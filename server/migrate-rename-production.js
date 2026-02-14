const mysql = require('mysql2/promise');
require('dotenv').config();

async function renameProductionToAssembly() {
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
    console.log('开始将"生产"阶段重命名为"装配"...\n');
    
    // 步骤1: 先添加"装配"到枚举中（临时包含"生产"和"装配"）
    console.log('1. 添加"装配"到 orders 表枚举...');
    await pool.execute(`
      ALTER TABLE orders 
      MODIFY COLUMN current_stage ENUM('生产', '装配', '部署', '调试', '打包', '物流', '完成') DEFAULT '生产'
    `);
    console.log('✅ orders 表枚举已更新');
    
    console.log('\n2. 添加"装配"到 order_progress 表枚举...');
    await pool.execute(`
      ALTER TABLE order_progress 
      MODIFY COLUMN stage ENUM('生产', '装配', '部署', '调试', '打包', '物流') NOT NULL
    `);
    console.log('✅ order_progress 表枚举已更新');
    
    console.log('\n3. 添加"装配"到 sop_templates 表枚举...');
    await pool.execute(`
      ALTER TABLE sop_templates 
      MODIFY COLUMN stage ENUM('生产', '装配', '部署', '调试', '打包', '物流') NOT NULL
    `);
    console.log('✅ sop_templates 表枚举已更新');
    
    // 步骤2: 更新现有数据，将"生产"改为"装配"
    console.log('\n4. 更新现有数据中的"生产"为"装配"...');
    
    const ordersResult = await pool.execute(`
      UPDATE orders SET current_stage = '装配' WHERE current_stage = '生产'
    `);
    console.log(`✅ 更新了 ${ordersResult[0].changedRows} 条订单记录`);
    
    const progressResult = await pool.execute(`
      UPDATE order_progress SET stage = '装配' WHERE stage = '生产'
    `);
    console.log(`✅ 更新了 ${progressResult[0].changedRows} 条进度记录`);
    
    const templatesResult = await pool.execute(`
      UPDATE sop_templates SET stage = '装配' WHERE stage = '生产'
    `);
    console.log(`✅ 更新了 ${templatesResult[0].changedRows} 条SOP模板记录`);
    
    // 步骤3: 从枚举中移除"生产"
    console.log('\n5. 从 orders 表枚举中移除"生产"...');
    await pool.execute(`
      ALTER TABLE orders 
      MODIFY COLUMN current_stage ENUM('装配', '部署', '调试', '打包', '物流', '完成') DEFAULT '装配'
    `);
    console.log('✅ orders.current_stage 最终更新成功');
    
    console.log('\n6. 从 order_progress 表枚举中移除"生产"...');
    await pool.execute(`
      ALTER TABLE order_progress 
      MODIFY COLUMN stage ENUM('装配', '部署', '调试', '打包', '物流') NOT NULL
    `);
    console.log('✅ order_progress.stage 最终更新成功');
    
    console.log('\n7. 从 sop_templates 表枚举中移除"生产"...');
    await pool.execute(`
      ALTER TABLE sop_templates 
      MODIFY COLUMN stage ENUM('装配', '部署', '调试', '打包', '物流') NOT NULL
    `);
    console.log('✅ sop_templates.stage 最终更新成功');
    
    console.log('\n✅ 所有数据库更新完成！');
    console.log('\n新的生产流程：装配 → 部署 → 调试 → 打包 → 物流 → 完成');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

renameProductionToAssembly()
  .then(() => {
    console.log('\n迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n迁移出错:', error);
    process.exit(1);
  });
