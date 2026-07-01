/**
 * 飞书通知服务层
 * 支持 Mock 模式（FEISHU_MOCK_MODE=true）和真实飞书 API，代码完全一致。
 * 切换只需修改环境变量：FEISHU_BASE_URL / FEISHU_APP_ID / FEISHU_APP_SECRET
 */

const axios = require('axios');
const os = require('os');
const { query } = require('../database');

const BASE_URL = process.env.FEISHU_BASE_URL || 'https://open.feishu.cn';
const APP_ID = process.env.FEISHU_APP_ID || '';
const APP_SECRET = process.env.FEISHU_APP_SECRET || '';

let _systemBaseUrlCache = null;
let _systemBaseUrlCacheAt = 0;
const SYSTEM_BASE_URL_CACHE_TTL = 60_000;

function normalizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function isLocalhostUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url || '');
}

function detectLanBaseUrl() {
  const port = process.env.PORT || 5000;
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return `http://${net.address}:${port}`;
      }
    }
  }
  return `http://localhost:${port}`;
}

/**
 * 飞书通知卡片中的系统链接基址
 * 优先级：环境变量 SYSTEM_BASE_URL > 飞书设置 system_base_url > 生产环境局域网 IP > 开发默认
 */
async function getSystemBaseUrl() {
  const envUrl = normalizeBaseUrl(process.env.SYSTEM_BASE_URL);
  if (envUrl && !(process.env.NODE_ENV === 'production' && isLocalhostUrl(envUrl))) {
    return envUrl;
  }

  const now = Date.now();
  if (_systemBaseUrlCache && now - _systemBaseUrlCacheAt < SYSTEM_BASE_URL_CACHE_TTL) {
    return _systemBaseUrlCache;
  }

  try {
    const config = await getConfig();
    const dbUrl = normalizeBaseUrl(config?.system_base_url);
    if (dbUrl) {
      _systemBaseUrlCache = dbUrl;
      _systemBaseUrlCacheAt = now;
      return dbUrl;
    }
  } catch (_) {
    // ignore
  }

  if (process.env.NODE_ENV === 'production') {
    const detected = detectLanBaseUrl();
    console.warn(`[飞书] SYSTEM_BASE_URL 未配置，通知链接暂用 ${detected}。请在 .env 或飞书设置中配置系统访问地址`);
    return detected;
  }

  return envUrl || 'http://localhost:3000';
}

function invalidateSystemBaseUrlCache() {
  _systemBaseUrlCache = null;
  _systemBaseUrlCacheAt = 0;
}

// 内存 token 缓存（按 app_id 区分）
const _tokenCacheMap = {};

/**
 * 获取 tenant_access_token（带 5 分钟提前刷新缓存）
 * 优先使用数据库中存储的 app_id / app_secret，回退到环境变量
 */
async function getTenantToken() {
  // 优先从数据库读取凭据
  const config = await getConfig();
  const appId = (config && config.app_id) || APP_ID;
  const appSecret = (config && config.app_secret) || APP_SECRET;

  const now = Date.now();
  const cached = _tokenCacheMap[appId];
  if (cached && now < cached.expiresAt - 5 * 60 * 1000) {
    return cached.token;
  }
  const res = await axios.post(
    `${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`,
    { app_id: appId, app_secret: appSecret },
    { timeout: 8000 }
  );
  const data = res.data;
  if (data.code !== 0) throw new Error(`飞书 token 错误: ${data.msg}`);
  _tokenCacheMap[appId] = {
    token: data.tenant_access_token,
    expiresAt: now + data.expire * 1000,
  };
  return _tokenCacheMap[appId].token;
}

/**
 * 从数据库读取飞书配置行
 */
async function getConfig() {
  const rows = await query('SELECT * FROM feishu_config LIMIT 1');
  return rows[0] || null;
}

/**
 * 发送群消息（Interactive Card）
 * @param {string} chatId
 * @param {object} card  — 已构建好的飞书卡片 JSON
 */
async function sendGroupMessage(chatId, card) {
  const token = await getTenantToken();
  const res = await axios.post(
    `${BASE_URL}/open-apis/im/v1/messages?receive_id_type=chat_id`,
    {
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 8000,
    }
  );
  // 返回 message_id 供调用方保存日志
  return res.data?.data?.message_id || null;
}

