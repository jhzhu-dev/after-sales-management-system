#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const xlsx = require('xlsx');

const EXCEL_COLS = {
  orderNo: '订单号',
  productShortVersion: '产品简称&版本',
  customerName: '售后登记名称',
  model: '型号',
  merchantId: '商户号',
  deviceCode: '设备编码',
  serialNo: '序列号',
  todeskCode: 'Todesk Code',
  password: 'Password',
};

const MANUAL_CUSTOMER_MAP = {
  '合肥-WL': 21,
  '北京-BQ': 12,
  '阿联酋-POC-Barsha': 24,
  '阿联酋-POC-Barsha Basement': 24,
  '北京公交-SL': 19,
};

const FORCE_NEW_CUSTOMERS = new Set([
  '美国-TS',
  '西班牙-VTEQ',
  '俄罗斯-TL',
  '科威特-BU',
  '澳洲-MH',
  '约旦-SL',
]);

const MODEL_ALIAS = {
  'TSD-CV-LG-2010': 'TSD-PV-LG-2010',
};

const DEFAULT_STATUS = '使用中(正常)';

function normalize(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function customerShortNameFromName(name) {
  const n = normalize(name);
  if (!n) return '';
  const idx = n.indexOf('-');
  if (idx >= 0 && idx < n.length - 1) return n.slice(idx + 1).trim() || n;
  return n;
}

function groupByOrderNo(rows) {
  const m = new Map();
  for (const r of rows) {
    const orderNo = normalize(r[EXCEL_COLS.orderNo]);
    if (!orderNo) continue;
    if (!m.has(orderNo)) m.set(orderNo, []);
    m.get(orderNo).push(r);
  }
  return m;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='));
  const envArg = args.find((a) => a.startsWith('--env='));
  const dryRun = args.includes('--dry-run');
  if (!fileArg) {
    console.error('请提供参数: --file=<excel路径> [--dry-run] [--env=.env.prod]');
    process.exit(1);
  }

  if (envArg) {
    const envPathRaw = envArg.replace('--env=', '');
    const envPath = path.isAbsolute(envPathRaw) ? envPathRaw : path.join(process.cwd(), envPathRaw);
    require('dotenv').config({ path: envPath, override: true });
  }

  const excelPathRaw = fileArg.replace('--file=', '').trim();
  const excelPath = path.isAbsolute(excelPathRaw) ? excelPathRaw : path.join(process.cwd(), excelPathRaw);
  if (!fs.existsSync(excelPath)) {
    console.error(`Excel 文件不存在: ${excelPath}`);
    process.exit(1);
  }

  return { excelPath, dryRun };
}

function parseExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  const firstSheet = wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });
  return { firstSheet, rows };
}

function generateNickname(customerName, productShortName, serialNo) {
  const customer = normalize(customerName);
  const product = normalize(productShortName);
  const serial = normalize(serialNo);
  const last4 = serial ? serial.slice(-4) : '';
  return `${customer}${product}${last4}`;
}

function chooseVersion(productVersions, productId, excelVersionText) {
  const txt = normalize(excelVersionText);
  if (!txt) return null;
  const list = productVersions.get(productId) || [];
  const hit = list.find((v) => {
    const vn = normalize(v.version_number);
    const vname = normalize(v.version_name);
    return (vn && txt.includes(vn)) || (vname && txt.includes(vname));
  });
  return hit || null;
}

