const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database');
const router = express.Router();

// 获取所有设备
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status, search } = req.query;


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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 获取设备列表
    const devicesQuery = `
      SELECT 
        d.*,
        pl.name as product_line_name,
        p.name as product_name,
        p.model as product_model,
        pv.version_number as product_version_number,
        pv.version_name as product_version_name,
        c.name as customer_name,
        c.short_name as customer_short_name,
        COUNT(DISTINCT i.id) as issue_count,
        COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) as open_issues
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN product_versions pv ON d.product_version_id = pv.id
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
      ${whereClause}
      GROUP BY d.id, pl.name, p.name, p.model, pv.version_number, pv.version_name, c.name, c.short_name
      ORDER BY d.created_at DESC
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
    d.*,
      pl.name as product_line_name,
      p.name as product_name,
      p.model as product_model,
      pv.version_number as product_version_number,
      pv.version_name as product_version_name,
      c.name as customer_name,
      c.short_name as customer_short_name,
      COUNT(DISTINCT i.id) as issue_count
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN product_versions pv ON d.product_version_id = pv.id
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
      WHERE d.id = ?
      GROUP BY d.id, pl.name, p.name, p.model, pv.version_number, pv.version_name, c.name, c.short_name
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
      ORDER BY mt.name
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
router.post('/', [
  body('id').optional({ nullable: true }).isString().withMessage('设备ID必须是字符串'),
  body('name').optional({ nullable: true }).isString().withMessage('订单号必须是字符串'),
  body('product_line_id').notEmpty().isInt().withMessage('产品线ID必须是整数'),
  body('customer_id').optional({ nullable: true }).isInt().withMessage('客户ID必须是整数'),
  body('status').optional({ nullable: true }).isIn(['正常', '异常', '维护中']).withMessage('状态必须是：正常、异常或维护中'),
  body('remote_code').optional({ nullable: true }).isString().withMessage('远程码必须是字符串'),
  body('password').optional({ nullable: true }).isString().withMessage('密码必须是字符串')
], async (req, res) => {
  try {
    console.log('收到创建设备请求:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('验证失败:', errors.array());
      return res.status(400).json({
        success: false,
        error: '输入数据无效',
        details: errors.array()
      });
    }

    const { id, name, device_code, product_line_id, product_id, product_version_id, customer_id, status = '正常', remote_code, password } = req.body;

    // 如果提供了ID，使用用户提供的ID，否则自动生成
    let deviceId = id;
    if (!deviceId) {
      const IDGenerator = require('../../id-generator');
      const idGenerator = new IDGenerator();
      deviceId = idGenerator.generate();
    }

    // 检查设备ID是否已存在
    const existingDevice = await query('SELECT id FROM devices WHERE id = ?', [deviceId]);
    if (existingDevice.length > 0) {
      return res.status(400).json({ success: false, error: '设备ID已存在' });
    }

    // 检查产品线是否存在
    const productLine = await query('SELECT id FROM product_lines WHERE id = ?', [product_line_id]);
    if (productLine.length === 0) {
      return res.status(400).json({ success: false, error: '产品线不存在' });
    }

    const insertQuery = `
      INSERT INTO devices(id, name, nickname, device_code, product_line_id, product_id, product_version_id, customer_id, status, remote_code, password)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      // 从生产序列号中提取所有数字，取最后2位
      let idSuffix = '';
      if (deviceId) {
        const digits = deviceId.replace(/\D/g, '');
        idSuffix = digits.length >= 2 ? digits.slice(-2) : digits;
      }
      if (customerName && productShort && idSuffix) {
        nickname = `${customerName}${productShort}${idSuffix}`;
      }
    } catch (e) {
      console.warn('生成设备俗称失败:', e.message);
    }

    await query(insertQuery, [deviceId, name ?? null, nickname, device_code || null, product_line_id, product_id || null, product_version_id || null, customer_id || null, status, remote_code || null, password || null]);

    res.status(201).json({
      success: true,
      message: '设备创建成功',
      data: { id: deviceId, name, nickname, device_code, product_line_id, product_id, product_version_id, customer_id, status, remote_code, password }
    });
  } catch (error) {
    console.error('创建设备失败:', error);
    res.status(500).json({ success: false, error: '创建设备失败' });
  }
});

// 更新设备
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('设备名称不能为空'),
  body('product_line_id').optional().isInt().withMessage('产品线ID必须是整数'),
  body('customer_id').optional({ nullable: true }).isInt().withMessage('客户ID必须是整数'),
  body('status').optional({ nullable: true }).isIn(['正常', '异常', '维护中']).withMessage('状态必须是：正常、异常或维护中'),
  body('remote_code').optional({ nullable: true }).isString().withMessage('远程码必须是字符串'),
  body('password').optional({ nullable: true }).isString().withMessage('密码必须是字符串')
], async (req, res) => {
  try {
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
    const existingDevice = await query('SELECT id FROM devices WHERE id = ?', [id]);
    if (existingDevice.length === 0) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }

    // 如果更新产品线，检查是否存在
    if (updates.product_line_id) {
      const productLine = await query('SELECT id FROM product_lines WHERE id = ?', [updates.product_line_id]);
      if (productLine.length === 0) {
        return res.status(400).json({ success: false, error: '产品线不存在' });
      }
    }

    // 提取new_id（如果要修改序列号）
    const newId = updates.new_id;
    delete updates.new_id;

    // 如果要修改序列号，检查新ID是否已存在
    if (newId && newId !== id) {
      const existingNew = await query('SELECT id FROM devices WHERE id = ?', [newId]);
      if (existingNew.length > 0) {
        return res.status(400).json({ success: false, error: '该生产序列号已存在' });
      }
    }

    // 只允许更新存在的字段（白名单）
    const allowedFields = ['name', 'nickname', 'device_code', 'product_line_id', 'product_id', 'product_version_id', 'customer_id', 'status', 'remote_code', 'password'];
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    });

    // 构建更新语句
    const updateFields = [];
    const updateValues = [];

    Object.keys(filteredUpdates).forEach(key => {
      updateFields.push(`${key} = ?`);
      updateValues.push(filteredUpdates[key]);
    });

    // 如果要修改序列号，加入id字段
    if (newId && newId !== id) {
      updateFields.push('id = ?');
      updateValues.push(newId);
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

    await query(updateQuery, updateValues);

    res.json({
      success: true,
      message: '设备更新成功',
      data: { new_id: newId && newId !== id ? newId : id }
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
