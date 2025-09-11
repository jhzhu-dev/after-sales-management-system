const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取子模块列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', module_id, status } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const whereConditions = [];
    const params = [];
    
    if (module_id) {
      whereConditions.push('s.module_id = ?');
      params.push(module_id);
    }
    
    if (status) {
      whereConditions.push('s.status = ?');
      params.push(status);
    }
    
    if (search) {
      whereConditions.push('(s.name LIKE ? OR s.model LIKE ? OR s.factory_version LIKE ? OR s.current_version LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 获取子模块列表
    const submodulesQuery = `
      SELECT 
        s.*,
        m.device_id,
        d.name as device_name,
        dt.name as device_type,
        mt.name as module_type
      FROM submodules s
      LEFT JOIN modules m ON s.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const submodules = await query(submodulesQuery, params);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM submodules s
      LEFT JOIN modules m ON s.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, params);
    const { total } = countResult[0];
    
    res.json({
      success: true,
      data: submodules,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取子模块列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取子模块列表失败',
      error: error.message
    });
  }
});

// 获取单个子模块
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submoduleQuery = `
      SELECT 
        s.*,
        m.device_id,
        d.name as device_name,
        dt.name as device_type,
        mt.name as module_type
      FROM submodules s
      LEFT JOIN modules m ON s.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      WHERE s.id = ?
    `;
    
    const submodule = (await query(submoduleQuery, [id]))[0];
    
    if (!submodule) {
      return res.status(404).json({
        success: false,
        message: '子模块不存在'
      });
    }
    
    res.json({
      success: true,
      data: submodule
    });
  } catch (error) {
    console.error('获取子模块失败:', error);
    res.status(500).json({
      success: false,
      message: '获取子模块失败',
      error: error.message
    });
  }
});

// 创建子模块
router.post('/', [
  body('module_id').notEmpty().withMessage('模块ID不能为空'),
  body('name').notEmpty().withMessage('子模块名称不能为空'),
  body('model').optional().isString(),
  body('factory_version').optional().isString(),
  body('current_version').optional().isString(),
  body('description').optional().isString(),
  body('status').optional().isIn(['正常', '异常', '维护中'])
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
    
    const { module_id, name, model, factory_version, current_version, description, status = '正常' } = req.body;
    
    // 检查模块是否存在
    const moduleExists = await query(
      'SELECT id FROM modules WHERE id = ?',
      [module_id]
    );
    
    if (moduleExists.length === 0) {
      return res.status(400).json({
        success: false,
        message: '指定的模块不存在'
      });
    }
    
    // 生成6位随机ID
    const IDGenerator = require('../../id-generator');
    const idGenerator = new IDGenerator();
    const submoduleId = idGenerator.generate();
    
    const insertQuery = `
      INSERT INTO submodules (id, module_id, name, model, factory_version, current_version, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await query(insertQuery, [submoduleId, module_id, name, model, factory_version, current_version, description, status]);
    
    res.status(201).json({
      success: true,
      message: '子模块创建成功',
      data: { id: submoduleId }
    });
  } catch (error) {
    console.error('创建子模块失败:', error);
    res.status(500).json({
      success: false,
      message: '创建子模块失败',
      error: error.message
    });
  }
});

// 更新子模块
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('子模块名称不能为空'),
  body('model').optional().isString(),
  body('factory_version').optional().isString(),
  body('current_version').optional().isString(),
  body('description').optional().isString(),
  body('status').optional().isIn(['正常', '异常', '维护中'])
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
    const { name, model, factory_version, current_version, description, status } = req.body;
    
    // 检查子模块是否存在
    const submoduleExists = await query(
      'SELECT id FROM submodules WHERE id = ?',
      [id]
    );
    
    if (submoduleExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: '子模块不存在'
      });
    }
    
    // 构建更新字段
    const updateFields = [];
    const params = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (model !== undefined) {
      updateFields.push('model = ?');
      params.push(model);
    }
    if (factory_version !== undefined) {
      updateFields.push('factory_version = ?');
      params.push(factory_version);
    }
    if (current_version !== undefined) {
      updateFields.push('current_version = ?');
      params.push(current_version);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      params.push(description);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有提供要更新的字段'
      });
    }
    
    params.push(id);
    
    const updateQuery = `
      UPDATE submodules
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await query(updateQuery, params);
    
    res.json({
      success: true,
      message: '子模块更新成功'
    });
  } catch (error) {
    console.error('更新子模块失败:', error);
    res.status(500).json({
      success: false,
      message: '更新子模块失败',
      error: error.message
    });
  }
});

// 删除子模块
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleteQuery = 'DELETE FROM submodules WHERE id = ?';
    const result = await query(deleteQuery, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '子模块不存在'
      });
    }
    
    res.json({
      success: true,
      message: '子模块删除成功'
    });
  } catch (error) {
    console.error('删除子模块失败:', error);
    res.status(500).json({
      success: false,
      message: '删除子模块失败',
      error: error.message
    });
  }
});

// 获取指定模块的子模块列表
router.get('/module/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params;
    
    const submodulesQuery = `
      SELECT 
        s.*,
        m.device_id,
        d.name as device_name,
        dt.name as device_type,
        mt.name as module_type
      FROM submodules s
      LEFT JOIN modules m ON s.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      WHERE s.module_id = ?
      ORDER BY s.created_at DESC
    `;
    
    const submodules = await query(submodulesQuery, [moduleId]);
    
    res.json({
      success: true,
      data: submodules
    });
  } catch (error) {
    console.error('获取模块子模块列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块子模块列表失败',
      error: error.message
    });
  }
});

module.exports = router;
