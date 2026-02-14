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

async function removeSubmoduleTables() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始删除子模块相关表...');
    
    // 禁用外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // 1. 删除子模块版本表
    const [versionTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'device_management' 
        AND TABLE_NAME = 'submodule_versions'
    `);
    
    if (versionTables.length > 0) {
      await connection.query('DROP TABLE submodule_versions');
      console.log('✓ 删除 submodule_versions 表');
    } else {
      console.log('- submodule_versions 表不存在');
    }
    
    // 2. 删除子模块表
    const [submoduleTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'device_management' 
        AND TABLE_NAME = 'submodules'
    `);
    
    if (submoduleTables.length > 0) {
      await connection.query('DROP TABLE submodules');
      console.log('✓ 删除 submodules 表');
    } else {
      console.log('- submodules 表不存在');
    }
    
    // 3. 删除产品子模块规格表
    const [specTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'device_management' 
        AND TABLE_NAME = 'product_submodule_specs'
    `);
    
    if (specTables.length > 0) {
      await connection.query('DROP TABLE product_submodule_specs');
      console.log('✓ 删除 product_submodule_specs 表');
    } else {
      console.log('- product_submodule_specs 表不存在');
    }
    
    // 启用外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✓ 成功删除所有子模块相关表');
    
  } catch (error) {
    console.error('✗ 迁移失败:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// 执行迁移
removeSubmoduleTables()
  .then(() => {
    console.log('\n迁移完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n迁移失败:', error);
    process.exit(1);
  });
