const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateSopProductLine() {
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
    console.log('开始迁移 SOP 模板表，添加产品线关联...');
    
    // 检查 product_line_id 列是否已存在
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sop_templates' AND COLUMN_NAME = 'product_line_id'
    `, [process.env.DB_NAME || 'device_manager']);
    
    if (columns.length > 0) {
      console.log('✅ product_line_id 列已存在，无需迁移');
    } else {
      // 删除旧的唯一索引
      try {
        await pool.execute('ALTER TABLE sop_templates DROP INDEX stage_version');
        console.log('✅ 已删除旧的唯一索引 stage_version');
      } catch (e) {
        console.log('ℹ️  旧索引不存在或已删除');
      }
      
      // 添加 product_line_id 列
      await pool.execute(`
        ALTER TABLE sop_templates 
        ADD COLUMN product_line_id INT DEFAULT NULL AFTER stage
      `);
      console.log('✅ 添加 product_line_id 列成功');
      
      // 添加外键约束
      await pool.execute(`
        ALTER TABLE sop_templates 
        ADD CONSTRAINT fk_sop_product_line 
        FOREIGN KEY (product_line_id) REFERENCES product_lines(id) ON DELETE CASCADE
      `);
      console.log('✅ 添加外键约束成功');
    }
    
    console.log('\n✅ SOP 模板表迁移完成！');
    console.log('现在 SOP 模板支持按产品线配置：');
    console.log('- product_line_id = NULL: 通用模板（适用所有产品线）');
    console.log('- product_line_id = 具体ID: 特定产品线的专用模板');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateSopProductLine()
  .then(() => {
    console.log('\n迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n迁移出错:', error);
    process.exit(1);
  });
