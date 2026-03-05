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
    
    // ==================== Phase 1: 基础表（无外键依赖） ====================
    
    // 产品线管理表 - 必须最先创建，因为其他表依赖它
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(50) NOT NULL UNIQUE,
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

    // 客户表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        short_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_short_name (short_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ==================== Phase 2: 依赖基础表的表 ====================
    
    // 产品管理表 - 依赖 product_lines
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_line_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        model VARCHAR(100),
        description TEXT,
        specifications JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_line_id) REFERENCES product_lines(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 设备表 - 依赖 product_lines 和 customers
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NULL,
        product_line_id INT NOT NULL,
        customer_id INT,
        status ENUM('正常', '异常', '维护中') DEFAULT '正常',
        remote_code VARCHAR(100),
        password VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_line_id) REFERENCES product_lines(id) ON DELETE RESTRICT,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ==================== Phase 3: 依赖设备和模块类型的表 ====================
    
    // 模块表 - 依赖 devices 和 module_types
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(50) NOT NULL,
        type_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        FOREIGN KEY (type_id) REFERENCES module_types(id) ON DELETE RESTRICT,
        UNIQUE KEY unique_device_module (device_id, type_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ==================== Phase 4: 依赖模块的表 ====================
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

    // 版本发布库表 - 用于存储可供选择的正式发布的版本
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS version_releases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_type_id INT NOT NULL,
        version_number VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        change_log TEXT,
        category VARCHAR(100) DEFAULT NULL,
        release_date DATE DEFAULT (CURRENT_DATE),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_type_id) REFERENCES module_types(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 版本发布附件表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS release_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        release_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (release_id) REFERENCES version_releases(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ==================== Phase 5: 产品相关表 ====================

    // 产品资料表 - 依赖 products
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        doc_type ENUM('规格书', '使用说明', '用户手册', '其他') NOT NULL,
        title VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT,
        uploaded_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 设备出厂资料表 - 依赖 devices
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS device_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        file_path VARCHAR(500) NOT NULL,
        file_size INT,
        uploaded_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        INDEX idx_device_category (device_id, category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 产品模块模板表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        module_type_id INT NOT NULL,
        is_required BOOLEAN DEFAULT TRUE,
        default_config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (module_type_id) REFERENCES module_types(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 产品子模块规格表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_submodule_specs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_module_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        model VARCHAR(255),
        specifications TEXT,
        default_version VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_module_id) REFERENCES product_modules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 产品模块配置历史表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_module_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        module_type_id INT NOT NULL,
        is_required BOOLEAN DEFAULT TRUE,
        default_config JSON,
        version_number VARCHAR(50) NOT NULL,
        change_description TEXT,
        effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deprecated_date TIMESTAMP NULL,
        is_current BOOLEAN DEFAULT FALSE,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (module_type_id) REFERENCES module_types(id) ON DELETE RESTRICT,
        INDEX idx_product_module_current (product_id, module_type_id, is_current),
        INDEX idx_current (is_current, effective_date),
        UNIQUE KEY unique_version (product_id, module_type_id, version_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 问题跟进日志表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS issue_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        content TEXT NOT NULL,
        operator VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ==================== Schema Migrations ====================

    // 迁移：将设备类型改为产品线
    try {
      const [typeIdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'type_id'");
      if (typeIdCols.length > 0) {
        console.log('🔄 正在迁移 devices 表：type_id -> product_line_id...');
        
        // 删除旧的外键约束
        try {
          await pool.execute("ALTER TABLE devices DROP FOREIGN KEY devices_ibfk_1");
        } catch (e) {
          console.log('⚠️ 外键约束 devices_ibfk_1 不存在或已删除');
        }
        
        // 重命名列
        await pool.execute("ALTER TABLE devices CHANGE COLUMN type_id product_line_id INT NOT NULL");
        
        // 添加新的外键约束
        await pool.execute("ALTER TABLE devices ADD CONSTRAINT fk_device_product_line FOREIGN KEY (product_line_id) REFERENCES product_lines(id) ON DELETE RESTRICT");
        
        console.log('✅ devices 表迁移成功：type_id -> product_line_id');
      }
    } catch (err) {
      console.warn('⚠️ devices 表迁移警告:', err.message);
    }

    // 检查 devices 表扩展字段
    try {
      const [remoteCodeCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'remote_code'");
      if (remoteCodeCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 remote_code 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN remote_code VARCHAR(100) AFTER status");
      }

      const [pwdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'password'");
      if (pwdCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 password 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN password VARCHAR(100) AFTER remote_code");
      }
      console.log('✅ devices 表字段更新成功');

      // 客户关联和位置字段迁移
      const [customerIdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'customer_id'");
      if (customerIdCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 customer_id 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN customer_id INT AFTER product_line_id");
        try {
          await pool.execute("ALTER TABLE devices ADD CONSTRAINT fk_device_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT");
        } catch (e) {
          console.warn('⚠️ 添加 customer_id 外键警告:', e.message);
        }
        console.log('✅ customer_id 字段添加成功');
      }

      // 添加 device_code 字段
      const [deviceCodeCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'device_code'");
      if (deviceCodeCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 device_code 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN device_code VARCHAR(100) AFTER name");
        console.log('✅ device_code 字段添加成功');
      }

      // 将 name 字段改为允许 NULL（订单号改为非必填）
      const [deviceNameCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'name'");
      if (deviceNameCols.length > 0 && deviceNameCols[0].Null === 'NO') {
        console.log('🔄 正在将 devices.name 字段改为允许 NULL...');
        await pool.execute("ALTER TABLE devices MODIFY COLUMN name VARCHAR(255) NULL");
        console.log('✅ devices.name 字段已允许 NULL');
      }

      // 添加 product_id 字段
      const [deviceProductIdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'product_id'");
      if (deviceProductIdCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 product_id 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN product_id INT AFTER product_line_id");
        try {
          await pool.execute("ALTER TABLE devices ADD CONSTRAINT fk_device_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL");
        } catch (e) {
          console.warn('⚠️ 添加 product_id 外键警告:', e.message);
        }
        console.log('✅ product_id 字段添加成功');
      }

      // Phase 4: 扩展 issues 表及创建 device_upgrades 表
      console.log('🔄 正在执行 Phase 4 数据库迁移...');

      // 检查 issues 表扩展字段
      const [issueCategoryCols] = await pool.execute("SHOW COLUMNS FROM issues LIKE 'category'");
      if (issueCategoryCols.length === 0) {
        await pool.execute("ALTER TABLE issues ADD COLUMN category ENUM('硬件故障', '软件Bug', '操作咨询', '安装调试', '其他') DEFAULT '其他' AFTER module_id");
        await pool.execute("ALTER TABLE issues ADD COLUMN contact_person VARCHAR(100) AFTER description");
        await pool.execute("ALTER TABLE issues ADD COLUMN contact_phone VARCHAR(50) AFTER contact_person");
        await pool.execute("ALTER TABLE issues ADD COLUMN is_visit_required BOOLEAN DEFAULT FALSE AFTER contact_phone");
        await pool.execute("ALTER TABLE issues ADD COLUMN visit_at TIMESTAMP NULL AFTER is_visit_required");
        await pool.execute("ALTER TABLE issues ADD COLUMN attachments JSON AFTER visit_at");
        console.log('✅ issues 表扩展字段成功');
      }

      // 创建 device_upgrades 表
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS device_upgrades (
          id INT AUTO_INCREMENT PRIMARY KEY,
          device_id VARCHAR(50) NOT NULL,
          upgrade_type ENUM('硬件升级', '软件更新', '系统重装') NOT NULL,
          description TEXT,
          old_version VARCHAR(100),
          new_version VARCHAR(100),
          operator_id VARCHAR(100),
          upgrade_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ device_upgrades 表就绪');

    } catch (err) {
      console.warn('⚠️ 数据库迁移警告:', err.message);
    }

    console.log('✅ 数据库表结构创建/更新成功');
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
    // 使用 query 而不是 execute，query 更宽容参数类型
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('❌ 数据库查询失败:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
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
