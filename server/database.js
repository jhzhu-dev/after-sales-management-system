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

// 数据库初始化函数
async function initializeDatabase() {
  try {
    console.log('🔗 正在连接MySQL数据库...');
    
    // 先创建数据库（如果不存在）
    await createDatabase();
    
    // 测试连接
    const connection = await pool.getConnection();
    console.log('✅ MySQL数据库连接成功!');
    connection.release();
    
    // 创建表结构
    await createTables();
    
    console.log('🎉 数据库初始化完成!');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    return false;
  }
}

// 创建数据库
async function createDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: 'utf8mb4'
    });
    
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 '${dbConfig.database}' 创建成功`);
    
    await connection.end();
  } catch (error) {
    console.error('❌ 创建数据库失败:', error.message);
    throw error;
  }
}

// 创建表结构
async function createTables() {
  try {
    // 检查表是否存在，如果不存在才创建
    console.log('🔍 检查数据库表结构...');
    // 设备类型管理表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS device_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 模块类型管理表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS module_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 设备表 - 使用外键关联设备类型
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type_id INT NOT NULL,
        location VARCHAR(255),
        status ENUM('正常', '异常', '维护中') DEFAULT '正常',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES device_types(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 模块表 - 使用外键关联模块类型
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(50) NOT NULL,
        type_id INT NOT NULL,
        status ENUM('正常', '异常', '维护中') DEFAULT '正常',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        FOREIGN KEY (type_id) REFERENCES module_types(id) ON DELETE RESTRICT,
        UNIQUE KEY unique_device_module (device_id, type_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 模块版本表 - 版本追踪
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS module_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_id INT NOT NULL,
        version_number VARCHAR(100) NOT NULL,
        version_type ENUM('factory', 'update') NOT NULL,
        release_date DATE,
        description TEXT,
        updated_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 子模块表 - 模块的子组件
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS submodules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        model VARCHAR(255),
        factory_version VARCHAR(100),
        current_version VARCHAR(100),
        description TEXT,
        status ENUM('正常', '异常', '维护中') DEFAULT '正常',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 子模块版本历史表 - 版本迭代追踪
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS submodule_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submodule_id INT NOT NULL,
        version_number VARCHAR(100) NOT NULL,
        version_type ENUM('factory', 'update') NOT NULL,
        release_date DATE,
        description TEXT,
        updated_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submodule_id) REFERENCES submodules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 问题表 - 售后问题管理
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(50),
        module_id INT NULL,
        description TEXT NOT NULL,
        severity ENUM('low', 'medium', 'high') DEFAULT 'medium',
        status ENUM('open', 'in_progress', 'closed') DEFAULT 'open',
        assignee VARCHAR(255),
        resolution_description TEXT NULL,
        resolved_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ 数据库表结构创建成功');
  } catch (error) {
    console.error('❌ 创建表结构失败:', error.message);
    throw error;
  }
}

// 获取连接池
function getPool() {
  return pool;
}

// 执行查询
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('❌ 数据库查询失败:', error.message);
    throw error;
  }
}

// 执行事务
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 关闭连接池
async function closePool() {
  try {
    await pool.end();
    console.log('✅ 数据库连接池已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接池失败:', error.message);
  }
}

module.exports = {
  initializeDatabase,
  getPool,
  query,
  transaction,
  closePool,
  dbConfig
};
