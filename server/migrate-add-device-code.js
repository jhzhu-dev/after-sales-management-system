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

async function migrate() {
  let connection;
  try {
    console.log('🚀 开始数据库迁移：添加设备编码字段');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 检查device_code字段是否已存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'devices' 
        AND COLUMN_NAME = 'device_code'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      console.log('⚠️  device_code字段已存在，跳过迁移');
      return;
    }
    
    // 添加device_code字段
    await connection.execute(`
      ALTER TABLE devices 
      ADD COLUMN device_code VARCHAR(100) NULL 
      AFTER name
    `);
    
    console.log('✅ 成功添加device_code字段到devices表');
    
    // 添加索引以提高查询性能
    await connection.execute(`
      CREATE INDEX idx_device_code ON devices(device_code)
    `);
    
    console.log('✅ 成功为device_code字段创建索引');
    console.log('🎉 数据库迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
migrate()
  .then(() => {
    console.log('✅ 迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 迁移脚本执行失败:', error);
    process.exit(1);
  });
