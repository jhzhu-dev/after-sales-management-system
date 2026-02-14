const { query } = require('./database');

async function seedPhase1Data() {
    try {
        console.log('🌱 开始初始化Phase 1基础数据...');

        // 1. 初始化产品线数据
        const productLines = [
            { name: '龙门检测设备', code: 'LONGMEN', description: '用于汽车外观龙门检测的设备系列' },
            { name: '胎纹检测设备', code: 'TAIWEN', description: '用于轮胎纹路检测的设备系列' },
            { name: '底盘检测设备', code: 'DIPAN', description: '用于汽车底盘检测的设备系列' },
            { name: '侧扫检测设备', code: 'CESAO', description: '用于汽车侧面扫描检测的设备系列' },
            { name: '大盒子检测设备', code: 'DAHEZI', description: '用于大型检测设备系列' }
        ];

        console.log('📦 正在创建产品线...');
        const productLineIds = {};
        for (const pl of productLines) {
            const result = await query(
                'INSERT INTO product_lines (name, code, description) VALUES (?, ?, ?)',
                [pl.name, pl.code, pl.description]
            );
            productLineIds[pl.code] = result.insertId;
            console.log(`  ✅ 创建产品线: ${pl.name}`);
        }

        // 2. 初始化产品数据
        const products = [
            { line: 'LONGMEN', name: 'A龙门', model: 'LM-A-V1', description: 'A型龙门检测设备' },
            { line: 'LONGMEN', name: 'B龙门', model: 'LM-B-V1', description: 'B型龙门检测设备' },
            { line: 'LONGMEN', name: 'C龙门', model: 'LM-C-V1', description: 'C型龙门检测设备' },
            { line: 'TAIWEN', name: 'A胎纹', model: 'TW-A-V1', description: 'A型胎纹检测设备' },
            { line: 'TAIWEN', name: 'B胎纹', model: 'TW-B-V1', description: 'B型胎纹检测设备' },
            { line: 'DIPAN', name: 'A底盘', model: 'DP-A-V1', description: 'A型底盘检测设备' },
            { line: 'DIPAN', name: 'B底盘', model: 'DP-B-V1', description: 'B型底盘检测设备' },
            { line: 'CESAO', name: 'A侧扫', model: 'CS-A-V1', description: 'A型侧扫检测设备' },
            { line: 'CESAO', name: 'B侧扫', model: 'CS-B-V1', description: 'B型侧扫检测设备' },
            { line: 'DAHEZI', name: 'A大盒子', model: 'DHZ-A-V1', description: 'A型大盒子检测设备' },
            { line: 'DAHEZI', name: 'B大盒子', model: 'DHZ-B-V1', description: 'B型大盒子检测设备' },
            { line: 'DAHEZI', name: 'C大盒子', model: 'DHZ-C-V1', description: 'C型大盒子检测设备' }
        ];

        console.log('📦 正在创建产品...');
        for (const p of products) {
            await query(
                'INSERT INTO products (product_line_id, name, model, description) VALUES (?, ?, ?, ?)',
                [productLineIds[p.line], p.name, p.model, p.description]
            );
            console.log(`  ✅ 创建产品: ${p.name}`);
        }

        // 3. 创建示例客户
        const customers = [
            {
                id: 'C-20260203-001',
                name: 'MLS汽车检测中心',
                region: '沙特',
                contact_person: '张三',
                contact_phone: '+966-123456789',
                contact_email: 'zhang@mls.com'
            },
            {
                id: 'C-20260203-002',
                name: '北京汽车检测站',
                region: '北京',
                contact_person: '李四',
                contact_phone: '010-12345678',
                contact_email: 'li@beijing.com'
            }
        ];

        console.log('👥 正在创建示例客户...');
        for (const c of customers) {
            await query(
                `INSERT INTO customers (id, name, region, contact_person, contact_phone, contact_email) 
         VALUES (?, ?, ?, ?, ?, ?)`,
                [c.id, c.name, c.region, c.contact_person, c.contact_phone, c.contact_email]
            );
            console.log(`  ✅ 创建客户: ${c.name}`);
        }

        console.log('✅ Phase 1 基础数据初始化完成!');
        console.log(`   - 产品线: ${productLines.length} 条`);
        console.log(`   - 产品: ${products.length} 个`);
        console.log(`   - 客户: ${customers.length} 个`);

    } catch (error) {
        console.error('❌ Phase 1 数据初始化失败:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const { initializeDatabase } = require('./database');

    (async () => {
        try {
            await initializeDatabase();
            await seedPhase1Data();
            process.exit(0);
        } catch (error) {
            console.error('错误:', error);
            process.exit(1);
        }
    })();
}

module.exports = { seedPhase1Data };
