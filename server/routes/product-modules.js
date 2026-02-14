const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database');
const router = express.Router();

// 获取产品的当前模块配置
router.get('/:productId/modules', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const modules = await query(`
      SELECT 
        pm.id,
        pm.product_id,
        pm.module_type_id,
        mt.name as module_type_name,
        mt.code as module_type_code,
        pm.is_required,
        pm.default_config,
        pm.created_at
      FROM product_modules pm
      LEFT JOIN module_types mt ON pm.module_type_id = mt.id
      WHERE pm.product_id = ?
      ORDER BY mt.name
    `, [productId]);
    
    res.json({
      success: true,
      data: modules
    });
  } catch (error) {
    console.error('获取产品模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取产品模块配置失败',
      error: error.message
    });
  }
});

// 获取模块配置历史记录
router.get('/:productId/modules/:moduleTypeId/history', async (req, res) => {
  try {
    const { productId, moduleTypeId } = req.params;
    const { limit = 20 } = req.query;
    
    const history = await query(`
      SELECT 
        pmh.id,
        pmh.product_id,
        pmh.module_type_id,
        mt.name as module_type_name,
        pmh.is_required,
        pmh.default_config,
        pmh.version_number,
        pmh.change_description,
        pmh.effective_date,
        pmh.deprecated_date,
        pmh.is_current,
        pmh.created_by,
        pmh.created_at
      FROM product_module_history pmh
      LEFT JOIN module_types mt ON pmh.module_type_id = mt.id
      WHERE pmh.product_id = ? AND pmh.module_type_id = ?
      ORDER BY pmh.effective_date DESC
      LIMIT ?
    `, [productId, moduleTypeId, parseInt(limit)]);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('获取模块历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块历史记录失败',
      error: error.message
    });
  }
});

// 添加模块到产品
router.post('/:productId/modules', [
  body('module_type_id').isInt().withMessage('模块类型ID必须是整数'),
  body('is_required').optional().isBoolean().withMessage('is_required必须是布尔值'),
  body('default_config').optional(),
  body('version_number').optional().isString().isLength({ max: 50 }).withMessage('版本号最长50字符'),
  body('change_description').optional().isString().withMessage('变更说明必须是字符串'),
  body('created_by').optional().isString().withMessage('创建人必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join('; ');
      return res.status(400).json({ 
        success: false, 
        message: errorMessages,
        errors: errors.array() 
      });
    }
    
    const { productId } = req.params;
    const { 
      module_type_id, 
      is_required = true, 
      default_config, 
      version_number = 'v1',
      change_description = '初始版本',
      created_by
    } = req.body;
    
    // 检查产品是否存在
    const [product] = await query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    
    // 检查模块类型是否存在
    const [moduleType] = await query('SELECT id, name FROM module_types WHERE id = ?', [module_type_id]);
    if (!moduleType) {
      return res.status(404).json({ success: false, message: '模块类型不存在' });
    }
    
    // 检查是否已存在该模块类型
    const existing = await query(
      'SELECT id FROM product_modules WHERE product_id = ? AND module_type_id = ?',
      [productId, module_type_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `该产品已配置 ${moduleType.name} 模块类型`
      });
    }
    
    // 检查版本号唯一性
    const versionExists = await query(
      'SELECT id FROM product_module_history WHERE product_id = ? AND module_type_id = ? AND version_number = ?',
      [productId, module_type_id, version_number]
    );
    
    if (versionExists.length > 0) {
      return res.status(400).json({
        success: false,
        message: `版本号 ${version_number} 已存在`
      });
    }
    
    // 插入产品模块配置
    const result = await query(
      `INSERT INTO product_modules (product_id, module_type_id, is_required, default_config)
       VALUES (?, ?, ?, ?)`,
      [productId, module_type_id, is_required, default_config ? JSON.stringify(default_config) : null]
    );
    
    // 同时插入历史记录（标记为当前版本）
    await query(
      `INSERT INTO product_module_history 
       (product_id, module_type_id, is_required, default_config, version_number, change_description, is_current, created_by)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [productId, module_type_id, is_required, default_config ? JSON.stringify(default_config) : null, version_number, change_description, created_by]
    );
    
    res.json({
      success: true,
      message: '模块配置添加成功',
      data: {
        id: result.insertId,
        product_id: productId,
        module_type_id,
        module_type_name: moduleType.name,
        is_required,
        default_config,
        version_number
      }
    });
  } catch (error) {
    console.error('添加模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '添加模块配置失败',
      error: error.message
    });
  }
});

// 更新产品模块配置（创建新版本）
router.put('/:productId/modules/:moduleId', [
  body('is_required').optional().isBoolean().withMessage('is_required必须是布尔值'),
  body('default_config').optional(),
  body('version_number').notEmpty().isString().isLength({ max: 50 }).withMessage('版本号是必填项且最长50字符'),
  body('change_description').notEmpty().isString().withMessage('变更说明是必填项'),
  body('created_by').optional().isString().withMessage('创建人必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join('; ');
      return res.status(400).json({ 
        success: false, 
        message: errorMessages,
        errors: errors.array() 
      });
    }
    
    const { productId, moduleId } = req.params;
    const { is_required, default_config, version_number, change_description, created_by } = req.body;
    
    // 获取当前模块配置
    const [currentModule] = await query(
      'SELECT * FROM product_modules WHERE id = ? AND product_id = ?',
      [moduleId, productId]
    );
    
    if (!currentModule) {
      return res.status(404).json({ success: false, message: '模块配置不存在' });
    }
    
    // 检查新版本号是否已存在
    const versionExists = await query(
      'SELECT id FROM product_module_history WHERE product_id = ? AND module_type_id = ? AND version_number = ?',
      [productId, currentModule.module_type_id, version_number]
    );
    
    if (versionExists.length > 0) {
      return res.status(400).json({
        success: false,
        message: `版本号 ${version_number} 已存在`
      });
    }
    
    await transaction(async (conn) => {
      // 1. 将当前配置的历史记录标记为非当前版本，并设置过期日期
      await conn.execute(
        `UPDATE product_module_history 
         SET is_current = FALSE, deprecated_date = CURRENT_TIMESTAMP 
         WHERE product_id = ? AND module_type_id = ? AND is_current = TRUE`,
        [productId, currentModule.module_type_id]
      );
      
      // 2. 更新产品模块配置主表
      const updateFields = [];
      const updateValues = [];
      
      if (is_required !== undefined) {
        updateFields.push('is_required = ?');
        updateValues.push(is_required);
      }
      if (default_config !== undefined) {
        updateFields.push('default_config = ?');
        updateValues.push(default_config ? JSON.stringify(default_config) : null);
      }
      
      if (updateFields.length > 0) {
        updateValues.push(moduleId, productId);
        await conn.execute(
          `UPDATE product_modules SET ${updateFields.join(', ')} WHERE id = ? AND product_id = ?`,
          updateValues
        );
      }
      
      // 3. 插入新版本历史记录（标记为当前版本）
      await conn.execute(
        `INSERT INTO product_module_history 
         (product_id, module_type_id, is_required, default_config, version_number, change_description, is_current, created_by)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
        [
          productId,
          currentModule.module_type_id,
          is_required !== undefined ? is_required : currentModule.is_required,
          default_config !== undefined ? (default_config ? JSON.stringify(default_config) : null) : currentModule.default_config,
          version_number,
          change_description,
          created_by
        ]
      );
    });
    
    res.json({
      success: true,
      message: '模块配置更新成功，新版本已保存',
      data: {
        version_number,
        change_description
      }
    });
  } catch (error) {
    console.error('更新模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新模块配置失败',
      error: error.message
    });
  }
});

