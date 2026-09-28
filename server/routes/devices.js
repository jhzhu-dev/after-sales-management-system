const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database');
const router = express.Router();
const feishuService = require('../services/feishu-service');

// 获取所有设备
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status, search, device_code, bundle_id, unbundled } = req.query;


    // 参数验证
    const pageNum = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    const limitNum = Number.isInteger(parseInt(limit)) ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let params = [];

    if (type) {
      whereConditions.push('pl.name = ?');
      params.push(type);
    }

    if (status) {
      whereConditions.push('d.status = ?');
      params.push(status);
    }

    if (search) {
      whereConditions.push('(d.name LIKE ? OR d.id LIKE ? OR d.device_code LIKE ? OR c.name LIKE ? OR d.remote_code LIKE ? OR p.name LIKE ? OR d.nickname LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (device_code) {
      whereConditions.push('d.device_code LIKE ?');
      params.push(`%${device_code}%`);
    }

    if (bundle_id) {
      whereConditions.push('d.bundle_id = ?');
      params.push(bundle_id);
    }

    if (unbundled === 'true') {
      whereConditions.push('d.bundle_id IS NULL');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 获取设备列表
    const devicesQuery = `
      SELECT 
        d.id, d.name, d.nickname, d.device_code, d.product_line_id,
        d.product_id, d.customer_id, d.location,
        d.status, d.remote_code, d.password, d.notes, d.bundle_id,
        d.factory_docs_complete, d.factory_docs_completed_at, d.factory_docs_completed_by, d.shipped_at,
        d.created_at, d.updated_at,
        pl.name as product_line_name,
        p.name as product_name,
        p.model as product_model,
        c.name as customer_name,
        c.short_name as customer_short_name,
        db.id as bundle_id_val,
        db.bundle_code,
        db.name as bundle_name,
        COUNT(DISTINCT i.id) as issue_count,
        COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) as open_issues,
        (SELECT mv.version_number
         FROM modules m2
         JOIN module_versions mv ON mv.module_id = m2.id
         WHERE m2.device_id = d.id AND m2.type_id = 437838
         ORDER BY mv.created_at DESC
         LIMIT 1) as mechanical_version,
        (SELECT COUNT(*) FROM modules m3 WHERE m3.device_id = d.id) as module_total,
        (SELECT COUNT(DISTINCT m4.id) FROM modules m4
         WHERE m4.device_id = d.id
           AND EXISTS (SELECT 1 FROM module_versions mv4 WHERE mv4.module_id = m4.id)
        ) as module_versioned
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN device_bundles db ON d.bundle_id = db.id
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
      ${whereClause}
      GROUP BY d.id, pl.name, p.name, p.model, c.name, c.short_name, db.id, db.bundle_code, db.name
      ORDER BY d.name DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;

    const devices = await query(devicesQuery, params);

    // 获取总数
    const countQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN customers c ON d.customer_id = c.id
      ${whereClause}
    `;

    const countResult = await query(countQuery, params);
    const { total } = countResult[0];

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({ success: false, error: '获取设备列表失败' });
  }
});

