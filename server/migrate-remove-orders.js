/**
 * 数据库迁移脚本：移除订单和客户相关表
 * 将系统重构为纯设备管理与售后服务中心
 */
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
  console.log('🔄 开始数据库迁移：移除订单/客户相关数据...\n');

  const connection = await mysql.createConnection(dbConfig);

  try {
    // 1. 删除 devices 表的外键约束
    console.log('📌 步骤1: 删除 devices 表的外键约束...');
    try {
      await connection.execute("ALTER TABLE devices DROP FOREIGN KEY fk_device_customer");
      console.log('   ✅ 删除 fk_device_customer 成功');
    } catch (e) {
      console.log('   ⚠️ fk_device_customer 不存在或已删除');
    }

    try {
      await connection.execute("ALTER TABLE devices DROP FOREIGN KEY fk_device_order");
      console.log('   ✅ 删除 fk_device_order 成功');
    } catch (e) {
      console.log('   ⚠️ fk_device_order 不存在或已删除');
    }

    // 2. 删除 devices 表的 customer_id 和 order_id 列
    console.log('\n📌 步骤2: 删除 devices 表的 customer_id 和 order_id 列...');
    try {
      await connection.execute("ALTER TABLE devices DROP COLUMN customer_id");
      console.log('   ✅ 删除 customer_id 列成功');
    } catch (e) {
      console.log('   ⚠️ customer_id 列不存在或已删除');
    }

    try {
      await connection.execute("ALTER TABLE devices DROP COLUMN order_id");
      console.log('   ✅ 删除 order_id 列成功');
    } catch (e) {
      console.log('   ⚠️ order_id 列不存在或已删除');
    }

    // 3. 删除订单相关表（按外键依赖顺序删除）
    console.log('\n📌 步骤3: 删除订单相关表...');
    const orderTables = [
      'order_progress',
      'order_shipping_info',
      'order_software_configs',
      'order_hardware_configs',
      'order_devices',
      'order_payments',
      'orders'
    ];

    for (const table of orderTables) {
      try {
        await connection.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`   ✅ 删除表 ${table} 成功`);
      } catch (e) {
        console.log(`   ⚠️ 删除表 ${table} 失败: ${e.message}`);
      }
    }

    // 4. 删除客户表
    console.log('\n📌 步骤4: 删除客户表...');
    try {
      await connection.execute("DROP TABLE IF EXISTS customers");
      console.log('   ✅ 删除表 customers 成功');
    } catch (e) {
      console.log(`   ⚠️ 删除表 customers 失败: ${e.message}`);
    }

    // 5. 清空现有设备数据（demo阶段）
    console.log('\n📌 步骤5: 清空现有设备数据（demo阶段重置）...');
    try {
      // 先删除依赖数据
      await connection.execute("DELETE FROM device_upgrades");
      await connection.execute("DELETE FROM issues");
      await connection.execute("DELETE FROM submodule_versions");
      await connection.execute("DELETE FROM submodules");
      await connection.execute("DELETE FROM module_versions");
      await connection.execute("DELETE FROM modules");
      await connection.execute("DELETE FROM devices");
      console.log('   ✅ 设备相关数据已清空');
    } catch (e) {
      console.log(`   ⚠️ 清空数据失败: ${e.message}`);
    }

    console.log('\n✅ 数据库迁移完成！系统已重构为设备管理与售后服务中心。');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
  } finally {
    await connection.end();
  }
}

migrate();
