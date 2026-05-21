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

    // 问题归属分类配置表（可动态管理）
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS issue_classification_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // 预置种子数据（幂等，重复执行无副作用）
    await pool.execute(`
      INSERT IGNORE INTO issue_classification_types (name, sort_order) VALUES
        ('运营问题', 1),
        ('出厂问题', 2),
        ('设备问题', 3)
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

    // 版本发布与产品型号关联表（多对多，依赖 version_releases 和 products）
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS version_release_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        release_id INT NOT NULL,
        product_id INT NOT NULL,
        UNIQUE KEY uq_release_product (release_id, product_id),
        FOREIGN KEY (release_id) REFERENCES version_releases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 设备表 - 依赖 product_lines 和 customers
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NULL,
        product_line_id INT NOT NULL,
        customer_id INT,
        status ENUM('生产中','使用中(正常)','使用中(异常)','已停用') DEFAULT '使用中(正常)',
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
        checklist JSON NULL COMMENT '更新时SOP检查清单快照',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // SOP模板表 - 按模块类型配置更新检查清单
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS module_sop_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_type_id INT NOT NULL UNIQUE,
        items JSON NOT NULL COMMENT '[{id,text,required}]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (module_type_id) REFERENCES module_types(id) ON DELETE CASCADE
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
        original_name VARCHAR(255),
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

    // 产品迭代版本表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        version_number VARCHAR(100) NOT NULL,
        version_name VARCHAR(255),
        description TEXT,
        specifications JSON,
        status ENUM('开发中', '量产中', '已停产') DEFAULT '开发中',
        release_date DATE,
        is_current BOOLEAN DEFAULT FALSE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_product_version (product_id, version_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 产品迭代版本文档表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_version_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_version_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        file_size INT,
        category ENUM('规格书', '变更记录', '图纸', '其他') DEFAULT '其他',
        uploaded_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_version_id) REFERENCES product_versions(id) ON DELETE CASCADE
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

    // 运维知识库词条表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS kb_articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        symptom TEXT NOT NULL,
        cause TEXT,
        solution TEXT NOT NULL,
        category ENUM('硬件故障', '软件问题', '操作咨询', '安装调试', '其他') DEFAULT '其他',
        product_line_id INT,
        tags JSON,
        is_pinned BOOLEAN DEFAULT FALSE,
        view_count INT DEFAULT 0,
        helpful_count INT DEFAULT 0,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_line_id) REFERENCES product_lines(id) ON DELETE SET NULL
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

      const [merchantCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'merchant_id'");
      if (merchantCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 merchant_id 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN merchant_id VARCHAR(100) NULL AFTER password");
      }

      const [merchantPwdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'merchant_password'");
      if (merchantPwdCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 merchant_password 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN merchant_password VARCHAR(100) NULL AFTER merchant_id");
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

      // 添加 product_version_id 字段到 devices 表
      const [devicePVIdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'product_version_id'");
      if (devicePVIdCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 product_version_id 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN product_version_id INT AFTER product_id");
        try {
          await pool.execute("ALTER TABLE devices ADD CONSTRAINT fk_device_product_version FOREIGN KEY (product_version_id) REFERENCES product_versions(id) ON DELETE SET NULL");
        } catch (e) {
          console.warn('⚠️ 添加 product_version_id 外键警告:', e.message);
        }
        console.log('✅ product_version_id 字段添加成功');
      }

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

      // 检查 issues.id 列类型，若为 INT 则迁移为 VARCHAR(50)
      const [issueIdCol] = await pool.execute("SHOW COLUMNS FROM issues LIKE 'id'");
      if (issueIdCol.length > 0 && issueIdCol[0].Type.toLowerCase().includes('int')) {
        console.log('🔄 正在将 issues.id 从 INT 迁移为 VARCHAR(50)...');
        // 先去除 issue_logs 的外键约束
        try {
          const [fkRows] = await pool.execute(
            `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'issue_logs'
             AND REFERENCED_TABLE_NAME = 'issues' AND COLUMN_NAME = 'issue_id'`
          );
          if (fkRows.length > 0) {
            await pool.execute(`ALTER TABLE issue_logs DROP FOREIGN KEY ${fkRows[0].CONSTRAINT_NAME}`);
          }
        } catch (e) {
          console.warn('⚠️ 移除 issue_logs 外键警告:', e.message);
        }
        // 迁移 issues.id
        try {
          await pool.execute("ALTER TABLE issues MODIFY COLUMN id VARCHAR(50) NOT NULL");
          console.log('✅ issues.id 迁移为 VARCHAR(50) 成功');
        } catch (e) {
          console.warn('⚠️ issues.id 迁移失败:', e.message);
        }
        // 迁移 issue_logs.issue_id
        try {
          await pool.execute("ALTER TABLE issue_logs MODIFY COLUMN issue_id VARCHAR(50) NOT NULL");
          console.log('✅ issue_logs.issue_id 迁移为 VARCHAR(50) 成功');
        } catch (e) {
          console.warn('⚠️ issue_logs.issue_id 迁移失败:', e.message);
        }
        // 尝试重新添加外键
        try {
          await pool.execute("ALTER TABLE issue_logs ADD CONSTRAINT fk_issue_logs_issue FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE");
        } catch (e) {
          // 忽略：外键重建失败不影响功能
        }
      }

      // 检查 issues 表 custom_module_name 字段
      const [issueCustomModuleCols] = await pool.execute("SHOW COLUMNS FROM issues LIKE 'custom_module_name'");
      if (issueCustomModuleCols.length === 0) {
        await pool.execute("ALTER TABLE issues ADD COLUMN custom_module_name VARCHAR(255) NULL AFTER module_id");
        console.log('✅ issues 表添加 custom_module_name 字段成功');
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

      // 给 products 表添加 short_name（产品简称）
      try {
        await pool.execute("ALTER TABLE products ADD COLUMN short_name VARCHAR(20) NULL AFTER name");
        console.log('✅ products 表添加 short_name 字段成功');
      } catch (e) {
        if (!e.message.includes('Duplicate column')) throw e;
      }

      // 给 devices 表添加 nickname（设备俗称）
      try {
        await pool.execute("ALTER TABLE devices ADD COLUMN nickname VARCHAR(50) NULL AFTER name");
        console.log('✅ devices 表添加 nickname 字段成功');
      } catch (e) {
        if (!e.message.includes('Duplicate column')) throw e;
      }

    } catch (err) {
      console.warn('⚠️ 数据库迁移警告:', err.message);
    }

    // 模块类型名称迁移：将"算法"字眼替换为"服务器"，并去除多余的"模型"后缀
    try {
      // Step 1: 算法 → 服务器
      const [algRows] = await pool.execute("SELECT COUNT(*) as cnt FROM module_types WHERE name LIKE '%算法%'");
      if (algRows[0].cnt > 0) {
        console.log('🔄 正在将模块类型名称中的"算法"替换为"服务器"...');
        await pool.execute("UPDATE module_types SET name = REPLACE(name, '算法', '服务器'), description = IF(description IS NOT NULL, REPLACE(description, '算法', '服务器'), description) WHERE name LIKE '%算法%'");
        console.log('✅ 模块类型名称"算法"→"服务器"替换完成');
      }
      // Step 2: 服务器模型 → 服务器（去除多余的"模型"后缀）
      const [svrModelRows] = await pool.execute("SELECT COUNT(*) as cnt FROM module_types WHERE name LIKE '%服务器模型%'");
      if (svrModelRows[0].cnt > 0) {
        console.log('🔄 正在将模块类型名称中的"服务器模型"简化为"服务器"...');
        await pool.execute("UPDATE module_types SET name = REPLACE(name, '服务器模型', '服务器'), description = IF(description IS NOT NULL, REPLACE(description, '服务器模型', '服务器'), description) WHERE name LIKE '%服务器模型%'");
        console.log('✅ 模块类型名称"服务器模型"→"服务器"简化完成');
      }
    } catch (err) {
      console.warn('⚠️ 模块类型名称迁移警告:', err.message);
    }

    // Phase 5: SOP 检查清单字段迁移
    try {
      const [mvCols] = await pool.execute("SHOW COLUMNS FROM module_versions LIKE 'checklist'");
      if (mvCols.length === 0) {
        await pool.execute("ALTER TABLE module_versions ADD COLUMN checklist JSON NULL COMMENT '更新时SOP检查清单快照'");
        console.log('✅ module_versions.checklist 列已添加');
      }
    } catch (err) {
      console.warn('⚠️ module_versions checklist 迁移警告:', err.message);
    }

    // Phase 6: 迁移 kb_articles.category 为 VARCHAR（支持自由分类）
    try {
      const [catCols] = await pool.execute("SHOW COLUMNS FROM kb_articles LIKE 'category'");
      if (catCols.length > 0 && catCols[0].Type.toLowerCase().includes('enum')) {
        await pool.execute("ALTER TABLE kb_articles MODIFY COLUMN category VARCHAR(100) DEFAULT ''");
        console.log('✅ kb_articles.category 已从 ENUM 改为 VARCHAR(100)');
      }
    } catch (err) {
      console.warn('⚠️ Phase 6 迁移警告:', err.message);
    }

    // ==================== Phase 7: 多合一设备组合 ====================
    // 设备组合表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS device_bundles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bundle_code VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        customer_id INT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_bundle_code (bundle_code),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ device_bundles 表就绪');

    // 为 devices 表添加 bundle_id 字段
    try {
      const [bundleIdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'bundle_id'");
      if (bundleIdCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 bundle_id 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN bundle_id INT NULL");
        try {
          await pool.execute("ALTER TABLE devices ADD CONSTRAINT fk_device_bundle FOREIGN KEY (bundle_id) REFERENCES device_bundles(id) ON DELETE SET NULL");
        } catch (e) {
          console.warn('⚠️ 添加 bundle_id 外键警告:', e.message);
        }
        console.log('✅ devices.bundle_id 字段添加成功');
      }
    } catch (err) {
      console.warn('⚠️ devices.bundle_id 迁移警告:', err.message);
    }

    // 为 devices 表添加 notes 字段（备注）
    try {
      const [notesCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'notes'");
      if (notesCols.length === 0) {
        console.log('🔄 正在为 devices 表添加 notes 字段...');
        await pool.execute("ALTER TABLE devices ADD COLUMN notes TEXT NULL");
        console.log('✅ devices.notes 字段添加成功');
      }
    } catch (err) {
      console.warn('⚠️ devices.notes 迁移警告:', err.message);
    }

    // 为 device_documents 表添加 bundle_id 字段，并将 device_id 改为可 NULL
    try {
      const [docBundleIdCols] = await pool.execute("SHOW COLUMNS FROM device_documents LIKE 'bundle_id'");
      if (docBundleIdCols.length === 0) {
        console.log('🔄 正在为 device_documents 表添加 bundle_id 字段...');
        // 先将 device_id 改为可 NULL（组合级文档 device_id 为空）
        await pool.execute("ALTER TABLE device_documents MODIFY COLUMN device_id VARCHAR(50) NULL");
        await pool.execute("ALTER TABLE device_documents ADD COLUMN bundle_id INT NULL");
        try {
          await pool.execute("ALTER TABLE device_documents ADD CONSTRAINT fk_doc_bundle FOREIGN KEY (bundle_id) REFERENCES device_bundles(id) ON DELETE CASCADE");
        } catch (e) {
          console.warn('⚠️ 添加 device_documents.bundle_id 外键警告:', e.message);
        }
        console.log('✅ device_documents.bundle_id 字段添加成功');
      }
    } catch (err) {
      console.warn('⚠️ device_documents.bundle_id 迁移警告:', err.message);
    }

    // Phase 8b: 补充历史同步版本的附件（幂等：每次启动检查并补充缺失的附件）
    try {
      const syncedRels = await query(`
        SELECT vr.id as release_id, vrp.product_id, pv.id as pv_id
        FROM version_releases vr
        JOIN version_release_products vrp ON vr.id = vrp.release_id
        JOIN product_versions pv ON pv.product_id = vrp.product_id AND pv.version_number = vr.version_number
        WHERE vr.source = 'synced'
      `);
      for (const rel of syncedRels) {
        const attCount = await query('SELECT COUNT(*) as cnt FROM release_attachments WHERE release_id = ?', [rel.release_id]);
        const pvDocCount = await query('SELECT COUNT(*) as cnt FROM product_version_documents WHERE product_version_id = ?', [rel.pv_id]);
        // 仅当附件数量不一致时才重新同步
        if (attCount[0].cnt !== pvDocCount[0].cnt) {
          const docs = await query('SELECT * FROM product_version_documents WHERE product_version_id = ?', [rel.pv_id]);
          await query('DELETE FROM release_attachments WHERE release_id = ?', [rel.release_id]);
          for (const doc of docs) {
            const fileName = doc.file_path.split('/').pop() || doc.name;
            await query(
              'INSERT INTO release_attachments (release_id, file_name, original_name, file_path, file_size) VALUES (?,?,?,?,?)',
              [rel.release_id, fileName, doc.name, doc.file_path, doc.file_size || null]
            );
          }
          console.log(`✅ release_id=${rel.release_id} 附件已同步（${docs.length} 个）`);
        }
      }
    } catch (err) {
      console.warn('⚠️ 版本附件同步警告:', err.message);
    }

    console.log('✅ 数据库表结构创建/更新成功');

    // Phase 9: 删除 devices 表中的 product_version_id 字段（功能已移除）
    try {
      const [pvIdCols] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'product_version_id'");
      if (pvIdCols.length > 0) {
        // 先删除外键约束（如果存在）
        try {
          await pool.execute('ALTER TABLE devices DROP FOREIGN KEY fk_device_product_version');
        } catch (e) { /* 外键可能不存在，忽略 */ }
        await pool.execute('ALTER TABLE devices DROP COLUMN product_version_id');
        console.log('✅ devices.product_version_id 字段已删除');
      }
    } catch (err) {
      console.warn('⚠️ 删除 product_version_id 字段警告:', err.message);
    }

    // Phase 8: version_releases 添加 source 字段（区分手动创建 vs 产品型号同步）
    try {
      const [srcCols] = await pool.execute("SHOW COLUMNS FROM version_releases LIKE 'source'");
      if (srcCols.length === 0) {
        await pool.execute("ALTER TABLE version_releases ADD COLUMN source ENUM('manual','synced') NOT NULL DEFAULT 'manual' AFTER release_date");
        console.log('✅ version_releases.source 字段添加成功');
        // 将已知的同步记录标记为 synced（通过关联产品型号的版本记录判断）
        await pool.execute(`
          UPDATE version_releases vr
          JOIN version_release_products vrp ON vr.id = vrp.release_id
          JOIN product_versions pv ON pv.product_id = vrp.product_id AND pv.version_number = vr.version_number
          SET vr.source = 'synced'
          WHERE vr.module_type_id = 437838
        `);
        console.log('✅ 历史同步记录 source 标记完成');

        // 同步历史附件：将 product_version_documents 对应附件写入 release_attachments
        const [syncedRels] = await pool.execute(`
          SELECT vr.id as release_id, vrp.product_id, pv.id as pv_id
          FROM version_releases vr
          JOIN version_release_products vrp ON vr.id = vrp.release_id
          JOIN product_versions pv ON pv.product_id = vrp.product_id AND pv.version_number = vr.version_number
          WHERE vr.source = 'synced'
        `);
        for (const rel of syncedRels) {
          const [docs] = await pool.execute(
            'SELECT * FROM product_version_documents WHERE product_version_id = ?',
            [rel.pv_id]
          );
          await pool.execute('DELETE FROM release_attachments WHERE release_id = ?', [rel.release_id]);
          for (const doc of docs) {
            const fileName = doc.file_path.split('/').pop() || doc.name;
            await pool.execute(
              'INSERT INTO release_attachments (release_id, file_name, original_name, file_path, file_size) VALUES (?,?,?,?,?)',
              [rel.release_id, fileName, doc.name, doc.file_path, doc.file_size || null]
            );
          }
        }
        if (syncedRels.length > 0) {
          console.log(`✅ 历史同步版本附件已补充（共 ${syncedRels.length} 个版本）`);
        }
      }
    } catch (err) {
      console.warn('⚠️ version_releases.source 迁移警告:', err.message);
    }

    // ==================== 飞书通知集成 ====================
    // feishu_config 表：存储飞书应用配置
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS feishu_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        app_id VARCHAR(100),
        app_secret VARCHAR(200),
        chat_id VARCHAR(100) COMMENT '统一通知群',
        issues_chat_id VARCHAR(100) COMMENT '售后问题通知群（已废弃，保留向后兼容）',
        devices_chat_id VARCHAR(100) COMMENT '设备创建通知群（已废弃，保留向后兼容）',
        upgrades_chat_id VARCHAR(100) COMMENT '升级任务通知群（已废弃，保留向后兼容）',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ feishu_config 表就绪');

    // feishu_users 表：同步的飞书通讯录员工
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS feishu_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        open_id VARCHAR(100) UNIQUE NOT NULL,
        union_id VARCHAR(100),
        name VARCHAR(100) NOT NULL,
        department VARCHAR(100),
        avatar_url VARCHAR(500),
        is_active TINYINT(1) DEFAULT 1,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ feishu_users 表就绪');

    // issues 表新增 assignee_open_id 列（向后兼容）
    try {
      const [aoidCols] = await pool.execute("SHOW COLUMNS FROM issues LIKE 'assignee_open_id'");
      if (aoidCols.length === 0) {
        await pool.execute("ALTER TABLE issues ADD COLUMN assignee_open_id VARCHAR(100) DEFAULT NULL AFTER assignee");
        console.log('✅ issues.assignee_open_id 字段添加成功');
      }
    } catch (err) {
      console.warn('⚠️ issues.assignee_open_id 迁移警告:', err.message);
    }

    // module_types 表新增 feishu_user_open_id 列（关联飞书默认负责人）
    try {
      const [fuCols] = await pool.execute("SHOW COLUMNS FROM module_types LIKE 'feishu_user_open_id'");
      if (fuCols.length === 0) {
        await pool.execute("ALTER TABLE module_types ADD COLUMN feishu_user_open_id VARCHAR(100) DEFAULT NULL COMMENT '关联飞书负责人 open_id'");
        console.log('✅ module_types.feishu_user_open_id 字段添加成功');
      }
    } catch (err) {
      console.warn('⚠️ module_types.feishu_user_open_id 迁移警告:', err.message);
    }

    // feishu_config 表新增 chat_id 列（统一通知群，合并三个群为一个）
    try {
      const [chatIdCols] = await pool.execute("SHOW COLUMNS FROM feishu_config LIKE 'chat_id'");
      if (chatIdCols.length === 0) {
        await pool.execute("ALTER TABLE feishu_config ADD COLUMN chat_id VARCHAR(100) DEFAULT NULL COMMENT '统一通知群 Chat ID' AFTER app_secret");
        // 迁移旧数据：用 issues_chat_id（最常用）作为新 chat_id
        await pool.execute("UPDATE feishu_config SET chat_id = COALESCE(NULLIF(issues_chat_id,''), NULLIF(devices_chat_id,''), NULLIF(upgrades_chat_id,''))");
        console.log('✅ feishu_config.chat_id 字段添加成功，旧数据已迁移');
      }
    } catch (err) {
      console.warn('⚠️ feishu_config.chat_id 迁移警告:', err.message);
    }

    // 设备状态迁移：正常/异常/维护中 → 生产中/使用中(正常)/使用中(异常)/已停用
    try {
      const [statusCol] = await pool.execute("SHOW COLUMNS FROM devices LIKE 'status'");
      const colType = statusCol[0] ? statusCol[0].Type : '';
      if (colType.includes('正常') && !colType.includes('使用中(正常)')) {
        // Step 1: 扩展 ENUM，同时包含新旧值，避免约束冲突
        await pool.execute("ALTER TABLE devices MODIFY COLUMN status ENUM('正常','异常','维护中','生产中','使用中(正常)','使用中(异常)','已停用') DEFAULT '使用中(正常)'");
        // Step 2: 数据迁移
        await pool.execute("UPDATE devices SET status = '使用中(正常)' WHERE status = '正常'");
        await pool.execute("UPDATE devices SET status = '使用中(异常)' WHERE status IN ('异常', '维护中')");
        // Step 3: 收窄为最终 ENUM
        await pool.execute("ALTER TABLE devices MODIFY COLUMN status ENUM('生产中','使用中(正常)','使用中(异常)','已停用') DEFAULT '使用中(正常)'");
        console.log('✅ devices.status ENUM 迁移成功');
      }
    } catch (err) {
      console.warn('⚠️ devices.status ENUM 迁移警告:', err.message);
    }

    // feishu_notifications 表：记录每条飞书通知消息，保存 message_id 和被 @ 的人
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS feishu_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id VARCHAR(100) NOT NULL COMMENT '飞书消息 ID，用于后续 PATCH 更新',
        type ENUM('device','issue','upgrade') NOT NULL COMMENT '通知类型',
        ref_id VARCHAR(100) NOT NULL COMMENT '关联记录 ID（设备序列号 / 问题 ID / 升级 ID）',
        notify_open_ids JSON COMMENT '被 @ 的飞书用户 open_id 列表',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ref (type, ref_id),
        INDEX idx_message (message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ feishu_notifications 表就绪');

    // issues 表新增 classification_id 列（问题归属分类）
    try {
      const [classifCols] = await pool.execute("SHOW COLUMNS FROM issues LIKE 'classification_id'");
      if (classifCols.length === 0) {
        await pool.execute("ALTER TABLE issues ADD COLUMN classification_id INT NULL AFTER category");
        try {
          await pool.execute("ALTER TABLE issues ADD CONSTRAINT fk_issue_classification FOREIGN KEY (classification_id) REFERENCES issue_classification_types(id) ON DELETE SET NULL");
        } catch (e) {
          console.warn('⚠️ 添加 classification_id 外键警告:', e.message);
        }
        console.log('✅ issues.classification_id 字段添加成功');
      }
    } catch (err) {
      console.warn('⚠️ issues.classification_id 迁移警告:', err.message);
    }

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
