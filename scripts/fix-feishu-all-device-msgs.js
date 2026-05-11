#!/usr/bin/env node
/**
 * 全量修复飞书"新设备录入"通知消息
 * 策略：按发送时间最近的设备创建记录匹配，重建卡片并 PATCH
 */
const axios = require('axios');
const mysql = require('mysql2/promise');

const BASE_URL = 'https://open.feishu.cn';
const CORRECT_BASE = process.env.SYSTEM_BASE_URL || 'http://192.168.0.181:5000';

async function main() {
  // ─── 1. 数据库：取飞书配置 + 所有设备 ────────────────────
  const conn = await mysql.createConnection({
    host: 'mysql', port: 3306,
    user: 'device_user', password: 'device_pass_123',
    database: 'device_management',
  });

  const [configRows] = await conn.execute('SELECT * FROM feishu_config LIMIT 1');
  if (!configRows.length) throw new Error('未找到飞书配置');
  const config = configRows[0];

  const [devices] = await conn.execute(
    `SELECT d.id, d.name, d.created_at,
            pl.name AS product_line_name,
            p.name  AS product_model,
            c.name  AS customer_name
     FROM devices d
     LEFT JOIN product_lines pl ON d.product_line_id = pl.id
     LEFT JOIN products      p  ON d.product_id      = p.id
     LEFT JOIN customers     c  ON d.customer_id     = c.id
     ORDER BY d.created_at DESC`
  );
  await conn.end();

  console.log(`[1/4] 从数据库读取 ${devices.length} 台设备`);

  const chatId = config.chat_id || config.issues_chat_id || config.devices_chat_id;

  // ─── 2. 获取 token ─────────────────────────────────────────
  const tokenRes = await axios.post(
    `${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`,
    { app_id: config.app_id, app_secret: config.app_secret },
    { timeout: 8000 }
  );
  if (tokenRes.data.code !== 0) throw new Error(`token 获取失败: ${tokenRes.data.msg}`);
  const token = tokenRes.data.tenant_access_token;

  // ─── 3. 拉取群历史消息（最多 50 条） ──────────────────────
  const res = await axios.get(`${BASE_URL}/open-apis/im/v1/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { container_id_type: 'chat', container_id: chatId, page_size: 50 },
    timeout: 10000,
  });
  if (res.data.code !== 0) throw new Error(`查询消息失败: ${res.data.msg}`);

  const allMessages = res.data.data?.items || [];
  // 筛选"新设备录入"卡片消息
  const deviceMessages = allMessages.filter(m =>
    m.msg_type === 'interactive' &&
    (m.body?.content || '').includes('新设备录入')
  );

  console.log(`[2/4] 找到 ${deviceMessages.length} 条"新设备录入"消息`);

  // ─── 4. 按时间戳匹配设备 → PATCH ──────────────────────────
  console.log(`[3/4] 开始按时间最近原则匹配设备并修复...\n`);

  let fixed = 0;
  const usedDeviceIds = new Set();

  for (const msg of deviceMessages) {
    const msgTs = parseInt(msg.create_time); // 毫秒
    const msgTime = new Date(msgTs).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    // 找时间最接近且未被占用的设备
    let bestDevice = null;
    let bestDiff = Infinity;
    for (const d of devices) {
      if (usedDeviceIds.has(d.id)) continue;
      const deviceTs = new Date(d.created_at).getTime();
      const diff = Math.abs(msgTs - deviceTs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestDevice = d;
      }
    }

    if (!bestDevice) {
      console.log(`  [SKIP] ${msg.message_id} (${msgTime}) — 没有可匹配的设备`);
      continue;
    }

    const diffSec = Math.round(bestDiff / 1000);
    console.log(`  消息: ${msg.message_id} (${msgTime})`);
    console.log(`  匹配: ${bestDevice.id} | ${bestDevice.name} | 时差 ${diffSec}s`);

    // 重建卡片（保留原始提示文字，@信息因数据库未存储无法恢复）
    const cardContent = `有新设备已录入，请确认版本信息\n**序列号：** ${bestDevice.id || '-'}　**设备名：** ${bestDevice.name || '-'}\n**产品线：** ${bestDevice.product_line_name || '-'}　**型号：** ${bestDevice.product_model || '-'}\n**客户：** ${bestDevice.customer_name || '-'}\n[填写版本信息](${CORRECT_BASE}/devices/${bestDevice.id})`;

    const newCard = {
      schema: '2.0',
      body: {
        elements: [{
          tag: 'div',
          text: { tag: 'lark_md', content: cardContent },
        }],
      },
      header: { title: { tag: 'plain_text', content: '🖥️ 新设备录入' }, template: 'blue' },
    };

    // PATCH 消息
    const patchRes = await axios.patch(
      `${BASE_URL}/open-apis/im/v1/messages/${msg.message_id}`,
      { content: JSON.stringify(newCard) },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 8000 }
    );

    if (patchRes.data.code === 0) {
      console.log(`  ✓ 修复成功  →  ${CORRECT_BASE}/devices/${bestDevice.id}\n`);
      usedDeviceIds.add(bestDevice.id);
      fixed++;
    } else {
      console.log(`  ✗ 修复失败: ${patchRes.data.msg}\n`);
    }
  }

  console.log(`[4/4] 完成，共修复 ${fixed}/${deviceMessages.length} 条消息`);
}

main().catch(e => {
  console.error('出错:', e.message);
  if (e.response) console.error('response:', JSON.stringify(e.response.data));
  process.exit(1);
});