async function loadState(db, excelRows) {
  const [products] = await db.query('SELECT id, product_line_id, name, short_name, model FROM products');
  const [customers] = await db.query('SELECT id, name, short_name FROM customers');
  const [versions] = await db.query('SELECT id, product_id, version_number, version_name FROM product_versions');
  const [productModuleRows] = await db.query('SELECT product_id, module_type_id FROM product_modules');

  const serials = [...new Set(excelRows.map((r) => normalize(r[EXCEL_COLS.serialNo])).filter(Boolean))];
  const codes = [...new Set(excelRows.map((r) => normalize(r[EXCEL_COLS.deviceCode])).filter(Boolean))];
  const orderNos = [...new Set(excelRows.map((r) => normalize(r[EXCEL_COLS.orderNo])).filter(Boolean))];

  const [devicesById] = await db.query(
    'SELECT id, name, nickname, device_code, product_line_id, product_id, customer_id, status, remote_code, password, merchant_id, notes, bundle_id FROM devices WHERE id IN (?)',
    [serials.length ? serials : ['__none__']]
  );
  const [devicesByCode] = await db.query(
    'SELECT id, name, nickname, device_code, product_line_id, product_id, customer_id, status, remote_code, password, merchant_id, notes, bundle_id FROM devices WHERE device_code IN (?)',
    [codes.length ? codes : ['__none__']]
  );
  const [bundles] = await db.query(
    'SELECT id, bundle_code, customer_id, name FROM device_bundles WHERE bundle_code IN (?)',
    [orderNos.length ? orderNos : ['__none__']]
  );

  const productsByModel = new Map();
  for (const p of products) {
    const k = normalize(p.model);
    if (!k) continue;
    if (!productsByModel.has(k)) productsByModel.set(k, []);
    productsByModel.get(k).push(p);
  }

  const customersByName = new Map();
  const customersByShort = new Map();
  const customersById = new Map();
  for (const c of customers) {
    customersByName.set(normalize(c.name), c);
    customersById.set(c.id, c);
    customersByShort.set(normalize(c.short_name).toLowerCase(), c);
  }

  const versionsByProduct = new Map();
  for (const v of versions) {
    if (!versionsByProduct.has(v.product_id)) versionsByProduct.set(v.product_id, []);
    versionsByProduct.get(v.product_id).push(v);
  }

  const deviceByIdMap = new Map(devicesById.map((d) => [d.id, d]));
  const deviceByCodeMap = new Map();
  for (const d of devicesByCode) {
    if (!d.device_code) continue;
    deviceByCodeMap.set(d.device_code, d);
    // 将旧设备（如数字ID）的完整记录也存入 deviceByIdMap，供后续 replaceDeviceId 使用
    if (!deviceByIdMap.has(d.id)) deviceByIdMap.set(d.id, d);
  }

  // 复合 key = "bundle_code|customer_id"，支持同一订单号对应不同客户
  const bundlesByCodeAndCustomer = new Map();
  for (const b of bundles) {
    bundlesByCodeAndCustomer.set(`${normalize(b.bundle_code)}|${b.customer_id}`, b);
  }

  // 产品 -> 模块类型列表
  const moduleTypesByProduct = new Map();
  for (const pm of productModuleRows) {
    if (!moduleTypesByProduct.has(pm.product_id)) moduleTypesByProduct.set(pm.product_id, []);
    moduleTypesByProduct.get(pm.product_id).push(pm.module_type_id);
  }

  return {
    productsByModel,
    customersByName,
    customersByShort,
    customersById,
    versionsByProduct,
    deviceByIdMap,
    deviceByCodeMap,
    bundlesByCodeAndCustomer,
    moduleTypesByProduct,
  };
}

function matchCustomer(excelName, state) {
  const name = normalize(excelName);
  if (!name) return { level: 'missing', db: null };

  // Always reuse exact same name if already present (DB or current run).
  const exact = state.customersByName.get(name);
  if (exact) return { level: 'exact', db: exact };

  if (FORCE_NEW_CUSTOMERS.has(name)) {
    return { level: 'new', db: null, note: 'force_new' };
  }

  if (Object.prototype.hasOwnProperty.call(MANUAL_CUSTOMER_MAP, name)) {
    const id = MANUAL_CUSTOMER_MAP[name];
    const db = state.customersById.get(id);
    return { level: 'manual', db };
  }

  const short = customerShortNameFromName(name).toLowerCase();
  const byShort = state.customersByShort.get(short);
  if (byShort) return { level: 'short_name', db: byShort };

  return { level: 'new', db: null };
}

