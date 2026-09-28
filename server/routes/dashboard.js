const express = require('express');
const { query } = require('../database');
const router = express.Router();

// 中文映射
const ISSUE_STATUS_LABEL = { open: '待处理', in_progress: '处理中', closed: '已解决' };
const ISSUE_SEVERITY_LABEL = { low: '低', medium: '中', high: '高' };

// 生成长度 n 的月份数组（含当前月，升序）
function lastMonths(n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
}

// 获取仪表盘统计数据（运营驾驶舱）
router.get('/stats', async (req, res) => {
  try {
    /* ── 1. KPI（修正口径：用 resolved_at + 自然月）── */
    const [kpi] = await query(`
      SELECT
        (SELECT COUNT(*) FROM issues WHERE status IN ('open','in_progress')) AS open_issues,
        (SELECT COUNT(*) FROM issues WHERE status != 'closed' AND severity = 'high') AS high_open_issues,
        (SELECT COUNT(*) FROM issues WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())) AS issues_created_this_month,
        (SELECT COUNT(*) FROM issues WHERE status='closed' AND YEAR(resolved_at)=YEAR(CURDATE()) AND MONTH(resolved_at)=MONTH(CURDATE())) AS issues_resolved_this_month,
        (SELECT COUNT(*) FROM devices) AS total_devices,
        (SELECT COUNT(*) FROM devices WHERE status='使用中(异常)') AS abnormal_devices,
        (SELECT COUNT(*) FROM customer_requirements WHERE status NOT IN ('已发布','废弃')) AS active_requirements,
        (SELECT COUNT(*) FROM test_tasks WHERE status IN ('测试中','已测试')) AS active_tasks,
        (SELECT COUNT(*) FROM version_releases WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())) AS releases_this_month
    `);
    const createdThisMonth = Number(kpi.issues_created_this_month) || 0;
    const resolvedThisMonth = Number(kpi.issues_resolved_this_month) || 0;
    kpi.resolve_rate_this_month = createdThisMonth > 0
      ? Math.round((resolvedThisMonth / createdThisMonth) * 100)
      : (resolvedThisMonth > 0 ? 100 : 0);

    /* ── 2. 月度 新增 vs 解决（近12月）── */
    const createdByMonth = await query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS c
      FROM issues WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
    `);
    const resolvedByMonth = await query(`
      SELECT DATE_FORMAT(resolved_at,'%Y-%m') AS month, COUNT(*) AS c
      FROM issues WHERE resolved_at IS NOT NULL AND resolved_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
    `);
    const cmap = Object.fromEntries(createdByMonth.map(r => [r.month, Number(r.c)]));
    const rmap = Object.fromEntries(resolvedByMonth.map(r => [r.month, Number(r.c)]));
    const issueMonthly = lastMonths(12).map(month => ({
      month,
      created: cmap[month] || 0,
      resolved: rmap[month] || 0,
    }));

    /* ── 3. 售后问题分布 ── */
    const issueStatusDistribution = (await query(`
      SELECT status, COUNT(*) AS count FROM issues GROUP BY status
    `)).map(r => ({ status: ISSUE_STATUS_LABEL[r.status] || r.status, count: Number(r.count) }));

    const issueSeverityDistribution = (await query(`
      SELECT severity, COUNT(*) AS count FROM issues GROUP BY severity
    `)).map(r => ({ severity: ISSUE_SEVERITY_LABEL[r.severity] || r.severity, count: Number(r.count) }));

    const issueCategoryDistribution = (await query(`
      SELECT COALESCE(NULLIF(category,''),'其他') AS category, COUNT(*) AS count
      FROM issues GROUP BY category ORDER BY count DESC
    `)).map(r => ({ category: r.category, count: Number(r.count) }));

    const assigneeWorkload = (await query(`
      SELECT COALESCE(NULLIF(assignee,''),'未分配') AS assignee, COUNT(*) AS open_count
      FROM issues WHERE status != 'closed'
      GROUP BY assignee ORDER BY open_count DESC LIMIT 5
    `)).map(r => ({ assignee: r.assignee, open_count: Number(r.open_count) }));

    const latestHighIssues = await query(`
      SELECT i.id, i.description, i.severity, i.created_at,
             COALESCE(d.name, '') AS device_name
      FROM issues i
      LEFT JOIN devices d ON i.device_id = d.id
      WHERE i.status != 'closed' AND i.severity = 'high'
      ORDER BY i.created_at DESC LIMIT 5
    `);

    const [avgRes] = await query(`
      SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)), 1) AS avg_resolution_hours
      FROM issues WHERE status='closed' AND resolved_at IS NOT NULL
    `);
    const avgResolutionHours = avgRes.avg_resolution_hours;

    /* ── 4. 设备健康与分布 ── */
    const deviceStatusDistribution = (await query(`
      SELECT status, COUNT(*) AS count FROM devices GROUP BY status
    `)).map(r => ({ status: r.status, count: Number(r.count) }));

    const deviceCustomerDistribution = (await query(`
      SELECT COALESCE(c.name,'未指定') AS customer, COUNT(*) AS count
      FROM devices d LEFT JOIN customers c ON d.customer_id = c.id
      GROUP BY d.customer_id, c.name ORDER BY count DESC LIMIT 10
    `)).map(r => ({ customer: r.customer, count: Number(r.count) }));

    const deviceProductLineDistribution = (await query(`
      SELECT COALESCE(pl.name,'未分类') AS line, COUNT(*) AS count
      FROM devices d LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      GROUP BY d.product_line_id, pl.name ORDER BY count DESC
    `)).map(r => ({ line: r.line, count: Number(r.count) }));

    /* 设备型号数量分布（按产品型号） */
    const deviceModelDistribution = (await query(`
      SELECT COALESCE(NULLIF(p.name,''),'未指定型号') AS model, COUNT(*) AS count
      FROM devices d LEFT JOIN products p ON d.product_id = p.id
      GROUP BY d.product_id, p.name ORDER BY count DESC LIMIT 15
    `)).map(r => ({ model: r.model, count: Number(r.count) }));

    const abnormalDevices = await query(`
      SELECT d.id, d.name, COALESCE(c.name,'未指定') AS customer
      FROM devices d LEFT JOIN customers c ON d.customer_id = c.id
      WHERE d.status = '使用中(异常)'
      ORDER BY d.updated_at DESC
    `);

    /* ── 5. 版本发布库分布（高价值数据）── */
    const releaseCategoryDistribution = (await query(`
      SELECT COALESCE(NULLIF(category,''),'未分类') AS category, COUNT(*) AS count
      FROM version_releases GROUP BY category ORDER BY count DESC
    `)).map(r => ({ category: r.category, count: Number(r.count) }));

    const latestReleases = await query(`
      SELECT vr.id, vr.version_number, vr.title, vr.category, vr.release_date,
             COALESCE(mt.name,'') AS module_type_name
      FROM version_releases vr
      LEFT JOIN module_types mt ON vr.module_type_id = mt.id
      ORDER BY vr.release_date DESC, vr.id DESC LIMIT 10
    `);

    /* ── 6. 客户需求管线 ── */
    const requirementStatusDistribution = (await query(`
      SELECT status, COUNT(*) AS count FROM customer_requirements GROUP BY status
    `)).map(r => ({ status: r.status, count: Number(r.count) }));

    const requirementTypeDistribution = (await query(`
      SELECT requirement_type AS type, COUNT(*) AS count FROM customer_requirements GROUP BY requirement_type
    `)).map(r => ({ type: r.type, count: Number(r.count) }));

    const requirementUrgencyDistribution = (await query(`
      SELECT urgency, COUNT(*) AS count FROM customer_requirements GROUP BY urgency
    `)).map(r => ({ urgency: r.urgency, count: Number(r.count) }));

    const activeRequirements = await query(`
      SELECT cr.id, cr.req_code, cr.description, cr.urgency, cr.status,
             COALESCE(c.name,'') AS customer_name
      FROM customer_requirements cr
      LEFT JOIN customers c ON cr.customer_id = c.id
      WHERE cr.status NOT IN ('已发布','废弃')
      ORDER BY cr.proposed_date DESC LIMIT 8
    `);

    /* ── 7. 测试管线 ── */
    const taskStatusDistribution = (await query(`
      SELECT status, COUNT(*) AS count FROM test_tasks GROUP BY status
    `)).map(r => ({ status: r.status, count: Number(r.count) }));

    const taskPriorityDistribution = (await query(`
      SELECT priority, COUNT(*) AS count FROM test_tasks GROUP BY priority
    `)).map(r => ({ priority: r.priority, count: Number(r.count) }));

    const taskDecisionDistribution = (await query(`
      SELECT upgrade_decision AS decision, COUNT(*) AS count FROM test_tasks GROUP BY upgrade_decision
    `)).map(r => ({ decision: r.decision, count: Number(r.count) }));

    const activeTasks = await query(`
      SELECT tt.id, tt.task_code, tt.model_name, tt.status, tt.priority,
             COALESCE(p.name,'') AS product_name,
             tt.planned_completion_date
      FROM test_tasks tt
      LEFT JOIN products p ON tt.product_id = p.id
      WHERE tt.status IN ('测试中','已测试')
      ORDER BY tt.created_at DESC LIMIT 8
    `);

    /* ── 8. 知识库 ── */
    const kbCategoryDistribution = (await query(`
      SELECT COALESCE(NULLIF(category,''),'其他') AS category,
             COUNT(*) AS count,
             SUM(view_count) AS views,
             SUM(helpful_count) AS helpful
      FROM kb_articles GROUP BY category ORDER BY count DESC
    `)).map(r => ({ category: r.category, count: Number(r.count), views: Number(r.views || 0), helpful: Number(r.helpful || 0) }));

    /* ── 9. 最近动态（跨模块，近14天）── */
    const recentActivities = await query(`
      SELECT 'issue' AS type, i.id, LEFT(i.description, 50) AS name, i.created_at AS timestamp,
             CONCAT('问题登记 - ', COALESCE(s.slabel, i.severity)) AS action
      FROM issues i
      LEFT JOIN (
        SELECT 'low' AS sev, '低' AS slabel UNION ALL SELECT 'medium','中' UNION ALL SELECT 'high','高'
      ) s ON s.sev = i.severity
      WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      UNION ALL
      SELECT 'requirement', cr.id, cr.req_code, cr.created_at, CONCAT('需求登记 - ', cr.requirement_type)
      FROM customer_requirements cr WHERE cr.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      UNION ALL
      SELECT 'task', tt.id, tt.task_code, tt.created_at, CONCAT('测试任务 - ', tt.status)
      FROM test_tasks tt WHERE tt.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      UNION ALL
      SELECT 'release', vr.id, vr.version_number, vr.created_at, '版本发布'
      FROM version_releases vr WHERE vr.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      UNION ALL
      SELECT 'upgrade', du.id, COALESCE(du.description, du.upgrade_type), du.created_at, CONCAT('设备升级 - ', du.upgrade_type)
      FROM device_upgrades du WHERE du.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      UNION ALL
      SELECT 'kb', ka.id, ka.title, ka.created_at, '知识库更新'
      FROM kb_articles ka WHERE ka.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      ORDER BY timestamp DESC LIMIT 30
    `);

    res.json({
      success: true,
      data: {
        kpi,
        issueMonthly,
        issueStatusDistribution,
        issueSeverityDistribution,
        issueCategoryDistribution,
        assigneeWorkload,
        latestHighIssues,
        avgResolutionHours,
        deviceStatusDistribution,
        deviceCustomerDistribution,
        deviceProductLineDistribution,
        deviceModelDistribution,
        abnormalDevices,
        releaseCategoryDistribution,
        latestReleases,
        requirementStatusDistribution,
        requirementTypeDistribution,
        requirementUrgencyDistribution,
        activeRequirements,
        taskStatusDistribution,
        taskPriorityDistribution,
        taskDecisionDistribution,
        activeTasks,
        kbCategoryDistribution,
        recentActivities
      }
    });
  } catch (error) {
    console.error('获取仪表盘统计失败:', error);
    res.status(500).json({ success: false, error: '获取仪表盘统计失败' });
  }
});

// 获取设备概览
router.get('/devices/overview', async (req, res) => {
  try {
    const devicesQuery = `
      SELECT 
        d.*,
        COUNT(DISTINCT m.id) as module_count,
        COUNT(DISTINCT i.id) as issue_count,
        COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) as open_issues
      FROM devices d
      LEFT JOIN modules m ON d.id = m.device_id
      LEFT JOIN issues i ON d.id = i.device_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `;
    
    const devices = await query(devicesQuery);
    
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('获取设备概览失败:', error);
    res.status(500).json({ success: false, error: '获取设备概览失败' });
  }
});

// 获取问题概览
router.get('/issues/overview', async (req, res) => {
  try {
    const issuesQuery = `
      SELECT 
        i.*,
        d.name as device_name,
        d.type as device_type,
        m.category as module_category
      FROM issues i
      LEFT JOIN devices d ON i.device_id = d.id
      LEFT JOIN modules m ON i.module_id = m.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `;
    
    const issues = await query(issuesQuery);
    
    res.json({
      success: true,
      data: issues
    });
  } catch (error) {
    console.error('获取问题概览失败:', error);
    res.status(500).json({ success: false, error: '获取问题概览失败' });
  }
});

// 获取版本概览
router.get('/versions/overview', async (req, res) => {
  try {
    const versionsQuery = `
      SELECT 
        mv.*,
        m.category as module_category,
        d.name as device_name,
        d.type as device_type
      FROM module_versions mv
      LEFT JOIN modules m ON mv.module_id = m.id
      LEFT JOIN devices d ON m.device_id = d.id
      ORDER BY mv.created_at DESC
      LIMIT 10
    `;
    
    const versions = await query(versionsQuery);
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    console.error('获取版本概览失败:', error);
    res.status(500).json({ success: false, error: '获取版本概览失败' });
  }
});

// 获取性能指标
router.get('/performance', async (req, res) => {
  try {
    // 问题解决时间统计
    const resolutionTimeQuery = `
      SELECT 
        AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_resolution_hours,
        MIN(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as min_resolution_hours,
        MAX(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as max_resolution_hours
      FROM issues
      WHERE status = 'closed'
    `;
    
    const [resolutionStats] = await query(resolutionTimeQuery);
    
    // 设备正常运行时间
    const uptimeQuery = `
      SELECT 
        COUNT(CASE WHEN status = '使用中(正常)' THEN 1 END) as normal_devices,
        COUNT(*) as total_devices,
        ROUND(COUNT(CASE WHEN status = '使用中(正常)' THEN 1 END) * 100.0 / COUNT(*), 2) as uptime_percentage
      FROM devices
    `;
    
    const [uptimeStats] = await query(uptimeQuery);
    
    // 版本更新频率
    const updateFrequencyQuery = `
      SELECT 
        COUNT(*) as total_updates,
        COUNT(DISTINCT module_id) as modules_updated,
        AVG(updates_per_module) as avg_updates_per_module
      FROM (
        SELECT 
          module_id,
          COUNT(*) as updates_per_module
        FROM module_versions
        WHERE version_type = 'update'
        GROUP BY module_id
      ) as module_updates
    `;
    
    const [updateStats] = await query(updateFrequencyQuery);
    
    res.json({
      success: true,
      data: {
        resolutionTime: resolutionStats,
        uptime: uptimeStats,
        updateFrequency: updateStats
      }
    });
  } catch (error) {
    console.error('获取性能指标失败:', error);
    res.status(500).json({ success: false, error: '获取性能指标失败' });
  }
});

module.exports = router;
