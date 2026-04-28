const express = require('express');
const { query } = require('../database');
const router = express.Router();

// 获取仪表盘统计数据
router.get('/stats', async (req, res) => {
  try {
    // 基础统计
    const basicStatsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM devices) as total_devices,
        (SELECT COUNT(*) FROM issues WHERE status != 'closed') as open_issues,
        (SELECT COUNT(DISTINCT version_type) FROM module_versions) as version_types,
        (SELECT COUNT(*) FROM issues WHERE status = 'closed' AND DATE(updated_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as resolved_this_month
    `;
    
    const [basicStats] = await query(basicStatsQuery);
    
    // 设备状态分布
    const deviceStatusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM devices
      GROUP BY status
    `;
    
    const deviceStatusDistribution = await query(deviceStatusQuery);
    
    // 问题状态分布
    const issueStatusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM issues
      GROUP BY status
    `;
    
    const issueStatusDistribution = await query(issueStatusQuery);
    
    // 问题严重性分布
    const issueSeverityQuery = `
      SELECT 
        severity,
        COUNT(*) as count
      FROM issues
      GROUP BY severity
    `;
    
    const issueSeverityDistribution = await query(issueSeverityQuery);
    
    // 版本类型分布
    const versionTypeQuery = `
      SELECT 
        version_type,
        COUNT(*) as count
      FROM module_versions
      GROUP BY version_type
    `;
    
    const versionTypeDistribution = await query(versionTypeQuery);
    
    // 产品线分布（带百分比）
    const productLineQuery = `
      SELECT 
        COALESCE(pl.name, '未分类') as type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM devices), 2) as percentage
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      GROUP BY d.product_line_id, pl.name
      ORDER BY count DESC
    `;
    
    const deviceTypeDistribution = await query(productLineQuery);
    
    // 产品线分布统计
    const productLineStatsQuery = `
      SELECT 
        COALESCE(pl.name, '未指定') as product_line,
        COUNT(*) as total,
        SUM(CASE WHEN d.status = '使用中(正常)' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN d.status = '使用中(异常)' THEN 1 ELSE 0 END) as abnormal,
        SUM(CASE WHEN d.status IN ('生产中', '已停用') THEN 1 ELSE 0 END) as maintenance
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      GROUP BY d.product_line_id, pl.name
      ORDER BY total DESC
      LIMIT 10
    `;
    
    const locationStats = await query(productLineStatsQuery);
    
    // 模块类别分布
    const moduleCategoryQuery = `
      SELECT 
        mt.name as category,
        COUNT(*) as count
      FROM modules m
      LEFT JOIN module_types mt ON m.type_id = mt.id
      GROUP BY m.type_id, mt.name
    `;
    
    const moduleCategoryDistribution = await query(moduleCategoryQuery);
    
    // 最近活动
    const recentActivitiesQuery = `
      SELECT 
        'device' as type,
        id,
        name,
        created_at as timestamp,
        '设备创建' as action
      FROM devices
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'issue' as type,
        id,
        description as name,
        created_at as timestamp,
        CONCAT('问题创建 - ', severity) as action
      FROM issues
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'version' as type,
        mv.id,
        mv.version_number as name,
        mv.created_at as timestamp,
        CONCAT('版本更新 - ', mv.version_type) as action
      FROM module_versions mv
      WHERE mv.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    
    const recentActivities = await query(recentActivitiesQuery);
    
    // 月度趋势数据
    const monthlyTrendsQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        'devices' as type
      FROM devices
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      
      UNION ALL
      
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        'issues' as type
      FROM issues
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      
      UNION ALL
      
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        'versions' as type
      FROM module_versions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      
      ORDER BY month DESC, type
    `;
    
    const monthlyTrends = await query(monthlyTrendsQuery);
    
    res.json({
      success: true,
      data: {
        basicStats,
        deviceStatusDistribution,
        issueStatusDistribution,
        issueSeverityDistribution,
        versionTypeDistribution,
        deviceTypeDistribution,
        locationStats,
        moduleCategoryDistribution,
        recentActivities,
        monthlyTrends
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
