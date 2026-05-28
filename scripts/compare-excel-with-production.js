#!/usr/bin/env node
'use strict';

/**
 * 对比 Excel 与生产数据库数据，输出导入可行性报告（仅检查，不写入）
 *
 * 用法:
 *   node scripts/compare-excel-with-production.js --file=订单清单.xlsx
 *   node scripts/compare-excel-with-production.js --file=订单清单.xlsx --env=.env.prod
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const xlsx = require('xlsx');

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='));
const envArg = args.find((a) => a.startsWith('--env='));

if (envArg) {
  const envPath = envArg.replace('--env=', '');
  require('dotenv').config({ path: path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath), override: true });
}

if (!fileArg) {
  console.error('请提供参数: --file=<excel路径>');
  process.exit(1);
}

const excelPathRaw = fileArg.replace('--file=', '').trim();
const excelPath = path.isAbsolute(excelPathRaw) ? excelPathRaw : path.join(process.cwd(), excelPathRaw);

if (!fs.existsSync(excelPath)) {
  console.error(`Excel 文件不存在: ${excelPath}`);
  process.exit(1);
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'els',
  password: process.env.DB_PASSWORD || '111111',
  database: process.env.DB_NAME || 'device_management',
  charset: 'utf8mb4',
  timezone: '+08:00',
};

const EXCEL_COLS = {
  orderTime: '下单时间',
  orderNo: '订单号',
  productShortVersion: '产品简称&版本',
  customerName: '售后登记名称',
  productFullName: '产品全称',
  model: '型号',
  qty: '数量',
  merchantId: '商户号',
  cloudAccount: 'Cloud登录账号',
  cloudPassword: 'Cloud登录密码',
  deviceCode: '设备编码',
  serialNo: '序列号',
  todeskCode: 'Todesk Code',
  password: 'Password',
};

/**
 * 人工确认的客户映射表（Excel客户名 → 生产库 customer_id）
 * 经人工核对，以下 Excel 客户名对应系统中已有的客户。
 * 导入时直接使用此 ID，不重新创建。
 */
const MANUAL_CUSTOMER_MAP = {
  '合肥-WL':                     21,  // DB[21] 合肥-蔚来
  '北京-BQ':                     12,  // DB[12] 北京-北汽 舜尧
  '阿联酋-POC-Barsha':           24,  // DB[24] 迪拜-BARSHA
  '阿联酋-POC-Barsha Basement':  24,  // DB[24] 迪拜-BARSHA
  '北京公交-SL':                 19,  // DB[19] 北京-公交SL
};

/**
 * 人工确认需要强制新增的客户（尽管模糊匹配有候选，但不是同一客户）
 * 导入时跳过模糊匹配，直接走新增流程。
 */
const FORCE_NEW_CUSTOMERS = new Set([
  '美国-TS',
  '西班牙-VTEQ',
  '俄罗斯-TL',
  '科威特-BU',
  '澳洲-MH',
  '约旦-SL',
]);

