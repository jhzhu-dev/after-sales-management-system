const { initializeDatabase, query, transaction } = require('./database');

/**
 * 丰富的模拟数据生成脚本
 * 数据库表结构:
 * - device_types: 设备类型
 * - module_types: 模块类型  
 * - devices: 设备
 * - modules: 模块（关联设备和模块类型）
 * - submodules: 子模块
 * - submodule_versions: 子模块版本历史
 * - product_lines: 产品线
 * - products: 产品
 * - product_documents: 产品资料
 * - product_modules: 产品模块模板
 * - product_submodule_specs: 产品子模块规格
 * - customers: 客户
 * - orders: 订单
 * - order_payments: 付款记录
 * - order_devices: 订单设备
 * - order_hardware_configs: 硬件配置
 * - order_software_configs: 软件配置
 * - order_shipping_info: 出货信息
 * - order_progress: 订单进度
 * - issues: 售后问题
 * - device_upgrades: 设备升级记录
 * - version_releases: 版本发布库
 * - sop_templates: SOP模板
 */

// ===================== 基础数据 =====================

const deviceTypes = [
    { name: '龙门设备', description: '用于大型工件加工的龙门式设备' },
    { name: '底盘设备', description: '用于底盘装配和检测的设备' },
    { name: '侧扫设备', description: '用于侧面扫描和检测的设备' },
    { name: '检测设备', description: '用于质量检测和测试的设备' },
    { name: '胎纹设备', description: '用于轮胎纹路检测的设备' },
    { name: '大盒子设备', description: '大型综合检测设备' }
];

const moduleTypes = [
    { name: '机械', code: 'mechanical', description: '机械传动模块' },
    { name: '电气', code: 'electrical', description: '电气控制模块' },
    { name: '上位机', code: 'host', description: '上位机控制模块' },
    { name: '服务器', code: 'server', description: '数据服务器模块' },
    { name: '视觉', code: 'vision', description: '视觉检测模块' }
];

const productLines = [
    { name: '龙门检测设备', code: 'LONGMEN', description: '用于汽车外观龙门检测的设备系列' },
    { name: '胎纹检测设备', code: 'TAIWEN', description: '用于轮胎纹路检测的设备系列' },
    { name: '底盘检测设备', code: 'DIPAN', description: '用于汽车底盘检测的设备系列' },
    { name: '侧扫检测设备', code: 'CESAO', description: '用于汽车侧面扫描检测的设备系列' },
    { name: '大盒子检测设备', code: 'DAHEZI', description: '用于大型检测设备系列' }
];

const products = [
    { line: 'LONGMEN', name: 'A龙门', model: 'LM-A-V1', description: 'A型龙门检测设备，适用于标准车辆' },
    { line: 'LONGMEN', name: 'B龙门', model: 'LM-B-V1', description: 'B型龙门检测设备，适用于大型车辆' },
    { line: 'LONGMEN', name: 'C龙门', model: 'LM-C-V1', description: 'C型龙门检测设备，高精度版本' },
    { line: 'TAIWEN', name: 'A胎纹', model: 'TW-A-V1', description: 'A型胎纹检测设备，标准版' },
    { line: 'TAIWEN', name: 'B胎纹', model: 'TW-B-V1', description: 'B型胎纹检测设备，高速版' },
    { line: 'DIPAN', name: 'A底盘', model: 'DP-A-V1', description: 'A型底盘检测设备' },
    { line: 'DIPAN', name: 'B底盘', model: 'DP-B-V1', description: 'B型底盘检测设备，增强版' },
    { line: 'CESAO', name: 'A侧扫', model: 'CS-A-V1', description: 'A型侧扫检测设备' },
    { line: 'CESAO', name: 'B侧扫', model: 'CS-B-V1', description: 'B型侧扫检测设备，双面扫描' },
    { line: 'DAHEZI', name: 'A大盒子', model: 'DHZ-A-V1', description: 'A型大盒子检测设备' },
    { line: 'DAHEZI', name: 'B大盒子', model: 'DHZ-B-V1', description: 'B型大盒子检测设备' },
    { line: 'DAHEZI', name: 'C大盒子', model: 'DHZ-C-V1', description: 'C型大盒子检测设备，全功能版' }
];

