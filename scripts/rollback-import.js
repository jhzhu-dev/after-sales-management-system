/**
 * 回滚脚本：撤销 2026-05-27 10:08 的 Excel 导入操作
 * 操作顺序：
 *   1. 删除新增设备 (188条, created_at 在导入时间窗口内)
 *   2. 删除新增 bundle (42条)
 *   3. 删除新增客户 (58条)
 *   4. 还原 ID 替换（14台旧设备的 PK 从序列号改回原数字/旧ID）
 *   5. 还原被更新设备的字段（name/password/merchant_id/remote_code/device_code → NULL）
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// 导入时间窗口（数据库本地时间 UTC+8，即 2026-05-27 18:08）
const IMPORT_FROM = '2026-05-27 18:08:00';
const IMPORT_TO   = '2026-05-27 18:09:00';

// 14条 ID 替换记录：{ currentId: 导入后的序列号, originalId: 导入前的旧ID }
const ID_REVERSALS = [
  { currentId: 'F20410010131NO0113', originalId: 'F21112010931NO0038' },
  { currentId: 'F20711002131D00009', originalId: '260439' },
  { currentId: 'F20711002131D00010', originalId: '3413052' },
  { currentId: 'F20711002131D00011', originalId: '359901' },
  { currentId: 'F21110010931ALQ0043', originalId: '833483' },
  { currentId: 'F20220011231ALQ0036', originalId: '664151' },
  { currentId: 'F20220011231ALQ0029', originalId: '1253822' },
  { currentId: 'F20220011231ALQ0030', originalId: '6728977' },
  { currentId: 'F21910010931ALQ0005', originalId: '308523' },
  { currentId: 'F21910010931ALQ0007', originalId: '708267' },
  { currentId: 'F20711002131ST0042',  originalId: '920389' },
  { currentId: 'F20220011231ST0052',  originalId: '260733' },
  { currentId: 'F22011010631SL0046',  originalId: '341300' },
  { currentId: 'F21212010231UK0056',  originalId: '7952722' },
];

async function main() {
  const db = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT || 3306),
    user:     process.env.DB_USER || 'els',
    password: process.env.DB_PASSWORD || '111111',
    database: process.env.DB_NAME || 'device_management',
    charset:  'utf8mb4',
    timezone: '+08:00',
  });

  console.log(`DB: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log('='.repeat(70));

  try {
    // ── Step 0: 统计确认 ──────────────────────────────────────────────────
    const [chk] = await db.query(
      'SELECT COUNT(*) as cnt FROM devices WHERE created_at BETWEEN ? AND ?',
      [IMPORT_FROM, IMPORT_TO]
    );
    console.log(`待删除新设备: ${chk[0].cnt} 条 (created_at BETWEEN ${IMPORT_FROM} AND ${IMPORT_TO})`);

    // ── Step 1: 删除新增设备 ──────────────────────────────────────────────
    // 先删 modules/issues 中引用这些设备的记录（若有）
    await db.query(`DELETE FROM modules WHERE device_id IN (SELECT id FROM devices WHERE created_at BETWEEN ? AND ?)`, [IMPORT_FROM, IMPORT_TO]);
    await db.query(`DELETE FROM issues  WHERE device_id IN (SELECT id FROM devices WHERE created_at BETWEEN ? AND ?)`, [IMPORT_FROM, IMPORT_TO]);

    const [delDev] = await db.query(
      'DELETE FROM devices WHERE created_at BETWEEN ? AND ?',
      [IMPORT_FROM, IMPORT_TO]
    );
    console.log(`✓ 删除设备: ${delDev.affectedRows} 条`);

    // ── Step 2: 删除新增 bundle ──────────────────────────────────────────
    // FK ON DELETE SET NULL 会自动把旧设备的 bundle_id 置 NULL
    const [delBundle] = await db.query(
      'DELETE FROM device_bundles WHERE created_at BETWEEN ? AND ?',
      [IMPORT_FROM, IMPORT_TO]
    );
    console.log(`✓ 删除 Bundle: ${delBundle.affectedRows} 条`);

    // ── Step 3: 删除新增客户 ──────────────────────────────────────────────
    const [delCust] = await db.query(
      'DELETE FROM customers WHERE created_at BETWEEN ? AND ?',
      [IMPORT_FROM, IMPORT_TO]
    );
    console.log(`✓ 删除客户: ${delCust.affectedRows} 条`);

    // ── Step 4: 还原 ID 替换 ─────────────────────────────────────────────
    await db.query('SET FOREIGN_KEY_CHECKS=0');
    let idRevertCount = 0;
    try {
      for (const { currentId, originalId } of ID_REVERSALS) {
        // 检查当前ID是否存在（可能已在步骤1被删，如果该设备恰好是新增的，但这些应都是旧设备）
        const [exists] = await db.query('SELECT id FROM devices WHERE id=?', [currentId]);
        if (exists.length === 0) {
          console.log(`  跳过 ${currentId}（不存在，可能已被删除）`);
          continue;
        }
        // 还原关联表
        await db.query('UPDATE modules           SET device_id=? WHERE device_id=?', [originalId, currentId]);
        await db.query('UPDATE issues            SET device_id=? WHERE device_id=?', [originalId, currentId]);
        await db.query('UPDATE device_documents  SET device_id=? WHERE device_id=?', [originalId, currentId]).catch(()=>{});
        // 还原 devices.id，name 置 NULL（这些旧设备导入前 name 都是空的）
        await db.query('UPDATE devices SET id=?, name=NULL WHERE id=?', [originalId, currentId]);
        console.log(`  ↩ ${currentId} → ${originalId}`);
        idRevertCount++;
      }
    } finally {
      await db.query('SET FOREIGN_KEY_CHECKS=1');
    }
    console.log(`✓ 还原 ID 替换: ${idRevertCount} 条`);

    // ── Step 5: 还原被更新的旧设备字段 ──────────────────────────────────
    // 这些设备 created_at 早于导入时间，但 updated_at 在导入时间窗口内
    // 导入只会填充 NULL 字段，所以把这些字段置回 NULL 即可恢复原状
    // 排除刚才已还原 ID 的设备（originalId 列表）
    const originalIds = ID_REVERSALS.map(r => r.originalId);
    const placeholders = originalIds.map(() => '?').join(',');

    const [upd] = await db.query(`
      UPDATE devices
      SET name        = NULL,
          password    = NULL,
          merchant_id = NULL,
          remote_code = NULL,
          device_code = NULL
      WHERE updated_at BETWEEN ? AND ?
        AND created_at < ?
        AND id NOT IN (${placeholders})
    `, [IMPORT_FROM, IMPORT_TO, IMPORT_FROM, ...originalIds]);
    console.log(`✓ 还原更新字段 (name/password/merchant_id/remote_code/device_code→NULL): ${upd.affectedRows} 条`);

    console.log('\n回滚完成。');
  } catch (e) {
    console.error('回滚失败:', e.message);
    throw e;
  } finally {
    await db.end();
  }
}

main().catch(e => { console.error(e.stack); process.exit(1); });