// 获取单个设备详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取设备基本信息
    const deviceQuery = `
    SELECT
    d.id, d.name, d.nickname, d.device_code, d.product_line_id,
    d.product_id, d.customer_id, d.location,
    d.status, d.remote_code, d.password, d.merchant_id, d.merchant_password, d.notes, d.bundle_id,
    d.factory_docs_complete, d.factory_docs_completed_at, d.factory_docs_completed_by, d.shipped_at,
    d.created_at, d.updated_at,
    pl.name as product_line_name,
      p.name as product_name,
      p.model as product_model,
      c.name as customer_name,
      c.short_name as customer_short_name,
      db.id as bundle_id_val,
      db.bundle_code,
      db.name as bundle_name,
      COUNT(DISTINCT i.id) as issue_count
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN device_bundles db ON d.bundle_id = db.id
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
      WHERE d.id = ?
      GROUP BY d.id, pl.name, p.name, p.model, c.name, c.short_name, db.id, db.bundle_code, db.name
        `;

    const deviceResult = await query(deviceQuery, [id]);
    const device = deviceResult[0];

    if (!device) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }

    // 获取设备模块
    const modulesQuery = `
    SELECT
    m.*,
      mt.name as module_type,
      mv.version_number as current_version,
      mv.version_type as current_version_type
      FROM modules m
      LEFT JOIN module_types mt ON m.type_id = mt.id
      LEFT JOIN module_versions mv ON m.id = mv.module_id
      WHERE m.device_id = ?
      ORDER BY CASE
        WHEN mt.name LIKE '%机械%' THEN 0
        WHEN mt.name LIKE '%电气%' THEN 1
        WHEN mt.name LIKE '%上位%' THEN 2
        WHEN mt.name LIKE '%视觉%' THEN 3
        WHEN mt.name LIKE '%服务器%' THEN 4
        WHEN mt.name LIKE '%车牌%' THEN 5
        ELSE 6
      END, mt.name
        `;

    const modules = await query(modulesQuery, [id]);

    // 获取设备问题
    const issuesQuery = `
    SELECT
    i.*,
      mt.name as module_category
      FROM issues i
      LEFT JOIN modules m ON i.module_id = m.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      WHERE i.device_id = ?
      ORDER BY i.created_at DESC
        `;

    const issues = await query(issuesQuery, [id]);

    res.json({
      success: true,
      data: {
        ...device,
        modules,
        issues
      }
    });
  } catch (error) {
    console.error('获取设备详情失败:', error);
    res.status(500).json({ success: false, error: '获取设备详情失败' });
  }
});

