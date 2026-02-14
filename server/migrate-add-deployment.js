const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDeploymentStage() {
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
    console.log('开始添加"部署"阶段到生产流程...\n');
    
    // 1. 修改 orders 表的 current_stage 枚举
    console.log('1. 更新 orders 表的 current_stage 字段...');
    await pool.execute(`
      ALTER TABLE orders 
      MODIFY COLUMN current_stage ENUM('生产', '部署', '调试', '打包', '物流', '完成') DEFAULT '生产'
    `);
    console.log('✅ orders.current_stage 更新成功');
    
    // 2. 修改 order_progress 表的 stage 枚举
    console.log('\n2. 更新 order_progress 表的 stage 字段...');
    await pool.execute(`
      ALTER TABLE order_progress 
      MODIFY COLUMN stage ENUM('生产', '部署', '调试', '打包', '物流') NOT NULL
    `);
    console.log('✅ order_progress.stage 更新成功');
    
    // 3. 修改 sop_templates 表的 stage 枚举
    console.log('\n3. 更新 sop_templates 表的 stage 字段...');
    await pool.execute(`
      ALTER TABLE sop_templates 
      MODIFY COLUMN stage ENUM('生产', '部署', '调试', '打包', '物流') NOT NULL
    `);
    console.log('✅ sop_templates.stage 更新成功');
    
    console.log('\n✅ 所有数据库更新完成！');
    console.log('\n新的生产流程：生产 → 部署 → 调试 → 打包 → 物流 → 完成');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addDeploymentStage()
  .then(() => {
    console.log('\n迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n迁移出错:', error);
    process.exit(1);
  });