async function createCustomer(db, state, excelName, stats, logs) {
  let short = customerShortNameFromName(excelName);
  if (!short) short = normalize(excelName);

  let finalShort = short;
  let suffix = 2;
  while (state.customersByShort.has(finalShort.toLowerCase())) {
    finalShort = `${short}${suffix}`;
    suffix += 1;
  }

  const [res] = await db.query('INSERT INTO customers(name, short_name) VALUES(?, ?)', [excelName, finalShort]);
  const c = { id: res.insertId, name: excelName, short_name: finalShort };
  state.customersByName.set(c.name, c);
  state.customersByShort.set(c.short_name.toLowerCase(), c);
  state.customersById.set(c.id, c);
  stats.customersCreated += 1;
  logs.push(`  + 创建客户: ${c.name} (short_name=${c.short_name}, id=${c.id})`);
  return c;
}

function resolveProductByModel(rawModel, state) {
  const model = normalize(rawModel);
  if (!model) return { ok: false, reason: '缺少型号' };

  const mappedModel = MODEL_ALIAS[model] || model;
  const list = state.productsByModel.get(mappedModel) || [];
  if (list.length === 0) return { ok: false, reason: `型号不存在: ${model} (映射后=${mappedModel})` };
  if (list.length > 1) return { ok: false, reason: `型号匹配多个产品: ${mappedModel}` };
  return { ok: true, product: list[0], mappedModel };
}

async function getOrCreateBundle(db, state, orderNo, customerId, stats, logs) {
  // 复合 key：同一订单号可属于不同客户
  const key = `${orderNo}|${customerId}`;
  let b = state.bundlesByCodeAndCustomer.get(key);
  if (b) return b;

  const [res] = await db.query(
    'INSERT INTO device_bundles(bundle_code, name, customer_id, description) VALUES(?, ?, ?, ?)',
    [orderNo, orderNo, customerId, 'Excel导入自动创建']
  );
  b = { id: res.insertId, bundle_code: orderNo, customer_id: customerId, name: orderNo };
  state.bundlesByCodeAndCustomer.set(key, b);
  stats.bundlesCreated += 1;
  logs.push(`  + 创建Bundle: ${orderNo} (客户id=${customerId}, bundle.id=${b.id})`);
  return b;
}

function buildUpdatePatch(existing, incoming) {
  const patch = {};
  for (const key of Object.keys(incoming)) {
    const current = existing[key];
    const next = incoming[key];
    // undefined 与 null 视为相同（旧设备字段未加载时可能为 undefined）
    const isEmpty = current === null || current === undefined || current === '';
    if (isEmpty && next !== null && next !== undefined && next !== '') {
      patch[key] = next;
    }
  }
  return patch;
}

async function applyUpdate(db, serialNo, patch) {
  const keys = Object.keys(patch);
  if (keys.length === 0) return 0;
  const setSql = keys.map((k) => `${k} = ?`).join(', ');
  const params = keys.map((k) => patch[k]);
  params.push(serialNo);
  const [res] = await db.query(`UPDATE devices SET ${setSql} WHERE id = ?`, params);
  return res.affectedRows;
}

