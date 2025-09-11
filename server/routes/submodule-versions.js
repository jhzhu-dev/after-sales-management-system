const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取子模块版本列表
router.get('/', async (req, res) => {
  try {
    const { 
      submodule_id, 
      page = 1, 
      limit = 10, 
      version_type,
      search 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    const whereConditions = [];
    const params = [];
    
    if (submodule_id) {
      whereConditions.push('sv.submodule_id = ?');
      params.push(submodule_id);
    }
    
    if (version_type) {
      whereConditions.push('sv.version_type = ?');
      params.push(version_type);
    }
    
    if (search) {
      whereConditions.push('(sv.version_number LIKE ? OR sv.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 获取子模块版本列表
    const versionsQuery = `
      SELECT 
        sv.*,
        s.name as submodule_name,
        s.model as submodule_model,
        m.device_id,
        d.name as device_name,
        dt.name as device_type,
        mt.name as module_type
      FROM submodule_versions sv
      LEFT JOIN submodules s ON sv.submodule_id = s.id
      LEFT JOIN modules m ON s.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      ${whereClause}
      ORDER BY sv.created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const versions = await query(versionsQuery, params);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM submodule_versions sv
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, params);
    const { total } = countResult[0];
    
    res.json({
      success: true,
      data: versions,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取子模块版本列表失败:', error);
    res.status(500).json({ success: false, error: '获取子模块版本列表失败' });
  }
});

// 获取单个子模块版本详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const versionQuery = `
      SELECT 
        sv.*,
        s.name as submodule_name,
        s.model as submodule_model,
        m.device_id,
        d.name as device_name,
        dt.name as device_type,
        mt.name as module_type
      FROM submodule_versions sv
      LEFT JOIN submodules s ON sv.submodule_id = s.id
      LEFT JOIN modules m ON s.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      WHERE sv.id = ?
    `;
    
    const versionResult = await query(versionQuery, [id]);
    const version = versionResult[0];
    
    if (!version) {
      return res.status(404).json({ success: false, error: '子模块版本不存在' });
    }
    
    res.json({ success: true, data: version });
  } catch (error) {
    console.error('获取子模块版本详情失败:', error);
    res.status(500).json({ success: false, error: '获取子模块版本详情失败' });
  }
});

// 创建子模块版本
router.post('/', [
  body('submodule_id').notEmpty().withMessage('子模块ID不能为空'),
  body('version_number').notEmpty().withMessage('版本号不能为空'),
  body('version_type').isIn(['factory', 'update']).withMessage('版本类型必须是factory或update'),
  body('release_date').optional().isISO8601().withMessage('发布日期格式不正确'),
  body('description').optional().isString(),
  body('updated_by').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: '输入验证失败', 
        details: errors.array() 
      });
    }
    
    const { 
      submodule_id, 
      version_number, 
      version_type, 
      release_date, 
      description, 
      updated_by 
    } = req.body;
    
    // 检查子模块是否存在
    const submoduleResult = await query('SELECT id FROM submodules WHERE id = ?', [submodule_id]);
    if (submoduleResult.length === 0) {
      return res.status(404).json({ success: false, error: '子模块不存在' });
    }
    
    // 生成6位随机ID
    const IDGenerator = require('../../id-generator');
    const idGenerator = new IDGenerator();
    const versionId = idGenerator.generate();
    
    // 插入版本记录
    const insertQuery = `
      INSERT INTO submodule_versions 
      (id, submodule_id, version_number, version_type, release_date, description, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await query(insertQuery, [
      versionId,
      submodule_id, 
      version_number, 
      version_type, 
      release_date || null, 
      description || null, 
      updated_by || null
    ]);
    
    // 如果是当前版本，更新子模块的current_version
    if (version_type === 'update') {
      await query(
        'UPDATE submodules SET current_version = ? WHERE id = ?',
        [version_number, submodule_id]
      );
    } else if (version_type === 'factory') {
      // 如果是出厂版本，同时更新factory_version和current_version
      await query(
        'UPDATE submodules SET factory_version = ?, current_version = ? WHERE id = ?',
        [version_number, version_number, submodule_id]
      );
    }
    
    res.status(201).json({ 
      success: true, 
      data: { id: versionId },
      message: '子模块版本创建成功' 
    });
  } catch (error) {
    console.error('创建子模块版本失败:', error);
    res.status(500).json({ success: false, error: '创建子模块版本失败' });
  }
});

// 更新子模块版本
router.put('/:id', [
  body('version_number').optional().notEmpty().withMessage('版本号不能为空'),
  body('version_type').optional().isIn(['factory', 'update']).withMessage('版本类型必须是factory或update'),
  body('release_date').optional().isISO8601().withMessage('发布日期格式不正确'),
  body('description').optional().isString(),
  body('updated_by').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: '输入验证失败', 
        details: errors.array() 
      });
    }
    
    const { id } = req.params;
    const { 
      version_number, 
      version_type, 
      release_date, 
      description, 
      updated_by 
    } = req.body;
    
    // 检查版本是否存在
    const versionResult = await query('SELECT * FROM submodule_versions WHERE id = ?', [id]);
    if (versionResult.length === 0) {
      return res.status(404).json({ success: false, error: '子模块版本不存在' });
    }
    
    const version = versionResult[0];
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    
    if (version_number !== undefined) {
      updateFields.push('version_number = ?');
      updateValues.push(version_number);
    }
    if (version_type !== undefined) {
      updateFields.push('version_type = ?');
      updateValues.push(version_type);
    }
    if (release_date !== undefined) {
      updateFields.push('release_date = ?');
      updateValues.push(release_date || null);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description || null);
    }
    if (updated_by !== undefined) {
      updateFields.push('updated_by = ?');
      updateValues.push(updated_by || null);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有提供要更新的字段' });
    }
    
    updateValues.push(id);
    
    const updateQuery = `UPDATE submodule_versions SET ${updateFields.join(', ')} WHERE id = ?`;
    await query(updateQuery, updateValues);
    
    res.json({ success: true, message: '子模块版本更新成功' });
  } catch (error) {
    console.error('更新子模块版本失败:', error);
    res.status(500).json({ success: false, error: '更新子模块版本失败' });
  }
});

