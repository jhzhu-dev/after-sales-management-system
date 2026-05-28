'use strict';
const mysql = require('mysql2/promise');

(async () => {
  const db = await mysql.createConnection({
    host: '192.168.0.181', port: 3306,
    user: 'device_user', password: 'device_pass_123',
    database: 'device_management',
  });
  try {
    await db.query(
      "ALTER TABLE modules ADD COLUMN `status` ENUM('正常','异常','维护中') NOT NULL DEFAULT '正常' AFTER type_id"
    );
    console.log('OK - 生产库 modules.status 列已添加');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('列已存在，无需重复添加');
    } else {
      throw e;
    }
  }
  await db.end();
})();