// 创建设备
// 设备发货：仅「生产中」状态且出厂资料完善时允许
router.post('/:id/ship', async (req, res) => {
  try {
    const { id } = req.params;
    const deviceResult = await query('SELECT id, status, factory_docs_complete FROM devices WHERE id = ?', [id]);
    const device = deviceResult[0];
    if (!device) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }
    if (device.status !== '生产中') {
      return res.status(400).json({ success: false, error: '仅「生产中」状态的设备可以发货' });
    }
    const docsComplete = device.factory_docs_complete === true
      || device.factory_docs_complete === 1
      || device.factory_docs_complete === '1';
    if (!docsComplete) {
      return res.status(400).json({ success: false, error: '出厂资料未完善，无法发货' });
    }
    await query(
      `UPDATE devices SET status = '已发货', shipped_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [id]
    );
    const updatedResult = await query('SELECT * FROM devices WHERE id = ?', [id]);

    // ── 飞书催填版本号通知（异步，不阻塞响应）──
    const { notify_open_ids } = req.body;
    const recipientIds = Array.isArray(notify_open_ids) ? notify_open_ids.filter(Boolean) : [];
    if (recipientIds.length > 0) {
      const feishuService = require('../services/feishu-service');
      query(`SELECT d.*, pl.name as product_line_name, p.model as product_model, c.name as customer_name
             FROM devices d
             LEFT JOIN product_lines pl ON d.product_line_id = pl.id
             LEFT JOIN products p ON d.product_id = p.id
             LEFT JOIN customers c ON d.customer_id = c.id
             WHERE d.id = ?`, [id])
        .then(rows => {
          if (rows[0]) feishuService.sendShipNotification(rows[0], recipientIds);
        })
        .catch(() => {});
    }

    res.json({ success: true, data: updatedResult[0], message: '设备已标记为已发货' });
  } catch (error) {
    console.error('设备发货失败:', error);
    res.status(500).json({ success: false, error: '设备发货失败' });
  }
});

// 创建设备
router.post('/', [
  body('id').optional({ nullable: true }).isString().withMessage('设备ID必须是字符串'),
  body('name').optional({ nullable: true }).isString().withMessage('订单号必须是字符串'),
  body('product_line_id')
    .exists({ checkFalsy: true }).withMessage('产品线不能为空')
    .bail()
    .isInt().withMessage('产品线ID必须是整数')
    .toInt(),
  body('product_id').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('产品ID必须是整数').toInt(),
  body('customer_id').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('客户ID必须是整数').toInt(),
  body('status').optional({ nullable: true }).isIn(['生产中', '已发货', '使用中(正常)', '使用中(异常)', '已停用', '正常']).withMessage('状态必须是：生产中、已发货、使用中(正常)、使用中(异常)或已停用'),
  body('remote_code').optional({ nullable: true }).isString().withMessage('远程码必须是字符串'),
  body('password').optional({ nullable: true }).isString().withMessage('密码必须是字符串')
], async (req, res) => {
  try {
    console.log('收到创建设备请求:', req.body);
    // 兼容旧前端：将单独的"正常"状态规范化为"使用中(正常)"
    if (req.body.status === '正常') req.body.status = '使用中(正常)';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const details = errors.array();
      console.log('验证失败:', details);
      return res.status(400).json({
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: details[0]?.msg || '输入数据无效',
        details
      });
    }

    let { id, name, device_code, product_line_id, product_id, customer_id, status = '使用中(正常)', remote_code, password, merchant_id, merchant_password, notes } = req.body;

    // 统一去除首尾空格，避免因空格绕过重复校验
    const trimStr = (v) => (typeof v === 'string' ? v.trim() : v);
    id = trimStr(id);
    name = trimStr(name);
    device_code = trimStr(device_code);
    remote_code = trimStr(remote_code);
    password = trimStr(password);
    merchant_id = trimStr(merchant_id);
    merchant_password = trimStr(merchant_password);
    notes = trimStr(notes);

    // 字段长度前置校验（与表结构一致，避免 ER_DATA_TOO_LONG 抛出无明确提示的500）
    if (id && id.length > 50) {
      return res.status(400).json({ success: false, error_code: 'DEVICE_ID_TOO_LONG', error: '生产序列号长度不能超过50个字符' });
    }
    if (device_code && device_code.length > 100) {
      return res.status(400).json({ success: false, error_code: 'DEVICE_CODE_TOO_LONG', error: '设备编码长度不能超过100个字符' });
    }
    if (remote_code && remote_code.length > 100) {
      return res.status(400).json({ success: false, error_code: 'REMOTE_CODE_TOO_LONG', error: '远程码长度不能超过100个字符' });
    }
    if (name && name.length > 255) {
      return res.status(400).json({ success: false, error: '订单号长度不能超过255个字符' });
    }

    // 如果提供了ID，使用用户提供的ID，否则自动生成
    let deviceId = id;
    if (!deviceId) {
      const IDGenerator = require('../../id-generator');
      const idGenerator = new IDGenerator();
      const maxRetries = 8;
      for (let i = 0; i < maxRetries; i++) {
        const candidate = idGenerator.generate();
        const existing = await query('SELECT id FROM devices WHERE id = ?', [candidate]);
        if (existing.length === 0) {
          deviceId = candidate;
          break;
        }
      }

      if (!deviceId) {
        return res.status(503).json({ success: false, error_code: 'DEVICE_ID_GENERATION_FAILED', error: '自动生成设备ID失败，请重试' });
      }
    } else {
      // 检查生产序列号是否已存在（附带客户信息，便于在设备列表中定位冲突记录）
      const existingDevice = await query(
        `SELECT d.id, c.name AS customer_name
         FROM devices d LEFT JOIN customers c ON c.id = d.customer_id
         WHERE d.id = ?`,
        [deviceId]
      );
      if (existingDevice.length > 0) {
        const owner = existingDevice[0].customer_name ? `（客户：${existingDevice[0].customer_name}）` : '';
        return res.status(400).json({
          success: false,
          error_code: 'DEVICE_ID_DUPLICATED',
          error: `生产序列号 "${deviceId}" 已存在${owner}，请勿重复录入，可在设备列表搜索该序列号定位已有设备`,
          data: { id: deviceId }
        });
      }
    }

    // 检查设备编码是否已被其他设备占用（问题单导入按设备编码匹配设备，重复会导致匹配错乱）
    if (device_code) {
      const dupCode = await query(
        `SELECT d.id, c.name AS customer_name
         FROM devices d LEFT JOIN customers c ON c.id = d.customer_id
         WHERE d.device_code = ?`,
        [device_code]
      );
      if (dupCode.length > 0) {
        const owner = dupCode[0].customer_name ? `（客户：${dupCode[0].customer_name}）` : '';
        return res.status(400).json({
          success: false,
          error_code: 'DEVICE_CODE_DUPLICATED',
          error: `设备编码 "${device_code}" 已被设备 ${dupCode[0].id}${owner} 使用，请勿重复录入`,
          data: { device_code, device_id: dupCode[0].id }
        });
      }
    }

    // 远程码允许重复（多合一设备的多台成员设备可能共用同一远程码），此处不做唯一校验

    // 检查产品线是否存在
    const productLine = await query('SELECT id FROM product_lines WHERE id = ?', [product_line_id]);
    if (productLine.length === 0) {
      return res.status(400).json({ success: false, error_code: 'PRODUCT_LINE_NOT_FOUND', error: '所选产品线不存在或已被删除，请刷新后重新选择', data: { product_line_id } });
    }

    // 检查客户是否存在
    if (customer_id) {
      const customer = await query('SELECT id FROM customers WHERE id = ?', [customer_id]);
      if (customer.length === 0) {
        return res.status(400).json({ success: false, error_code: 'CUSTOMER_NOT_FOUND', error: '所选客户不存在或已被删除，请刷新后重新选择' });
      }
    }

    // 检查产品型号是否存在且属于所选产品线
    if (product_id) {
      const product = await query('SELECT id, product_line_id FROM products WHERE id = ?', [product_id]);
      if (product.length === 0) {
        return res.status(400).json({ success: false, error_code: 'PRODUCT_NOT_FOUND', error: '所选产品型号不存在或已停用，请刷新后重新选择' });
      }
      if (product[0].product_line_id !== product_line_id) {
        return res.status(400).json({ success: false, error_code: 'PRODUCT_LINE_MISMATCH', error: '所选产品型号与产品线不匹配，请重新选择产品型号' });
      }
    }

    const insertQuery = `
      INSERT INTO devices(id, name, nickname, device_code, product_line_id, product_id, customer_id, status, remote_code, password, merchant_id, merchant_password, notes)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // 自动生成设备俗称：{客户中文名称}{产品简称}{生产序列号末2位数字}号
    let nickname = null;
    try {
      let customerName = '';
      let productShort = '';
      if (customer_id) {
        const cRows = await query('SELECT name FROM customers WHERE id = ?', [customer_id]);
        if (cRows.length > 0) customerName = cRows[0].name || '';
      }
      if (product_id) {
        const pRows = await query('SELECT short_name FROM products WHERE id = ?', [product_id]);
        if (pRows.length > 0) productShort = pRows[0].short_name || '';
      }
      // 从生产序列号中提取所有数字，取最后4位；若序列号无数字则从订单号(name)中提取
      let idSuffix = '';
      if (deviceId) {
        const digits = deviceId.replace(/\D/g, '');
        idSuffix = digits.length >= 4 ? digits.slice(-4) : digits;
      }
      if (!idSuffix && name) {
        const digits = name.replace(/\D/g, '');
        idSuffix = digits.length >= 4 ? digits.slice(-4) : digits;
      }
      if (customerName && productShort && idSuffix) {
        nickname = `${customerName}${productShort}${idSuffix}`;
      }
    } catch (e) {
      console.warn('生成设备俗称失败:', e.message);
    }

    try {
      await query(insertQuery, [deviceId, name ?? null, nickname, device_code || null, product_line_id, product_id || null, customer_id || null, status, remote_code || null, password || null, merchant_id || null, merchant_password || null, notes || null]);
    } catch (e) {
      // 并发录入等场景下前置校验后仍可能触发唯一键冲突，需给出具体提示而非500
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, error_code: 'DEVICE_ID_DUPLICATED', error: `生产序列号 "${deviceId}" 已存在，请勿重复录入` });
      }
      if (e.code === 'ER_DATA_TOO_LONG') {
        return res.status(400).json({ success: false, error: '提交内容过长，请检查生产序列号、设备编码、远程码等字段长度' });
      }
      throw e;
    }

    // ── 飞书通知（异步，支持多人）──
    const { notify_open_id, notify_open_ids, send_notify } = req.body;
    // 合并单值与数组，兼容旧格式
    const recipientIds = [
      ...(Array.isArray(notify_open_ids) ? notify_open_ids : []),
      ...(notify_open_id && !Array.isArray(notify_open_ids) ? [notify_open_id] : [])
    ].filter(Boolean);

    if (send_notify && recipientIds.length > 0) {
      query(`SELECT d.*, pl.name as product_line_name, p.model as product_model, c.name as customer_name
             FROM devices d
             LEFT JOIN product_lines pl ON d.product_line_id = pl.id
             LEFT JOIN products p ON d.product_id = p.id
             LEFT JOIN customers c ON d.customer_id = c.id
             WHERE d.id = ?`, [deviceId])
        .then(rows => {
          if (rows[0]) {
            // 每台设备只发一条消息，同时 @ 所有相关人员
            feishuService.sendDeviceNotification(rows[0], recipientIds);
          }
        })
        .catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: '设备创建成功',
      data: { id: deviceId, name, nickname, device_code, product_line_id, product_id, customer_id, status, remote_code, password, merchant_id, merchant_password }
    });
  } catch (error) {
    console.error('创建设备失败:', error);
    res.status(500).json({ success: false, error: '创建设备失败' });
  }
});