// 删除子模块版本
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查版本是否存在
    const versionResult = await query('SELECT * FROM submodule_versions WHERE id = ?', [id]);
    if (versionResult.length === 0) {
      return res.status(404).json({ success: false, error: '子模块版本不存在' });
    }
    
    await query('DELETE FROM submodule_versions WHERE id = ?', [id]);
    
    res.json({ success: true, message: '子模块版本删除成功' });
  } catch (error) {
    console.error('删除子模块版本失败:', error);
    res.status(500).json({ success: false, error: '删除子模块版本失败' });
  }
});

// 获取指定子模块的所有版本
router.get('/submodule/:submoduleId', async (req, res) => {
  try {
    const { submoduleId } = req.params;
    const { page = 1, limit = 100 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    const versionsQuery = `
      SELECT 
        sv.*,
        s.name as submodule_name,
        s.model as submodule_model,
        m.device_id,
        d.name as device_name,
        dt.name as device_type,
        mt.name as module_type
      FROM submodule_versions sv
      LEFT JOIN submodules s ON sv.submodule_id = s.id
      LEFT JOIN modules m ON s.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      WHERE sv.submodule_id = ?
      ORDER BY sv.created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const versions = await query(versionsQuery, [submoduleId]);
    
    // 获取总数
    const countResult = await query('SELECT COUNT(*) as total FROM submodule_versions WHERE submodule_id = ?', [submoduleId]);
    const { total } = countResult[0];
    
    res.json({
      success: true,
      data: versions,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取子模块版本历史失败:', error);
    res.status(500).json({ success: false, error: '获取子模块版本历史失败' });
  }
});

module.exports = router;