// 丰富的客户数据 - 15个客户
const customers = [
    { id: 'C-20260101-001', name: 'MLS沙特汽车检测中心', region: '沙特阿拉伯', contact_person: '穆罕默德·阿里', contact_phone: '+966-11-1234567', contact_email: 'mali@mls-saudi.com', address: '利雅得市工业区A座' },
    { id: 'C-20260101-002', name: '北京汽车检测站', region: '北京', contact_person: '李明', contact_phone: '010-88886666', contact_email: 'liming@bjtest.cn', address: '北京市朝阳区望京科技园' },
    { id: 'C-20260101-003', name: '上海大众4S店', region: '上海', contact_person: '王芳', contact_phone: '021-55551234', contact_email: 'wangfang@shvw.com', address: '上海市浦东新区张江高科' },
    { id: 'C-20260101-004', name: '广州本田检测中心', region: '广东', contact_person: '陈志强', contact_phone: '020-87654321', contact_email: 'czq@gzhonda.com', address: '广州市黄埔区开发区' },
    { id: 'C-20260101-005', name: '深圳比亚迪工厂', region: '深圳', contact_person: '张伟', contact_phone: '0755-26668888', contact_email: 'zhangwei@byd.com', address: '深圳市坪山区比亚迪工业园' },
    { id: 'C-20260101-006', name: '成都一汽大众', region: '四川', contact_person: '刘洋', contact_phone: '028-85551234', contact_email: 'liuyang@faw-vw.com', address: '成都市龙泉驿区经开区' },
    { id: 'C-20260101-007', name: '武汉东风汽车', region: '湖北', contact_person: '赵静', contact_phone: '027-87651234', contact_email: 'zhaojing@dfmotor.com', address: '武汉市经济技术开发区' },
    { id: 'C-20260101-008', name: '重庆长安汽车', region: '重庆', contact_person: '周磊', contact_phone: '023-68881234', contact_email: 'zhoulei@changan.com', address: '重庆市渝北区两江新区' },
    { id: 'C-20260101-009', name: '天津丰田检测站', region: '天津', contact_person: '孙丽', contact_phone: '022-27771234', contact_email: 'sunli@toyota-tj.com', address: '天津市西青区汽车工业园' },
    { id: 'C-20260101-010', name: '杭州吉利汽车', region: '浙江', contact_person: '吴刚', contact_phone: '0571-88881234', contact_email: 'wugang@geely.com', address: '杭州市滨江区科技园' },
    { id: 'C-20260102-001', name: '迪拜汽车检测中心', region: '阿联酋', contact_person: 'Ahmed Hassan', contact_phone: '+971-4-1234567', contact_email: 'ahmed@dubai-auto.ae', address: 'Dubai Industrial City' },
    { id: 'C-20260102-002', name: '科威特国家检测局', region: '科威特', contact_person: 'Khalid Al-Sabah', contact_phone: '+965-22334455', contact_email: 'khalid@kuwait-test.kw', address: 'Kuwait City, Shuwaikh Industrial' },
    { id: 'C-20260102-003', name: '德国宝马检测中心', region: '德国', contact_person: 'Hans Mueller', contact_phone: '+49-89-12345678', contact_email: 'hmueller@bmw-test.de', address: 'Munich, Bavaria' },
    { id: 'C-20260102-004', name: '日本丰田技术中心', region: '日本', contact_person: '田中太郎', contact_phone: '+81-52-1234567', contact_email: 'tanaka@toyota-tech.jp', address: 'Aichi Prefecture, Toyota City' },
    { id: 'C-20260102-005', name: '美国通用汽车检测', region: '美国', contact_person: 'John Smith', contact_phone: '+1-313-1234567', contact_email: 'jsmith@gm-test.com', address: 'Detroit, Michigan' }
];

