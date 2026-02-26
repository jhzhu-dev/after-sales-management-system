const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateIssueIdToBigint() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root_password',
    database: process.env.DB_NAME || 'device_manager',
    charset: 'utf8mb4'
  });

  try {
    console.log('开始迁移 issues 表的 id 列类型...');

    // 一步完成：移除AUTO_INCREMENT并修改类型为BIGINT
    console.log('修改 id 列：移除AUTO_INCREMENT并改为BIGINT类型...');
    await connection.execute(`
      ALTER TABLE issues 
      MODIFY COLUMN id BIGINT NOT NULL
    `);
    console.log('✓ id 列修改成功（INT AUTO_INCREMENT → BIGINT NOT NULL）');

    console.log('\n✅ 迁移完成！issues 表的 id 列现在使用 BIGINT 类型，可以存储时间戳ID');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrateIssueIdToBigint()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
