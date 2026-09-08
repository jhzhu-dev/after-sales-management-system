// 将 customer_requirements.urgency 从 低/普通/高/紧急 迁移为 低/中/高（对齐运维中心 severity 字段）
// 运行: node scripts/migrate-req-urgency.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'els',
  password: process.env.DB_PASSWORD || '111111',
  database: process.env.DB_NAME || 'device_management',
  charset: 'utf8mb4',
  timezone: '+08:00'
};

async function main() {
  const pool = mysql.createPool(dbConfig);
  const conn = await pool.getConnection();
  try {
    // 1. 先扩展枚举，把'中'加入（保留旧值），否则 UPDATE 到'中'会被拒绝
    await conn.query("ALTER TABLE customer_requirements MODIFY urgency ENUM('低','普通','高','紧急','中') DEFAULT '普通' COMMENT '紧急程度'");
    console.log('ALTER expand enum -> 加入 中 done');

    // 2. 迁移已有数据
    const [u1] = await conn.query("UPDATE customer_requirements SET urgency = '中' WHERE urgency = '普通'");
    const [u2] = await conn.query("UPDATE customer_requirements SET urgency = '高' WHERE urgency = '紧急'");
    console.log('UPDATE 普通->中 rows:', u1.affectedRows);
    console.log('UPDATE 紧急->高 rows:', u2.affectedRows);

    // 3. 收窄枚举为 低/中/高
    await conn.query("ALTER TABLE customer_requirements MODIFY urgency ENUM('低','中','高') DEFAULT '中' COMMENT '紧急程度'");
    console.log('ALTER enum -> 低/中/高 done');

    // 4. 验证
    const [rows] = await conn.query('SELECT urgency, COUNT(*) cnt FROM customer_requirements GROUP BY urgency');
    console.log('distinct urgency:', JSON.stringify(rows));
    const [info] = await conn.query("SHOW COLUMNS FROM customer_requirements LIKE 'urgency'");
    console.log('column type:', info[0].Type, 'default:', info[0].Default);

    console.log('迁移完成 ✅');
  } catch (e) {
    console.error('迁移失败:', e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