// 删除产品模块配置（软删除：移至历史记录）
router.delete('/:productId/modules/:moduleId', async (req, res) => {
  try {
    const { productId, moduleId } = req.params;
    const { created_by } = req.body;
    
    // 获取当前模块配置
    const [currentModule] = await query(
      'SELECT * FROM product_modules WHERE id = ? AND product_id = ?',
      [moduleId, productId]
    );
    
    if (!currentModule) {
      return res.status(404).json({ success: false, message: '模块配置不存在' });
    }
    
    await transaction(async (conn) => {
      // 1. 将历史记录标记为非当前版本并设置过期日期
      await conn.execute(
        `UPDATE product_module_history 
         SET is_current = FALSE, deprecated_date = CURRENT_TIMESTAMP 
         WHERE product_id = ? AND module_type_id = ? AND is_current = TRUE`,
        [productId, currentModule.module_type_id]
      );
      
      // 2. 创建删除记录到历史表
      await conn.execute(
        `INSERT INTO product_module_history 
         (product_id, module_type_id, is_required, default_config, version_number, change_description, is_current, created_by, deprecated_date)
         VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, CURRENT_TIMESTAMP)`,
        [
          productId,
          currentModule.module_type_id,
          currentModule.is_required,
          currentModule.default_config,
          'deleted',
          '配置已删除',
          created_by
        ]
      );
      
      // 3. 从主表删除
      await conn.execute(
        'DELETE FROM product_modules WHERE id = ? AND product_id = ?',
        [moduleId, productId]
      );
    });
    
    res.json({
      success: true,
      message: '模块配置删除成功，历史记录已保留'
    });
  } catch (error) {
    console.error('删除模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除模块配置失败',
      error: error.message
    });
  }
});