async function insertDevice(db, payload) {
  const sql = `
    INSERT INTO devices(
      id, name, nickname, device_code, product_line_id, product_id,
      customer_id, status, remote_code, password, merchant_id, notes, bundle_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    payload.id,
    payload.name,
    payload.nickname,
    payload.device_code,
    payload.product_line_id,
    payload.product_id,
    payload.customer_id,
    payload.status,
    payload.remote_code,
    payload.password,
    payload.merchant_id,
    payload.notes,
    payload.bundle_id,
  ];
  await db.query(sql, params);
}

/**
 * 将旧设备的 PK(id) 替换为正式序列号，并迁移所有关联记录。
 * 使用 FOREIGN_KEY_CHECKS=0 绕过 MySQL 对 PK 更新的外键限制。
 */
async function replaceDeviceId(db, oldId, newId, newName, oldRecord, state, logs) {
  await db.query('SET FOREIGN_KEY_CHECKS=0');
  try {
    // 仅当旧 name 为空时才填入订单号
    const nameToSet = (oldRecord.name === null || oldRecord.name === undefined || oldRecord.name === '') ? newName : oldRecord.name;
    await db.query(
      'UPDATE devices SET id=?, name=?, updated_at=NOW() WHERE id=?',
      [newId, nameToSet, oldId]
    );
    await db.query('UPDATE modules SET device_id=? WHERE device_id=?', [newId, oldId]);
    await db.query('UPDATE issues SET device_id=? WHERE device_id=?', [newId, oldId]);
    try {
      await db.query('UPDATE device_documents SET device_id=? WHERE device_id=?', [newId, oldId]);
    } catch (_) { /* device_documents 可能无 device_id 列，忽略 */ }
  } finally {
    await db.query('SET FOREIGN_KEY_CHECKS=1');
  }
  // 更新内存状态
  const updatedRecord = Object.assign({}, oldRecord, { id: newId, name: oldRecord.name || newName });
  state.deviceByIdMap.delete(oldId);
  state.deviceByIdMap.set(newId, updatedRecord);
  if (oldRecord.device_code) {
    state.deviceByCodeMap.set(oldRecord.device_code, { id: newId, device_code: oldRecord.device_code });
  }
  logs.push(`  ↳ ID替换: ${oldId} → ${newId} (关联记录已迁移)`);
}

/**
 * 处理同一客户的一批设备（单客户订单或多客户订单的一个子组）。
 * bundleCode 已由调用方决定（单客户=订单号，多客户=订单号-short_name）。
 */
async function processSubGroup(db, orderNo, customerName, subRows, state, stats, bundleCode) {
  const logs = [];

  const customerMatch = matchCustomer(customerName, state);
  let customer = customerMatch.db;
  if (!customer) {
    customer = await createCustomer(db, state, customerName, stats, logs);
  }

  const shouldBundle = subRows.length >= 2 || state.bundlesByCodeAndCustomer.has(`${bundleCode}|${customer.id}`);
  let bundle = null;
  if (shouldBundle) {
    bundle = await getOrCreateBundle(db, state, bundleCode, customer.id, stats, logs);
  }

  for (let i = 0; i < subRows.length; i++) {
    const row = subRows[i];
    let serialNo     = normalize(row[EXCEL_COLS.serialNo]);
    const deviceCode = normalize(row[EXCEL_COLS.deviceCode]);
    const model      = normalize(row[EXCEL_COLS.model]);
    const merchantId = normalize(row[EXCEL_COLS.merchantId]);
    const remoteCode = normalize(row[EXCEL_COLS.todeskCode]);
    const password   = normalize(row[EXCEL_COLS.password]);
    const verText    = normalize(row[EXCEL_COLS.productShortVersion]);

    // 序列号缺失时自动生成占位 ID，后续人工补充
    if (!serialNo) {
      serialNo = `PENDING-${orderNo}-${i + 1}`;
      logs.push(`  ↳ 行(${i + 1}): 序列号缺失，使用占位ID: ${serialNo}`);
    }
    // device_code 允许为空（字段可 NULL），不跳过

    const productRes = resolveProductByModel(model, state);
    if (!productRes.ok) {
      stats.rowsSkipped += 1;
      logs.push(`  - 跳过行(${i + 1}, 序列号=${serialNo}): ${productRes.reason}`);
      continue;
    }
    const product = productRes.product;

    const existingByCode = state.deviceByCodeMap.get(deviceCode);
    let existingById = state.deviceByIdMap.get(serialNo);

    // ── 旧设备 ID 替换：device_code 已存在但 id 不同 ──────────────────────────
    if (!existingById && existingByCode && existingByCode.id !== serialNo) {
      const oldRecord = state.deviceByIdMap.get(existingByCode.id) || existingByCode;
      logs.push(`  → 正式序列号替换旧记录: ${existingByCode.id} → ${serialNo}`);
      await replaceDeviceId(db, existingByCode.id, serialNo, orderNo, oldRecord, state, logs);
      existingById = state.deviceByIdMap.get(serialNo);
    }

    const version  = chooseVersion(state.versionsByProduct, product.id, verText);
    const nickname = generateNickname(customer.name, product.short_name || product.name, serialNo);

    if (existingById) {
      // ── UPDATE：仅补全空字段 ───────────────────────────────────────────────
      const incoming = {
        name: orderNo,
        nickname,
        device_code: deviceCode,
        product_line_id: product.product_line_id,
        product_id: product.id,
        customer_id: customer.id,
        status: DEFAULT_STATUS,
        remote_code: remoteCode,
        password,
        merchant_id: merchantId,
        bundle_id: bundle ? bundle.id : null,
      };
      const patch = buildUpdatePatch(existingById, incoming);
      if (Object.prototype.hasOwnProperty.call(patch, 'bundle_id') && patch.bundle_id === null) {
        delete patch.bundle_id;
      }
      const changed = await applyUpdate(db, serialNo, patch);
      if (changed > 0) {
        stats.rowsUpdated += 1;
        Object.assign(existingById, patch);
        logs.push(`  ~ 更新设备: ${serialNo} (补全字段: ${Object.keys(patch).join(', ')})`);
      } else {
        stats.rowsUnchanged += 1;
        logs.push(`  = 已存在且无需更新: ${serialNo}`);
      }
    } else {
      // ── INSERT：新设备 ────────────────────────────────────────────────────
      const payload = {
        id: serialNo,
        name: orderNo,
        nickname,
        device_code: deviceCode,
        product_line_id: product.product_line_id,
        product_id: product.id,
        customer_id: customer.id,
        status: DEFAULT_STATUS,
        remote_code: remoteCode || null,
        password: password || null,
        merchant_id: merchantId || null,
        notes: null,
        bundle_id: bundle ? bundle.id : null,
      };
      await insertDevice(db, payload);
      state.deviceByIdMap.set(serialNo, payload);
      if (deviceCode) state.deviceByCodeMap.set(deviceCode, { id: serialNo, device_code: deviceCode });
      stats.rowsInserted += 1;
      logs.push(`  + 新增设备: ${serialNo} (device_code=${deviceCode || 'null'}${version ? `, version=${version.version_number || version.version_name}` : ''})`);

      // 自动分配产品对应的模块
      const moduleTypeIds = state.moduleTypesByProduct.get(product.id) || [];
      if (moduleTypeIds.length > 0) {
        for (const typeId of moduleTypeIds) {
          await db.query(
            'INSERT IGNORE INTO modules(device_id, type_id, status) VALUES(?, ?, ?)',
            [serialNo, typeId, '正常']
          );
        }
        logs.push(`    └ 分配模块 ${moduleTypeIds.length} 个 (product_id=${product.id})`);
        stats.modulesAssigned = (stats.modulesAssigned || 0) + moduleTypeIds.length;
      }
    }
  }

  return logs;
}

/**
 * 处理一个订单组（可含多个客户）。
 * 单客户 → bundle_code = 订单号
 * 多客户 → 按客户拆分子组，bundle_code = 订单号-客户short_name
 */
async function processOrderGroup(db, orderNo, groupRows, state, stats) {
  const logs = [];

  // 按客户名称分组
  const customerGroups = new Map();
  for (const row of groupRows) {
    const cn = normalize(row[EXCEL_COLS.customerName]);
    if (!cn) {
      stats.rowsSkipped += 1;
      logs.push(`  - 跳过行: 缺少客户名称`);
      continue;
    }
    if (!customerGroups.has(cn)) customerGroups.set(cn, []);
    customerGroups.get(cn).push(row);
  }

  const isMultiCustomer = customerGroups.size > 1;
  if (isMultiCustomer) {
    logs.push(`  → 多客户订单，拆为 ${customerGroups.size} 个子Bundle (bundle_code = 订单号，按客户区分)`);
  }

  for (const [customerName, subRows] of customerGroups.entries()) {
    // bundle_code 始终用订单号，不同客户通过 (bundle_code, customer_id) 联合唯一索引区分
    const subLogs = await processSubGroup(db, orderNo, customerName, subRows, state, stats, orderNo);
    logs.push(...subLogs);
  }

  return logs;
}

async function main() {
  const { excelPath, dryRun } = parseArgs();
  const { firstSheet, rows } = parseExcel(excelPath);

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'els',
    password: process.env.DB_PASSWORD || '111111',
    database: process.env.DB_NAME || 'device_management',
    charset: 'utf8mb4',
    timezone: '+08:00',
  };

  console.log('='.repeat(88));
  console.log(`Excel 导入脚本 ${dryRun ? '(DRY RUN)' : '(WRITE MODE)'}`);
  console.log(`Sheet: ${firstSheet}, 行数: ${rows.length}`);
  console.log(`Excel: ${excelPath}`);
  console.log(`DB: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  console.log('策略: 序列号已存在 => 仅补全null字段；下单时间不导入；status=使用中(正常)');
  console.log('='.repeat(88));

  const db = await mysql.createConnection(dbConfig);
  const state = await loadState(db, rows);
  const orderGroups = groupByOrderNo(rows);

  const stats = {
    groups: orderGroups.size,
    groupsCommitted: 0,
    groupErrors: 0,
    customersCreated: 0,
    bundlesCreated: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsUnchanged: 0,
    rowsSkipped: 0,
  };

  try {
    if (dryRun) {
      await db.beginTransaction();
      for (const [orderNo, groupRows] of orderGroups.entries()) {
        console.log(`\n[订单] ${orderNo} (${groupRows.length}行)`);
        const logs = await processOrderGroup(db, orderNo, groupRows, state, stats);
        for (const line of logs) console.log(line);
      }
      await db.rollback();
      console.log('\nDRY RUN 完成，已回滚全部变更。');
    } else {
      for (const [orderNo, groupRows] of orderGroups.entries()) {
        console.log(`\n[订单] ${orderNo} (${groupRows.length}行)`);
        try {
          await db.beginTransaction();
          const logs = await processOrderGroup(db, orderNo, groupRows, state, stats);
          for (const line of logs) console.log(line);
          await db.commit();
          stats.groupsCommitted += 1;
        } catch (e) {
          await db.rollback();
          stats.groupErrors += 1;
          console.log(`  ! 订单事务回滚: ${e.message}`);
        }
      }
    }
  } finally {
    await db.end();
  }

  console.log('\n' + '='.repeat(88));
  console.log('导入结果汇总');
  console.log('='.repeat(88));
  console.log(`订单组: ${stats.groups}`);
  console.log(`成功提交订单组: ${dryRun ? 'N/A(dry-run)' : stats.groupsCommitted}`);
  console.log(`失败订单组: ${stats.groupErrors}`);
  console.log(`创建客户: ${stats.customersCreated}`);
  console.log(`创建Bundle: ${stats.bundlesCreated}`);
  console.log(`新增设备: ${stats.rowsInserted}`);
  console.log(`分配模块: ${stats.modulesAssigned || 0}`);
  console.log(`更新设备: ${stats.rowsUpdated}`);
  console.log(`无需更新: ${stats.rowsUnchanged}`);
  console.log(`跳过行: ${stats.rowsSkipped}`);

  if (dryRun) {
    console.log('\n下一步可执行正式导入:');
    console.log(`node scripts/import-devices-from-excel.js --file=${path.relative(process.cwd(), excelPath)}`);
  }
}

main().catch((e) => {
  console.error('执行失败:', e.stack || e.message);
  process.exit(1);
});
