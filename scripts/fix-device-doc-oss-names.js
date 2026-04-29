/**
 * 修复 device_documents 表中 OSS 对象 key 的乱码文件名
 *
 * 背景：
 *   早期上传时代码直接使用 multer 的 file.originalname（latin1 编码字节），
 *   导致 OSS 对象 key 的文件名部分是乱码，但数据库 original_name 字段已经正确存储了中文。
 *   本脚本以数据库中的 original_name 为准，对 OSS 对象进行 copy + delete（重命名），
 *   并更新数据库中的 file_path。
 *
 * 用法：
 *   node scripts/fix-device-doc-oss-names.js            # 默认 dry-run，只预览不修改
 *   node scripts/fix-device-doc-oss-names.js --fix      # 真正执行修复
 *   node scripts/fix-device-doc-oss-names.js --limit 50 # 只处理前50条（配合 --fix 使用）
 *
 * 安全保证：
 *   - 先 copy 新对象，copy 成功后再 delete 旧对象，绝不丢失文件
 *   - copy 成功后还会 head 验证新对象确实存在，验证通过后才删除旧对象
 *   - 若 copy 或验证失败，跳过该条记录，旧对象保留，数据库不更新
 *   - dry-run 模式不做任何修改，只打印将要执行的操作
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');
const OSS = require('ali-oss');

// ─── 命令行参数 ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = !args.includes('--fix');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

// ─── OSS 客户端 ───────────────────────────────────────────────────────────────
const ossClient = new OSS({
  region: process.env.OSS_REGION || 'oss-cn-shanghai',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || 'els-pub-04',
});
const bucket = process.env.OSS_BUCKET || 'els-pub-04';

// ─── 安全复制（copy → head 验证 → delete 旧对象） ─────────────────────────────
async function safeCopyAndDelete(oldKey, newKey) {
  // 1. 复制到新 key
  await ossClient.copy(newKey, oldKey);

  // 2. head 验证新对象确实存在
  await ossClient.head(newKey);

  // 3. 确认存在后才删除旧对象
  await ossClient.delete(oldKey);
}

// ─── 判断字符串是否含有 latin1-as-string 乱码特征 ─────────────────────────────
// 乱码特征：U+0080–U+00FF 范围内的字符（正确存储的中文 UTF-8 不会包含该范围）
function isGarbled(str) {
  if (!str) return false;
  return /[\u0080-\u00FF]/.test(str);
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(` OSS 文件名修复脚本`);
  console.log(` 模式：${isDryRun ? '🔍 DRY-RUN（预览，不修改任何数据）' : '🔧 FIX（正式执行）'}`);
  if (limit) console.log(` 限制处理：前 ${limit} 条`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ─ 连接数据库 ─
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '192.168.0.181',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });

  try {
    // ─ 查询所有 OSS 路径的设备文档 ─
    const [rows] = await conn.query(
      `SELECT id, title, original_name, file_path
       FROM device_documents
       WHERE file_path LIKE 'oss://%'
       ORDER BY id`
    );

    const total = rows.length;
    console.log(`共查询到 ${total} 条 OSS 文档记录\n`);

    let needFix = 0;
    let fixed = 0;
    let skipped = 0;
    let errorCount = 0;

    const records = limit ? rows.slice(0, limit) : rows;

    for (const row of records) {
      const { id, title, original_name, file_path } = row;

      // 解析 OSS key：oss://bucket/key
      const ossMatch = file_path.match(/^oss:\/\/[^/]+\/(.+)$/);
      if (!ossMatch) {
        console.warn(`[ID=${id}] 路径格式无法解析，跳过: ${file_path}`);
        skipped++;
        continue;
      }

      const oldKey = ossMatch[1];

      // 取目录前缀（最后一个 / 之前的部分，含 /）
      const lastSlash = oldKey.lastIndexOf('/');
      const dirPrefix = lastSlash >= 0 ? oldKey.slice(0, lastSlash + 1) : '';
      const oldFileName = lastSlash >= 0 ? oldKey.slice(lastSlash + 1) : oldKey;

      // 判断 original_name 是否含有乱码特征（U+0080–U+00FF，正确存储的中文 UTF-8 不会包含该范围）
      const garbled = isGarbled(original_name);

      let correctFileName;
      if (garbled && original_name) {
        // 旧记录：original_name 是 latin1 字节被误当字符串存入，需要重新解码
        correctFileName = Buffer.from(original_name, 'latin1').toString('utf8');
      } else {
        // 新记录：original_name 已经是正确 UTF-8，直接用
        correctFileName = original_name || title;
      }

      if (!correctFileName) {
        console.warn(`[ID=${id}] 无法确定正确文件名，跳过`);
        skipped++;
        continue;
      }

      const newKey = dirPrefix + correctFileName;
      const newFilePath = `oss://${bucket}/${newKey}`;

      // 判断是否需要修复（key 不同说明文件名有问题）
      if (oldKey === newKey) {
        // 文件名已经正确，无需处理
        continue;
      }

      needFix++;

      const ossKeyDisplay = oldKey.split('/').slice(-3).join('/');
      console.log(`[ID=${id}] 需要修复`);
      console.log(`  旧 key  : .../${ossKeyDisplay}`);
      console.log(`  旧文件名: ${oldFileName}`);
      console.log(`  新文件名: ${correctFileName}`);
      console.log(`  title   : ${title}`);
      console.log(`  来源    : ${garbled ? 'latin1→utf8 解码' : 'original_name 直接使用'}`);

      if (isDryRun) {
        console.log(`  → [dry-run] 跳过实际操作\n`);
        continue;
      }

      // ─ 正式执行 ─
      try {
        // 先检查旧对象是否存在
        let oldExists = false;
        try {
          await ossClient.head(oldKey);
          oldExists = true;
        } catch (e) {
          if (e.code === 'NoSuchKey' || e.status === 404) {
            oldExists = false;
          } else {
            throw e;
          }
        }

        if (!oldExists) {
          console.warn(`  ⚠️  OSS 旧对象不存在，仅修复数据库`);
          if (garbled) {
            await conn.query(
              'UPDATE device_documents SET file_path = ?, original_name = ? WHERE id = ?',
              [newFilePath, correctFileName, id]
            );
          } else {
            await conn.query(
              'UPDATE device_documents SET file_path = ? WHERE id = ?',
              [newFilePath, id]
            );
          }
          console.log(`  ✅ 数据库已更新（OSS 对象已不存在）\n`);
          fixed++;
          continue;
        }

        // copy → head 验证 → delete
        await safeCopyAndDelete(oldKey, newKey);
        console.log(`  ✅ OSS 对象已重命名`);

        // 更新数据库 file_path 和 original_name（乱码的一并修正）
        if (garbled) {
          await conn.query(
            'UPDATE device_documents SET file_path = ?, original_name = ? WHERE id = ?',
            [newFilePath, correctFileName, id]
          );
          console.log(`  ✅ 数据库 file_path + original_name 已更新\n`);
        } else {
          await conn.query(
            'UPDATE device_documents SET file_path = ? WHERE id = ?',
            [newFilePath, id]
          );
          console.log(`  ✅ 数据库 file_path 已更新\n`);
        }
        fixed++;

      } catch (err) {
        console.error(`  ❌ 修复失败（保留旧对象，数据库不变）: ${err.message}\n`);
        errorCount++;
      }
    }

    // ─ 汇总 ─
    console.log('═══════════════════════════════════════════════════════');
    console.log(` 汇总`);
    console.log(`  总记录数    : ${total}`);
    console.log(`  需要修复    : ${needFix}`);
    if (isDryRun) {
      console.log(`  → dry-run 模式，未实际修改任何数据`);
      console.log(`  → 确认无误后运行: node scripts/fix-device-doc-oss-names.js --fix`);
    } else {
      console.log(`  成功修复    : ${fixed}`);
      console.log(`  跳过        : ${skipped}`);
      console.log(`  失败        : ${errorCount}`);
    }
    console.log('═══════════════════════════════════════════════════════');

  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('脚本执行失败:', err.message);
  process.exit(1);
});
