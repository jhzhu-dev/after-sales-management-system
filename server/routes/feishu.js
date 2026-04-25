/**
 * 飞书集成管理路由
 * 提供飞书配置读写、员工同步、测试消息等管理接口
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const feishuService = require('../services/feishu-service');

/**
 * GET /api/feishu/config — 获取当前飞书配置（app_secret 脱敏）
 */
router.get('/config', async (req, res) => {
  try {
    const config = await feishuService.getConfig();
    if (!config) {
      return res.json({ success: true, data: null });
    }
    // 脱敏 app_secret
    const safeConfig = { ...config };
    if (safeConfig.app_secret) safeConfig.app_secret = '***';
    res.json({ success: true, data: safeConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/feishu/config — 保存飞书配置
 */
router.post('/config', async (req, res) => {
  try {
    const { app_id, app_secret, chat_id } = req.body;

    // 检查是否已有配置
    const existing = await feishuService.getConfig();

    if (existing) {
      // 更新：如果 app_secret 是 '***' 则不更新该字段
      const secretClause = app_secret && app_secret !== '***'
        ? ', app_secret = ?'
        : '';
      const params = [app_id, chat_id];
      if (app_secret && app_secret !== '***') params.splice(1, 0, app_secret);
      params.push(existing.id);

      await query(
        `UPDATE feishu_config SET app_id = ?${secretClause}, chat_id = ? WHERE id = ?`,
        params
      );
    } else {
      await query(
        `INSERT INTO feishu_config (app_id, app_secret, chat_id) VALUES (?, ?, ?)`,
        [app_id, app_secret || '', chat_id || '']
      );
    }

    res.json({ success: true, message: '配置已保存' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/feishu/sync-users — 手动触发同步飞书通讯录
 */
router.post('/sync-users', async (req, res) => {
  try {
    const { count, chatName, clearedModules } = await feishuService.syncUsers();
    res.json({ success: true, data: { synced: count, chatName, clearedModules, timestamp: new Date().toISOString() } });
  } catch (err) {
    console.error('[飞书同步]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/feishu/users — 获取已同步的员工列表
 */
router.get('/users', async (req, res) => {
  try {
    const users = await query(
      'SELECT open_id, name, department, avatar_url, synced_at FROM feishu_users WHERE is_active = 1 ORDER BY department, name'
    );
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/feishu/test-message — 发送测试消息验证配置
 */
router.post('/test-message', async (req, res) => {
  try {
    const config = await feishuService.getConfig();
    const chatId = config?.chat_id || config?.issues_chat_id || config?.devices_chat_id || config?.upgrades_chat_id;
    if (!chatId) {
      return res.status(400).json({ success: false, error: '请先配置通知群 Chat ID' });
    }

    const testCard = {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: '✅ 飞书集成测试消息' },
        template: 'green',
      },
      body: {
        elements: [
          {
            tag: 'markdown',
            content: '这是一条来自**设备管理系统**的测试消息，表示飞书通知功能配置成功！\n\n发送时间：' + new Date().toLocaleString('zh-CN'),
          },
        ],
      },
    };

    await feishuService.sendGroupMessage(chatId, testCard);
    res.json({ success: true, message: '测试消息已发送' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
