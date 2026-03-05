const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取所有版本记录
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, module_id, version_type, device_id } = req.query;

    // 参数验证
    const pageNum = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    const limitNum = Number.isInteger(parseInt(limit)) ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let params = [];

    if (module_id) {
      whereConditions.push('mv.module_id = ?');
      params.push(module_id);
    }

    if (version_type) {
      whereConditions.push('mv.version_type = ?');
      params.push(version_type);
    }

    if (device_id) {
      whereConditions.push('m.device_id = ?');
      params.push(device_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const versionsQuery = `
      SELECT 
        mv.*,
        mt.name as module_type,
        d.id as device_id,
        d.name as device_name,
        pl.name as device_type,
        c.name as customer_name,
        p.name as product_name,
        d.nickname as device_nickname,
        p.model as product_model,
        pv.version_number as product_version_number,
        pv.version_name as product_version_name
      FROM module_versions mv
      LEFT JOIN modules m ON mv.module_id = m.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN product_versions pv ON d.product_version_id = pv.id
      ${whereClause}
      ORDER BY mv.created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;

    const versions = await query(versionsQuery, params);

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM module_versions mv
      LEFT JOIN modules m ON mv.module_id = m.id
      ${whereClause}
    `;

    const countResult = await query(countQuery, params);
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
    console.error('获取版本列表失败:', error);
    res.status(500).json({ success: false, error: '获取版本列表失败' });
  }
});

// 获取单个版本详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const versionQuery = `
      SELECT 
        mv.*,
        mt.name as module_type,
        d.id as device_id,
        d.name as device_name,
        pl.name as device_type
      FROM module_versions mv
      LEFT JOIN modules m ON mv.module_id = m.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      LEFT JOIN devices d ON m.device_id = d.id
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      WHERE mv.id = ?
    `;

    const versionResult = await query(versionQuery, [id]);
    const version = versionResult[0];

    if (!version) {
      return res.status(404).json({ success: false, error: '版本记录不存在' });
    }

    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    console.error('获取版本详情失败:', error);
    res.status(500).json({ success: false, error: '获取版本详情失败' });
  }
});

// 创建版本记录
router.post('/', [
  body('module_id').notEmpty().withMessage('模块ID不能为空'),
  body('version_number').optional().isString().withMessage('版本号格式不正确'),
  body('release_id').optional().isInt().withMessage('发布记录ID格式不正确'),
  body('version_type').isIn(['factory', 'update']).withMessage('版本类型无效'),
  body('release_date').optional().isISO8601().withMessage('发布日期格式无效'),
  body('description').notEmpty().withMessage('更新说明不能为空（强制登记）'),
  body('updated_by').notEmpty().withMessage('更新执行人不能为空（强制登记）')
], async (req, res) => {
  try {
    console.log('📝 收到创建版本请求:', JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ 验证失败:', errors.array());
      return res.status(400).json({
        success: false,
        error: '输入数据无效',
        details: errors.array()
      });
    }

    let { module_id, version_number, release_id, version_type, release_date, description, updated_by } = req.body;

    // 强制说明字符长度检查
    if (description && description.trim().length < 5) {
      return res.status(400).json({ success: false, error: '更新说明过短，请提供更详细的执行记录（至少5个字符）' });
    }

    // 检查模块是否存在
    const [module] = await query('SELECT id, type_id FROM modules WHERE id = ?', [module_id]);
    if (!module) {
      return res.status(400).json({ success: false, error: '模块不存在' });
    }

    // 如果提供了 release_id，则从发布库获取版本号
    if (release_id) {
      const [release] = await query('SELECT version_number, module_type_id FROM version_releases WHERE id = ?', [release_id]);
      if (!release) {
        return res.status(400).json({ success: false, error: '选定的版本发布记录不存在' });
      }
      // 校验版本库分类是否匹配模块类型
      if (release.module_type_id !== module.type_id) {
        return res.status(400).json({ success: false, error: '选定的版本与当前模块类型不匹配' });
      }
      version_number = release.version_number;
    }

    if (!version_number) {
      return res.status(400).json({ success: false, error: '版本号不能为空（请直接输入或从版本库选择）' });
    }

    // 检查同一模块的版本号是否已存在
    const existingVersion = await query(
      'SELECT id FROM module_versions WHERE module_id = ? AND version_number = ?',
      [module_id, version_number]
    );
    if (existingVersion.length > 0) {
      console.error(`❌ 版本号冲突: 模块${module_id}已有版本${version_number}`);
      return res.status(400).json({ success: false, error: `该模块的版本${version_number}已存在，请使用不同的版本号` });
    }

    // 生成6位随机ID
    const IDGenerator = require('../../id-generator');
    const idGenerator = new IDGenerator();
    const versionId = idGenerator.generate();

    const insertQuery = `
      INSERT INTO module_versions (id, module_id, version_number, version_type, release_date, description, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await query(insertQuery, [versionId, module_id, version_number, version_type, release_date || new Date().toISOString().split('T')[0], description, updated_by]);

    res.status(201).json({
      success: true,
      message: '版本更新成功并已完成登记',
      data: { id: versionId, version_number }
    });
  } catch (error) {
    console.error('创建版本记录失败:', error);
    res.status(500).json({ success: false, error: '创建版本记录失败' });
  }
});

