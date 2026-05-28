const mysql = require('mysql2/promise');
(async () => {
  const db = await mysql.createConnection({
    host:'192.168.0.181',port:3306,user:'device_user',
    password:'device_pass_123',database:'device_management',charset:'utf8mb4'
  });
  const codes = ['20260303000129-AUS-USA','20260507000136-ITA'];
  const [rows] = await db.query(
    'SELECT d.id, d.device_code, d.merchant_id, d.remote_code, d.password, d.bundle_id, b.bundle_code FROM devices d LEFT JOIN device_bundles b ON b.id=d.bundle_id WHERE d.name IN (?)',
    [codes]
  );
  console.log('=== 冲突bundle设备现状 ===');
  for (const r of rows) console.log(JSON.stringify(r));

  const shd = ['2025112000119-SHD','20251120000119-SHD'];
  const [r2] = await db.query(
    'SELECT id, device_code, merchant_id, remote_code, password, bundle_id FROM devices WHERE name IN (?)',
    [shd]
  );
  console.log('\n=== SHD订单设备 ===');
  for (const r of r2) console.log(JSON.stringify(r));
  await db.end();
})().catch(e => { console.error(e.message); process.exit(1); });
