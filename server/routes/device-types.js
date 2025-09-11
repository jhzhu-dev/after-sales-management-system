const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取设备类型列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', is_active } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const whereConditions = [];
    const params = [];
    
    if (search) {
      whereConditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (is_active !== undefined && is_active !== '') {
      whereConditions.push('is_active = ?');
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 获取设备类型列表
    const typesQuery = `
      SELECT 
        id,
        name,
        description,
        is_active,
        created_at,
        updated_at
      FROM device_types
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const types = await query(typesQuery, params);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM device_types
      ${whereClause}
    `;
    
    const { total } = (await query(countQuery, params))[0];
    
    res.json({
      success: true,
      data: types,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取设备类型列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备类型列表失败',
      error: error.message
    });
  }
});

// 获取所有启用的设备类型（用于下拉选择）
router.get('/active', async (req, res) => {
  try {
    const typesQuery = `
      SELECT id, name, description
      FROM device_types
      WHERE is_active = 1
      ORDER BY name
    `;
    
    const types = await query(typesQuery);
    
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    console.error('获取启用的设备类型失败:', error);
    res.status(500).json({
      success: false,
      message: '获取启用的设备类型失败',
      error: error.message
    });
  }
});

// 获取单个设备类型
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const typeQuery = `
      SELECT 
        id,
        name,
        description,
        is_active,
        created_at,
        updated_at
      FROM device_types
      WHERE id = ?
    `;
    
    const type = (await query(typeQuery, [id]))[0];
    
    if (!type) {
      return res.status(404).json({
        success: false,
        message: '设备类型不存在'
      });
    }
    
    res.json({
      success: true,
      data: type
    });
  } catch (error) {
    console.error('获取设备类型失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备类型失败',
      error: error.message
    });
  }
});

// 创建设备类型
router.post('/', [
  body('name').notEmpty().withMessage('设备类型名称不能为空'),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入数据无效',
        errors: errors.array()
      });
    }
    
    const { name, description, is_active = true } = req.body;
    
    // 检查名称是否已存在
    const existingType = await query(
      'SELECT id FROM device_types WHERE name = ?',
      [name]
    );
    
    if (existingType.length > 0) {
      return res.status(400).json({
        success: false,
        message: '设备类型名称已存在'
      });
    }
    
    // 生成6位随机ID
    const IDGenerator = require('../../id-generator');
    const idGenerator = new IDGenerator();
    const typeId = idGenerator.generate();
    
    const insertQuery = `
      INSERT INTO device_types (id, name, description, is_active)
      VALUES (?, ?, ?, ?)
    `;
    
    await query(insertQuery, [typeId, name, description, is_active]);
    
    res.status(201).json({
      success: true,
      message: '设备类型创建成功',
      data: { id: typeId }
    });
  } catch (error) {
    console.error('创建设备类型失败:', error);
    res.status(500).json({
      success: false,
      message: '创建设备类型失败',
      error: error.message
    });
  }
});

// 更新设备类型
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('设备类型名称不能为空'),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入数据无效',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    
    // 检查设备类型是否存在
    const existingType = await query(
      'SELECT id FROM device_types WHERE id = ?',
      [id]
    );
    
    if (existingType.length === 0) {
      return res.status(404).json({
        success: false,
        message: '设备类型不存在'
      });
    }
    
    // 如果更新名称，检查是否与其他记录冲突
    if (name) {
      const duplicateType = await query(
        'SELECT id FROM device_types WHERE name = ? AND id != ?',
        [name, id]
      );
      
      if (duplicateType.length > 0) {
        return res.status(400).json({
          success: false,
          message: '设备类型名称已存在'
        });
      }
    }
    
    // 构建更新字段
    const updateFields = [];
    const params = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      params.push(description);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(is_active);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有提供要更新的字段'
      });
    }
    
    params.push(id);
    
    const updateQuery = `
      UPDATE device_types
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await query(updateQuery, params);
    
    res.json({
      success: true,
      message: '设备类型更新成功'
    });
  } catch (error) {
    console.error('更新设备类型失败:', error);
    res.status(500).json({
      success: false,
      message: '更新设备类型失败',
      error: error.message
    });
  }
});

// 删除设备类型
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否有设备使用此类型
    const devicesUsingType = await query(
      'SELECT COUNT(*) as count FROM devices WHERE type_id = ?',
      [id]
    );
    
    if (devicesUsingType[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '无法删除：有设备正在使用此类型'
      });
    }
    
    // 删除设备类型
    const deleteQuery = 'DELETE FROM device_types WHERE id = ?';
    const result = await query(deleteQuery, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '设备类型不存在'
      });
    }
    
    res.json({
      success: true,
      message: '设备类型删除成功'
    });
  } catch (error) {
    console.error('删除设备类型失败:', error);
    res.status(500).json({
      success: false,
      message: '删除设备类型失败',
      error: error.message
    });
  }
});

module.exports = router;