// 更新版本记录
router.put('/:id', [
  body('version_number').optional().notEmpty().withMessage('版本号不能为空'),
  body('version_type').optional().isIn(['factory', 'update']).withMessage('版本类型无效'),
  body('release_date').optional().isISO8601().withMessage('发布日期格式无效'),
  body('description').optional().isString(),
  body('updated_by').optional().isString()
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

    // 检查版本记录是否存在
    const existingVersion = await query('SELECT id FROM module_versions WHERE id = ?', [id]);
    if (existingVersion.length === 0) {
      return res.status(404).json({ success: false, error: '版本记录不存在' });
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
      UPDATE module_versions 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await query(updateQuery, updateValues);

    res.json({
      success: true,
      message: '版本记录更新成功'
    });
  } catch (error) {
    console.error('更新版本记录失败:', error);
    res.status(500).json({ success: false, error: '更新版本记录失败' });
  }
});

// 删除版本记录
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查版本记录是否存在
    const existingVersion = await query('SELECT id FROM module_versions WHERE id = ?', [id]);
    if (existingVersion.length === 0) {
      return res.status(404).json({ success: false, error: '版本记录不存在' });
    }

    // 删除版本记录
    await query('DELETE FROM module_versions WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '版本记录删除成功'
    });
  } catch (error) {
    console.error('删除版本记录失败:', error);
    res.status(500).json({ success: false, error: '删除版本记录失败' });
  }
});

// 获取版本统计信息
router.get('/stats/overview', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_versions,
        COUNT(DISTINCT module_id) as modules_with_versions,
        COUNT(CASE WHEN version_type = 'factory' THEN 1 END) as factory_versions,
        COUNT(CASE WHEN version_type = 'update' THEN 1 END) as update_versions,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_versions,
        COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as week_versions
      FROM module_versions
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult[0];

    // 获取版本类型分布
    const typeDistributionQuery = `
      SELECT 
        version_type,
        COUNT(*) as count
      FROM module_versions
      GROUP BY version_type
    `;

    const typeDistribution = await query(typeDistributionQuery);

    // 获取最近版本
    const recentVersionsQuery = `
      SELECT 
        mv.version_number,
        mv.version_type,
        mv.created_at,
        m.category as module_category,
        d.name as device_name
      FROM module_versions mv
      LEFT JOIN modules m ON mv.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      ORDER BY mv.created_at DESC
      LIMIT 10
    `;

    const recentVersions = await query(recentVersionsQuery);

    res.json({
      success: true,
      data: {
        overview: stats,
        typeDistribution,
        recentVersions
      }
    });
  } catch (error) {
    console.error('获取版本统计失败:', error);
    res.status(500).json({ success: false, error: '获取版本统计失败' });
  }
});

module.exports = router;
