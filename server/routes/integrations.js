const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ossService = require('../services/oss-service');

// ─── 附件上传配置 ─────────────────────────────────────────────────────────────
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/integration-attachments');
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
const upload = multer({ storage: uploadStorage, limits: { fileSize: 50 * 1024 * 1024 } });

async function ossUploadWithRetry(ossPath, localPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await ossService.client.put(ossPath, localPath); }
    catch (err) {
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000));
      else throw err;
    }
  }
}

// ─── GET /api/integrations ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, customer_id, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) { conditions.push('i.status = ?'); params.push(status); }
    if (customer_id) { conditions.push('i.customer_id = ?'); params.push(customer_id); }
    if (search) {
      conditions.push('(i.title LIKE ? OR i.responsible_person LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        i.*,
        c.name AS customer_name, c.short_name AS customer_short_name,
        COUNT(DISTINCT id2.device_id) AS device_count,
        COUNT(DISTINCT il.id) AS log_count
      FROM integrations i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN integration_devices id2 ON i.id = id2.integration_id
      LEFT JOIN integration_logs il ON i.id = il.integration_id
      ${where}
      GROUP BY i.id
      ORDER BY i.updated_at DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取系统对接列表失败:', error);
    res.status(500).json({ success: false, error: '获取系统对接列表失败' });
  }
});

// ─── POST /api/integrations ───────────────────────────────────────────────────
router.post('/',
  [
    body('title').notEmpty().withMessage('对接项目名称不能为空'),
    body('status').optional().isIn(['洽谈中', '对接中', '已完成', '暂停']).withMessage('状态值无效'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { title, customer_id, status = '洽谈中', description, responsible_person, started_at, completed_at, device_ids = [] } = req.body;

      const result = await query(
        `INSERT INTO integrations (title, customer_id, status, description, responsible_person, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, customer_id || null, status, description || null, responsible_person || null, started_at || null, completed_at || null]
      );
      const integrationId = result.insertId;

      if (device_ids.length > 0) {
        const vals = device_ids.map(did => [integrationId, did]);
        for (const [iid, did] of vals) {
          await query('INSERT IGNORE INTO integration_devices (integration_id, device_id) VALUES (?, ?)', [iid, did]);
        }
      }

      res.status(201).json({ success: true, data: { id: integrationId }, message: '系统对接创建成功' });
    } catch (error) {
      console.error('创建系统对接失败:', error);
      res.status(500).json({ success: false, error: '创建系统对接失败' });
    }
  }
);

// ─── GET /api/integrations/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await query(`
      SELECT i.*, c.name AS customer_name, c.short_name AS customer_short_name
      FROM integrations i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ success: false, error: '记录不存在' });

    const integration = rows[0];

    // 关联设备
    const devices = await query(`
      SELECT d.id, d.nickname, d.device_code, d.status, d.product_id,
             d.bundle_id, db2.bundle_code, db2.name AS bundle_name,
             p.name AS product_name, c2.name AS customer_name, c2.short_name AS customer_short_name,
             id2.added_at
      FROM integration_devices id2
      JOIN devices d ON id2.device_id = d.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN customers c2 ON d.customer_id = c2.id
      LEFT JOIN device_bundles db2 ON d.bundle_id = db2.id
      WHERE id2.integration_id = ?
      ORDER BY id2.added_at ASC
    `, [id]);

    // 跟进记录
    const logs = await query(`
      SELECT * FROM integration_logs WHERE integration_id = ? ORDER BY created_at DESC
    `, [id]);

    integration.devices = devices;

    // 跟进记录 + 刷新 OSS 签名 URL
    const refreshAtts = async (atts) => {
      if (!Array.isArray(atts) || !ossService.enabled) return atts;
      return Promise.all(atts.map(async att => {
        const ossPath = att.ossPath || (att.url && att.url.startsWith('oss://') ? att.url : null);
        if (ossPath) {
          try {
            const freshUrl = await ossService.getSignedUrl(ossPath, 3600 * 24 * 7, att.name);
            return { ...att, ossPath, url: freshUrl };
          } catch (_) { return att; }
        }
        return att;
      }));
    };

    integration.logs = await Promise.all(logs.map(async l => {
      const atts = l.attachments
        ? (typeof l.attachments === 'string' ? JSON.parse(l.attachments) : l.attachments)
        : [];
      return { ...l, attachments: await refreshAtts(atts) };
    }));

    res.json({ success: true, data: integration });
  } catch (error) {
    console.error('获取系统对接详情失败:', error);
    res.status(500).json({ success: false, error: '获取系统对接详情失败' });
  }
});

