const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'device_user',
    password: process.env.DB_PASSWORD || 'device_pass_123',
    database: process.env.DB_NAME || 'device_management'
  });

  try {
    console.log('开始迁移: 删除 modules 表的 status 列...');

    // 检查列是否存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'status'`
    );

    if (columns.length > 0) {
      await connection.execute('ALTER TABLE modules DROP COLUMN status');
      console.log('✅ 已删除 modules.status 列');
    } else {
      console.log('⏭️  modules.status 列不存在，跳过');
    }

    console.log('迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
