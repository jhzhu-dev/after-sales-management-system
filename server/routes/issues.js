const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取所有问题
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      device_id, 
      module_id, 
      status, 
      severity, 
      module,
      device_type,
      search 
    } = req.query;
    
    // 参数验证
    const pageNum = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    const limitNum = Number.isInteger(parseInt(limit)) ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;
    
    let whereConditions = [];
    let params = [];
    
    if (device_id) {
      whereConditions.push('i.device_id = ?');
      params.push(device_id);
    }
    
    if (module_id) {
      whereConditions.push('i.module_id = ?');
      params.push(module_id);
    }
    
    if (status) {
      whereConditions.push('i.status = ?');
      params.push(status);
    }
    
    if (severity) {
      whereConditions.push('i.severity = ?');
      params.push(severity);
    }
    
    if (module) {
      whereConditions.push('mt.name = ?');
      params.push(module);
    }
    
    if (device_type) {
      whereConditions.push('dt.name = ?');
      params.push(device_type);
    }
    
    if (search) {
      whereConditions.push('(i.description LIKE ? OR d.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 根据是否有模块筛选或设备类型筛选来决定使用LEFT JOIN还是INNER JOIN
    const joinClause = (module || device_type) ? 
      `FROM issues i
       INNER JOIN devices d ON i.device_id = d.id
       INNER JOIN device_types dt ON d.type_id = dt.id
       INNER JOIN modules m ON i.module_id = m.id
       INNER JOIN module_types mt ON m.type_id = mt.id` :
      `FROM issues i
       LEFT JOIN devices d ON i.device_id = d.id
       LEFT JOIN device_types dt ON d.type_id = dt.id
       LEFT JOIN modules m ON i.module_id = m.id
       LEFT JOIN module_types mt ON m.type_id = mt.id`;
    
    const issuesQuery = `
      SELECT 
        i.*,
        d.name as device_name,
        dt.name as device_type,
        mt.name as module_category
      ${joinClause}
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}
    `;
    
    const issues = await query(issuesQuery, params);
    
    // 获取总数 - 使用相同的JOIN逻辑
    const countJoinClause = (module || device_type) ? 
      `FROM issues i
       INNER JOIN devices d ON i.device_id = d.id
       INNER JOIN device_types dt ON d.type_id = dt.id
       INNER JOIN modules m ON i.module_id = m.id
       INNER JOIN module_types mt ON m.type_id = mt.id` :
      `FROM issues i
       LEFT JOIN devices d ON i.device_id = d.id
       LEFT JOIN device_types dt ON d.type_id = dt.id
       LEFT JOIN modules m ON i.module_id = m.id
       LEFT JOIN module_types mt ON m.type_id = mt.id`;
    
    const countQuery = `
      SELECT COUNT(*) as total
      ${countJoinClause}
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, params);
    const { total } = countResult[0];
    
    res.json({
      success: true,
      data: issues,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取问题列表失败:', error);
    res.status(500).json({ success: false, error: '获取问题列表失败' });
  }
});

// 获取单个问题详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const issueQuery = `
      SELECT 
        i.*,
        d.name as device_name,
        dt.name as device_type,
        d.location as device_location,
        mt.name as module_category
      FROM issues i
      LEFT JOIN devices d ON i.device_id = d.id
      LEFT JOIN device_types dt ON d.type_id = dt.id
      LEFT JOIN modules m ON i.module_id = m.id
      LEFT JOIN module_types mt ON m.type_id = mt.id
      WHERE i.id = ?
    `;
    
    const issueResult = await query(issueQuery, [id]);
    const issue = issueResult[0];
    
    if (!issue) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }
    
    res.json({
      success: true,
      data: issue
    });
  } catch (error) {
    console.error('获取问题详情失败:', error);
    res.status(500).json({ success: false, error: '获取问题详情失败' });
  }
});

// 创建问题
router.post('/', [
  body('device_id').notEmpty().withMessage('设备ID不能为空'),
  body('description').notEmpty().withMessage('问题描述不能为空'),
  body('severity').optional().isIn(['low', 'medium', 'high']).withMessage('严重性无效'),
  body('status').optional().isIn(['open', 'in_progress', 'closed']).withMessage('状态无效'),
  body('assignee').optional().isString(),
  body('module_id').optional().custom((value) => {
    if (value !== undefined && value !== null && value !== '' && !value.trim()) {
      throw new Error('模块ID不能为空');
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
    
    const { device_id, module_id, description, severity = 'medium', status = 'open', assignee } = req.body;
    
    // 处理module_id，空字符串转为null
    const processedModuleId = module_id && module_id.trim() ? module_id : null;
    
    // 检查设备是否存在
    const device = await query('SELECT id FROM devices WHERE id = ?', [device_id]);
    if (device.length === 0) {
      return res.status(400).json({ success: false, error: '设备不存在' });
    }
    
    // 如果指定了模块，检查模块是否存在且属于该设备
    if (processedModuleId) {
      const module = await query(
        'SELECT id FROM modules WHERE id = ? AND device_id = ?',
        [processedModuleId, device_id]
      );
      if (module.length === 0) {
        return res.status(400).json({ success: false, error: '模块不存在或不属于该设备' });
      }
    }
    
    // 生成6位随机ID
    const IDGenerator = require('../../id-generator');
    const idGenerator = new IDGenerator();
    const issueId = idGenerator.generate();
    
    const insertQuery = `
      INSERT INTO issues (id, device_id, module_id, description, severity, status, assignee)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await query(insertQuery, [issueId, device_id, processedModuleId, description, severity, status, assignee]);
    
    res.status(201).json({
      success: true,
      message: '问题创建成功',
      data: { id: issueId }
    });
  } catch (error) {
    console.error('创建问题失败:', error);
    res.status(500).json({ success: false, error: '创建问题失败' });
  }
});