// 丰富的订单数据 - 12个订单（不同阶段）
const orders = [
    // 进行中的订单 - 各阶段
    { id: 'ORD-20260115-001', name: 'MLS沙特订单-龙门检测设备', customer_idx: 0, stage: '调试', status: '进行中', product_summary: '2台A龙门检测设备', quantity: 2, send_date: '2026-01-15', delivery_date: '2026-03-15', transport: '海运' },
    { id: 'ORD-20260120-001', name: '北京订单-底盘检测设备', customer_idx: 1, stage: '打包', status: '进行中', product_summary: '1台A底盘检测设备', quantity: 1, send_date: '2026-01-20', delivery_date: '2026-02-28', transport: '陆运' },
    { id: 'ORD-20260125-001', name: '上海大众-侧扫设备', customer_idx: 2, stage: '生产', status: '进行中', product_summary: '3台A侧扫检测设备', quantity: 3, send_date: '2026-01-25', delivery_date: '2026-04-10', transport: '陆运' },
    { id: 'ORD-20260128-001', name: '广州本田-胎纹检测', customer_idx: 3, stage: '物流', status: '进行中', product_summary: '2台B胎纹检测设备', quantity: 2, send_date: '2026-01-28', delivery_date: '2026-03-01', transport: '陆运' },
    { id: 'ORD-20260130-001', name: '深圳比亚迪-大盒子设备', customer_idx: 4, stage: '生产', status: '进行中', product_summary: '1台A大盒子检测设备', quantity: 1, send_date: '2026-01-30', delivery_date: '2026-04-30', transport: '陆运' },
    { id: 'ORD-20260201-001', name: '成都一汽-龙门设备', customer_idx: 5, stage: '调试', status: '进行中', product_summary: '2台B龙门检测设备', quantity: 2, send_date: '2026-02-01', delivery_date: '2026-04-15', transport: '陆运' },
    // 已完成的订单
    { id: 'ORD-20251201-001', name: '武汉东风-底盘设备', customer_idx: 6, stage: '完成', status: '已完成', product_summary: '1台B底盘检测设备', quantity: 1, send_date: '2025-12-01', delivery_date: '2026-01-15', transport: '陆运' },
    { id: 'ORD-20251215-001', name: '重庆长安-侧扫设备', customer_idx: 7, stage: '完成', status: '已完成', product_summary: '2台B侧扫检测设备', quantity: 2, send_date: '2025-12-15', delivery_date: '2026-01-30', transport: '陆运' },
    // 草稿订单
    { id: 'ORD-20260203-001', name: '天津丰田-胎纹设备', customer_idx: 8, stage: '生产', status: '草稿', product_summary: '1台A胎纹检测设备', quantity: 1, send_date: '2026-02-10', delivery_date: '2026-04-10', transport: '陆运' },
    { id: 'ORD-20260203-002', name: '杭州吉利-龙门设备', customer_idx: 9, stage: '生产', status: '草稿', product_summary: '3台C龙门检测设备', quantity: 3, send_date: '2026-02-15', delivery_date: '2026-05-15', transport: '海运' },
    // 海外订单
    { id: 'ORD-20260201-002', name: '迪拜订单-大盒子设备', customer_idx: 10, stage: '生产', status: '进行中', product_summary: '2台B大盒子检测设备', quantity: 2, send_date: '2026-02-01', delivery_date: '2026-05-01', transport: '海运' },
    { id: 'ORD-20260202-001', name: '科威特订单-检测设备', customer_idx: 11, stage: '调试', status: '进行中', product_summary: '1台C大盒子检测设备', quantity: 1, send_date: '2026-02-02', delivery_date: '2026-04-20', transport: '海运' },
];