// ─── Card builders ────────────────────────────────────────────────────────────

function buildMentionElement(openId) {
  return openId
    ? { tag: 'at', user_id: openId }
    : null;
}

/**
 * 严重程度视觉化配置
 */
const SEVERITY_CONFIG = {
  high:   { emoji: '🔴', label: '高', template: 'red',    headerPrefix: '🚨' },
  medium: { emoji: '🟡', label: '中', template: 'orange', headerPrefix: '⚠️' },
  low:    { emoji: '🟢', label: '低', template: 'green',  headerPrefix: '📋' },
};

/**
 * 新售后问题通知卡片
 */
function buildIssueCard(issue, mentionOpenId, mentionText = '您有一条新的售后问题需要处理', systemBaseUrl) {
  const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG['medium'];
  const severityText = `${sev.emoji} ${sev.label}`;
  const elements = [];
  const mentionLine = mentionOpenId ? `<at id="${mentionOpenId}"></at> ${mentionText}\n` : '';
  const baseUrl = normalizeBaseUrl(systemBaseUrl) || 'http://localhost:3000';
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `${mentionLine}**设备：** ${issue.device_id || '-'}　**严重程度：** ${severityText}\n**描述：** ${issue.description || '-'}\n[查看详情](${baseUrl}/issues/${issue.id})`,
    },
  });
  return {
    schema: '2.0',
    body: { elements },
    header: {
      title: { tag: 'plain_text', content: `${sev.headerPrefix} 新售后问题` },
      template: sev.template,
    },
  };
}

/**
 * 新设备创建通知卡片
 * @param {object} device
 * @param {string|string[]} mentionOpenIds  — 单个 open_id 或数组，所有人在同一条消息中被 @
 */
function buildDeviceCard(device, mentionOpenIds, systemBaseUrl) {
  const ids = Array.isArray(mentionOpenIds)
    ? mentionOpenIds.filter(Boolean)
    : (mentionOpenIds ? [mentionOpenIds] : []);
  const elements = [];
  const mentionPart = ids.map(id => `<at id="${id}"></at>`).join(' ');
  const mentionLine = mentionPart ? `${mentionPart} 有新设备已录入，请确认版本信息\n` : '';
  const baseUrl = normalizeBaseUrl(systemBaseUrl) || 'http://localhost:3000';
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `${mentionLine}**序列号：** ${device.id || '-'}　**设备名：** ${device.name || '-'}\n**产品线：** ${device.product_line_name || '-'}　**型号：** ${device.product_model || '-'}\n**客户：** ${device.customer_name || '-'}\n[填写版本信息](${baseUrl}/devices/${device.id})`,
    },
  });
  return {
    schema: '2.0',
    body: { elements },
    header: { title: { tag: 'plain_text', content: '🖥️ 新设备录入' }, template: 'blue' },
  };
}

/**
 * 升级任务通知卡片
 */
function buildUpgradeCard(upgrade, mentionOpenId) {
  const elements = [];
  const mentionLine = mentionOpenId ? `<at id="${mentionOpenId}"></at> 您有新的升级任务\n` : '';
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `${mentionLine}**设备：** ${upgrade.device_id || '-'}　**类型：** ${upgrade.upgrade_type || '-'}\n**描述：** ${upgrade.description || '-'}`,
    },
  });
  return {
    schema: '2.0',
    body: { elements },
    header: { title: { tag: 'plain_text', content: '⬆️ 升级任务' }, template: 'green' },
  };
}

// ─── 高层通知函数（fire-and-forget，永不抛出）────────────────────────────────

// 获取统一通知群 Chat ID（优先用 chat_id，兼容旧字段）
function resolveChatId(config) {
  return config.chat_id || config.issues_chat_id || config.devices_chat_id || config.upgrades_chat_id || null;
}

async function sendIssueNotification(issue, assigneeOpenId) {
  try {
    const config = await getConfig();
    const chatId = resolveChatId(config);
    if (!config || !chatId) return;
    const systemBaseUrl = await getSystemBaseUrl();
    const card = buildIssueCard(issue, assigneeOpenId, '您有一条新的售后问题需要处理', systemBaseUrl);
    const messageId = await sendGroupMessage(chatId, card);
    if (messageId) {
      await query(
        'INSERT INTO feishu_notifications (message_id, type, ref_id, notify_open_ids) VALUES (?, ?, ?, ?)',
        [messageId, 'issue', String(issue.id), JSON.stringify(assigneeOpenId ? [assigneeOpenId] : [])]
      ).catch(e => console.warn('[飞书] 写入通知日志失败:', e.message));
    }
  } catch (err) {
    console.error('[飞书] 发送问题通知失败:', err.message);
  }
}

