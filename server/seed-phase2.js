const { query, transaction } = require('./database');

async function seedPhase2Data() {
    try {
        console.log('🌱 开始初始化Phase 2订单数据...');

        // 获取已有的客户和产品
        const customers = await query('SELECT id FROM customers LIMIT 2');
        const products = await query('SELECT id FROM products LIMIT 3');

        if (customers.length === 0 || products.length === 0) {
            console.log('⚠️  请先运行Phase 1数据初始化');
            return;
        }

        // 创建示例订单
        const orders = [
            {
                id: 'ORD-20260203-001',
                order_name: 'MLS沙特订单-龙门检测设备',
                customer_id: customers[0].id,
                product_summary: '2台A龙门检测设备',
                quantity: 2,
                order_send_date: '2026-01-15',
                planned_delivery_date: '2026-03-15',
                transport_method: '海运',
                packaging_method: '木箱包装',
                usage_scenario: '汽车检测站',
                installation_scenario: '室内',
                status: '进行中',
                current_stage: '调试',
                created_by: '张三'
            },
            {
                id: 'ORD-20260203-002',
                order_name: '北京订单-底盘检测设备',
                customer_id: customers[1] ? customers[1].id : customers[0].id,
                product_summary: '1台A底盘检测设备',
                quantity: 1,
                order_send_date: '2026-02-01',
                planned_delivery_date: '2026-04-01',
                transport_method: '陆运',
                packaging_method: '纸箱包装',
                usage_scenario: '4S店',
                installation_scenario: '室内',
                status: '进行中',
                current_stage: '装配',
                created_by: '李四'
            }
        ];

        console.log('📦 正在创建订单...');
        for (const order of orders) {
            await query(
                `INSERT INTO orders 
         (id, order_name, customer_id, product_summary, quantity, order_send_date, 
          planned_delivery_date, transport_method, packaging_method, usage_scenario, 
          installation_scenario, status, current_stage, created_by) 
                        // 创建订单设备（每台设备一条记录）
                        let orderDeviceId = null;
                        for (let i = 0; i < order.quantity; i++) {
                            const deviceResult = await query(
                                `INSERT INTO order_devices 
                     (order_id, product_id, quantity, serial_number, unit_price) 
                     VALUES (?, ?, ?, ?, ?)`,
                                [order.id, products[0].id, 1, `SN-${order.id}-${String(i + 1).padStart(3, '0')}`, 150000.00]
                            );
                            if (i === 0) {
                                orderDeviceId = deviceResult.insertId;
                            }
                        }
                    order.transport_method,
                    order.packaging_method,
                    order.usage_scenario,
                    order.installation_scenario,
                    order.status,
                    order.current_stage,
                    order.created_by
                ]
            );
            console.log(`  ✅ 创建订单: ${order.order_name}`);

            // 创建付款信息
            await query(
                `INSERT INTO order_payments (order_id, payment_type, is_paid, prepay_percentage) 
         VALUES (?, ?, ?, ?)`,
                [order.id, '预付款', true, 30.00]
            );

            // 创建订单设备
            const deviceResult = await query(
                `INSERT INTO order_devices (order_id, product_id, quantity, unit_price) 
         VALUES (?, ?, ?, ?)`,
                [order.id, products[0].id, order.quantity, 150000.00]
            );

            const orderDeviceId = deviceResult.insertId;

            // 创建硬件配置
            await query(
                `INSERT INTO order_hardware_configs 
         (order_device_id, product_name, version, power_direction, computer_config) 
         VALUES (?, ?, ?, ?, ?)`,
                [orderDeviceId, '龙门检测设备', 'V1.0', '左侧', 'i7-12700/16G/512G SSD']
            );

            // 创建软件配置
            await query(
                `INSERT INTO order_software_configs 
         (order_device_id, merchant_id, login_email) 
         VALUES (?, ?, ?)`,
                [orderDeviceId, 'M-001', 'admin@example.com']
            );

            // 创建订单进度
            if (order.current_stage === '装配') {
                await query(
                    `INSERT INTO order_progress 
           (order_id, stage, status, operator_id, started_at) 
           VALUES (?, ?, ?, ?, NOW())`,
                    [order.id, '装配', '审核中', '操作员001']
                );
            } else if (order.current_stage === '调试') {
                // 生产阶段已完成
                await query(
                    `INSERT INTO order_progress 
           (order_id, stage, status, operator_id, reviewer_id, started_at, completed_at) 
           VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY))`,
                    [order.id, '装配', '已通过', '操作员001', '审核员001']
                );
                // 调试阶段进行中
                await query(
                    `INSERT INTO order_progress 
           (order_id, stage, status, operator_id, started_at) 
           VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 DAY))`,
                    [order.id, '调试', '审核中', '操作员002']
                );
            }
        }

        console.log('✅ Phase 2 订单数据初始化完成!');
        console.log(`   - 订单: ${orders.length} 个`);
        console.log(`   - 付款记录: ${orders.length} 条`);
        console.log(`   - 订单设备: ${orders.length} 个`);

    } catch (error) {
        console.error('❌ Phase 2 数据初始化失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const { initializeDatabase } = require('./database');

    (async () => {
        try {
            await initializeDatabase();
            await seedPhase2Data();
            process.exit(0);
        } catch (error) {
            console.error('错误:', error);
            process.exit(1);
        }
    })();
}

module.exports = { seedPhase2Data };
