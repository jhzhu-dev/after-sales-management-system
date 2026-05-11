#!/usr/bin/env node
/**
 * 临时脚本：查询飞书群历史消息，找到含 localhost:3000 的卡片消息并更新链接
 * 在生产服务器上执行：node fix-feishu-message.js
 */

const axios = require('axios');
const mysql = require('mysql2/promise');

const BASE_URL = 'https://open.feishu.cn';

// ─── 1. 从数据库读取飞书配置 ─────────────────────────────────────────────────
async function getConfig() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'mysql',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'device_user',
    password: process.env.DB_PASSWORD || 'device_pass_123',
    database: process.env.DB_NAME || 'device_management',
  });
  const [rows] = await conn.execute('SELECT * FROM feishu_config LIMIT 1');
  await conn.end();
  if (!rows.length) throw new Error('数据库中没有飞书配置');
  return rows[0];
}

// ─── 2. 获取 tenant_access_token ─────────────────────────────────────────────
async function getToken(appId, appSecret) {
  const res = await axios.post(
    `${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`,
    { app_id: appId, app_secret: appSecret },
    { timeout: 8000 }
  );
  if (res.data.code !== 0) throw new Error(`获取 token 失败: ${res.data.msg}`);
  return res.data.tenant_access_token;
}

// ─── 3. 拉取群历史消息（最近 50 条）──────────────────────────────────────────
async function fetchMessages(token, chatId) {
  const res = await axios.get(`${BASE_URL}/open-apis/im/v1/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      container_id_type: 'chat',
      container_id: chatId,
      sort_type: 'ByCreateTimeDesc',
      page_size: 50,
    },
    timeout: 10000,
  });
  if (res.data.code !== 0) throw new Error(`查询消息失败: ${res.data.msg}`);
  return res.data.data?.items || [];
}

// ─── 4. 更新消息内容（patch）─────────────────────────────────────────────────
async function patchMessage(token, messageId, newCard) {
  const res = await axios.patch(
    `${BASE_URL}/open-apis/im/v1/messages/${messageId}`,
    { content: JSON.stringify(newCard) },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 8000,
    }
  );
  return res.data;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  const config = await getConfig();
  const appId     = config.app_id;
  const appSecret = config.app_secret;
  const chatId    = config.chat_id || config.issues_chat_id || config.devices_chat_id;
  const correctBase = process.env.SYSTEM_BASE_URL || 'http://192.168.0.181:5000';

  if (!appId || !appSecret) throw new Error('飞书 app_id / app_secret 未配置');
  if (!chatId) throw new Error('未找到飞书群 chat_id');

  console.log(`[1/4] 获取 token  (app_id: ${appId})`);
  const token = await getToken(appId, appSecret);

  console.log(`[2/4] 查询群 ${chatId} 历史消息（最近 50 条）`);
  const messages = await fetchMessages(token, chatId);
  console.log(`      共拿到 ${messages.length} 条消息`);

  // 筛选含 localhost:3000 的卡片消息
  const badMessages = messages.filter(m => {
    if (m.msg_type !== 'interactive') return false;
    try {
      const content = typeof m.body?.content === 'string'
        ? m.body.content
        : JSON.stringify(m.body?.content || '');
      return content.includes('localhost:3000');
    } catch {
      return false;
    }
  });

  console.log(`[3/4] 找到 ${badMessages.length} 条含 localhost:3000 的消息`);

  if (badMessages.length === 0) {
    console.log('      没有需要修复的消息，退出。');
    return;
  }

  // 修复每条消息
  let fixed = 0;
  for (const msg of badMessages) {
    const msgId = msg.message_id;
    try {
      // 解析原始卡片 JSON
      const rawContent = msg.body?.content;
      const card = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

      // 替换 content 字段中所有 localhost:3000
      const cardStr = JSON.stringify(card).replace(/http:\/\/localhost:3000/g, correctBase);
      const newCard = JSON.parse(cardStr);

      console.log(`\n  修复消息 ${msgId}`);
      console.log(`  发送时间: ${msg.create_time}`);

      const result = await patchMessage(token, msgId, newCard);
      if (result.code === 0) {
        console.log(`  ✓ 修复成功`);
        fixed++;
      } else {
        console.log(`  ✗ 修复失败: ${result.msg}`);
      }
    } catch (err) {
      console.error(`  ✗ 处理消息 ${msgId} 出错:`, err.message);
    }
  }

  console.log(`\n[4/4] 完成，共修复 ${fixed}/${badMessages.length} 条消息`);
}

main().catch(err => {
  console.error('脚本执行出错:', err.message);
  process.exit(1);
});