// 更新设备
router.put('/:id', [
  body('name').optional({ nullable: true, checkFalsy: true }),  // 订单号允许为空/null
  body('product_line_id').optional().isInt().withMessage('产品线ID必须是整数'),
  body('customer_id').optional({ nullable: true }).isInt().withMessage('客户ID必须是整数'),
  body('status').optional({ nullable: true }).isIn(['生产中', '已发货', '使用中(正常)', '使用中(异常)', '已停用', '正常']).withMessage('状态必须是：生产中、已发货、使用中(正常)、使用中(异常)或已停用'),
  body('remote_code').optional({ nullable: true }).isString().withMessage('远程码必须是字符串'),
  body('password').optional({ nullable: true }).isString().withMessage('密码必须是字符串')
], async (req, res) => {
  try {
    // 兼容旧前端：将单独的"正常"状态规范化为"使用中(正常)"
    if (req.body.status === '正常') req.body.status = '使用中(正常)';
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: '输入数据无效',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // 检查设备是否存在
    const existingDevice = await query('SELECT id, customer_id, product_id, bundle_id, status, device_code, remote_code FROM devices WHERE id = ?', [id]);
    if (existingDevice.length === 0) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }

    // 多合一成员设备的客户由多合一设备统一管理
    if (updates.customer_id !== undefined && updates.customer_id !== existingDevice[0].customer_id && existingDevice[0].bundle_id) {
      return res.status(400).json({ success: false, error: '该设备属于多合一设备，请通过编辑多合一设备修改客户' });
    }

    // 如果更新产品线，检查是否存在
    if (updates.product_line_id) {
      const productLine = await query('SELECT id FROM product_lines WHERE id = ?', [updates.product_line_id]);
      if (productLine.length === 0) {
        return res.status(400).json({ success: false, error: '产品线不存在' });
      }
    }

    // 提取new_id（如果要修改序列号）
    let newId = typeof updates.new_id === 'string' ? updates.new_id.trim() : updates.new_id;
    delete updates.new_id;

    // 如果要修改序列号，检查长度与新ID是否已存在
    if (newId && newId !== id) {
      if (newId.length > 50) {
        return res.status(400).json({ success: false, error_code: 'DEVICE_ID_TOO_LONG', error: '生产序列号长度不能超过50个字符' });
      }
      const existingNew = await query(
        `SELECT d.id, c.name AS customer_name
         FROM devices d LEFT JOIN customers c ON c.id = d.customer_id
         WHERE d.id = ?`,
        [newId]
      );
      if (existingNew.length > 0) {
        const owner = existingNew[0].customer_name ? `（客户：${existingNew[0].customer_name}）` : '';
        return res.status(400).json({
          success: false,
          error_code: 'DEVICE_ID_DUPLICATED',
          error: `生产序列号 "${newId}" 已存在${owner}，无法修改为该序列号`,
          data: { id: newId }
        });
      }
    }

    // 字符串字段去除首尾空格
    ['name', 'device_code', 'remote_code', 'password', 'merchant_id', 'merchant_password', 'notes', 'nickname'].forEach(k => {
      if (typeof updates[k] === 'string') updates[k] = updates[k].trim();
    });

    // 长度校验
    if (updates.device_code && updates.device_code.length > 100) {
      return res.status(400).json({ success: false, error_code: 'DEVICE_CODE_TOO_LONG', error: '设备编码长度不能超过100个字符' });
    }
    if (updates.remote_code && updates.remote_code.length > 100) {
      return res.status(400).json({ success: false, error_code: 'REMOTE_CODE_TOO_LONG', error: '远程码长度不能超过100个字符' });
    }
    if (updates.name && updates.name.length > 255) {
      return res.status(400).json({ success: false, error: '订单号长度不能超过255个字符' });
    }

    // 只允许更新存在的字段（白名单）
    const allowedFields = ['name', 'nickname', 'device_code', 'product_line_id', 'product_id', 'customer_id', 'status', 'remote_code', 'password', 'merchant_id', 'merchant_password', 'notes', 'factory_docs_complete', 'is_primary'];
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    });

    // 客户/产品型号存在性校验
    if (filteredUpdates.customer_id) {
      const customer = await query('SELECT id FROM customers WHERE id = ?', [filteredUpdates.customer_id]);
      if (customer.length === 0) {
        return res.status(400).json({ success: false, error_code: 'CUSTOMER_NOT_FOUND', error: '所选客户不存在或已被删除，请刷新后重新选择' });
      }
    }
    if (filteredUpdates.product_id) {
      const product = await query('SELECT id FROM products WHERE id = ?', [filteredUpdates.product_id]);
      if (product.length === 0) {
        return res.status(400).json({ success: false, error_code: 'PRODUCT_NOT_FOUND', error: '所选产品型号不存在或已停用，请刷新后重新选择' });
      }
    }

    // 设备编码唯一性校验（仅在值发生变化时检查，避免存量数据阻断无关编辑）
    if (filteredUpdates.device_code && filteredUpdates.device_code !== (existingDevice[0].device_code || null)) {
      const dupCode = await query(
        `SELECT d.id, c.name AS customer_name
         FROM devices d LEFT JOIN customers c ON c.id = d.customer_id
         WHERE d.device_code = ? AND d.id != ?`,
        [filteredUpdates.device_code, id]
      );
      if (dupCode.length > 0) {
        const owner = dupCode[0].customer_name ? `（客户：${dupCode[0].customer_name}）` : '';
        return res.status(400).json({
          success: false,
          error_code: 'DEVICE_CODE_DUPLICATED',
          error: `设备编码 "${filteredUpdates.device_code}" 已被设备 ${dupCode[0].id}${owner} 使用，请勿重复录入`
        });
      }
    }

    // 远程码允许重复（多合一成员设备可共用），不做唯一校验

    // 构建更新语句
    const updateFields = [];
    const updateValues = [];

    Object.keys(filteredUpdates).forEach(key => {
      if (key === 'factory_docs_complete') {
        const complete = filteredUpdates[key] === true || filteredUpdates[key] === 1 || filteredUpdates[key] === '1';
        updateFields.push('factory_docs_complete = ?');
        updateValues.push(complete ? 1 : 0);
        updateFields.push('factory_docs_completed_at = ?');
        updateValues.push(complete ? new Date() : null);
        updateFields.push('factory_docs_completed_by = ?');
        updateValues.push(complete ? (updates.factory_docs_completed_by || null) : null);
        return;
      }
      updateFields.push(`${key} = ?`);
      updateValues.push(filteredUpdates[key]);
    });

    // 如果要修改序列号，加入id字段，并重新计算nickname
    if (newId && newId !== id) {
      updateFields.push('id = ?');
      updateValues.push(newId);
      // 重新计算 nickname（客户名 + 产品简称 + 新序列号末4位数字）
      try {
        const customerId = updates.customer_id || existingDevice[0].customer_id;
        const productId = updates.product_id || existingDevice[0].product_id;
        let customerName = '';
        let productShort = '';
        if (customerId) {
          const cRows = await query('SELECT name FROM customers WHERE id = ?', [customerId]);
          if (cRows.length > 0) customerName = cRows[0].name || '';
        }
        if (productId) {
          const pRows = await query('SELECT short_name FROM products WHERE id = ?', [productId]);
          if (pRows.length > 0) productShort = pRows[0].short_name || '';
        }
        const digits = newId.replace(/\D/g, '');
        const idSuffix = digits.length >= 4 ? digits.slice(-4) : digits;
        if (customerName && productShort && idSuffix) {
          updateFields.push('nickname = ?');
          updateValues.push(`${customerName}${productShort}${idSuffix}`);
        }
      } catch (e) {
        console.warn('重新生成设备俗称失败:', e.message);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    updateValues.push(id);

    const updateQuery = `
      UPDATE devices 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `;

    try {
      if (newId && newId !== id) {
        // 序列号变更：子表（modules/device_documents/device_upgrades/issues）均无 ON UPDATE CASCADE，
        // 需临时关闭 FK 检查，先更新主键，再级联更新所有子表的 device_id
        await transaction(async (connection) => {
          try {
            await connection.execute('SET FOREIGN_KEY_CHECKS=0');
            await connection.execute(updateQuery, updateValues);
            // 级联更新子表
            await connection.execute('UPDATE modules SET device_id = ? WHERE device_id = ?', [newId, id]);
            await connection.execute('UPDATE device_documents SET device_id = ? WHERE device_id = ?', [newId, id]);
            await connection.execute('UPDATE device_upgrades SET device_id = ? WHERE device_id = ?', [newId, id]);
            await connection.execute('UPDATE issues SET device_id = ? WHERE device_id = ?', [newId, id]);
          } finally {
            await connection.execute('SET FOREIGN_KEY_CHECKS=1');
          }
        });
      } else {
        await query(updateQuery, updateValues);
      }
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        const conflictId = (newId && newId !== id) ? newId : id;
        return res.status(400).json({ success: false, error_code: 'DEVICE_ID_DUPLICATED', error: `生产序列号 "${conflictId}" 已存在，保存失败` });
      }
      if (e.code === 'ER_DATA_TOO_LONG') {
        return res.status(400).json({ success: false, error: '提交内容过长，请检查各字段长度后重试' });
      }
      throw e;
    }

    // 客户变更时，用 REPLACE() 替换 nickname 中的旧客户名
    const finalId = (newId && newId !== id) ? newId : id;
    const newCustomerId = updates.customer_id;
    const oldCustomerId = existingDevice[0].customer_id;
    if (newCustomerId !== undefined && newCustomerId !== null && newCustomerId !== oldCustomerId) {
      try {
        const oldCustRows = await query('SELECT name FROM customers WHERE id = ?', [oldCustomerId]);
        const newCustRows = await query('SELECT name FROM customers WHERE id = ?', [newCustomerId]);
        if (oldCustRows.length > 0 && newCustRows.length > 0) {
          await query(
            'UPDATE devices SET nickname = REPLACE(nickname, ?, ?) WHERE id = ? AND nickname IS NOT NULL',
            [oldCustRows[0].name, newCustRows[0].name, finalId]
          );
        }
      } catch (e) {
        console.warn('更新nickname客户名失败:', e.message);
      }
    }

    // 产品型号变更时，按新产品的模块模板同步设备模块列表：
    // 新增缺失的模块类型；移除新产品不再包含的模块（已有版本历史的模块保留，避免丢失记录）
    const requestedProductId = filteredUpdates.product_id;
    const oldProductId = existingDevice[0].product_id;
    let moduleSync = { added: 0, removed: 0 };
    if (requestedProductId !== undefined && requestedProductId !== null && Number(requestedProductId) !== Number(oldProductId)) {
      try {
        const pmRows = await query('SELECT module_type_id FROM product_modules WHERE product_id = ?', [requestedProductId]);
        const newTypeIds = pmRows.map(r => Number(r.module_type_id));
        const newTypeSet = new Set(newTypeIds);
        const deviceModuleRows = await query('SELECT id, type_id FROM modules WHERE device_id = ?', [finalId]);
        const keptTypeIds = new Set();
        const removableIds = [];
        for (const m of deviceModuleRows) {
          if (newTypeSet.has(Number(m.type_id))) continue;
          const [cntRow] = await query('SELECT COUNT(*) AS cnt FROM module_versions WHERE module_id = ?', [m.id]);
          if (Number(cntRow?.cnt || 0) > 0) {
            // 该模块已有版本历史，保留以免丢失记录
            keptTypeIds.add(Number(m.type_id));
          } else {
            removableIds.push(m.id);
          }
        }
        if (removableIds.length > 0) {
          await query(`DELETE FROM modules WHERE id IN (${removableIds.map(() => '?').join(',')})`, removableIds);
        }
        const presentTypeIds = new Set([
          ...deviceModuleRows.filter(m => newTypeSet.has(Number(m.type_id))).map(m => Number(m.type_id)),
          ...keptTypeIds,
        ]);
        for (const typeId of newTypeIds) {
          if (presentTypeIds.has(Number(typeId))) continue;
          await query('INSERT INTO modules (device_id, type_id) VALUES (?, ?)', [finalId, typeId]);
          moduleSync.added++;
        }
        moduleSync.removed = removableIds.length;
      } catch (syncError) {
        console.warn('同步设备模块列表失败:', syncError.message);
      }
    }

    // 出厂资料完善不再自动置为已发货：发货统一走「发货」按钮（POST /:id/ship），
    // 以便在发货确认弹窗中选择飞书催填版本号通知人
    const syncNote = (moduleSync.added > 0 || moduleSync.removed > 0)
      ? `，已按新产品型号同步模块列表（新增 ${moduleSync.added}，移除 ${moduleSync.removed}）`
      : '';
    res.json({
      success: true,
      message: `设备更新成功${syncNote}`,
      data: { new_id: finalId, module_sync: moduleSync }
    });
  } catch (error) {
    console.error('更新设备失败:', error);
    res.status(500).json({ success: false, error: '更新设备失败' });
  }
});

