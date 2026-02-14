const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateOrderStatus() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'device_manager',
    waitForConnections: true,
    connectionLimit: 10
  });

  try {
    console.log('开始更新订单状态枚举值...');
    
    // 修改 orders 表的 status 字段，添加 '待生产' 状态
    await pool.execute(`
      ALTER TABLE orders 
      MODIFY COLUMN status ENUM('草稿', '待生产', '进行中', '已完成', '已取消') DEFAULT '草稿'
    `);
    
    console.log('✅ 成功更新订单状态枚举值');
    console.log('现在 status 字段支持: 草稿, 待生产, 进行中, 已完成, 已取消');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行迁移
migrateOrderStatus()
  .then(() => {
    console.log('迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移出错:', error);
    process.exit(1);
  });
