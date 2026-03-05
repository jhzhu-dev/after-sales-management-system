const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ossService = require('../services/oss-service');

// ─── 处理记录附件上传配置 ─────────────────────────────────────────────────────
const issueLogUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/issue-log-attachments');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    let safeName;
    try { safeName = Buffer.from(file.originalname, 'latin1').toString('utf8'); }
    catch (e) { safeName = file.originalname; }
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const issueLogUpload = multer({ storage: issueLogUploadStorage, limits: { fileSize: 50 * 1024 * 1024 } });

async function issueLogOssUploadWithRetry(ossPath, localPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await ossService.client.put(ossPath, localPath); }
    catch (err) {
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000));
      else throw err;
    }
  }
}

// ─── 启动时迁移：确保 attachments 列存在 ────────────────────────────────────
(async () => {
  try {
    await query('ALTER TABLE issue_logs ADD COLUMN attachments JSON');
    console.log('✅ issue_logs.attachments 列已添加');
  } catch (e) {
    // 1060 = ER_DUP_FIELDNAME (列已存在), 忽略即可
    if (e.errno === 1060 || (e.message && e.message.includes('Duplicate column'))) {
      console.log('✅ issue_logs.attachments 列已就绪');
    } else {
      console.error('issue_logs 迁移警告:', e.message);
    }
  }
})();

// POST /api/issue-logs/upload-attachment
router.post('/upload-attachment', issueLogUpload.array('files', 10), async (req, res) => {
  const uploaded = req.files || [];
  try {
    const { issue_id } = req.body;
    if (uploaded.length === 0)
      return res.status(400).json({ success: false, error: '没有上传文件' });

    // 查询问题关联的设备信息（含客户和产品信息，用于构建设备标识）
    let deviceInfo = null;
    if (issue_id) {
      const rows = await query(
        `SELECT i.id as issue_id,
                d.id, d.name,
                c.short_name as customer_short_name, c.name as customer_name,
                p.name as product_name
         FROM issues i
         LEFT JOIN devices d ON i.device_id = d.id
         LEFT JOIN customers c ON d.customer_id = c.id
         LEFT JOIN products p ON d.product_id = p.id
         WHERE i.id = ?`,
        [issue_id]
      );
      if (rows[0]) deviceInfo = rows[0];
    }

    const results = [];

    for (const file of uploaded) {
      let originalName;
      try { originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); }
      catch (e) { originalName = file.originalname; }

      let filePath = file.path;

      if (ossService.enabled) {
        try {
          // devices/{设备标识}/issues/{issue_id}/logs/{文件名}
          const device = deviceInfo || { id: 'unknown', name: 'unknown', customer_short_name: 'unknown', product_name: 'unknown' };
          const fileName = `${Date.now()}_${originalName}`;
          const ossKey = ossService.buildPathByType('issue-log-attachments', {
            device,
            issueId: issue_id || 'unknown',
            fileName
          });
          await issueLogOssUploadWithRetry(ossKey, file.path);
          filePath = `oss://${ossService.bucket}/${ossKey}`;
          try { fs.unlinkSync(file.path); } catch (_) {}
          console.log(`✅ 处理记录附件已上传OSS: ${filePath}`);
        } catch (err) {
          console.error('OSS上传失败，保留本地文件:', err.message);
        }
      }

      let url = filePath;
      if (filePath.startsWith('oss://')) {
        try { url = await ossService.getSignedUrl(filePath, 3600 * 24 * 7); }
        catch (e) { url = filePath; }
      } else {
        url = `/uploads/issue-log-attachments/${path.basename(filePath)}`;
      }

      results.push({ name: originalName, url, ossPath: filePath, size: file.size });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    uploaded.forEach(f => { try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_) {} });
    console.error('上传处理记录附件失败:', error);
    res.status(500).json({ success: false, error: '上传失败', message: error.message });
  }
});

// 获取指定问题的所有处理记录
router.get('/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;

    // 验证问题是否存在
    const issue = await query('SELECT id FROM issues WHERE id = ?', [issueId]);
    if (issue.length === 0) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }

    // 获取处理记录，按时间倒序
    const logs = await query(
      `SELECT id, issue_id, content, operator, attachments, created_at
      FROM issue_logs
      WHERE issue_id = ?
      ORDER BY created_at DESC`,
      [issueId]
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取处理记录失败:', error);
    res.status(500).json({ success: false, error: '获取处理记录失败' });
  }
});

// 创建处理记录
router.post('/', [
  body('issue_id').notEmpty().withMessage('问题ID不能为空'),
  body('content').notEmpty().withMessage('处理内容不能为空'),
  body('operator').optional().isString(),
  body('attachments').optional()
], async (req, res) => {
  try {
    // 验证请求
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { issue_id, content, operator, attachments } = req.body;

    // 验证问题是否存在
    const issue = await query('SELECT id FROM issues WHERE id = ?', [issue_id]);
    if (issue.length === 0) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }

    // 序列化附件
    const attachmentsJson = attachments
      ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments))
      : null;

    // 插入处理记录
    const result = await query(
      'INSERT INTO issue_logs (issue_id, content, operator, attachments) VALUES (?, ?, ?, ?)',
      [issue_id, content, operator || null, attachmentsJson]
    );

    // 获取新创建的记录
    const newLog = await query(
      'SELECT id, issue_id, content, operator, attachments, created_at FROM issue_logs WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: '处理记录创建成功',
      data: newLog[0]
    });
  } catch (error) {
    console.error('创建处理记录失败:', error);
    res.status(500).json({ success: false, error: '创建处理记录失败' });
  }
});

// 删除处理记录
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查记录是否存在
    const log = await query('SELECT id FROM issue_logs WHERE id = ?', [id]);
    if (log.length === 0) {
      return res.status(404).json({ success: false, error: '处理记录不存在' });
    }

    // 删除记录
    await query('DELETE FROM issue_logs WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '处理记录删除成功'
    });
  } catch (error) {
    console.error('删除处理记录失败:', error);
    res.status(500).json({ success: false, error: '删除处理记录失败' });
  }
});

module.exports = router;
