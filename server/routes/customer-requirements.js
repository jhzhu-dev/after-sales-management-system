const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ossService = require('../services/oss-service');

// ─── 附件上传配置 ──────────────────────────────────────────────────────────────
const cqUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/customer-requirement-attachments');
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
const cqUpload = multer({ storage: cqUploadStorage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB

// 允许的状态集合（用于校验）
const CQ_STATUSES = ['需求收集', '待评估', '已评估待开发', '开发中', '已开发待测试', '测试中', '已测试待发布', '已发布', '废弃'];
// 需求分类已支持自定义输入（VARCHAR），基础三分类仅作为前端建议项
const URGENCIES = ['低', '中', '高'];

// 生成需求编号：XQ-YYYYMMDD-NN（当日序号）。必须传 conn（在事务内调用，取最大序号）
async function generateReqCode(conn) {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `XQ-${yyyymmdd}-`;
  const [rows] = await conn.query(
    `SELECT MAX(CAST(SUBSTRING(req_code, CHAR_LENGTH(?) + 1) AS UNSIGNED)) AS maxNo
     FROM customer_requirements WHERE req_code LIKE ?`,
    [prefix, `${prefix}%`]
  );
  const maxNo = rows[0] && rows[0].maxNo ? Number(rows[0].maxNo) : 0;
  return `${prefix}${String(maxNo + 1).padStart(3, '0')}`;
}

// 统一返回错误
function fail(res, status, error, details) {
  return res.status(status).json({ success: false, error, ...(details ? { details } : {}) });
}

// GET /api/customer-requirements - 列表（分页 + 筛选）
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 10,
      customer_id, device_id, requirement_type, urgency, status,
      proposed_date_from, proposed_date_to, publish_time_from, publish_time_to,
      search, sortBy = 'created_at', sortOrder = 'DESC'
    } = req.query;

    const pageNum = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    const limitNum = Number.isInteger(parseInt(limit)) ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;

    const allowedSort = ['id', 'req_code', 'requirement_type', 'urgency', 'status', 'proposed_date', 'publish_time', 'created_at', 'updated_at'];
    const validSortBy = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where = [];
    const params = [];

    if (customer_id) { where.push('cr.customer_id = ?'); params.push(customer_id); }
    if (requirement_type) { where.push('cr.requirement_type = ?'); params.push(requirement_type); }
    if (urgency) { where.push('cr.urgency = ?'); params.push(urgency); }
    if (status) { where.push('cr.status = ?'); params.push(status); }
    if (proposed_date_from) { where.push('cr.proposed_date >= ?'); params.push(proposed_date_from); }
    if (proposed_date_to) { where.push('cr.proposed_date <= ?'); params.push(proposed_date_to); }
    if (publish_time_from) { where.push('cr.publish_time >= ?'); params.push(publish_time_from); }
    if (publish_time_to) { where.push('cr.publish_time <= ?'); params.push(publish_time_to); }
    if (search) {
      where.push('(cr.req_code LIKE ? OR cr.description LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (device_id) {
      where.push('EXISTS (SELECT 1 FROM customer_requirement_devices crd WHERE crd.requirement_id = cr.id AND crd.device_id = ?)');
      params.push(device_id);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const listSql = `
      SELECT cr.*, c.name AS customer_name, c.short_name AS customer_short_name,
             (SELECT GROUP_CONCAT(d.name ORDER BY d.name SEPARATOR '、')
              FROM customer_requirement_devices crd
              JOIN devices d ON d.id = crd.device_id
              WHERE crd.requirement_id = cr.id) AS device_names,
             (SELECT COUNT(*) FROM customer_requirement_devices crd WHERE crd.requirement_id = cr.id) AS device_count
      FROM customer_requirements cr
      LEFT JOIN customers c ON c.id = cr.customer_id
      ${whereClause}
      ORDER BY cr.${validSortBy} ${validSortOrder}
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;

    const rows = await query(listSql, params);

    const countSql = `SELECT COUNT(*) AS total FROM customer_requirements cr ${whereClause}`;
    const countRows = await query(countSql, params);
    const total = countRows[0] ? countRows[0].total : 0;

    res.json({ success: true, data: rows, total, page: pageNum, pageSize: limitNum });
  } catch (error) {
    console.error('获取需求列表失败:', error);
    fail(res, 500, '获取需求列表失败');
  }
});

// GET /api/customer-requirements/categories - 历史使用过的需求分类（去重，供表单建议；必须在 /:id 之前注册）
router.get('/categories', async (req, res) => {
  try {
    const rows = await query(
      `SELECT requirement_type AS name, COUNT(*) AS count
       FROM customer_requirements
       WHERE requirement_type IS NOT NULL AND requirement_type <> ''
       GROUP BY requirement_type
       ORDER BY count DESC, name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取需求分类失败:', error);
    fail(res, 500, '获取需求分类失败');
  }
});

