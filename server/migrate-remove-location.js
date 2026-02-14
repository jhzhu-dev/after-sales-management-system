require('dotenv').config();
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'els',
  password: process.env.DB_PASSWORD || '111111',
  database: process.env.DB_NAME || 'device_management',
  charset: 'utf8mb4',
  timezone: '+08:00'
};

// 创建连接池
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function removeLocationField() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始移除设备位置字段...');
    
    // 检查字段是否存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'device_management' 
        AND TABLE_NAME = 'devices' 
        AND COLUMN_NAME = 'location'
    `);
    
    if (columns.length === 0) {
      console.log('✓ location字段不存在，无需迁移');
      return;
    }
    
    // 删除location字段
    await connection.query(`
      ALTER TABLE devices DROP COLUMN location
    `);
    
    console.log('✓ 成功删除devices表的location字段');
    
  } catch (error) {
    console.error('✗ 迁移失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// 执行迁移
removeLocationField()
  .then(() => {
    console.log('\n迁移完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n迁移失败:', error);
    process.exit(1);
  });