// 更新问题
router.put('/:id', [
  body('description').optional().notEmpty().withMessage('问题描述不能为空'),
  body('severity').optional().isIn(['low', 'medium', 'high']).withMessage('严重性无效'),
  body('status').optional().isIn(['open', 'in_progress', 'closed']).withMessage('状态无效'),
  body('assignee').optional().isString(),
  body('resolution_description').optional().isString()
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
    
    // 检查问题是否存在
    const existingIssue = await query('SELECT id FROM issues WHERE id = ?', [id]);
    if (existingIssue.length === 0) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }
    
    // 构建更新语句
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        // 特殊处理日期时间字段
        if (key === 'resolved_at' && updates[key]) {
          // 将ISO 8601格式转换为MySQL兼容格式
          const date = new Date(updates[key]);
          if (!isNaN(date.getTime())) {
            updateFields.push(`${key} = ?`);
            updateValues.push(date.toISOString().slice(0, 19).replace('T', ' '));
          }
        } else {
          updateFields.push(`${key} = ?`);
          updateValues.push(updates[key]);
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }
    
    updateValues.push(id);
    
    const updateQuery = `
      UPDATE issues 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await query(updateQuery, updateValues);
    
    res.json({
      success: true,
      message: '问题更新成功'
    });
  } catch (error) {
    console.error('更新问题失败:', error);
    res.status(500).json({ success: false, error: '更新问题失败' });
  }
});

// 删除问题
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查问题是否存在
    const existingIssue = await query('SELECT id, device_id, description FROM issues WHERE id = ?', [id]);
    if (existingIssue.length === 0) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }
    
    const issue = existingIssue[0];
    console.log(`正在删除问题 ID: ${id}, 设备ID: ${issue.device_id}, 描述: ${issue.description}`);
    
    // 删除问题
    const result = await query('DELETE FROM issues WHERE id = ?', [id]);
    console.log(`删除结果: 影响行数 ${result.affectedRows}`);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '问题不存在或已被删除' });
    }
    
    res.json({
      success: true,
      message: '问题删除成功'
    });
  } catch (error) {
    console.error('删除问题失败:', error);
    
    // 提供更详细的错误信息
    let errorMessage = '删除问题失败';
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      errorMessage = '无法删除问题，存在相关引用';
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      errorMessage = '无法删除问题，外键约束错误';
    } else if (error.code === 'ER_TRUNCATED_WRONG_VALUE') {
      errorMessage = '数据格式错误';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: error.message 
    });
  }
});

// 获取问题统计信息
router.get('/stats/overview', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_issues,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_issues,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_issues,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_issues,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_issues,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_severity_issues,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_severity_issues,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_issues,
        COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as week_issues
      FROM issues
    `;
    
    const statsResult = await query(statsQuery);
    const stats = statsResult[0];
    
    // 获取状态分布
    const statusDistributionQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM issues
      GROUP BY status
    `;
    
    const statusDistribution = await query(statusDistributionQuery);
    
    // 获取严重性分布
    const severityDistributionQuery = `
      SELECT 
        severity,
        COUNT(*) as count
      FROM issues
      GROUP BY severity
    `;
    
    const severityDistribution = await query(severityDistributionQuery);
    
    // 获取最近问题
    const recentIssuesQuery = `
      SELECT 
        i.id,
        i.description,
        i.severity,
        i.status,
        i.created_at,
        d.name as device_name
      FROM issues i
      LEFT JOIN devices d ON i.device_id = d.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `;
    
    const recentIssues = await query(recentIssuesQuery);
    
    res.json({
      success: true,
      data: {
        overview: stats,
        statusDistribution,
        severityDistribution,
        recentIssues
      }
    });
  } catch (error) {
    console.error('获取问题统计失败:', error);
    res.status(500).json({ success: false, error: '获取问题统计失败' });
  }
});

// 批量更新问题状态
router.patch('/batch/status', [
  body('issue_ids').isArray().withMessage('问题ID列表必须是数组'),
  body('status').isIn(['open', 'in_progress', 'closed']).withMessage('状态无效')
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
    
    const { issue_ids, status } = req.body;
    
    if (issue_ids.length === 0) {
      return res.status(400).json({ success: false, error: '问题ID列表不能为空' });
    }
    
    const placeholders = issue_ids.map(() => '?').join(',');
    const updateQuery = `
      UPDATE issues 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;
    
    await query(updateQuery, [status, ...issue_ids]);
    
    res.json({
      success: true,
      message: `成功更新 ${issue_ids.length} 个问题的状态`
    });
  } catch (error) {
    console.error('批量更新问题状态失败:', error);
    res.status(500).json({ success: false, error: '批量更新问题状态失败' });
  }
});

module.exports = router;