// SOP模板数据
const sopTemplates = [
    {
        stage: '生产', version: 'v1.0',
        content: [
            { id: 1, name: '零部件检验', checked: false },
            { id: 2, name: '机械装配', checked: false },
            { id: 3, name: '电气接线', checked: false },
            { id: 4, name: '初步调试', checked: false },
            { id: 5, name: '外观检查', checked: false },
            { id: 6, name: '出厂标签', checked: false }
        ]
    },
    {
        stage: '调试', version: 'v1.0',
        content: [
            { id: 1, name: '上电测试', checked: false },
            { id: 2, name: '功能验证', checked: false },
            { id: 3, name: '精度校准', checked: false },
            { id: 4, name: '软件配置', checked: false },
            { id: 5, name: '联机测试', checked: false },
            { id: 6, name: '调试报告', checked: false }
        ]
    },
    {
        stage: '打包', version: 'v1.0',
        content: [
            { id: 1, name: '外观清洁', checked: false },
            { id: 2, name: '粘贴标签', checked: false },
            { id: 3, name: '装箱清单确认', checked: false },
            { id: 4, name: '附件核对', checked: false },
            { id: 5, name: '包装防护', checked: false },
            { id: 6, name: '封箱拍照', checked: false }
        ]
    },
    {
        stage: '物流', version: 'v1.0',
        content: [
            { id: 1, name: '物流单号', checked: false },
            { id: 2, name: '发货拍照', checked: false },
            { id: 3, name: '运输保险', checked: false },
            { id: 4, name: '客户通知', checked: false },
            { id: 5, name: '签收确认', checked: false },
            { id: 6, name: '交付文档', checked: false }
        ]
    }
];

// 子模块模板
const submoduleTemplates = {
    '机械': [
        { name: '主轴电机', model: 'SM-2000', factory_version: 'v2.0', current_version: 'v2.1', description: '主轴驱动电机' },
        { name: '导轨系统', model: 'RG-500', factory_version: 'v1.5', current_version: 'v1.8', description: 'X轴导轨系统' },
        { name: '传动装置', model: 'TD-300', factory_version: 'v1.2', current_version: 'v1.2', description: '动力传动装置' }
    ],
    '电气': [
        { name: '主控制器', model: 'PLC-3000', factory_version: 'v3.0', current_version: 'v3.2', description: '主控PLC' },
        { name: '伺服驱动器', model: 'SD-1000', factory_version: 'v2.0', current_version: 'v2.0', description: '伺服电机驱动器' },
        { name: '电源模块', model: 'PM-500', factory_version: 'v1.5', current_version: 'v1.6', description: '稳压电源模块' }
    ],
    '上位机': [
        { name: '工控机', model: 'IPC-5000', factory_version: 'v4.0', current_version: 'v4.1', description: '工业控制计算机' },
        { name: '触摸屏', model: 'HMI-1500', factory_version: 'v2.0', current_version: 'v2.3', description: '人机交互界面' }
    ],
    '服务器': [
        { name: '数据库服务器', model: 'DB-SRV-2000', factory_version: 'v1.5', current_version: 'v1.5', description: '数据存储服务器' },
        { name: '应用服务器', model: 'APP-SRV-1000', factory_version: 'v2.0', current_version: 'v2.0', description: '应用程序服务器' }
    ],
    '视觉': [
        { name: '工业相机', model: 'CAM-5000', factory_version: 'v3.0', current_version: 'v3.1', description: '高分辨率工业相机' },
        { name: '镜头组', model: 'LENS-200', factory_version: 'v1.2', current_version: 'v1.2', description: '变焦镜头组' },
        { name: '光源控制器', model: 'LC-100', factory_version: 'v1.0', current_version: 'v1.1', description: 'LED光源控制器' }
    ]
};