// GET /api/customer-requirements/:id - 详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const mainRows = await query(
      `SELECT cr.*, c.name AS customer_name, c.short_name AS customer_short_name
       FROM customer_requirements cr
       LEFT JOIN customers c ON c.id = cr.customer_id
       WHERE cr.id = ?`, [id]
    );
    if (mainRows.length === 0) return fail(res, 404, '需求不存在');

    const devices = await query(
      `SELECT d.id, d.name, d.nickname FROM customer_requirement_devices crd
       JOIN devices d ON d.id = crd.device_id
       WHERE crd.requirement_id = ? ORDER BY d.name`, [id]
    );
    const attachments = await query(
      'SELECT * FROM customer_requirement_attachments WHERE requirement_id = ? ORDER BY created_at DESC', [id]
    );
    const logs = await query(
      'SELECT * FROM customer_requirement_logs WHERE requirement_id = ? ORDER BY created_at ASC', [id]
    );

    res.json({ success: true, data: { ...mainRows[0], devices, attachments, logs } });
  } catch (error) {
    console.error('获取需求详情失败:', error);
    fail(res, 500, '获取需求详情失败');
  }
});

// POST /api/customer-requirements - 新增需求
router.post('/', [
  body('customer_id').notEmpty().withMessage('客户名称必填'),
  body('requirement_type').trim().notEmpty().withMessage('请填写需求分类').isLength({ max: 50 }).withMessage('需求分类不能超过50字'),
  body('proposed_date').notEmpty().withMessage('需求提出日期必填'),
  body('description').notEmpty().withMessage('需求详情描述必填'),
  body('device_ids').optional().isArray().withMessage('设备列表格式错误')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return fail(res, 400, '输入数据无效', errors.array());

    const { customer_id, requirement_type, proposed_date, urgency = '中', description, remarks, device_ids = [] } = req.body;
    const createdBy = (req.user && req.user.username) || 'system';

    if (!Array.isArray(device_ids) || device_ids.length === 0) {
      return fail(res, 400, '请至少选择一台涉及设备');
    }

    // 自动生成编号 + 写主表/关联表（事务内取号，避免并发撞号）
    let result;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = await transaction(async (conn) => {
          const reqCode = await generateReqCode(conn);
          const [ins] = await conn.query(
            `INSERT INTO customer_requirements
             (req_code, customer_id, requirement_type, proposed_date, urgency, description, remarks, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [reqCode, customer_id, requirement_type, proposed_date, urgency, description, remarks || null, createdBy]
          );
          const requirementId = ins.insertId;
          for (const deviceId of device_ids) {
            await conn.query(
              'INSERT INTO customer_requirement_devices (requirement_id, device_id) VALUES (?, ?)',
              [requirementId, deviceId]
            );
          }
          return { requirementId, reqCode };
        });
        break;
      } catch (e) {
        // 编号撞唯一约束时重试；其他错误直接抛出
        if (e.code === 'ER_DUP_ENTRY' && attempt < maxRetries) {
          console.warn('需求编号撞号，重试生成:', e.message);
          continue;
        }
        throw e;
      }
    }

    res.status(201).json({ success: true, message: '需求登记成功', data: result });
  } catch (error) {
    console.error('新增需求失败:', error);
    fail(res, 500, '新增需求失败');
  }
});

// PUT /api/customer-requirements/:id - 编辑需求
router.put('/:id', [
  body('customer_id').optional().notEmpty(),
  body('requirement_type').optional().trim().notEmpty().isLength({ max: 50 }),
  body('proposed_date').optional().notEmpty(),
  body('description').optional().notEmpty(),
  body('device_ids').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return fail(res, 400, '输入数据无效', errors.array());

    const { id } = req.params;
    const updatedBy = (req.user && req.user.username) || 'system';

    const existing = await query('SELECT * FROM customer_requirements WHERE id = ?', [id]);
    if (existing.length === 0) return fail(res, 404, '需求不存在');

    // 已发布/废弃状态限制编辑范围
    const curStatus = existing[0].status;
    if (['已发布', '废弃'].includes(curStatus)) {
      return fail(res, 400, `当前状态为「${curStatus}」，不允许编辑，请重新登记新需求`);
    }

    const { customer_id, requirement_type, proposed_date, urgency, description, remarks, device_ids } = req.body;

    const updateFields = [];
    const updateValues = [];
    if (customer_id !== undefined) { updateFields.push('customer_id = ?'); updateValues.push(customer_id); }
    if (requirement_type !== undefined) { updateFields.push('requirement_type = ?'); updateValues.push(requirement_type); }
    if (proposed_date !== undefined) { updateFields.push('proposed_date = ?'); updateValues.push(proposed_date); }
    if (urgency !== undefined) { updateFields.push('urgency = ?'); updateValues.push(urgency); }
    if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
    if (remarks !== undefined) { updateFields.push('remarks = ?'); updateValues.push(remarks); }
    if (updateFields.length > 0) {
      updateFields.push('updated_by = ?'); updateValues.push(updatedBy);
      updateValues.push(id);
      await query(`UPDATE customer_requirements SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
    }

    // 更新设备关联（若传入）
    if (Array.isArray(device_ids)) {
      await transaction(async (conn) => {
        await conn.query('DELETE FROM customer_requirement_devices WHERE requirement_id = ?', [id]);
        for (const deviceId of device_ids) {
          await conn.query('INSERT INTO customer_requirement_devices (requirement_id, device_id) VALUES (?, ?)', [id, deviceId]);
        }
      });
    }

    res.json({ success: true, message: '需求更新成功' });
  } catch (error) {
    console.error('更新需求失败:', error);
    fail(res, 500, '更新需求失败');
  }
});

// PUT /api/customer-requirements/:id/status - 状态流转（允许跳级/回退，须填原因）
router.put('/:id/status', [
  body('status').isIn(CQ_STATUSES).withMessage('目标状态非法'),
  body('reason').notEmpty().withMessage('状态流转必须填写原因'),
  body('operator').notEmpty().withMessage('状态流转必须填写登记人名字')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return fail(res, 400, '输入数据无效', errors.array());

    const { id } = req.params;
    const { status, reason, operator } = req.body;
    const resolvedOperator = (operator && operator.trim()) || (req.user && req.user.username) || 'system';
    const publish_version = req.body.publish_version;
    const publish_time = req.body.publish_time;
    const deprecated_reason = req.body.deprecated_reason;

    const existing = await query('SELECT * FROM customer_requirements WHERE id = ?', [id]);
    if (existing.length === 0) return fail(res, 404, '需求不存在');

    const fromStatus = existing[0].status;
    if (fromStatus === status) return fail(res, 400, '状态未发生变化');

    // 条件必填校验
    if (status === '已发布') {
      if (!publish_version || !publish_time) return fail(res, 400, '进入「已发布」需填写发布版本号与发布时间');
    }
    if (status === '废弃') {
      if (!deprecated_reason) return fail(res, 400, '废弃需求必须填写废弃原因');
    }

    await transaction(async (conn) => {
      await conn.query(
        `UPDATE customer_requirements SET status = ?, publish_version = ?, publish_time = ?, deprecated_reason = ?, updated_by = ? WHERE id = ?`,
        [
          status,
          status === '已发布' ? (publish_version || null) : existing[0].publish_version,
          status === '已发布' ? (publish_time || null) : existing[0].publish_time,
          status === '废弃' ? (deprecated_reason || null) : existing[0].deprecated_reason,
          resolvedOperator,
          id
        ]
      );
      await conn.query(
        `INSERT INTO customer_requirement_logs (requirement_id, from_status, to_status, operator, remark) VALUES (?, ?, ?, ?, ?)`,
        [id, fromStatus, status, resolvedOperator, reason]
      );
    });

    res.json({ success: true, message: '状态流转成功' });
  } catch (error) {
    console.error('状态流转失败:', error);
    fail(res, 500, '状态流转失败');
  }
});