// 删除设备
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查设备是否存在
    const existingDevice = await query('SELECT id FROM devices WHERE id = ?', [id]);
    if (existingDevice.length === 0) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }

    // 使用事务删除设备及其相关数据
    await transaction(async (connection) => {
      // 删除设备（级联删除模块、版本、问题）
      await connection.execute('DELETE FROM devices WHERE id = ?', [id]);
    });

    res.json({
      success: true,
      message: '设备删除成功'
    });
  } catch (error) {
    console.error('删除设备失败:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED' || error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ success: false, error: '该设备存在关联记录（如出厂资料、客户需求等），无法直接删除，请先解除相关关联' });
    }
    res.status(500).json({ success: false, error: '删除设备失败' });
  }
});

// 获取设备统计信息
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const statsQuery = `
      SELECT
    COUNT(DISTINCT mv.id) as version_count,
      COUNT(DISTINCT i.id) as total_issues,
      COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) as open_issues,
      COUNT(DISTINCT CASE WHEN i.status = 'in_progress' THEN i.id END) as in_progress_issues,
      COUNT(DISTINCT CASE WHEN i.status = 'closed' THEN i.id END) as closed_issues,
      COUNT(DISTINCT CASE WHEN i.severity = 'high' THEN i.id END) as high_severity_issues
      FROM devices d
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN module_versions mv ON m.id = mv.module_id
      LEFT JOIN issues i ON d.id = i.device_id
      WHERE d.id = ?
      `;

    const statsResult = await query(statsQuery, [id]);
    const stats = statsResult[0];

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取设备统计失败:', error);
    res.status(500).json({ success: false, error: '获取设备统计失败' });
  }
});

module.exports = router;
