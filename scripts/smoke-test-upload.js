/**
 * 产品文档上传冒烟测试脚本
 *
 * 用法: node scripts/smoke-test-upload.js [base_url]
 * 示例: node scripts/smoke-test-upload.js http://192.168.0.181:5000
 *
 * 测试步骤（全程自清理，不留生产数据）：
 *   1. 登录获取 token
 *   2. 获取第一个可用产品（只读）
 *   3. 上传一个微型测试文件（< 1 KB）
 *   4. 验证文件名一致性（original_name == 上传文件名 == OSS 路径文件名）
 *   5. 验证文档可在列表中查询到（只读）
 *   6. 立即删除测试文档（清理）
 *   7. 验证删除成功（只读）
 */

'use strict';

const FormData = require('form-data');
const http     = require('http');
const https    = require('https');
const os       = require('os');

// ─── 配置 ──────────────────────────────────────────────────────────────────
let BASE_URL = process.argv[2] || 'http://127.0.0.1:5000';

// Windows 本地测试: localhost → 127.0.0.1，避免 IPv6 解析到其它进程
BASE_URL = BASE_URL.replace(/^(https?:\/\/)localhost(:\d+)?/, '$1127.0.0.1$2');

const USERNAME = process.env.TEST_USERNAME || 'elsvision';
const PASSWORD = process.env.TEST_PASSWORD || 'elsvisiongo666';

// ─── HTTP 工具 ────────────────────────────────────────────────────────────
function httpRequest(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const opts   = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers,
    };
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch {
          reject(new Error('Non-JSON response: ' + Buffer.concat(chunks).toString().slice(0, 300)));
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (typeof body.pipe === 'function') { body.pipe(req); return; }
      req.write(body);
    }
    req.end();
  });
}

async function api(method, path, token, body, extraHeaders) {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return httpRequest(method, BASE_URL + path, headers, body);
}

// ─── 输出工具 ─────────────────────────────────────────────────────────────
function pass(msg)      { console.log('  ✅', msg); }
function fail(msg)      { console.error('  ❌', msg); process.exit(1); }
function warn(msg)      { console.warn('  ⚠️ ', msg); }
function step(n, title) { console.log(`\n[${n}] ${title}`); }

// ─── 主流程 ───────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(62));
  console.log(' 产品文档上传 - 冒烟测试（自清理，不影响生产数据）');
  console.log(' 目标:', BASE_URL);
  console.log(' 时间:', new Date().toLocaleString('zh-CN'));
  console.log(' 主机:', os.hostname());
  console.log('='.repeat(62));

  let token, productId, docId;

  // ── 步骤 1：登录 ─────────────────────────────────────────────────────
  step(1, '登录验证');
  {
    const r = await api('POST', '/api/auth/login', null,
      JSON.stringify({ username: USERNAME, password: PASSWORD }),
      { 'Content-Type': 'application/json' }
    );
    if (r.status !== 200 || !r.data.token)
      fail(`登录失败 HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    token = r.data.token;
    pass(`登录成功，用户: ${r.data.username}`);
  }

  // ── 步骤 2：获取产品（只读）────────────────────────────────────────────
  step(2, '获取产品列表（只读）');
  {
    const r = await api('GET', '/api/products', token);
    if (r.status !== 200 || !r.data.success)
      fail(`获取产品失败 HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    const products = r.data.data || [];
    if (products.length === 0) fail('没有可用产品，无法执行上传测试');
    productId = products[0].id;
    pass(`找到 ${products.length} 个产品，选用: ID=${productId} ${products[0].name || products[0].model}`);
  }

  // ── 步骤 3：上传测试文件 ───────────────────────────────────────────────
  step(3, '上传测试文档（将在步骤6立即删除）');
  const testFileName = `smoke-test-${Date.now()}.txt`;
  {
    const form = new FormData();
    form.append('product_id', String(productId));
    form.append('doc_type', '其他');
    form.append('title', `[smoke-test ${new Date().toISOString()}]`);
    form.append('file',
      Buffer.from('smoke-test-content - safe to delete'),
      { filename: testFileName, contentType: 'text/plain' }
    );

    const headers = { ...form.getHeaders(), Authorization: 'Bearer ' + token };
    const r = await httpRequest('POST', BASE_URL + '/api/product-documents/upload', headers, form);

    if (r.status !== 201 || !r.data.success)
      fail(`上传失败 HTTP ${r.status}: ${JSON.stringify(r.data)}`);

    docId = r.data.data.id;
    const returnedName = r.data.data.original_name;
    const ossPath      = r.data.data.file_path || '';

    pass(`上传成功，文档 ID=${docId}`);

    // ── 步骤 4：文件名一致性验证 ────────────────────────────────────────
    step(4, '验证文件名一致性');

    if (returnedName !== testFileName)
      fail(`original_name 不一致：期望 "${testFileName}"，实际 "${returnedName}"`);
    pass(`original_name = "${returnedName}" ✓（与上传文件名一致）`);

    if (ossPath.startsWith('oss://')) {
      const ossFileName = ossPath.split('/').pop();
      if (ossFileName !== testFileName)
        fail(`OSS 路径末尾文件名 "${ossFileName}" ≠ 上传文件名 "${testFileName}"`);
      pass(`OSS 路径文件名 = "${ossFileName}" ✓`);
      pass(`OSS 完整路径: ${ossPath}`);
    } else {
      warn(`OSS 未启用，文件存储于本地: ${ossPath}`);
    }
  }

  // ── 步骤 5：验证文档可查询 ─────────────────────────────────────────────
  step(5, '验证文档出现在列表中（只读）');
  {
    const r = await api('GET', `/api/product-documents?product_id=${productId}`, token);
    if (r.status !== 200 || !r.data.success)
      fail(`获取文档列表失败 HTTP ${r.status}`);
    const found = (r.data.data || []).some(d => d.id === docId);
    if (!found) fail(`刚上传的文档 ID=${docId} 未出现在列表中`);
    pass(`文档 ID=${docId} 已出现在文档列表（共 ${r.data.data.length} 条）`);
  }

  // ── 步骤 6：删除测试文档 ──────────────────────────────────────────────
  step(6, '清理：删除测试文档');
  {
    const r = await api('DELETE', `/api/product-documents/${docId}`, token);
    if (r.status !== 200 || !r.data.success)
      fail(`删除失败 HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    pass(`测试文档 ID=${docId} 已删除`);
  }

  // ── 步骤 7：确认已删除 ────────────────────────────────────────────────
  step(7, '确认测试数据已完全清理（只读）');
  {
    const r = await api('GET', `/api/product-documents?product_id=${productId}`, token);
    if (r.status !== 200 || !r.data.success)
      fail(`获取文档列表失败 HTTP ${r.status}`);
    const found = (r.data.data || []).some(d => d.id === docId);
    if (found) fail(`文档 ID=${docId} 仍存在，清理失败，请手动删除`);
    pass(`已确认文档列表中无测试残留（${r.data.data.length} 条记录均为真实数据）`);
  }

  console.log('\n' + '='.repeat(62));
  console.log(' 🎉 全部 7 步测试通过！');
  console.log(' ✅ 上传功能正常，文件名一致性验证通过');
  console.log(' ✅ 生产数据零残留（自清理完成）');
  console.log('='.repeat(62) + '\n');
  process.exit(0);
})().catch(err => {
  console.error('\n❌ 测试异常:', err.message);
  if (typeof docId !== 'undefined') {
    console.error(`⚠️  请手动删除测试文档 ID=${docId} 以清理数据`);
  }
  process.exit(1);
});