// POST /api/customer-requirements/:id/attachments - 上传附件
router.post('/:id/attachments', cqUpload.array('files', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const uploadedBy = (req.user && req.user.username) || 'system';
    const uploaded = req.files || [];

    const exists = await query('SELECT id FROM customer_requirements WHERE id = ?', [id]);
    if (exists.length === 0) {
      uploaded.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) {} });
      return fail(res, 404, '需求不存在');
    }
    if (uploaded.length === 0) return fail(res, 400, '没有上传文件');

    const category = req.body.status || req.body.category || null;

    const results = [];
    for (const file of uploaded) {
      let originalName;
      try { originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); }
      catch (e) { originalName = file.originalname; }

      let filePath = file.path;
      if (ossService.enabled) {
        try {
          const fileName = `${Date.now()}_${originalName}`;
          const ossKey = ossService.buildPathByType('customer-requirement-attachments', { requirementId: id, fileName });
          await ossService.client.put(ossKey, file.path);
          filePath = `oss://${ossService.bucket}/${ossKey}`;
          try { fs.unlinkSync(file.path); } catch (_) {}
          console.log(`✅ 需求附件已上传OSS: ${filePath}`);
        } catch (err) {
          console.error('OSS上传失败，保留本地文件:', err.message);
        }
      }

      const fileType = path.extname(originalName).replace('.', '').toLowerCase();
      const ins = await query(
        `INSERT INTO customer_requirement_attachments (requirement_id, status, file_name, original_name, file_path, file_size, file_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, category, path.basename(filePath), originalName, filePath, file.size, fileType, uploadedBy]
      );
      results.push({ id: ins.insertId, requirement_id: id, status: category, original_name: originalName, file_path: filePath, file_size: file.size, file_type: fileType });
    }

    res.status(201).json({ success: true, message: '附件上传成功', data: results });
  } catch (error) {
    console.error('上传附件失败:', error);
    fail(res, 500, '上传附件失败');
  }
});

// GET /api/customer-requirements/attachments/:attId/download - 下载/预览
router.get('/attachments/:attId/download', async (req, res) => {
  try {
    const { attId } = req.params;
    const rows = await query('SELECT * FROM customer_requirement_attachments WHERE id = ?', [attId]);
    if (rows.length === 0) return fail(res, 404, '附件不存在');
    const att = rows[0];

    if (ossService.isOSSPath(att.file_path)) {
      try {
        const signedUrl = await ossService.getSignedUrl(att.file_path, 3600, att.original_name);
        return res.redirect(signedUrl);
      } catch (ossError) {
        console.error('生成OSS下载链接失败:', ossError);
        return fail(res, 500, '生成下载链接失败');
      }
    }

    if (!fs.existsSync(att.file_path)) return fail(res, 404, '文件不存在');
    if (req.query.inline) {
      res.setHeader('Content-Disposition', 'inline');
      return res.sendFile(att.file_path);
    }
    res.download(att.file_path, att.original_name);
  } catch (error) {
    console.error('下载附件失败:', error);
    fail(res, 500, '下载附件失败');
  }
});

// DELETE /api/customer-requirements/attachments/:attId - 删除附件
router.delete('/attachments/:attId', async (req, res) => {
  try {
    const { attId } = req.params;
    const rows = await query('SELECT * FROM customer_requirement_attachments WHERE id = ?', [attId]);
    if (rows.length === 0) return fail(res, 404, '附件不存在');
    const att = rows[0];

    await query('DELETE FROM customer_requirement_attachments WHERE id = ?', [attId]);

    if (!ossService.isOSSPath(att.file_path) && fs.existsSync(att.file_path)) {
      try { fs.unlinkSync(att.file_path); } catch (_) {}
    } else if (ossService.isOSSPath(att.file_path)) {
      try { await ossService.client.delete(att.file_path.replace(/^oss:\/\/[^/]+\//, '')); } catch (e) { console.warn('删除OSS对象失败:', e.message); }
    }

    res.json({ success: true, message: '附件删除成功' });
  } catch (error) {
    console.error('删除附件失败:', error);
    fail(res, 500, '删除附件失败');
  }
});

module.exports = router;
