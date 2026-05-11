#!/usr/bin/env node
// 根据设备创建时间定位飞书消息，并用正确链接更新卡片
const axios = require('axios');
const mysql = require('mysql2/promise');

const BASE_URL = 'https://open.feishu.cn';
const DEVICE_ID = process.env.DEVICE_ID || 'F21720011631TR0082';
const CORRECT_BASE = process.env.SYSTEM_BASE_URL || 'http://192.168.0.181:5000';

async function main() {
  // 1. 从数据库取设备信息
  const conn = await mysql.createConnection({
    host: 'mysql', port: 3306,
    user: 'device_user', password: 'device_pass_123',
    database: 'device_management',
  });
  const [deviceRows] = await conn.execute(
    `SELECT d.*, pl.name AS product_line_name, p.name AS product_model, c.name AS customer_name
     FROM devices d
     LEFT JOIN product_lines pl ON d.product_line_id = pl.id
     LEFT JOIN products p ON d.product_id = p.id
     LEFT JOIN customers c ON d.customer_id = c.id
     WHERE d.id = ?`, [DEVICE_ID]
  );
  const [configRows] = await conn.execute('SELECT * FROM feishu_config LIMIT 1');
  await conn.end();

  if (!deviceRows.length) throw new Error(`找不到设备 ${DEVICE_ID}`);
  if (!configRows.length) throw new Error('未找到飞书配置');

  const device = deviceRows[0];
  const config = configRows[0];
  const chatId = config.chat_id || config.issues_chat_id || config.devices_chat_id;

  console.log(`设备信息: ${device.id} | ${device.name} | 创建时间: ${device.created_at}`);
  const deviceCreatedMs = new Date(device.created_at).getTime();

  // 2. 获取 token
  const tokenRes = await axios.post(
    `${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`,
    { app_id: config.app_id, app_secret: config.app_secret },
    { timeout: 8000 }
  );
  const token = tokenRes.data.tenant_access_token;

  // 3. 查询群历史消息
  const res = await axios.get(`${BASE_URL}/open-apis/im/v1/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { container_id_type: 'chat', container_id: chatId, page_size: 50 },
    timeout: 10000,
  });
  const items = res.data.data?.items || [];
  console.log(`\n共 ${items.length} 条消息，设备创建时间戳: ${deviceCreatedMs}`);

  // 4. 找出设备创建时间前后 5 分钟内的 "新设备录入" 消息
  const candidates = items.filter(m => {
    if (m.msg_type !== 'interactive') return false;
    const content = m.body?.content || '';
    if (!content.includes('新设备录入')) return false;
    const msgTs = parseInt(m.create_time); // 飞书时间戳是毫秒
    const diff = Math.abs(msgTs - deviceCreatedMs);
    return diff < 5 * 60 * 1000; // 5 分钟内
  });

  console.log(`\n时间匹配到 ${candidates.length} 条候选消息：`);
  candidates.forEach(m => {
    const ts = new Date(parseInt(m.create_time)).toLocaleString('zh-CN');
    console.log(`  ${m.message_id}  ${ts}`);
  });

  if (candidates.length === 0) {
    // 放宽到 30 分钟
    const wider = items.filter(m => {
      if (m.msg_type !== 'interactive') return false;
      const content = m.body?.content || '';
      if (!content.includes('新设备录入')) return false;
      const msgTs = parseInt(m.create_time);
      const diff = Math.abs(msgTs - deviceCreatedMs);
      return diff < 30 * 60 * 1000;
    });
    console.log(`放宽到 30 分钟，找到 ${wider.length} 条：`);
    wider.forEach(m => {
      const ts = new Date(parseInt(m.create_time)).toLocaleString('zh-CN');
      console.log(`  ${m.message_id}  ${ts}`);
    });
    if (wider.length === 0) {
      console.log('\n仍未找到匹配消息，打印所有新设备录入消息供手动确认：');
      items.filter(m => m.msg_type === 'interactive' && (m.body?.content || '').includes('新设备录入')).forEach(m => {
        const ts = new Date(parseInt(m.create_time)).toLocaleString('zh-CN');
        console.log(`  ${m.message_id}  ${ts}`);
      });
      return;
    }
    candidates.push(...wider);
  }

  // 5. 重建正确的卡片并 PATCH
  const newCard = {
    schema: '2.0',
    body: {
      elements: [{
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**序列号：** ${device.id || '-'}　**设备名：** ${device.name || '-'}\n**产品线：** ${device.product_line_name || '-'}　**型号：** ${device.product_model || '-'}\n**客户：** ${device.customer_name || '-'}\n[填写版本信息](${CORRECT_BASE}/devices/${device.id})`,
        },
      }],
    },
    header: { title: { tag: 'plain_text', content: '🖥️ 新设备录入' }, template: 'blue' },
  };

  console.log('\n重建的卡片内容预览:');
  console.log(JSON.stringify(newCard.body.elements[0].text.content));

  for (const msg of candidates) {
    const ts = new Date(parseInt(msg.create_time)).toLocaleString('zh-CN');
    console.log(`\nPATCH ${msg.message_id} (${ts}) ...`);
    const patchRes = await axios.patch(
      `${BASE_URL}/open-apis/im/v1/messages/${msg.message_id}`,
      { content: JSON.stringify(newCard) },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    if (patchRes.data.code === 0) {
      console.log(`  ✓ 修复成功`);
    } else {
      console.log(`  ✗ 失败: ${patchRes.data.msg}`);
    }
  }
}

main().catch(e => {
  console.error('出错:', e.message);
  if (e.response) console.error('response:', JSON.stringify(e.response.data));
  process.exit(1);
});