// 批量添加模块配置（带冲突检测）
router.post('/batch', [
  body('product_ids').isArray().withMessage('产品ID列表必须是数组'),
  body('modules').isArray().withMessage('模块列表必须是数组'),
  body('modules.*.module_type_id').isInt().withMessage('模块类型ID必须是整数'),
  body('modules.*.is_required').optional().isBoolean(),
  body('version_number').optional().isString().isLength({ max: 50 }),
  body('created_by').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join('; ');
      return res.status(400).json({ 
        success: false, 
        message: errorMessages,
        errors: errors.array() 
      });
    }
    
    const { product_ids, modules, version_number = 'v1', created_by } = req.body;
    
    if (product_ids.length === 0 || modules.length === 0) {
      return res.status(400).json({
        success: false,
        message: '产品列表和模块列表不能为空'
      });
    }
    
    // 检测冲突
    const moduleTypeIds = modules.map(m => m.module_type_id);
    const conflicts = [];
    
    for (const productId of product_ids) {
      const existing = await query(
        `SELECT pm.module_type_id, mt.name as module_type_name, p.name as product_name
         FROM product_modules pm
         LEFT JOIN module_types mt ON pm.module_type_id = mt.id
         LEFT JOIN products p ON pm.product_id = p.id
         WHERE pm.product_id = ? AND pm.module_type_id IN (${moduleTypeIds.map(() => '?').join(',')})`,
        [productId, ...moduleTypeIds]
      );
      
      if (existing.length > 0) {
        conflicts.push({
          product_id: productId,
          product_name: existing[0].product_name,
          conflicts: existing.map(e => ({
            module_type_id: e.module_type_id,
            module_type_name: e.module_type_name
          }))
        });
      }
    }
    
    // 如果有冲突，返回冲突详情
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'conflict',
        message: `检测到 ${conflicts.length} 个产品存在模块配置冲突`,
        conflicts: conflicts
      });
    }
    
    // 无冲突，批量插入
    let successCount = 0;
    
    await transaction(async (conn) => {
      for (const productId of product_ids) {
        for (const module of modules) {
          // 插入产品模块配置
          await conn.execute(
            `INSERT INTO product_modules (product_id, module_type_id, is_required, default_config)
             VALUES (?, ?, ?, ?)`,
            [productId, module.module_type_id, module.is_required ?? true, module.default_config ? JSON.stringify(module.default_config) : null]
          );
          
          // 插入历史记录
          await conn.execute(
            `INSERT INTO product_module_history 
             (product_id, module_type_id, is_required, default_config, version_number, change_description, is_current, created_by)
             VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
            [productId, module.module_type_id, module.is_required ?? true, module.default_config ? JSON.stringify(module.default_config) : null, version_number, '批量配置', created_by]
          );
          
          successCount++;
        }
      }
    });
    
    res.json({
      success: true,
      message: `成功为 ${product_ids.length} 个产品批量添加 ${modules.length} 个模块配置`,
      data: {
        product_count: product_ids.length,
        module_count: modules.length,
        total_count: successCount
      }
    });
  } catch (error) {
    console.error('批量添加模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '批量添加模块配置失败',
      error: error.message
    });
  }
});

// 批量覆盖模块配置
router.post('/batch-overwrite', [
  body('product_ids').isArray().withMessage('产品ID列表必须是数组'),
  body('modules').isArray().withMessage('模块列表必须是数组'),
  body('version_number').optional().isString().isLength({ max: 50 }),
  body('created_by').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join('; ');
      return res.status(400).json({ 
        success: false, 
        message: errorMessages,
        errors: errors.array() 
      });
    }
    
    const { product_ids, modules, version_number = 'v1-overwrite', created_by } = req.body;
    const moduleTypeIds = modules.map(m => m.module_type_id);
    
    let successCount = 0;
    
    await transaction(async (conn) => {
      for (const productId of product_ids) {
        // 1. 标记现有配置的历史为非当前版本
        await conn.execute(
          `UPDATE product_module_history 
           SET is_current = FALSE, deprecated_date = CURRENT_TIMESTAMP 
           WHERE product_id = ? AND module_type_id IN (${moduleTypeIds.map(() => '?').join(',')}) AND is_current = TRUE`,
          [productId, ...moduleTypeIds]
        );
        
        // 2. 删除现有配置
        await conn.execute(
          `DELETE FROM product_modules 
           WHERE product_id = ? AND module_type_id IN (${moduleTypeIds.map(() => '?').join(',')})`,
          [productId, ...moduleTypeIds]
        );
        
        // 3. 插入新配置
        for (const module of modules) {
          await conn.execute(
            `INSERT INTO product_modules (product_id, module_type_id, is_required, default_config)
             VALUES (?, ?, ?, ?)`,
            [productId, module.module_type_id, module.is_required ?? true, module.default_config ? JSON.stringify(module.default_config) : null]
          );
          
          // 4. 插入新历史记录
          await conn.execute(
            `INSERT INTO product_module_history 
             (product_id, module_type_id, is_required, default_config, version_number, change_description, is_current, created_by)
             VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
            [productId, module.module_type_id, module.is_required ?? true, module.default_config ? JSON.stringify(module.default_config) : null, version_number, '批量覆盖配置', created_by]
          );
          
          successCount++;
        }
      }
    });
    
    res.json({
      success: true,
      message: `成功覆盖 ${product_ids.length} 个产品的模块配置`,
      data: {
        product_count: product_ids.length,
        module_count: modules.length,
        total_count: successCount
      }
    });
  } catch (error) {
    console.error('批量覆盖模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '批量覆盖模块配置失败',
      error: error.message
    });
  }
});

module.exports = router;
