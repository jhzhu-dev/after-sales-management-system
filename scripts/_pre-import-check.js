#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const xlsx = require('xlsx');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'els',
  password: process.env.DB_PASSWORD || '111111',
  database: process.env.DB_NAME || 'device_management',
  charset: 'utf8mb4',
};

(async () => {
  const db = await mysql.createConnection(dbConfig);

  // 1. 冲突 bundle 及其已有设备数
  const conflictCodes = [
    '20250922000110-SAU',
    '20260303000129-AUS-USA',
    '20260420000134-TUR',
    '20260507000136-ITA',
  ];
  const [bundles] = await db.query(
    `SELECT b.id, b.bundle_code, b.customer_id,
            COUNT(d.id) AS device_count,
            GROUP_CONCAT(d.device_code ORDER BY d.id SEPARATOR ', ') AS device_codes
     FROM device_bundles b
     LEFT JOIN devices d ON d.bundle_id = b.id
     WHERE b.bundle_code IN (?)
     GROUP BY b.id`,
    [conflictCodes]
  );
  console.log('\n=== 1. 冲突 Bundle 现有情况 ===');
  for (const b of bundles) {
    console.log(`  bundle_code=${b.bundle_code}  db_id=${b.id}  现有设备数=${b.device_count}`);
    if (b.device_codes) console.log(`    device_codes: ${b.device_codes}`);
  }

  // 2. short_name 冲突
  const newShortNames = [
    'TIPTOP','VAL','TS','ISN','MUPRO','WTD','QT','AME','VTEQ','SL','RTT','TMG',
    'KMC','LSM','MM','TD','TATKO','PPC','ATS','SF','AAE','EK','TL','ICO','PTM',
    'CACL','HDMT','Nexion','ABDBM','DLT','Copart','KTC','FTTS','MAM','Jastec',
    'Matex','AASW','AZTC','GOPDR','ELITE','PRND','PPS','CG','SX','PM-Musaffah',
    'BU','Mega','NE','EDGE','PC','SHP','理想舜尧','PP','北汽舜尧','HD','CMT','CAA','MH',
  ];
  const [existingCustomers] = await db.query('SELECT name, short_name FROM customers');
  const existingShortMap = new Map(existingCustomers.map((c) => [c.short_name.toLowerCase(), c.name]));
  console.log('\n=== 2. 新客户 short_name 冲突检查 ===');
  let conflicts = 0;
  for (const s of newShortNames) {
    if (existingShortMap.has(s.toLowerCase())) {
      console.log(`  ❌ CONFLICT: short_name="${s}" 已被 "${existingShortMap.get(s.toLowerCase())}" 占用`);
      conflicts++;
    }
  }
  if (conflicts === 0) console.log('  ✅ 无冲突');

  // 3. Excel 序列号(device.id) 重叠
  const wb = xlsx.readFile(require('path').join(__dirname, '../doc/data/订单清单.xlsx'));
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const excelIds = rows.map((r) => String(r['序列号'] || '').trim()).filter(Boolean);
  const [overlappingIds] = await db.query(
    'SELECT id, device_code, name FROM devices WHERE id IN (?)',
    [excelIds.length ? excelIds : ['__none__']]
  );
  console.log('\n=== 3. 序列号(device.id)重叠检查 ===');
  if (overlappingIds.length > 0) {
    for (const r of overlappingIds) {
      console.log(`  ❌ 序列号 ${r.id} 已存在 (device_code=${r.device_code}, name=${r.name})`);
    }
  } else {
    console.log('  ✅ 无重叠');
  }

  // 4. 型号映射确认
  const [pRows] = await db.query(
    'SELECT id, name, model, short_name, product_line_id FROM products WHERE model IN (?, ?)',
    ['TSD-CV-LG-2010', 'TSD-PV-LG-2010']
  );
  console.log('\n=== 4. 型号映射确认 (TSD-CV-LG-2010 → TSD-PV-LG-2010) ===');
  if (pRows.length === 0) {
    console.log('  ❌ 两个型号在DB中均不存在');
  }
  for (const p of pRows) {
    console.log(`  DB model="${p.model}"  id=${p.id}  name="${p.name}"  short_name="${p.short_name}"  product_line_id=${p.product_line_id}`);
  }

  // 5. 数量列异常（数量 > 该订单号在Excel的行数）
  const orderGroups = new Map();
  for (const r of rows) {
    const k = String(r['订单号'] || '').trim();
    if (!k) continue;
    if (!orderGroups.has(k)) orderGroups.set(k, []);
    orderGroups.get(k).push(r);
  }
  console.log('\n=== 5. 数量列异常检查 (数量 > 组内行数) ===');
  let qtyIssues = 0;
  for (const [orderNo, group] of orderGroups) {
    const qty = Math.max(...group.map((r) => Number(r['数量'] || 1)));
    if (qty > group.length) {
      console.log(`  ⚠️  订单号=${orderNo}  数量列=${qty}  Excel行数=${group.length}  差=${qty - group.length}`);
      qtyIssues++;
    }
  }
  if (qtyIssues === 0) console.log('  ✅ 无异常');

  // 6. Excel中冲突bundle订单号的设备编码 vs DB已存在
  console.log('\n=== 6. 冲突Bundle的Excel设备编码 vs 生产库 ===');
  for (const code of conflictCodes) {
    const group = orderGroups.get(code) || [];
    const excelDevCodes = group.map((r) => String(r['设备编码'] || '').trim()).filter(Boolean);
    if (excelDevCodes.length === 0) { console.log(`  ${code}: Excel无设备编码`); continue; }
    const [found] = await db.query(
      'SELECT device_code FROM devices WHERE device_code IN (?)',
      [excelDevCodes]
    );
    const foundSet = new Set(found.map((r) => r.device_code));
    const newOnes = excelDevCodes.filter((c) => !foundSet.has(c));
    console.log(`  ${code}: Excel ${excelDevCodes.length}台, 已在库 ${found.length}台, 待新增 ${newOnes.length}台`);
    if (newOnes.length > 0) console.log(`    待新增device_codes: ${newOnes.join(', ')}`);
  }

  await db.end();
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