// 问题描述模板
const issueDescriptions = [
    { desc: '设备启动后自动停机，需要重新启动', severity: 'high', category: '硬件故障' },
    { desc: '传感器读数偏差超过允许范围', severity: 'medium', category: '硬件故障' },
    { desc: '控制系统响应延迟明显', severity: 'medium', category: '软件Bug' },
    { desc: '机械部件运行时有异常噪音', severity: 'low', category: '硬件故障' },
    { desc: '触摸屏偶尔无响应', severity: 'medium', category: '硬件故障' },
    { desc: '软件界面显示异常', severity: 'low', category: '软件Bug' },
    { desc: '网络连接经常断开', severity: 'medium', category: '软件Bug' },
    { desc: '数据同步到云端失败', severity: 'high', category: '软件Bug' },
    { desc: '如何调整检测精度参数？', severity: 'low', category: '操作咨询' },
    { desc: '设备安装位置要求咨询', severity: 'low', category: '安装调试' },
    { desc: '客户需要现场培训支持', severity: 'medium', category: '其他' },
    { desc: '设备运行数据无法导出', severity: 'medium', category: '软件Bug' }
];

// ===================== 主函数 =====================

async function seedRichData() {
    try {
        console.log('🚀 开始全量丰富模拟数据导入...\n');
        
        await initializeDatabase();

        await transaction(async (conn) => {
            console.log('🗑️  正在清理所有业务数据...');
            // 按外键依赖顺序清理
            await conn.execute('DELETE FROM device_upgrades');
            await conn.execute('DELETE FROM issues');
            await conn.execute('DELETE FROM submodule_versions');
            await conn.execute('DELETE FROM submodules');
            await conn.execute('DELETE FROM module_versions');
            await conn.execute('DELETE FROM modules');
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
            await conn.execute('DELETE FROM version_releases');
            await conn.execute('DELETE FROM sop_templates');
            await conn.execute('DELETE FROM devices');
            await conn.execute('DELETE FROM customers');
            await conn.execute('DELETE FROM module_types');
            await conn.execute('DELETE FROM device_types');
            console.log('✅ 数据清理完成\n');
        });

        // ========== 1. 基础类型数据 ==========
        console.log('📦 正在创建基础类型数据...');
        
        // 设备类型
        const deviceTypeIds = {};
        for (const dt of deviceTypes) {
            const result = await query(
                'INSERT INTO device_types (name, description) VALUES (?, ?)',
                [dt.name, dt.description]
            );
            deviceTypeIds[dt.name] = result.insertId;
        }
        console.log(`  ✅ 设备类型: ${deviceTypes.length} 个`);

        // 模块类型
        const moduleTypeIds = {};
        for (const mt of moduleTypes) {
            const result = await query(
                'INSERT INTO module_types (name, code, description) VALUES (?, ?, ?)',
                [mt.name, mt.code, mt.description]
            );
            moduleTypeIds[mt.name] = result.insertId;
        }
        console.log(`  ✅ 模块类型: ${moduleTypes.length} 个`);

        // ========== 2. SOP模板 ==========
        console.log('\n📋 正在创建SOP模板...');
        for (const tpl of sopTemplates) {
            await query(
                'INSERT INTO sop_templates (stage, version, content, is_active, created_by) VALUES (?, ?, ?, ?, ?)',
                [tpl.stage, tpl.version, JSON.stringify(tpl.content), true, '系统管理员']
            );
        }
        console.log(`  ✅ SOP模板: ${sopTemplates.length} 个`);

        // ========== 3. 产品线和产品 ==========
        console.log('\n📦 正在创建产品线和产品...');
        const productLineIds = {};
        for (const pl of productLines) {
            const result = await query(
                'INSERT INTO product_lines (name, code, description) VALUES (?, ?, ?)',
                [pl.name, pl.code, pl.description]
            );
            productLineIds[pl.code] = result.insertId;
        }
        console.log(`  ✅ 产品线: ${productLines.length} 个`);

        const productIds = {};
        for (const p of products) {
            const result = await query(
                'INSERT INTO products (product_line_id, name, model, description) VALUES (?, ?, ?, ?)',
                [productLineIds[p.line], p.name, p.model, p.description]
            );
            productIds[p.name] = result.insertId;
            
            // 为每个产品创建模块模板
            for (const mt of moduleTypes) {
                await query(
                    'INSERT INTO product_modules (product_id, module_type_id, is_required) VALUES (?, ?, ?)',
                    [result.insertId, moduleTypeIds[mt.name], true]
                );
            }
        }
        console.log(`  ✅ 产品: ${products.length} 个`);

        // ========== 4. 客户 ==========
        console.log('\n👥 正在创建客户数据...');
        const customerIds = [];
        for (const c of customers) {
            await query(
                `INSERT INTO customers (id, name, region, contact_person, contact_phone, contact_email, address) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [c.id, c.name, c.region, c.contact_person, c.contact_phone, c.contact_email, c.address]
            );
            customerIds.push(c.id);
        }
        console.log(`  ✅ 客户: ${customers.length} 个`);

        // ========== 5. 订单 ==========
        console.log('\n📋 正在创建订单数据...');
        const orderDeviceMap = {}; // 存储订单设备ID
        
        for (const order of orders) {
            const customerId = customerIds[order.customer_idx];
            
            await query(
                `INSERT INTO orders (id, order_name, customer_id, product_summary, quantity, 
                 order_send_date, planned_delivery_date, transport_method, status, current_stage, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [order.id, order.name, customerId, order.product_summary, order.quantity,
                 order.send_date, order.delivery_date, order.transport, order.status, order.stage, '系统管理员']
            );

            // 创建付款记录
            await query(
                `INSERT INTO order_payments (order_id, payment_type, is_paid, prepay_percentage) 
                 VALUES (?, ?, ?, ?)`,
                [order.id, '预付款', order.status !== '草稿', 30.00]
            );

            // 创建订单设备（每个订单创建 quantity 个设备）
            const productNames = Object.keys(productIds);
            const selectedProduct = productNames[order.customer_idx % productNames.length];
            
            orderDeviceMap[order.id] = [];
            
            for (let i = 0; i < order.quantity; i++) {
                const deviceResult = await query(
                    `INSERT INTO order_devices (order_id, product_id, quantity, unit_price, serial_number) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [order.id, productIds[selectedProduct], 1, 150000.00, `SN-${order.id}-${i + 1}`]
                );
                
                const orderDeviceId = deviceResult.insertId;
                orderDeviceMap[order.id].push(orderDeviceId);

                // 创建硬件配置
                await query(
                    `INSERT INTO order_hardware_configs 
                     (order_device_id, product_name, version, power_direction, computer_config) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [orderDeviceId, selectedProduct, 'V1.0', i % 2 === 0 ? '左侧' : '右侧', 'i7-12700/16G/512G SSD']
                );

                // 创建软件配置
                await query(
                    `INSERT INTO order_software_configs 
                     (order_device_id, merchant_id, login_email) 
                     VALUES (?, ?, ?)`,
                    [orderDeviceId, `M-${String(order.customer_idx + 1).padStart(3, '0')}`, customers[order.customer_idx].contact_email]
                );
            }

            // 创建订单进度（根据当前阶段）
            const stages = ['生产', '调试', '打包', '物流'];
            const currentStageIndex = stages.indexOf(order.stage);
            
            if (order.status !== '草稿') {
                // 为每个订单设备创建进度记录
                for (const orderDeviceId of orderDeviceMap[order.id]) {
                    // 创建已完成的阶段进度
                    for (let i = 0; i < currentStageIndex; i++) {
                        await query(
                            `INSERT INTO order_progress 
                             (order_id, order_device_id, stage, status, operator_id, reviewer_id, started_at, completed_at) 
                             VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
                            [order.id, orderDeviceId, stages[i], '已通过', '生产专员', '质检专员', 
                             (currentStageIndex - i) * 5 + 5, (currentStageIndex - i) * 5]
                        );
                    }
                    
                    // 创建当前阶段进度（如果不是完成状态）
                    if (order.stage !== '完成') {
                        // 获取对应阶段的SOP模板
                        const sopTemplateResult = await query(
                            'SELECT id, content FROM sop_templates WHERE stage = ? AND is_active = 1 LIMIT 1',
                            [order.stage]
                        );
                        
                        const sopContent = sopTemplateResult.length > 0 ? sopTemplateResult[0].content : null;
                        const sopTemplateId = sopTemplateResult.length > 0 ? sopTemplateResult[0].id : null;
                        
                        await query(
                            `INSERT INTO order_progress 
                             (order_id, order_device_id, stage, status, operator_id, sop_checklist, sop_template_id, started_at) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                            [order.id, orderDeviceId, order.stage, '待审核', '生产专员', sopContent, sopTemplateId]
                        );
                    }
                }
            }
        }
        console.log(`  ✅ 订单: ${orders.length} 个`);

        // ========== 6. 设备（独立于订单的设备，已交付的设备）==========
        console.log('\n🔧 正在创建设备数据...');
        const deviceIds = [];
        const locations = ['车间1-生产线A', '车间1-生产线B', '车间2-装配线', '车间2-检测区', '车间3-质检区', 
                          '车间3-包装区', '车间4-测试区', '车间4-维修区', '车间5-存储区', '车间5-发货区',
                          '客户现场-北京', '客户现场-上海', '客户现场-广州', '客户现场-深圳', '客户现场-成都'];
        const statuses = ['正常', '正常', '正常', '异常', '维护中'];
        const deviceTypeNames = Object.keys(deviceTypeIds);

        for (let i = 1; i <= 25; i++) {
            const deviceId = `DEV${i.toString().padStart(3, '0')}`;
            const typeName = deviceTypeNames[(i - 1) % deviceTypeNames.length];
            const status = statuses[(i - 1) % statuses.length];
            const location = locations[(i - 1) % locations.length];
            
            // 一些设备关联到客户
            const customerId = i <= 15 ? customerIds[(i - 1) % customerIds.length] : null;
            // 一些设备关联到已完成订单
            const orderId = i <= 4 ? orders.find(o => o.status === '已完成')?.id : null;

            await query(
                `INSERT INTO devices (id, name, type_id, customer_id, order_id, location, status, remote_code, password) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [deviceId, `${typeName}${String.fromCharCode(64 + ((i - 1) % 26) + 1)}`, 
                 deviceTypeIds[typeName], customerId, orderId, location, status,
                 `RC-${deviceId}`, `PWD-${deviceId}`]
            );
            deviceIds.push(deviceId);

            // 为每个设备创建模块
            for (const [mtName, mtId] of Object.entries(moduleTypeIds)) {
                const moduleResult = await query(
                    'INSERT INTO modules (device_id, type_id, status) VALUES (?, ?, ?)',
                    [deviceId, mtId, status]
                );
                const moduleId = moduleResult.insertId;

                // 创建子模块
                const templates = submoduleTemplates[mtName] || [];
                for (const tpl of templates) {
                    const subResult = await query(
                        `INSERT INTO submodules (module_id, name, model, factory_version, current_version, description, status) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [moduleId, tpl.name, tpl.model, tpl.factory_version, tpl.current_version, tpl.description, '正常']
                    );

                    // 创建版本历史
                    await query(
                        `INSERT INTO submodule_versions (submodule_id, version_number, version_type, release_date, description, updated_by) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [subResult.insertId, tpl.factory_version, 'factory', '2025-01-01', `出厂版本 - ${tpl.name}`, '制造商']
                    );

                    if (tpl.current_version !== tpl.factory_version) {
                        await query(
                            `INSERT INTO submodule_versions (submodule_id, version_number, version_type, release_date, description, updated_by) 
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [subResult.insertId, tpl.current_version, 'update', '2025-06-01', `版本更新 - ${tpl.name}`, '维护工程师']
                        );
                    }
                }
            }
        }
        console.log(`  ✅ 设备: 25 台 (含模块和子模块)`);

        // ========== 7. 售后问题 ==========
        console.log('\n🔧 正在创建售后问题...');
        const assignees = ['维护工程师A', '电气工程师B', '机械工程师C', '软件工程师D', '系统管理员E'];
        const issueStatuses = ['open', 'in_progress', 'closed'];
        let issueCount = 0;

        for (let i = 0; i < 30; i++) {
            const deviceId = deviceIds[i % deviceIds.length];
            const template = issueDescriptions[i % issueDescriptions.length];
            const status = issueStatuses[i % issueStatuses.length];
            
            await query(
                `INSERT INTO issues (device_id, category, description, severity, status, assignee, 
                 contact_person, contact_phone, is_visit_required, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
                [deviceId, template.category, template.desc, template.severity, status, 
                 assignees[i % assignees.length], customers[i % customers.length].contact_person,
                 customers[i % customers.length].contact_phone, i % 4 === 0, i * 2]
            );
            issueCount++;
        }
        console.log(`  ✅ 售后问题: ${issueCount} 条`);

        // ========== 8. 设备升级记录 ==========
        console.log('\n⬆️  正在创建设备升级记录...');
        const upgradeTypes = ['硬件升级', '软件更新', '系统重装'];
        let upgradeCount = 0;

        for (let i = 0; i < 20; i++) {
            const deviceId = deviceIds[i % deviceIds.length];
            const upgradeType = upgradeTypes[i % upgradeTypes.length];
            
            await query(
                `INSERT INTO device_upgrades (device_id, upgrade_type, description, old_version, new_version, operator_id, upgrade_at) 
                 VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
                [deviceId, upgradeType, `${upgradeType} - 常规维护`, `v1.${i % 5}`, `v1.${(i % 5) + 1}`, 
                 assignees[i % assignees.length], i * 3]
            );
            upgradeCount++;
        }
        console.log(`  ✅ 升级记录: ${upgradeCount} 条`);

        // ========== 9. 版本发布库 ==========
        console.log('\n📚 正在创建版本发布库...');
        let releaseCount = 0;
        for (const [mtName, mtId] of Object.entries(moduleTypeIds)) {
            for (let v = 1; v <= 5; v++) {
                await query(
                    `INSERT INTO version_releases (module_type_id, version_number, title, change_log, release_date) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [mtId, `v${v}.0`, `${mtName}模块 v${v}.0 正式版`, 
                     `- 新增功能优化\n- 修复已知问题\n- 性能提升`,
                     `2025-${String(v * 2).padStart(2, '0')}-01`]
                );
                releaseCount++;
            }
        }
        console.log(`  ✅ 版本发布: ${releaseCount} 条`);

        // ========== 统计 ==========
        console.log('\n' + '='.repeat(50));
        console.log('✨ 全量丰富模拟数据导入完成！');
        console.log('='.repeat(50));
        console.log(`📊 数据统计:`);
        console.log(`   - 设备类型: ${deviceTypes.length} 个`);
        console.log(`   - 模块类型: ${moduleTypes.length} 个`);
        console.log(`   - 产品线: ${productLines.length} 个`);
        console.log(`   - 产品: ${products.length} 个`);
        console.log(`   - 客户: ${customers.length} 个`);
        console.log(`   - 订单: ${orders.length} 个`);
        console.log(`   - 设备: 25 台`);
        console.log(`   - 模块: ${25 * moduleTypes.length} 个`);
        console.log(`   - 售后问题: ${issueCount} 条`);
        console.log(`   - 升级记录: ${upgradeCount} 条`);
        console.log(`   - 版本发布: ${releaseCount} 条`);
        console.log(`   - SOP模板: ${sopTemplates.length} 个`);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ 数据导入失败:', error);
        process.exit(1);
    }
}

seedRichData();
