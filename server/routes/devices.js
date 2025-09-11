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
      whereConditions.push('dt.name = ?');
      params.push(type);
    }
    
    if (status) {
      whereConditions.push('d.status = ?');
      params.push(status);
    }
    
    if (search) {
      whereConditions.push('(d.name LIKE ? OR d.id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 获取设备列表
    const devicesQuery = `
      SELECT 
        d.*,
        dt.name as device_type,
        COUNT(DISTINCT i.id) as issue_count,
        COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) as open_issues
      FROM devices d
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
      ${whereClause}
      GROUP BY d.id, dt.name
      ORDER BY d.created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const devices = await query(devicesQuery, params);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM devices d
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
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
        dt.name as device_type,
        COUNT(DISTINCT i.id) as issue_count
      FROM devices d
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
      WHERE d.id = ?
      GROUP BY d.id, dt.name
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
  body('name').notEmpty().withMessage('设备名称不能为空'),
  body('type_id').notEmpty().withMessage('设备类型ID不能为空'),
  body('location').optional().isString(),
  body('status').optional().isIn(['正常', '异常', '维护中']),
  body('remote_code').optional().custom((value) => {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new Error('远程码必须是字符串');
    }
    return true;
  }),
  body('password').optional().custom((value) => {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new Error('密码必须是字符串');
    }
    return true;
  })
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
    
    const { name, type_id, location, status = '正常', remote_code, password } = req.body;
    
    // 生成6位随机ID
    const IDGenerator = require('../../id-generator');
    const idGenerator = new IDGenerator();
    const deviceId = idGenerator.generate();
    
    // 检查设备ID是否已存在（虽然概率很低，但为了安全起见）
    const existingDevice = await query('SELECT id FROM devices WHERE id = ?', [deviceId]);
    if (existingDevice.length > 0) {
      // 如果ID已存在，重新生成
      const newDeviceId = idGenerator.generate();
      deviceId = newDeviceId;
    }
    
    // 检查设备类型是否存在
    const deviceType = await query('SELECT id FROM device_types WHERE id = ?', [type_id]);
    if (deviceType.length === 0) {
      return res.status(400).json({ success: false, error: '设备类型不存在' });
    }
    
    const insertQuery = `
      INSERT INTO devices (id, name, type_id, location, status, remote_code, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await query(insertQuery, [deviceId, name, type_id, location, status, remote_code || null, password || null]);
    
    res.status(201).json({
      success: true,
      message: '设备创建成功',
      data: { id: deviceId, name, type_id, location, status, remote_code, password }
    });
  } catch (error) {
    console.error('创建设备失败:', error);
    res.status(500).json({ success: false, error: '创建设备失败' });
  }
});

// 更新设备
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('设备名称不能为空'),
  body('type_id').optional().notEmpty().withMessage('设备类型ID不能为空'),
  body('location').optional().isString(),
  body('status').optional().isIn(['正常', '异常', '维护中']),
  body('remote_code').optional().custom((value) => {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new Error('远程码必须是字符串');
    }
    return true;
  }),
  body('password').optional().custom((value) => {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new Error('密码必须是字符串');
    }
    return true;
  })
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
    
    // 如果更新设备类型，检查类型是否存在
    if (updates.type_id) {
      const deviceType = await query('SELECT id FROM device_types WHERE id = ?', [updates.type_id]);
      if (deviceType.length === 0) {
        return res.status(400).json({ success: false, error: '设备类型不存在' });
      }
    }
    
    // 构建更新语句
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });
    
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
      message: '设备更新成功'
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