/**
 * 发送设备录入通知，每台设备只发一条消息，同时 @ 所有相关人员
 * @param {object} device
 * @param {string|string[]} notifyOpenIds — 单个 open_id 或数组
 */
async function sendDeviceNotification(device, notifyOpenIds) {
  try {
    const config = await getConfig();
    const chatId = resolveChatId(config);
    if (!config || !chatId) return;
    const systemBaseUrl = await getSystemBaseUrl();
    const card = buildDeviceCard(device, notifyOpenIds, systemBaseUrl);
    const messageId = await sendGroupMessage(chatId, card);
    if (messageId) {
      await query(
        'INSERT INTO feishu_notifications (message_id, type, ref_id, notify_open_ids) VALUES (?, ?, ?, ?)',
        [messageId, 'device', String(device.id), JSON.stringify(Array.isArray(notifyOpenIds) ? notifyOpenIds : (notifyOpenIds ? [notifyOpenIds] : []))]
      ).catch(e => console.warn('[飞书] 写入通知日志失败:', e.message));
    }
  } catch (err) {
    console.error('[飞书] 发送设备通知失败:', err.message);
  }
}

async function sendIssueUpdateNotification(issue, changeType, assigneeOpenId) {
  try {
    const config = await getConfig();
    const chatId = resolveChatId(config);
    if (!config || !chatId) return;
    const mentionText = '您被指定为该问题的跟进人，请及时处理';
    const systemBaseUrl = await getSystemBaseUrl();
    const card = buildIssueCard(issue, assigneeOpenId, mentionText, systemBaseUrl);
    const messageId = await sendGroupMessage(chatId, card);
    if (messageId) {
      await query(
        'INSERT INTO feishu_notifications (message_id, type, ref_id, notify_open_ids) VALUES (?, ?, ?, ?)',
        [messageId, 'issue', String(issue.id), JSON.stringify(assigneeOpenId ? [assigneeOpenId] : [])]
      ).catch(e => console.warn('[飞书] 写入通知日志失败:', e.message));
    }
  } catch (err) {
    console.error('[飞书] 发送问题更新通知失败:', err.message);
  }
}

async function sendUpgradeNotification(upgrade, operatorOpenId) {
  try {
    const config = await getConfig();
    const chatId = resolveChatId(config);
    if (!config || !chatId) return;
    const card = buildUpgradeCard(upgrade, operatorOpenId);
    const messageId = await sendGroupMessage(chatId, card);
    if (messageId) {
      await query(
        'INSERT INTO feishu_notifications (message_id, type, ref_id, notify_open_ids) VALUES (?, ?, ?, ?)',
        [messageId, 'upgrade', String(upgrade.id), JSON.stringify(operatorOpenId ? [operatorOpenId] : [])]
      ).catch(e => console.warn('[飞书] 写入通知日志失败:', e.message));
    }
  } catch (err) {
    console.error('[飞书] 发送升级通知失败:', err.message);
  }
}

/**
 * 同步飞书通讯录用户到本地数据库
 */
