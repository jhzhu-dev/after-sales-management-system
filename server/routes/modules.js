const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database');
const router = express.Router();

// 获取所有模块
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, device_id, category } = req.query;
    
    // 参数验证
    const pageNum = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    const limitNum = Number.isInteger(parseInt(limit)) ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;
    
    let whereConditions = [];
    let params = [];
    
    if (device_id) {
      whereConditions.push('m.device_id = ?');
      params.push(device_id);
    }
    
    if (category) {
      whereConditions.push('m.type_id = ?');
      params.push(category);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const modulesQuery = `
      SELECT 
        m.*,
        d.name as device_name,
        pl.name as device_type,
        mt.name as module_type,
        mt.feishu_user_open_id,
        mv.version_number as current_version,
        mv.version_type as current_version_type,
        mv.release_date as current_version_date
      FROM modules m
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      LEFT JOIN (
        SELECT module_id, version_number, version_type, release_date
        FROM module_versions mv1
        WHERE id = (
          SELECT id FROM module_versions mv2
          WHERE mv2.module_id = mv1.module_id
          ORDER BY mv2.created_at DESC
          LIMIT 1
        )
      ) mv ON m.id = mv.module_id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const modules = await query(modulesQuery, params);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM modules m
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, params);
    const { total } = countResult[0];
    
    res.json({
      success: true,
      data: modules,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取模块列表失败:', error);
    res.status(500).json({ success: false, error: '获取模块列表失败' });
  }
});

// 获取单个模块详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const moduleQuery = `
      SELECT 
        m.*,
        d.name as device_name,
        pl.name as device_type
      FROM modules m
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      WHERE m.id = ?
    `;
    
    const moduleResult = await query(moduleQuery, [id]);
    const module = moduleResult[0];
    
    if (!module) {
      return res.status(404).json({ success: false, error: '模块不存在' });
    }
    
    // 获取模块版本历史
    const versionsQuery = `
      SELECT *
      FROM module_versions
      WHERE module_id = ?
      ORDER BY created_at DESC
    `;
    
    const versions = await query(versionsQuery, [id]);
    
    res.json({
      success: true,
      data: {
        ...module,
        versions
      }
    });
  } catch (error) {
    console.error('获取模块详情失败:', error);
    res.status(500).json({ success: false, error: '获取模块详情失败' });
  }
});

// 创建模块
router.post('/', [
  body('device_id').notEmpty().withMessage('设备ID不能为空'),
  body('type_id').notEmpty().withMessage('模块类型ID不能为空'),
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
    
    const { device_id, type_id, version_id } = req.body;
    
    // 检查设备是否存在
    const device = await query('SELECT id FROM devices WHERE id = ?', [device_id]);
    if (device.length === 0) {
      return res.status(400).json({ success: false, error: '设备不存在' });
    }
    
    // 检查模块类型是否存在
    const moduleType = await query('SELECT id FROM module_types WHERE id = ?', [type_id]);
    if (moduleType.length === 0) {
      return res.status(400).json({ success: false, error: '模块类型不存在' });
    }
    
    // 如果提供了version_id，检查版本是否存在且匹配模块类型
    if (version_id) {
      const versionRelease = await query(
        'SELECT id, version_number, title FROM version_releases WHERE id = ? AND module_type_id = ?',
        [version_id, type_id]
      );
      if (versionRelease.length === 0) {
        return res.status(400).json({ success: false, error: '版本不存在或与模块类型不匹配' });
      }
    }
    
    // 检查同一设备的模块类型是否已存在
    const existingModule = await query(
      'SELECT id FROM modules WHERE device_id = ? AND type_id = ?', 
      [device_id, type_id]
    );
    if (existingModule.length > 0) {
      return res.status(400).json({ success: false, error: '该设备的此模块类别已存在' });
    }
    
    await transaction(async (connection) => {
      // 创建模块（使用自增主键）
      const [insertResult] = await connection.execute(
        'INSERT INTO modules (device_id, type_id) VALUES (?, ?)',
        [device_id, type_id]
      );
      const moduleId = insertResult.insertId;
      
      // 如果提供了版本ID，创建初始版本记录
      if (version_id) {
        const versionRelease = await query(
          'SELECT version_number, title FROM version_releases WHERE id = ?',
          [version_id]
        );
        
        if (versionRelease.length > 0) {
          await connection.execute(
            `INSERT INTO module_versions (module_id, version_number, version_type, description) 
             VALUES (?, ?, 'factory', ?)`,
            [moduleId, versionRelease[0].version_number, versionRelease[0].title || '初始版本']
          );
        }
      }
    });
    
    res.status(201).json({
      success: true,
      message: '模块创建成功'
    });
  } catch (error) {
    console.error('创建模块失败:', error);
    res.status(500).json({ success: false, error: '创建模块失败' });
  }
});

// 更新模块
router.put('/:id', [
  body('type_id').optional().notEmpty().withMessage('模块类型ID不能为空')
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
    
    // 检查模块是否存在
    const existingModule = await query('SELECT id FROM modules WHERE id = ?', [id]);
    if (existingModule.length === 0) {
      return res.status(404).json({ success: false, error: '模块不存在' });
    }
    
    // 构建更新语句
    const allowedFields = ['type_id'];
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }
    
    updateValues.push(id);
    
    const updateQuery = `
      UPDATE modules 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await query(updateQuery, updateValues);
    
    res.json({
      success: true,
      message: '模块更新成功'
    });
  } catch (error) {
    console.error('更新模块失败:', error);
    res.status(500).json({ success: false, error: '更新模块失败' });
  }
});

// 删除模块
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查模块是否存在
    const existingModule = await query('SELECT id FROM modules WHERE id = ?', [id]);
    if (existingModule.length === 0) {
      return res.status(404).json({ success: false, error: '模块不存在' });
    }
    
    // 删除模块（级联删除版本记录）
    await query('DELETE FROM modules WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: '模块删除成功'
    });
  } catch (error) {
    console.error('删除模块失败:', error);
    res.status(500).json({ success: false, error: '删除模块失败' });
  }
});

// 获取模块版本历史
router.get('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // 参数验证
    const pageNum = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    const limitNum = Number.isInteger(parseInt(limit)) ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;
    
    const versionsQuery = `
      SELECT *
      FROM module_versions
      WHERE module_id = ?
      ORDER BY created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const versions = await query(versionsQuery, [id]);
    
    // 获取总数
    const countResult = await query(
      'SELECT COUNT(*) as total FROM module_versions WHERE module_id = ?',
      [id]
    );
    const { total } = countResult[0];
    
    res.json({
      success: true,
      data: versions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取模块版本历史失败:', error);
    res.status(500).json({ success: false, error: '获取模块版本历史失败' });
  }
});

module.exports = router;
