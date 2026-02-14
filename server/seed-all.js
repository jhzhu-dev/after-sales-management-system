const { initializeDatabase, transaction, query } = require('./database');
const { seedDatabase: seedCore } = require('./seed_new');
const { seedPhase1Data } = require('./seed-phase1');
const { seedPhase2Data } = require('./seed-phase2');

async function seedAll() {
    try {
        console.log('🚀 开始全量模拟数据导入...');

        await initializeDatabase();

        await transaction(async (conn) => {
            console.log('🗑️  正在清理相关业务数据 (Phase 1 & 2)...');
            // 注意：清理顺序需考虑外键约束
            await conn.execute('DELETE FROM order_progress');
            await conn.execute('DELETE FROM order_shipping_info');
            await conn.execute('DELETE FROM order_software_configs');
            await conn.execute('DELETE FROM order_hardware_configs');
            await conn.execute('DELETE FROM order_devices');
            await conn.execute('DELETE FROM order_payments');
            await conn.execute('DELETE FROM orders');
            await conn.execute('DELETE FROM product_documents');
            await conn.execute('DELETE FROM product_submodule_specs');
            await conn.execute('DELETE FROM product_modules');
            await conn.execute('DELETE FROM products');
            await conn.execute('DELETE FROM product_lines');
            await conn.execute('DELETE FROM device_upgrades');
            await conn.execute('DELETE FROM issues');
            await conn.execute('DELETE FROM customers');
            // seedCore 会清理 devices, modules, submodules, device_types, module_types
            console.log('✅ 业务数据清理完成');
        });

        console.log('\n--- 阶段 0: 核心设备与模块结构 ---');
        // seed_new.js 中的 seedDatabase 已经包含了自己的事务和清理
        await seedCore();

        console.log('\n--- 阶段 1: 产品线、产品与客户 ---');
        await seedPhase1Data();

        console.log('\n--- 阶段 2: 订单、配置与进度 ---');
        await seedPhase2Data();

        console.log('\n✨ 全量数据导入成功！');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ 数据导入失败:', error);
        process.exit(1);
    }
}

seedAll();
