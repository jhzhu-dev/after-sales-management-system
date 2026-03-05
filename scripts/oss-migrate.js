#!/usr/bin/env node
/**
 * OSS 历史文件路径迁移脚本
 *
 * 用途：将 OSS 上的旧路径文件迁移到新路径规范，并同步更新数据库记录。
 *
 * 新路径规范：
 *   产品文档    : {base}/product-docs/{产品线}/{型号}/{文件名}
 *   设备文档    : {base}/devices/{设备标识}/device-docs/{分类}/{文件名}
 *   问题附件    : {base}/devices/{设备标识}/issues/{issue_id}/{文件名}
 *   问题日志附件: {base}/devices/{设备标识}/issues/{issue_id}/logs/{文件名}
 *
 * 设备标识格式: {客户简称}-{生产序列号}-{订单号}-{产品名}
 *
 * 用法：
 *   node scripts/oss-migrate.js [选项]
 *
 * 选项：
 *   --dry-run           仅打印计划，不实际操作（推荐先用此参数确认）
 *   --table=<name>      仅迁移指定表 (product-docs | device-docs | issues | issue-logs)
 *                       不指定则迁移全部
 *
 * 示例：
 *   node scripts/oss-migrate.js --dry-run
 *   node scripts/oss-migrate.js --table=device-docs --dry-run
 *   node scripts/oss-migrate.js --table=product-docs
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const OSS    = require('ali-oss');
const mysql  = require('mysql2/promise');
const path   = require('path');

// ─── CLI 参数解析 ─────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TABLE   = (args.find(a => a.startsWith('--table=')) || '').replace('--table=', '') || null;
const TABLES  = ['product-docs', 'device-docs', 'issues', 'issue-logs'];
const targets = TABLE ? [TABLE] : TABLES;

if (TABLE && !TABLES.includes(TABLE)) {
  console.error(`❌ 无效的 --table 值："${TABLE}"，可选: ${TABLES.join(', ')}`);
  process.exit(1);
}

console.log('='.repeat(60));
console.log('OSS 路径迁移脚本');
console.log(`模式: ${DRY_RUN ? '🔍 DRY-RUN (只打印，不操作)' : '🚀 正式迁移'}`);
console.log(`目标表: ${targets.join(', ')}`);
console.log('='.repeat(60));

// ─── OSS / DB 配置 ─────────────────────────────────────────────────────────
const BASE_PATH = process.env.OSS_BASE_PATH || 'static/After-sales management system';
const BUCKET    = process.env.OSS_BUCKET    || 'els-pub-04';

const ossClient = new OSS({
  region         : process.env.OSS_REGION           || 'oss-cn-shanghai',
  accessKeyId    : process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket         : BUCKET,
});

const dbConfig = {
  host    : process.env.DB_HOST     || 'localhost',
  port    : process.env.DB_PORT     || 3306,
  user    : process.env.DB_USER     || 'els',
  password: process.env.DB_PASSWORD || '111111',
  database: process.env.DB_NAME     || 'device_management',
  charset : 'utf8mb4',
  timezone: '+08:00',
};

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
const safe = (s) => (s || 'unknown').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim();

function buildDeviceFolder(device) {
  const customer = safe(device.customer_short_name || device.customer_name);
  const serial   = safe(device.id);
  const order    = safe(device.name);
  const product  = safe(device.product_name || device.product_model);
  return `${customer}-${serial}-${order}-${product}`;
}

/** 从 oss://bucket/key 中解析 key */
function parseOssPath(ossPath) {
  const m = ossPath.match(/^oss:\/\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], key: m[2] };
}

/** 将旧 OSS key 替换前缀并返回新 key。如果不匹配旧前缀则返回 null。 */
function replacePrefix(oldKey, oldPrefix, newPrefix) {
  if (!oldKey.startsWith(oldPrefix)) return null;
  return newPrefix + oldKey.slice(oldPrefix.length);
}

// ─── OSS 操作 ────────────────────────────────────────────────────────────────
async function moveOssObject(oldKey, newKey) {
  if (DRY_RUN) {
    console.log(`  [DRY] copy  ${oldKey}`);
    console.log(`           → ${newKey}`);
    return;
  }
  await ossClient.copy(newKey, { sourceKey: oldKey, sourceBucket: BUCKET });
  await ossClient.delete(oldKey);
  console.log(`  ✅ 移动: ${path.basename(oldKey)}`);
}