async function syncUsers() {
  const token = await getTenantToken();
  const config = await getConfig();
  const chatId = resolveChatId(config);
  if (!chatId) throw new Error('未配置飞书群 Chat ID，无法同步群成员');

  // 获取群名称
  let chatName = chatId;
  try {
    const chatInfoRes = await axios.get(`${BASE_URL}/open-apis/im/v1/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    if (chatInfoRes.data.code === 0) chatName = chatInfoRes.data.data?.name || chatId;
  } catch (e) {
    console.warn('[飞书] 获取群名称失败:', e.message);
  }

  // 分页拉取群成员（open_id 类型）
  const memberOpenIds = [];
  let pageToken = undefined;
  do {
    const params = { member_id_type: 'open_id', page_size: 100 };
    if (pageToken) params.page_token = pageToken;
    const res = await axios.get(`${BASE_URL}/open-apis/im/v1/chats/${chatId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      timeout: 10000,
    });
    if (res.data.code !== 0) throw new Error(`获取群成员失败: ${res.data.msg}`);
    const items = res.data.data?.items || [];
    for (const m of items) {
      // 过滤掉机器人（bot 类型），只保留用户
      if (m.member_id_type === 'open_id' || m.member_id_type === undefined) {
        memberOpenIds.push(m.member_id);
      }
    }
    pageToken = res.data.data?.has_more ? res.data.data.page_token : undefined;
  } while (pageToken);

  if (memberOpenIds.length === 0) return 0;

  // 并行拉取用户详情（每批最多 20 个并发）
  const BATCH_SIZE = 20;
  const newUsers = [];
  for (let i = 0; i < memberOpenIds.length; i += BATCH_SIZE) {
    const batch = memberOpenIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(openId =>
        axios.get(`${BASE_URL}/open-apis/contact/v3/users/${openId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { user_id_type: 'open_id' },
          timeout: 10000,
        })
      )
    );
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'rejected') {
        // 通讯录接口无权限时降级：直接用群成员信息（无 department）
        console.warn('[飞书] 无法获取用户详情，使用群成员基础信息:', batch[j], result.reason?.message);
        continue;
      }
      const u = result.value.data?.data?.user;
      if (!u) continue;
      newUsers.push([u.open_id, u.union_id || null, u.name, u.department_name || u.department || '', u.avatar?.avatar_72 || null]);
    }
  }

  // 通讯录接口失败时，回退到群成员基础信息（仅有 name，无 department）
  if (newUsers.length === 0 && memberOpenIds.length > 0) {
    // 再次拉取群成员（items 里有 name 字段）
    const res2 = await axios.get(`${BASE_URL}/open-apis/im/v1/chats/${chatId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { member_id_type: 'open_id', page_size: 100 },
      timeout: 10000,
    });
    for (const m of (res2.data.data?.items || [])) {
      if (m.member_id_type === 'open_id' || m.member_id_type === undefined) {
        newUsers.push([m.member_id, null, m.name, '', null]);
      }
    }
  }

  // 清空旧数据，全量批量写入
  await query('DELETE FROM feishu_users');
  if (newUsers.length > 0) {
    const placeholders = newUsers.map(() => '(?, ?, ?, ?, ?, 1, NOW())').join(', ');
    const values = newUsers.flat();
    await query(
      `INSERT INTO feishu_users (open_id, union_id, name, department, avatar_url, is_active, synced_at) VALUES ${placeholders}`,
      values
    );
  }

  // 顺带更新 module_types 中匹配用户的名字缓存
  if (newUsers.length > 0) {
    for (const [openId, , name] of newUsers) {
      await query(
        'UPDATE module_types SET feishu_user_name = ? WHERE feishu_user_open_id = ?',
        [name, openId]
      ).catch(() => {});
    }
  }

  // 清除已不在群中的用户的模块关联
  let clearedModules = [];
  try {
    const newOpenIds = newUsers.map(u => u[0]);
    let staleModules;
    if (newOpenIds.length > 0) {
      const inList = newOpenIds.map(() => '?').join(',');
      staleModules = await query(
        `SELECT id, name FROM module_types WHERE feishu_user_open_id IS NOT NULL AND feishu_user_open_id NOT IN (${inList})`,
        newOpenIds
      );
    } else {
      staleModules = await query(
        'SELECT id, name FROM module_types WHERE feishu_user_open_id IS NOT NULL'
      );
    }
    if (staleModules.length > 0) {
      const ids = staleModules.map(m => m.id);
      const idPh = ids.map(() => '?').join(',');
      await query(`UPDATE module_types SET feishu_user_open_id = NULL WHERE id IN (${idPh})`, ids);
      clearedModules = staleModules.map(m => m.name);
    }
  } catch (e) {
    console.error('清除失效模块关联失败:', e.message);
  }

  return { count: newUsers.length, chatName, clearedModules };
}

module.exports = {
  getConfig,
  getTenantToken,
  getSystemBaseUrl,
  invalidateSystemBaseUrlCache,
  syncUsers,
  sendGroupMessage,
  sendIssueNotification,
  sendDeviceNotification,
  sendIssueUpdateNotification,
  sendUpgradeNotification,
};
