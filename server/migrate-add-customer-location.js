/**
 * 数据库迁移：创建客户表，为设备表添加客户关联和位置字段
 */
const { getPool } = require('./database');

async function migrate() {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    console.log('🚀 开始执行客户和设备位置迁移...');

    // 1. 创建客户表
    console.log('📋 创建 customers 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        short_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_short_name (short_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ customers 表创建成功');

    // 2. 为 devices 表添加 customer_id 字段
    const [customerIdCols] = await connection.execute("SHOW COLUMNS FROM devices LIKE 'customer_id'");
    if (customerIdCols.length === 0) {
      console.log('📋 为 devices 表添加 customer_id 字段...');
      await connection.execute("ALTER TABLE devices ADD COLUMN customer_id INT AFTER product_line_id");
      await connection.execute("ALTER TABLE devices ADD CONSTRAINT fk_device_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT");
      console.log('✅ customer_id 字段添加成功');
    } else {
      console.log('⏭️ customer_id 字段已存在，跳过');
    }

    // 3. 为 devices 表添加 location 字段
    const [locationCols] = await connection.execute("SHOW COLUMNS FROM devices LIKE 'location'");
    if (locationCols.length === 0) {
      console.log('📋 为 devices 表添加 location 字段...');
      await connection.execute("ALTER TABLE devices ADD COLUMN location VARCHAR(255) AFTER customer_id");
      console.log('✅ location 字段添加成功');
    } else {
      console.log('⏭️ location 字段已存在，跳过');
    }

    console.log('🎉 迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
