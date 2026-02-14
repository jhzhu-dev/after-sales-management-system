const express = require('express');
const { query } = require('../database');
const router = express.Router();

/**
 * @route GET /api/after-sales/stats/trend
 * @desc Get monthly after-sales issue trend for the last 6 months
 */
router.get('/stats/trend', async (req, res) => {
  try {
    const trendQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed
      FROM issues
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `;
    const trend = await query(trendQuery);
    res.json({ success: true, data: trend });
  } catch (error) {
    console.error('获取售后趋势失败:', error);
    res.status(500).json({ success: false, error: '获取售后趋势失败' });
  }
});

/**
 * @route GET /api/after-sales/stats/categories
 * @desc Get issue counts grouped by category
 */
router.get('/stats/categories', async (req, res) => {
  try {
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as count
      FROM issues
      GROUP BY category
    `;
    const categories = await query(categoryQuery);
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('获取分类统计失败:', error);
    res.status(500).json({ success: false, error: '获取分类统计失败' });
  }
});

/**
 * @route GET /api/after-sales/stats/severities
 * @desc Get issue counts grouped by severity
 */
router.get('/stats/severities', async (req, res) => {
  try {
    const severityQuery = `
      SELECT 
        severity,
        COUNT(*) as count
      FROM issues
      GROUP BY severity
    `;
    const severities = await query(severityQuery);
    res.json({ success: true, data: severities });
  } catch (error) {
    console.error('获取严重性统计失败:', error);
    res.status(500).json({ success: false, error: '获取严重性统计失败' });
  }
});



/**
 * @route GET /api/after-sales/overview
 * @desc Get high-level after-sales metrics
 */
router.get('/overview', async (req, res) => {
  try {
    const metricsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM issues WHERE status != 'closed') as pending_issues,
        (SELECT COUNT(*) FROM issues WHERE is_visit_required = 1 AND visit_at >= CURDATE()) as upcoming_visits,
        (SELECT COUNT(*) FROM device_upgrades WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as recent_upgrades
    `;
    const metrics = await query(metricsQuery);
    res.json({ success: true, data: metrics[0] });
  } catch (error) {
    console.error('获取售后概览失败:', error);
    res.status(500).json({ success: false, error: '获取售后概览失败' });
  }
});

module.exports = router;
