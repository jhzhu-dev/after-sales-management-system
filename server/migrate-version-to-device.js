const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateVersionInfo() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'device_manager'
    });

    try {
        console.log('🚀 开始版本信息完全重构...\n');

        // 步骤1: 为硬件配置表添加版本字段
        console.log('1. 为 order_hardware_configs 表添加版本字段...');
        
        const fieldsToAdd = [
            { name: 'structure_version', type: 'VARCHAR(100)', comment: '结构版本' },
            { name: 'electrical_version', type: 'VARCHAR(100)', comment: '电气版本' },
            { name: 'host_software_version', type: 'VARCHAR(100)', comment: '上位机软件版本' },
            { name: 'slave_software_version', type: 'VARCHAR(100)', comment: '下位机软件版本' },
            { name: 'algorithm_version', type: 'VARCHAR(100)', comment: '算法版本' }
        ];

        for (const field of fieldsToAdd) {
            try {
                const [columns] = await pool.execute(
                    `SHOW COLUMNS FROM order_hardware_configs LIKE '${field.name}'`
                );
                if (columns.length === 0) {
                    await pool.execute(
                        `ALTER TABLE order_hardware_configs ADD COLUMN ${field.name} ${field.type} COMMENT '${field.comment}'`
                    );
                    console.log(`  ✅ 添加字段: ${field.name}`);
                } else {
                    console.log(`  ⏭️  字段已存在: ${field.name}`);
                }
            } catch (e) {
                console.error(`  ❌ 添加字段 ${field.name} 失败:`, e.message);
            }
        }
        console.log('✅ 版本字段检查完成\n');

        // 步骤2: 迁移现有版本数据
        console.log('2. 迁移现有版本数据到设备硬件配置...');
        
        const [shippingData] = await pool.execute(`
            SELECT order_id, structure_versions, electrical_versions, software_versions
            FROM order_shipping_info
            WHERE structure_versions IS NOT NULL 
               OR electrical_versions IS NOT NULL 
               OR software_versions IS NOT NULL
        `);

        let migratedCount = 0;
        for (const record of shippingData) {
            // 获取该订单的设备
            const [devices] = await pool.execute(
                'SELECT id FROM order_devices WHERE order_id = ?',
                [record.order_id]
            );

            for (const device of devices) {
                try {
                    let structVer = null, elecVer = null, hostVer = null, slaveVer = null;

                    if (record.structure_versions) {
                        const parsed = JSON.parse(record.structure_versions);
                        structVer = parsed.上位机 || parsed.version || Object.values(parsed)[0] || null;
                    }
                    if (record.electrical_versions) {
                        const parsed = JSON.parse(record.electrical_versions);
                        elecVer = parsed.上位机 || parsed.version || Object.values(parsed)[0] || null;
                    }
                    if (record.software_versions) {
                        const parsed = JSON.parse(record.software_versions);
                        hostVer = parsed.上位机 || null;
                        slaveVer = parsed.下位机 || null;
                    }

                    await pool.execute(`
                        UPDATE order_hardware_configs 
                        SET structure_version = ?,
                            electrical_version = ?,
                            host_software_version = ?,
                            slave_software_version = ?
                        WHERE order_device_id = ?
                    `, [structVer, elecVer, hostVer, slaveVer, device.id]);

                    migratedCount++;
                } catch (e) {
                    console.log(`⚠️  订单 ${record.order_id} 设备 ${device.id} 迁移失败:`, e.message);
                }
            }
        }
        console.log(`✅ 成功迁移 ${migratedCount} 个设备的版本信息\n`);

        // 步骤3: 删除出货信息表的旧版本字段
        console.log('3. 删除出货信息表的旧版本字段...');
        
        const fieldsToRemove = ['structure_versions', 'electrical_versions', 'software_versions'];
        for (const field of fieldsToRemove) {
            try {
                const [columns] = await pool.execute(
                    `SHOW COLUMNS FROM order_shipping_info LIKE '${field}'`
                );
                if (columns.length > 0) {
                    await pool.execute(
                        `ALTER TABLE order_shipping_info DROP COLUMN ${field}`
                    );
                    console.log(`  ✅ 删除字段: ${field}`);
                } else {
                    console.log(`  ⏭️  字段不存在: ${field}`);
                }
            } catch (e) {
                console.error(`  ❌ 删除字段 ${field} 失败:`, e.message);
            }
        }
        console.log('✅ 旧版本字段清理完成\n');

        // 步骤4: 验证结果
        console.log('4. 验证迁移结果...');
        const [sample] = await pool.execute(`
            SELECT 
                o.order_name,
                od.serial_number,
                p.name as product_name,
                ohc.structure_version,
                ohc.electrical_version,
                ohc.host_software_version,
                ohc.slave_software_version,
                ohc.algorithm_version
            FROM orders o
            JOIN order_devices od ON o.id = od.order_id
            JOIN products p ON od.product_id = p.id
            LEFT JOIN order_hardware_configs ohc ON od.id = ohc.order_device_id
            ORDER BY o.created_at DESC
            LIMIT 5
        `);

        console.log('\n📋 迁移样本数据:');
        console.table(sample);

        console.log('\n✅ 版本信息完全重构完成！');
        console.log('\n📦 新增字段:');
        console.log('  - structure_version: 结构版本');
        console.log('  - electrical_version: 电气版本');
        console.log('  - host_software_version: 上位机软件版本');
        console.log('  - slave_software_version: 下位机软件版本');
        console.log('  - algorithm_version: 算法版本\n');

    } catch (error) {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrateVersionInfo();
