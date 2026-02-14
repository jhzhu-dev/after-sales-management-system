require('dotenv').config();
const mysql = require('mysql2/promise');

async function splitOrderDevices() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'els',
            password: process.env.DB_PASSWORD || '111111',
            database: process.env.DB_NAME || 'device_management'
        });

        console.log('✅ 数据库连接成功');

        const [rows] = await connection.query(
            'SELECT * FROM order_devices WHERE quantity > 1'
        );

        if (rows.length === 0) {
            console.log('ℹ️  没有需要拆分的订单设备');
            return;
        }

        for (const row of rows) {
            const { id, order_id, product_id, quantity, serial_number, customization, unit_price } = row;
            console.log(`🔧 拆分订单设备 ID=${id}, 数量=${quantity}`);

            const [hwConfigs] = await connection.query(
                'SELECT * FROM order_hardware_configs WHERE order_device_id = ?',
                [id]
            );
            const [swConfigs] = await connection.query(
                'SELECT * FROM order_software_configs WHERE order_device_id = ?',
                [id]
            );
            const [progressRows] = await connection.query(
                'SELECT * FROM order_progress WHERE order_device_id = ?',
                [id]
            );

            let firstNewId = null;
            for (let i = 0; i < quantity; i++) {
                const newSn = (i === 0 && serial_number)
                    ? serial_number
                    : `SN-${order_id}-${String(i + 1).padStart(3, '0')}`;

                const [result] = await connection.query(
                    `INSERT INTO order_devices
                     (order_id, product_id, quantity, serial_number, customization, unit_price)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [order_id, product_id, 1, newSn, customization, unit_price]
                );

                const newId = result.insertId;
                if (i === 0) {
                    firstNewId = newId;
                }

                // 复制硬件配置
                for (const hw of hwConfigs) {
                    await connection.query(
                        `INSERT INTO order_hardware_configs
                         (order_device_id, product_name, version, is_selected, power_direction,
                          wire_length, computer_config, server_config, monitor_config,
                          license_plate_recognition, barcode_board, other_parts, customization_notes,
                          structure_version, electrical_version, host_software_version,
                          slave_software_version, algorithm_version)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            newId,
                            hw.product_name,
                            hw.version,
                            hw.is_selected,
                            hw.power_direction,
                            hw.wire_length,
                            hw.computer_config,
                            hw.server_config,
                            hw.monitor_config,
                            hw.license_plate_recognition,
                            hw.barcode_board,
                            hw.other_parts,
                            hw.customization_notes,
                            hw.structure_version,
                            hw.electrical_version,
                            hw.host_software_version,
                            hw.slave_software_version,
                            hw.algorithm_version
                        ]
                    );
                }

                // 复制软件配置
                for (const sw of swConfigs) {
                    await connection.query(
                        `INSERT INTO order_software_configs
                         (order_device_id, merchant_id, login_email, initial_password,
                          device_code_sh, device_code_sz, logo)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            newId,
                            sw.merchant_id,
                            sw.login_email,
                            sw.initial_password,
                            sw.device_code_sh,
                            sw.device_code_sz,
                            sw.logo
                        ]
                    );
                }
            }

            // 迁移进度记录到第一台设备
            if (firstNewId && progressRows.length > 0) {
                await connection.query(
                    'UPDATE order_progress SET order_device_id = ? WHERE order_device_id = ?',
                    [firstNewId, id]
                );
            }

            // 删除原设备行及其配置
            await connection.query('DELETE FROM order_hardware_configs WHERE order_device_id = ?', [id]);
            await connection.query('DELETE FROM order_software_configs WHERE order_device_id = ?', [id]);
            await connection.query('DELETE FROM order_devices WHERE id = ?', [id]);
        }

        console.log('✅ 订单设备拆分完成');
    } catch (error) {
        console.error('❌ 拆分失败:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('✅ 数据库连接已关闭');
        }
    }
}

splitOrderDevices()
    .then(() => {
        console.log('✅ 迁移完成');
        process.exit(0);
    })
    .catch(() => process.exit(1));