// ─── 统计 ────────────────────────────────────────────────────────────────────
let stats = { processed: 0, migrated: 0, skipped: 0, error: 0 };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. 产品文档 (product_documents)
//    旧: {base}/Product Line Information/{产品线}/{型号}/{文件名}
//    新: {base}/product-docs/{产品线}/{型号}/{文件名}
// ═══════════════════════════════════════════════════════════════════════════════
async function migrateProductDocs(db) {
  console.log('\n─── [1/4] product_documents ──────────────────────────────');
  const oldPfx = `${BASE_PATH}/Product Line Information/`;
  const newPfx = `${BASE_PATH}/product-docs/`;

  const rows = await db.query(
    `SELECT id, file_path FROM product_documents WHERE file_path LIKE 'oss://%'`
  );

  for (const row of rows[0]) {
    stats.processed++;
    const parsed = parseOssPath(row.file_path);
    if (!parsed) { stats.skipped++; continue; }

    const newKey = replacePrefix(parsed.key, oldPfx, newPfx);
    if (!newKey) {
      console.log(`  SKIP [id=${row.id}] 路径未匹配旧规则: ${parsed.key}`);
      stats.skipped++;
      continue;
    }

    try {
      await moveOssObject(parsed.key, newKey);
      if (!DRY_RUN) {
        await db.query('UPDATE product_documents SET file_path = ? WHERE id = ?', [
          `oss://${BUCKET}/${newKey}`, row.id
        ]);
      }
      stats.migrated++;
    } catch (e) {
      console.error(`  ❌ [id=${row.id}] ${e.message}`);
      stats.error++;
    }
  }
  console.log(`  完成: ${rows[0].length} 条记录处理`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 设备文档 (device_documents)
//    旧: {base}/{产品线}/{设备名-设备ID}/{分类}/{文件名}
//    新: {base}/devices/{设备标识}/device-docs/{分类}/{文件名}
// ═══════════════════════════════════════════════════════════════════════════════
async function migrateDeviceDocs(db) {
  console.log('\n─── [2/4] device_documents ───────────────────────────────');

  // 加载所有设备信息，避免每条记录都查一次 DB
  const [deviceRows] = await db.query(
    `SELECT d.id, d.name,
            c.short_name as customer_short_name, c.name as customer_name,
            p.name as product_name
     FROM devices d
     LEFT JOIN customers c ON d.customer_id = c.id
     LEFT JOIN products  p ON d.product_id  = p.id`
  );
  const deviceMap = Object.fromEntries(deviceRows.map(d => [d.id, d]));

  const [rows] = await db.query(
    `SELECT id, device_id, category, original_name, file_path
     FROM device_documents WHERE file_path LIKE 'oss://%'`
  );

  for (const row of rows) {
    stats.processed++;
    const parsed = parseOssPath(row.file_path);
    if (!parsed) { stats.skipped++; continue; }

    const device = deviceMap[row.device_id];
    if (!device) {
      console.log(`  SKIP [id=${row.id}] 找不到设备 device_id=${row.device_id}`);
      stats.skipped++;
      continue;
    }

    const deviceFolder = buildDeviceFolder(device);
    const safeCategory = safe(row.category);
    const fileName     = row.original_name || path.basename(parsed.key);
    const newKey       = `${BASE_PATH}/devices/${deviceFolder}/device-docs/${safeCategory}/${fileName}`;

    if (parsed.key === newKey) {
      stats.skipped++;
      continue; // 已经是新路径
    }

    try {
      await moveOssObject(parsed.key, newKey);
      if (!DRY_RUN) {
        await db.query('UPDATE device_documents SET file_path = ? WHERE id = ?', [
          `oss://${BUCKET}/${newKey}`, row.id
        ]);
      }
      stats.migrated++;
    } catch (e) {
      console.error(`  ❌ [id=${row.id}] ${e.message}`);
      stats.error++;
    }
  }
  console.log(`  完成: ${rows.length} 条记录处理`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 问题附件 (issues.attachments JSON)
//    旧: {base}/{产品线}/{设备名-ID}/issue-attachments/{模块}/{ts}_{文件名}
//    新: {base}/devices/{设备标识}/issues/{issue_id}/{ts}_{文件名}
// ═══════════════════════════════════════════════════════════════════════════════
async function migrateIssueAttachments(db) {
  console.log('\n─── [3/4] issues.attachments ─────────────────────────────');

  const [deviceRows] = await db.query(
    `SELECT d.id, d.name,
            c.short_name as customer_short_name, c.name as customer_name,
            p.name as product_name
     FROM devices d
     LEFT JOIN customers c ON d.customer_id = c.id
     LEFT JOIN products  p ON d.product_id  = p.id`
  );
  const deviceMap = Object.fromEntries(deviceRows.map(d => [d.id, d]));

  const [rows] = await db.query(
    `SELECT id, device_id, attachments FROM issues WHERE attachments IS NOT NULL`
  );

  for (const row of rows) {
    stats.processed++;
    let atts;
    try {
      atts = typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments;
      if (!Array.isArray(atts) || atts.length === 0) { stats.skipped++; continue; }
    } catch (_) { stats.skipped++; continue; }

    const device = deviceMap[row.device_id];
    if (!device) {
      console.log(`  SKIP [issue=${row.id}] 找不到设备 device_id=${row.device_id}`);
      stats.skipped++;
      continue;
    }

    const deviceFolder = buildDeviceFolder(device);
    let changed = false;
    const updated = [];

    for (const att of atts) {
      if (!att.ossPath || !att.ossPath.startsWith('oss://')) {
        updated.push(att);
        continue;
      }
      const parsed = parseOssPath(att.ossPath);
      if (!parsed) { updated.push(att); continue; }

      const fileName  = path.basename(parsed.key);
      const newKey    = `${BASE_PATH}/devices/${deviceFolder}/issues/${row.id}/${fileName}`;
      const newOssPath = `oss://${BUCKET}/${newKey}`;

      if (parsed.key === newKey) { updated.push(att); continue; }

      try {
        await moveOssObject(parsed.key, newKey);
        updated.push({ ...att, ossPath: newOssPath, url: newOssPath });
        changed = true;
        stats.migrated++;
      } catch (e) {
        console.error(`  ❌ [issue=${row.id}] 附件移动失败: ${e.message}`);
        updated.push(att);
        stats.error++;
      }
    }

    if (changed && !DRY_RUN) {
      await db.query('UPDATE issues SET attachments = ? WHERE id = ?', [
        JSON.stringify(updated), row.id
      ]);
    }
  }
  console.log(`  完成: ${rows.length} 条记录处理`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 问题日志附件 (issue_logs.attachments JSON)
//    旧: {base}/{产品线}/{设备名-ID}/issue-attachments/{模块}/logs/{issue_id}/{ts}_{文件名}
//    新: {base}/devices/{设备标识}/issues/{issue_id}/logs/{ts}_{文件名}
// ═══════════════════════════════════════════════════════════════════════════════
async function migrateIssueLogAttachments(db) {
  console.log('\n─── [4/4] issue_logs.attachments ─────────────────────────');

  const [deviceRows] = await db.query(
    `SELECT d.id, d.name,
            c.short_name as customer_short_name, c.name as customer_name,
            p.name as product_name
     FROM devices d
     LEFT JOIN customers c ON d.customer_id = c.id
     LEFT JOIN products  p ON d.product_id  = p.id`
  );
  const deviceMap = Object.fromEntries(deviceRows.map(d => [d.id, d]));

  const [rows] = await db.query(
    `SELECT l.id, l.issue_id, l.attachments, i.device_id
     FROM issue_logs l
     JOIN issues i ON l.issue_id = i.id
     WHERE l.attachments IS NOT NULL`
  );

  for (const row of rows) {
    stats.processed++;
    let atts;
    try {
      atts = typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments;
      if (!Array.isArray(atts) || atts.length === 0) { stats.skipped++; continue; }
    } catch (_) { stats.skipped++; continue; }

    const device = deviceMap[row.device_id];
    if (!device) {
      console.log(`  SKIP [log=${row.id}] 找不到设备 device_id=${row.device_id}`);
      stats.skipped++;
      continue;
    }

    const deviceFolder = buildDeviceFolder(device);
    let changed = false;
    const updated = [];

    for (const att of atts) {
      if (!att.ossPath || !att.ossPath.startsWith('oss://')) {
        updated.push(att);
        continue;
      }
      const parsed = parseOssPath(att.ossPath);
      if (!parsed) { updated.push(att); continue; }

      const fileName   = path.basename(parsed.key);
      const newKey     = `${BASE_PATH}/devices/${deviceFolder}/issues/${row.issue_id}/logs/${fileName}`;
      const newOssPath = `oss://${BUCKET}/${newKey}`;

      if (parsed.key === newKey) { updated.push(att); continue; }

      try {
        await moveOssObject(parsed.key, newKey);
        updated.push({ ...att, ossPath: newOssPath, url: newOssPath });
        changed = true;
        stats.migrated++;
      } catch (e) {
        console.error(`  ❌ [log=${row.id}] 附件移动失败: ${e.message}`);
        updated.push(att);
        stats.error++;
      }
    }

    if (changed && !DRY_RUN) {
      await db.query('UPDATE issue_logs SET attachments = ? WHERE id = ?', [
        JSON.stringify(updated), row.id
      ]);
    }
  }
  console.log(`  完成: ${rows.length} 条记录处理`);
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  const db = await mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 5 });

  try {
    if (targets.includes('product-docs'))  await migrateProductDocs(db);
    if (targets.includes('device-docs'))   await migrateDeviceDocs(db);
    if (targets.includes('issues'))        await migrateIssueAttachments(db);
    if (targets.includes('issue-logs'))    await migrateIssueLogAttachments(db);
  } finally {
    await db.end();
  }

  console.log('\n' + '='.repeat(60));
  console.log('迁移统计:');
  console.log(`  处理总数: ${stats.processed}`);
  console.log(`  成功迁移: ${stats.migrated}`);
  console.log(`  跳过:     ${stats.skipped}`);
  console.log(`  错误:     ${stats.error}`);
  if (DRY_RUN) {
    console.log('\n⚠️  以上为 DRY-RUN 结果，未实际修改任何文件或数据库。');
    console.log('  确认无误后去掉 --dry-run 参数正式执行。');
  }
  console.log('='.repeat(60));
}

main().catch(e => {
  console.error('❌ 迁移脚本执行失败:', e);
  process.exit(1);
});
