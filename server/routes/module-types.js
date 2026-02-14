const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取模块类型列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', is_active } = req.query;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const whereConditions = [];
    const params = [];
    
    if (search) {
      whereConditions.push('(name LIKE ? OR code LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (is_active !== undefined && is_active !== '') {
      whereConditions.push('is_active = ?');
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 获取模块类型列表
    const typesQuery = `
      SELECT 
        id,
        name,
        code,
        description,
        is_active,
        created_at,
        updated_at
      FROM module_types
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const types = await query(typesQuery, params);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM module_types
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
    console.error('获取模块类型列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块类型列表失败',
      error: error.message
    });
  }
});

// 获取所有启用的模块类型（用于下拉选择）
router.get('/active', async (req, res) => {
  try {
    const typesQuery = `
      SELECT id, name, code, description
      FROM module_types
      WHERE is_active = 1
      ORDER BY name
    `;
    
    const types = await query(typesQuery);
    
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    console.error('获取启用的模块类型失败:', error);
    res.status(500).json({
      success: false,
      message: '获取启用的模块类型失败',
      error: error.message
    });
  }
});

// 获取单个模块类型
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const typeQuery = `
      SELECT 
        id,
        name,
        code,
        description,
        is_active,
        created_at,
        updated_at
      FROM module_types
      WHERE id = ?
    `;
    
    const type = (await query(typeQuery, [id]))[0];
    
    if (!type) {
      return res.status(404).json({
        success: false,
        message: '模块类型不存在'
      });
    }
    
    res.json({
      success: true,
      data: type
    });
  } catch (error) {
    console.error('获取模块类型失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块类型失败',
      error: error.message
    });
  }
});

// 创建模块类型
router.post('/', [
  body('name').notEmpty().withMessage('模块类型名称不能为空'),
  body('code').notEmpty().withMessage('模块类型代码不能为空'),
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
    
    const { name, code, description, is_active = true } = req.body;
    
    // 检查名称和代码是否已存在
    const existingName = await query(
      'SELECT id FROM module_types WHERE name = ?',
      [name]
    );
    
    if (existingName.length > 0) {
      return res.status(400).json({
        success: false,
        message: '模块类型名称已存在'
      });
    }
    
    const existingCode = await query(
      'SELECT id FROM module_types WHERE code = ?',
      [code]
    );
    
    if (existingCode.length > 0) {
      return res.status(400).json({
        success: false,
        message: '模块类型代码已存在'
      });
    }
    
    // 生成6位随机ID
    const IDGenerator = require('../../id-generator');
    const idGenerator = new IDGenerator();
    const typeId = idGenerator.generate();
    
    const insertQuery = `
      INSERT INTO module_types (id, name, code, description, is_active)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await query(insertQuery, [typeId, name, code, description, is_active]);
    
    res.status(201).json({
      success: true,
      message: '模块类型创建成功',
      data: { id: typeId }
    });
  } catch (error) {
    console.error('创建模块类型失败:', error);
    res.status(500).json({
      success: false,
      message: '创建模块类型失败',
      error: error.message
    });
  }
});

// 更新模块类型
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('模块类型名称不能为空'),
  body('code').optional().notEmpty().withMessage('模块类型代码不能为空'),
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
    const { name, code, description, is_active } = req.body;
    
    // 检查模块类型是否存在
    const existingType = await query(
      'SELECT id FROM module_types WHERE id = ?',
      [id]
    );
    
    if (existingType.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块类型不存在'
      });
    }
    
    // 如果更新名称，检查是否与其他记录冲突
    if (name) {
      const duplicateName = await query(
        'SELECT id FROM module_types WHERE name = ? AND id != ?',
        [name, id]
      );
      
      if (duplicateName.length > 0) {
        return res.status(400).json({
          success: false,
          message: '模块类型名称已存在'
        });
      }
    }
    
    // 如果更新代码，检查是否与其他记录冲突
    if (code) {
      const duplicateCode = await query(
        'SELECT id FROM module_types WHERE code = ? AND id != ?',
        [code, id]
      );
      
      if (duplicateCode.length > 0) {
        return res.status(400).json({
          success: false,
          message: '模块类型代码已存在'
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
    if (code !== undefined) {
      updateFields.push('code = ?');
      params.push(code);
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
      UPDATE module_types
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await query(updateQuery, params);
    
    res.json({
      success: true,
      message: '模块类型更新成功'
    });
  } catch (error) {
    console.error('更新模块类型失败:', error);
    res.status(500).json({
      success: false,
      message: '更新模块类型失败',
      error: error.message
    });
  }
});

// 删除模块类型
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查1：设备模块使用情况
    const modulesUsingType = await query(
      'SELECT COUNT(*) as count FROM modules WHERE type_id = ?',
      [id]
    );
    
    // 检查2：产品模块配置使用情况
    const productModulesUsingType = await query(
      'SELECT COUNT(*) as count FROM product_modules WHERE module_type_id = ?',
      [id]
    );
    
    // 检查3：产品模块历史记录使用情况
    const historyUsingType = await query(
      'SELECT COUNT(*) as count FROM product_module_history WHERE module_type_id = ?',
      [id]
    );
    
    const deviceCount = modulesUsingType[0].count;
    const productConfigCount = productModulesUsingType[0].count;
    const historyCount = historyUsingType[0].count;
    
    // 如果有任何使用记录，阻止删除
    if (deviceCount > 0 || productConfigCount > 0 || historyCount > 0) {
      const messages = [];
      if (deviceCount > 0) messages.push(`${deviceCount} 个设备模块`);
      if (productConfigCount > 0) messages.push(`${productConfigCount} 个产品配置`);
      if (historyCount > 0) messages.push(`${historyCount} 条历史记录`);
      
      return res.status(400).json({
        success: false,
        message: `无法删除：有 ${messages.join('、')} 正在使用此模块类型`,
        usage: {
          device_modules: deviceCount,
          product_configs: productConfigCount,
          history_records: historyCount
        }
      });
    }
    
    // 删除模块类型
    const deleteQuery = 'DELETE FROM module_types WHERE id = ?';
    const result = await query(deleteQuery, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '模块类型不存在'
      });
    }
    
    res.json({
      success: true,
      message: '模块类型删除成功'
    });
  } catch (error) {
    console.error('删除模块类型失败:', error);
    res.status(500).json({
      success: false,
      message: '删除模块类型失败',
      error: error.message
    });
  }
});

module.exports = router;