// ─── PUT /api/integrations/:id ───────────────────────────────────────────────
router.put('/:id',
  [body('status').optional().isIn(['洽谈中', '对接中', '已完成', '暂停']).withMessage('状态值无效')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { id } = req.params;
      const existing = await query('SELECT id FROM integrations WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ success: false, error: '记录不存在' });

      const allowedFields = ['title', 'customer_id', 'status', 'description', 'responsible_person', 'started_at', 'completed_at'];
      const updateFields = [];
      const updateValues = [];

      Object.keys(req.body).forEach(key => {
        if (!allowedFields.includes(key) || req.body[key] === undefined) return;
        updateFields.push(`${key} = ?`);
        updateValues.push(req.body[key] === '' ? null : req.body[key]);
      });

      if (updateFields.length === 0) return res.status(400).json({ success: false, error: '没有要更新的字段' });

      updateValues.push(id);
      await query(`UPDATE integrations SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, updateValues);

      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      console.error('更新系统对接失败:', error);
      res.status(500).json({ success: false, error: '更新系统对接失败' });
    }
  }
);

// ─── DELETE /api/integrations/:id ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT id FROM integrations WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: '记录不存在' });

    await query('DELETE FROM integration_logs WHERE integration_id = ?', [id]);
    await query('DELETE FROM integration_devices WHERE integration_id = ?', [id]);
    await query('DELETE FROM integrations WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除系统对接失败:', error);
    res.status(500).json({ success: false, error: '删除系统对接失败' });
  }
});

// ─── POST /api/integrations/:id/devices ──────────────────────────────────────
router.post('/:id/devices', async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id } = req.body;
    if (!device_id) return res.status(400).json({ success: false, error: 'device_id 不能为空' });

    const existing = await query('SELECT id FROM integrations WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: '记录不存在' });

    const device = await query('SELECT id FROM devices WHERE id = ?', [device_id]);
    if (device.length === 0) return res.status(400).json({ success: false, error: '设备不存在' });

    await query('INSERT IGNORE INTO integration_devices (integration_id, device_id) VALUES (?, ?)', [id, device_id]);
    await query('UPDATE integrations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    res.json({ success: true, message: '设备已添加' });
  } catch (error) {
    console.error('添加设备失败:', error);
    res.status(500).json({ success: false, error: '添加设备失败' });
  }
});

// ─── DELETE /api/integrations/:id/devices/:deviceId ──────────────────────────
router.delete('/:id/devices/:deviceId', async (req, res) => {
  try {
    const { id, deviceId } = req.params;
    await query('DELETE FROM integration_devices WHERE integration_id = ? AND device_id = ?', [id, deviceId]);
    await query('UPDATE integrations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    res.json({ success: true, message: '设备已移除' });
  } catch (error) {
    console.error('移除设备失败:', error);
    res.status(500).json({ success: false, error: '移除设备失败' });
  }
});

// ─── GET /api/integrations/:id/logs ──────────────────────────────────────────
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await query('SELECT * FROM integration_logs WHERE integration_id = ? ORDER BY created_at DESC', [id]);
    const data = await Promise.all(logs.map(async l => {
      const atts = l.attachments
        ? (typeof l.attachments === 'string' ? JSON.parse(l.attachments) : l.attachments)
        : [];
      const refreshed = ossService.enabled
        ? await Promise.all(atts.map(async att => {
            const ossPath = att.ossPath || (att.url && att.url.startsWith('oss://') ? att.url : null);
            if (ossPath) {
              try { return { ...att, ossPath, url: await ossService.getSignedUrl(ossPath, 3600 * 24 * 7, att.name) }; }
              catch (_) { return att; }
            }
            return att;
          }))
        : atts;
      return { ...l, attachments: refreshed };
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取跟进记录失败:', error);
    res.status(500).json({ success: false, error: '获取跟进记录失败' });
  }
});

// ─── POST /api/integrations/:id/logs ─────────────────────────────────────────
router.post('/:id/logs',
  [body('content').notEmpty().withMessage('跟进内容不能为空')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { id } = req.params;
      const { content, operator, attachments } = req.body;

      const existing = await query('SELECT id FROM integrations WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ success: false, error: '记录不存在' });

      const result = await query(
        'INSERT INTO integration_logs (integration_id, content, operator, attachments) VALUES (?, ?, ?, ?)',
        [id, content, operator || null, attachments ? JSON.stringify(attachments) : null]
      );
      await query('UPDATE integrations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

      const newLog = await query('SELECT * FROM integration_logs WHERE id = ?', [result.insertId]);
      const log = newLog[0];
      log.attachments = log.attachments ? (typeof log.attachments === 'string' ? JSON.parse(log.attachments) : log.attachments) : [];

      res.status(201).json({ success: true, data: log, message: '跟进记录已添加' });
    } catch (error) {
      console.error('添加跟进记录失败:', error);
      res.status(500).json({ success: false, error: '添加跟进记录失败' });
    }
  }
);

// ─── POST /api/integrations/upload-attachment ─────────────────────────────────
router.post('/upload-attachment', upload.array('files', 10), async (req, res) => {
  const uploaded = req.files || [];
  try {
    if (uploaded.length === 0) return res.status(400).json({ success: false, error: '没有上传文件' });

    const { integration_id } = req.body;
    const results = [];

    for (const file of uploaded) {
      let originalName;
      try { originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); }
      catch (e) { originalName = file.originalname; }

      let filePath = file.path;

      if (ossService.enabled) {
        try {
          const fileName = `${Date.now()}_${originalName}`;
          const ossKey = ossService.buildPathByType('integration-attachments', {
            integrationId: integration_id || 'pending',
            fileName
          });
          await ossUploadWithRetry(ossKey, file.path);
          filePath = `oss://${ossService.bucket}/${ossKey}`;
          try { fs.unlinkSync(file.path); } catch (_) {}
        } catch (err) {
          console.error('OSS上传失败，保留本地文件:', err.message);
        }
      }

      const stat = fs.existsSync(file.path) ? fs.statSync(file.path) : null;
      let url = filePath;
      if (filePath.startsWith('oss://')) {
        try { url = await ossService.getSignedUrl(filePath, 3600 * 24 * 7, originalName); }
        catch (e) { url = filePath; }
      } else {
        url = `/uploads/integration-attachments/${path.basename(filePath)}`;
      }
      results.push({
        name: originalName,
        url,
        ossPath: filePath.startsWith('oss://') ? filePath : undefined,
        size: stat ? stat.size : file.size,
        type: file.mimetype
      });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    for (const f of uploaded) { try { fs.unlinkSync(f.path); } catch (_) {} }
    console.error('上传附件失败:', error);
    res.status(500).json({ success: false, error: '上传附件失败' });
  }
});

module.exports = router;
