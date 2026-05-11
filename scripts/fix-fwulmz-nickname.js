const { query } = require('/app/server/database');

async function main() {
  const deviceId = 'FWULMZSRVBRVEFRP';
  const nickname = '斯洛文尼亚-TOCADO龙门0117';
  const result = await query('UPDATE devices SET nickname = ? WHERE id = ?', [nickname, deviceId]);
  console.log('更新行数:', result.affectedRows);
  if (result.affectedRows === 1) {
    console.log(`✅ 设备 ${deviceId} 简称已设置为：${nickname}`);
  } else {
    console.log('❌ 未找到该设备');
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
