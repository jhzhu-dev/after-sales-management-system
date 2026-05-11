#!/usr/bin/env node
const axios = require('axios');
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql', port: 3306,
    user: 'device_user', password: 'device_pass_123',
    database: 'device_management',
  });
  const [rows] = await conn.execute('SELECT * FROM feishu_config LIMIT 1');
  await conn.end();
  const config = rows[0];

  const tokenRes = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: config.app_id, app_secret: config.app_secret },
    { timeout: 8000 }
  );
  const token = tokenRes.data.tenant_access_token;

  const chatId = config.chat_id || config.issues_chat_id || config.devices_chat_id;
  const res = await axios.get('https://open.feishu.cn/open-apis/im/v1/messages', {
    headers: { Authorization: `Bearer ${token}` },
    params: { container_id_type: 'chat', container_id: chatId, page_size: 50 },
    timeout: 10000,
  });

  const items = res.data.data?.items || [];
  console.log('总消息数:', items.length);
  
  // 打印所有 interactive 消息的 body.content 原文
  items.filter(m => m.msg_type === 'interactive').forEach((m, i) => {
    const raw = m.body?.content;
    console.log(`\n--- interactive [${i}] id=${m.message_id} ---`);
    console.log(typeof raw === 'string' ? raw.substring(0, 500) : JSON.stringify(raw).substring(0, 500));
  });
}
main().catch(e => { console.error('err:', e.message); if (e.response) console.error(JSON.stringify(e.response.data)); });