function normalize(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function customerShortNameFromName(name) {
  const n = normalize(name);
  if (!n) return '';
  const idx = n.indexOf('-');
  if (idx >= 0 && idx < n.length - 1) {
    return n.slice(idx + 1).trim() || n;
  }
  return n;
}

async function getTableColumns(db, tableName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${tableName}`);
  return rows.map((r) => ({
    field: r.Field,
    type: r.Type,
    nullable: r.Null === 'YES',
    key: r.Key,
    default: r.Default,
    extra: r.Extra,
  }));
}

function printColumns(title, cols) {
  console.log(`\n${title}`);
  for (const c of cols) {
    console.log(`  - ${c.field} | ${c.type} | null=${c.nullable ? 'Y' : 'N'} | key=${c.key || '-'} | default=${c.default ?? '-'} | extra=${c.extra || '-'}`);
  }
}

function parseExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  const firstSheet = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheet];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  return { firstSheet, rows };
}

function normalizeModelForCompare(model) {
  return normalize(model)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[_]/g, '-')
    .replace(/[^A-Z0-9-]/g, '');
}

function suggestModels(missingModel, allModels) {
  const src = normalizeModelForCompare(missingModel);
  if (!src) return [];

  const cvToPv = src.replace('-CV-', '-PV-');
  const pvToCv = src.replace('-PV-', '-CV-');

  const suggestions = [];
  for (const m of allModels) {
    const n = normalizeModelForCompare(m);
    if (!n) continue;
    if (
      n === cvToPv ||
      n === pvToCv ||
      n.includes(src) ||
      src.includes(n) ||
      n.replace('-CV-', '-PV-') === cvToPv ||
      n.replace('-PV-', '-CV-') === pvToCv
    ) {
      suggestions.push(m);
    }
  }
  return [...new Set(suggestions)].slice(0, 5);
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

/**
 * 客户名称匹配（优先级：人工映射 > 精确 > short_name > 包含/模糊）
 *   level: 'manual' | 'exact' | 'short_name' | 'fuzzy' | 'fuzzy_multi' | 'new'
 */
function matchCustomer(excelName, customersByName, customersByShort, dbCustomersById) {
  // 0. 强制新增 — 跳过所有匹配
  if (FORCE_NEW_CUSTOMERS.has(excelName)) {
    return { level: 'new', db: null, note: '人工确认：新客户' };
  }

  // 1. 人工映射表优先
  if (Object.prototype.hasOwnProperty.call(MANUAL_CUSTOMER_MAP, excelName)) {
    const id = MANUAL_CUSTOMER_MAP[excelName];
    const db = dbCustomersById.get(id);
    return { level: 'manual', db, note: `人工指定 → DB[${id}]` };
  }

  // 2. 精确匹配
  const exact = customersByName.get(normalize(excelName));
  if (exact) return { level: 'exact', db: exact };

  // 3. short_name 匹配
  const extracted = customerShortNameFromName(excelName).toLowerCase();
  if (extracted) {
    const byShort = customersByShort.get(extracted);
    if (byShort) return { level: 'short_name', db: byShort };

    // 4. 包含匹配
    const candidates = [];
    for (const [, c] of customersByName.entries()) {
      const dbName = normalize(c.name).toLowerCase();
      const dbShort = normalize(c.short_name).toLowerCase();
      if (
        dbName.includes(extracted) ||
        extracted.includes(dbShort) ||
        dbShort.includes(extracted)
      ) {
        candidates.push(c);
      }
    }
    if (candidates.length === 1) return { level: 'fuzzy', db: candidates[0] };
    if (candidates.length > 1) return { level: 'fuzzy_multi', db: candidates };
  }

  return { level: 'new', db: null };
}

function buildCustomerComparison(excelRows, customersByName, customersByShort, dbCustomersById) {
  // 收集 Excel 中唯一客户名及对应设备数
  const excelCustomers = new Map(); // name -> count
  for (const r of excelRows) {
    const name = normalize(r[EXCEL_COLS.customerName]);
    if (!name) continue;
    excelCustomers.set(name, (excelCustomers.get(name) || 0) + 1);
  }

  const manual = [];
  const exact = [];
  const byShortName = [];
  const fuzzy = [];
  const fuzzyMulti = [];
  const needCreate = [];

  for (const [name, count] of excelCustomers.entries()) {
    const result = matchCustomer(name, customersByName, customersByShort, dbCustomersById);
    const entry = { excelName: name, count, ...result };
    if (result.level === 'manual') manual.push(entry);
    else if (result.level === 'exact') exact.push(entry);
    else if (result.level === 'short_name') byShortName.push(entry);
    else if (result.level === 'fuzzy') fuzzy.push(entry);
    else if (result.level === 'fuzzy_multi') fuzzyMulti.push(entry);
    else needCreate.push(entry);
  }

  return { manual, exact, byShortName, fuzzy, fuzzyMulti, needCreate };
}

async function main() {
  console.log('='.repeat(80));
  console.log('Excel vs 生产数据库 对比工具（只读）');
  console.log('='.repeat(80));
  console.log(`Excel: ${excelPath}`);
  console.log(`DB: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  const { firstSheet, rows } = parseExcel(excelPath);
  console.log(`\nSheet: ${firstSheet}`);
  console.log(`Excel 行数: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Excel 无数据行，退出。');
    return;
  }

  const db = await mysql.createConnection(dbConfig);

  try {
    const [products] = await db.query('SELECT id, product_line_id, name, short_name, model FROM products');
    const [customers] = await db.query('SELECT id, name, short_name FROM customers');
    const [deviceRows] = await db.query('SELECT id, device_code, name, bundle_id FROM devices');
    const [bundles] = await db.query('SELECT id, bundle_code, customer_id FROM device_bundles');
    const [versionRows] = await db.query('SELECT id, product_id, version_number, version_name FROM product_versions');

    const productsByModel = new Map();
    const allProductModels = [];
    for (const p of products) {
      const k = normalize(p.model);
      if (!k) continue;
      allProductModels.push(k);
      if (!productsByModel.has(k)) productsByModel.set(k, []);
      productsByModel.get(k).push(p);
    }

    const customersByName = new Map();
    const customersByShort = new Map();
    const dbCustomersById = new Map();
    for (const c of customers) {
      customersByName.set(normalize(c.name), c);
      dbCustomersById.set(c.id, c);
      if (c.short_name) {
        customersByShort.set(normalize(c.short_name).toLowerCase(), c);
      }
    }

    const deviceByCode = new Map();
    for (const d of deviceRows) {
      const k = normalize(d.device_code);
      if (k) deviceByCode.set(k, d);
    }

    const bundleByCode = new Map();
    for (const b of bundles) {
      const k = normalize(b.bundle_code);
      if (k) bundleByCode.set(k, b);
    }

    const versionsByProduct = new Map();
    for (const v of versionRows) {
      if (!versionsByProduct.has(v.product_id)) versionsByProduct.set(v.product_id, []);
      versionsByProduct.get(v.product_id).push(v);
    }

    const deviceCols = await getTableColumns(db, 'devices');
    const customerCols = await getTableColumns(db, 'customers');
    const bundleCols = await getTableColumns(db, 'device_bundles');

    printColumns('devices 表结构（生产库）', deviceCols);
    printColumns('customers 表结构（生产库）', customerCols);
    printColumns('device_bundles 表结构（生产库）', bundleCols);

    let totalRows = 0;
    let canImportRows = 0;
    let skipExistingRows = 0;
    let needCreateCustomerRows = 0;
    let missingModelRows = 0;
    let ambiguousModelRows = 0;
    let missingOrderNoRows = 0;
    let missingDeviceCodeRows = 0;

    const missingModels = new Set();
    const ambiguousModels = new Map();
    const customersToCreate = new Map();
    const rowsWithIssues = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      totalRows += 1;

      const orderNo = normalize(r[EXCEL_COLS.orderNo]);
      const model = normalize(r[EXCEL_COLS.model]);
      const customerName = normalize(r[EXCEL_COLS.customerName]);
      const deviceCode = normalize(r[EXCEL_COLS.deviceCode]);
      const serialNo = normalize(r[EXCEL_COLS.serialNo]);
      const productShortVersion = normalize(r[EXCEL_COLS.productShortVersion]);

      const issues = [];

      if (!orderNo) {
        missingOrderNoRows += 1;
        issues.push('缺少订单号(无法多合一分组)');
      }

      if (!deviceCode) {
        missingDeviceCodeRows += 1;
        issues.push('缺少设备编码(无法幂等去重)');
      }

      if (deviceCode && deviceByCode.has(deviceCode)) {
        skipExistingRows += 1;
        issues.push('设备编码已存在(将跳过)');
      }

      let matchedProduct = null;
      if (!model) {
        missingModelRows += 1;
        issues.push('缺少型号');
      } else {
        const found = productsByModel.get(model) || [];
        if (found.length === 0) {
          missingModelRows += 1;
          missingModels.add(model);
          issues.push(`型号不存在: ${model}`);
        } else if (found.length > 1) {
          ambiguousModelRows += 1;
          ambiguousModels.set(model, found);
          issues.push(`型号匹配到多个产品: ${model}`);
        } else {
          matchedProduct = found[0];
        }
      }

      if (!customerName) {
        issues.push('缺少客户名称');
      } else {
        const cMatch = matchCustomer(customerName, customersByName, customersByShort, dbCustomersById);
        if (cMatch.level === 'new') {
          needCreateCustomerRows += 1;
          customersToCreate.set(customerName, customerShortNameFromName(customerName));
          issues.push(`客户不存在(需创建): ${customerName}`);
        }
        // manual/exact/short_name/fuzzy 都视为已匹配，不计入需创建
      }

      if (matchedProduct && productShortVersion) {
        const candidateVersions = versionsByProduct.get(matchedProduct.id) || [];
        const hit = candidateVersions.find((v) => {
          const vn = normalize(v.version_number);
          const vname = normalize(v.version_name);
          return productShortVersion.includes(vn) || (vname && productShortVersion.includes(vname));
        });
        if (!hit) {
          issues.push(`产品版本未匹配(可选字段): ${productShortVersion}`);
        }
      }

      const onlySkippable = issues.every((it) => it === '设备编码已存在(将跳过)');
      const hasHardIssue = issues.some((it) =>
        it.includes('缺少订单号') ||
        it.includes('缺少设备编码') ||
        it.includes('缺少型号') ||
        it.includes('型号不存在') ||
        it.includes('型号匹配到多个产品')
      );

      if (!hasHardIssue && !onlySkippable) {
        canImportRows += 1;
      }

      if (issues.length > 0) {
        rowsWithIssues.push({
          row: i + 2,
          orderNo,
          deviceCode,
          serialNo,
          model,
          customerName,
          issues,
        });
      }
    }

    const orderGroups = groupByOrderNo(rows);
    let multiInOneGroups = 0;
    let singleGroups = 0;
    let bundleCodeConflictGroups = 0;
    const conflictBundleCodes = [];

    for (const [orderNo, items] of orderGroups.entries()) {
      if (items.length >= 2) multiInOneGroups += 1;
      else singleGroups += 1;

      if (bundleByCode.has(orderNo)) {
        bundleCodeConflictGroups += 1;
        conflictBundleCodes.push(orderNo);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('对比结果汇总');
    console.log('='.repeat(80));
    console.log(`总行数: ${totalRows}`);
    console.log(`可直接导入行数(不含已存在): ${canImportRows}`);
    console.log(`已存在设备(按device_code): ${skipExistingRows}`);
    console.log(`需创建客户行数: ${needCreateCustomerRows}`);
    console.log(`缺失/不匹配型号行数: ${missingModelRows}`);
    console.log(`型号歧义行数(匹配多个product): ${ambiguousModelRows}`);
    console.log(`缺少订单号行数: ${missingOrderNoRows}`);
    console.log(`缺少设备编码行数: ${missingDeviceCodeRows}`);

    console.log('\n多合一分组分析');
    console.log(`订单组总数: ${orderGroups.size}`);
    console.log(`单台组(订单号仅1条): ${singleGroups}`);
    console.log(`多合一组(订单号>=2): ${multiInOneGroups}`);
    console.log(`与现有bundle_code冲突组: ${bundleCodeConflictGroups}`);

    // ── 客户详细对比 ───────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(80));
    console.log('客户对比详情');
    console.log('='.repeat(80));
    console.log(`生产库现有客户数: ${customers.length}`);
    console.log('\n📋 生产库全部客户列表:');
    for (const c of customers.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  [${c.id}] ${c.name}  (简称: ${c.short_name})`);
    }

    const { manual, exact, byShortName, fuzzy, fuzzyMulti, needCreate } =
      buildCustomerComparison(rows, customersByName, customersByShort, dbCustomersById);

    const totalUnique = manual.length + exact.length + byShortName.length + fuzzy.length + fuzzyMulti.length + needCreate.length;
    console.log(`\nExcel 中唯一客户数: ${totalUnique}`);

    if (manual.length > 0) {
      console.log(`\n✅ 人工指定映射 (${manual.length}个) — 已确认复用现有客户:`);
      for (const e of manual) {
        console.log(`  Excel: ${e.excelName} (${e.count}台) → DB[${e.db.id}] ${e.db.name}  (${e.note})`);
      }
    }

    if (exact.length > 0) {
      console.log(`\n✅ 精确匹配 (${exact.length}个) — 名称完全一致，直接使用 customer_id:`);
      for (const e of exact) {
        console.log(`  Excel: ${e.excelName} (${e.count}台) → DB[${e.db.id}] ${e.db.name}`);
      }
    }

    if (byShortName.length > 0) {
      console.log(`\n🔶 简称匹配 (${byShortName.length}个) — short_name 完全一致，请再次确认:`);
      for (const e of byShortName) {
        console.log(`  Excel: ${e.excelName} (${e.count}台) → DB[${e.db.id}] ${e.db.name}  (简称: ${e.db.short_name})`);
      }
    }

    if (fuzzy.length > 0) {
      console.log(`\n🔶 模糊匹配（待确认） (${fuzzy.length}个) — 仍需人工判断:`);
      for (const e of fuzzy) {
        console.log(`  Excel: ${e.excelName} (${e.count}台) → DB[${e.db.id}] ${e.db.name}  (简称: ${e.db.short_name})`);
      }
    }

    if (fuzzyMulti.length > 0) {
      console.log(`\n⚠️ 模糊匹配歧义 (${fuzzyMulti.length}个) — 仍需人工指定:`);
      for (const e of fuzzyMulti) {
        const dbList = e.db.map((c) => `[${c.id}]${c.name}`).join(', ');
        console.log(`  Excel: ${e.excelName} (${e.count}台) → 候选: ${dbList}`);
      }
    }

    if (needCreate.length > 0) {
      console.log(`\n❌ 确认需新增 (${needCreate.length}个) — 将在导入时自动创建:`);
      for (const e of needCreate) {
        const short = customerShortNameFromName(e.excelName);
        const tag = e.note ? `  [${e.note}]` : '';
        console.log(`  ${e.excelName} (${e.count}台)  →  name="${e.excelName}"  short_name="${short}"${tag}`);
      }
    }

    if (missingModels.size > 0) {
      console.log('\n❌ Excel 中未匹配到产品的型号:');
      for (const m of missingModels) {
        const suggestions = suggestModels(m, allProductModels);
        if (suggestions.length > 0) {
          console.log(`  - ${m}  (建议映射: ${suggestions.join(', ')})`);
        } else {
          console.log(`  - ${m}`);
        }
      }
    }

    if (ambiguousModels.size > 0) {
      console.log('\n⚠️ 型号匹配多个产品(需要人工指定):');
      for (const [model, list] of ambiguousModels.entries()) {
        const mapped = list.map((x) => `${x.id}:${x.name}/${x.model}`).join(', ');
        console.log(`  - ${model} -> ${mapped}`);
      }
    }

    if (customersToCreate.size > 0) {
      console.log('\n🆕 需新增客户列表(name -> short_name):');
      for (const [name, shortName] of customersToCreate.entries()) {
        console.log(`  - ${name} -> ${shortName}`);
      }
    }

    if (conflictBundleCodes.length > 0) {
      console.log('\n⚠️ 订单号与现有bundle_code冲突:');
      for (const c of conflictBundleCodes.slice(0, 50)) {
        console.log(`  - ${c}`);
      }
      if (conflictBundleCodes.length > 50) {
        console.log(`  ... 其余 ${conflictBundleCodes.length - 50} 项未显示`);
      }
    }

    const hardIssueRows = rowsWithIssues.filter((x) =>
      x.issues.some((it) =>
        it.includes('缺少订单号') ||
        it.includes('缺少设备编码') ||
        it.includes('缺少型号') ||
        it.includes('型号不存在') ||
        it.includes('型号匹配到多个产品')
      )
    );

    if (hardIssueRows.length > 0) {
      console.log('\n❌ 不可导入行(前50条):');
      for (const r of hardIssueRows.slice(0, 50)) {
        console.log(`  - Excel第${r.row}行 | 订单号=${r.orderNo || '-'} | 设备编码=${r.deviceCode || '-'} | 型号=${r.model || '-'} | 客户=${r.customerName || '-'} | 问题=${r.issues.join('; ')}`);
      }
      if (hardIssueRows.length > 50) {
        console.log(`  ... 其余 ${hardIssueRows.length - 50} 行未显示`);
      }
    }

    console.log('\n✅ 结论说明');
    console.log('  1) 可导入: 有订单号、有设备编码、型号唯一可匹配的记录。');
    console.log('  2) 客户不存在不阻断导入，可先自动创建再绑定设备。');
    console.log('  3) 型号未匹配/歧义是主要阻断项，需先核对后再导入。');
    console.log('  4) 同订单号会归为多合一设备组，bundle_code 使用订单号。');

  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('\n执行失败:');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
