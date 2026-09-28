const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const { query } = require('../database');

// 读取设置（登录用户可读）
router.get('/dashboard-enabled', authenticate, async (req, res) => {
  try {
    const rows = await query(
      "SELECT svalue FROM system_settings WHERE skey = 'dashboard_enabled'"
    );
    // 默认关闭
    const enabled = rows.length > 0 ? rows[0].svalue === 'true' : false;
    res.json({ success: true, data: { enabled } });
  } catch (error) {
    console.error('读取仪表盘开关失败:', error);
    res.status(500).json({ success: false, error: '读取设置失败' });
  }
});

// 修改设置（仅管理员）
router.put('/dashboard-enabled', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: '仅管理员可修改此设置' });
    }
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled 必须为布尔值' });
    }
    await query(
      `INSERT INTO system_settings (skey, svalue, updated_by) VALUES ('dashboard_enabled', ?, ?)
       ON DUPLICATE KEY UPDATE svalue = VALUES(svalue), updated_by = VALUES(updated_by)`,
      [String(enabled), req.user?.username || 'admin']
    );
    res.json({ success: true, data: { enabled } });
  } catch (error) {
    console.error('保存仪表盘开关失败:', error);
    res.status(500).json({ success: false, error: '保存设置失败' });
  }
});

module.exports = router;
