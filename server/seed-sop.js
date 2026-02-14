const { query } = require('./database');

const DEFAULT_SOPS = {
    '生产': [
        '确认BOM清单',
        '领取物料',
        '外观检查',
        '组装完成',
        '通电测试',
        '安规测试'
    ],
    '调试': [
        '烧录固件',
        '参数校准',
        '功能测试',
        '老化测试(24h)',
        '性能验证',
        '生成测试报告'
    ],
    '打包': [
        '外观清洁',
        '附件核对',
        '粘贴标签',
        '包装防护',
        '装箱清单确认',
        '封箱拍照'
    ],
    '物流': [
        '联系物流',
        '打印面单',
        '发货交接',
        '录入追踪号',
        '通知客户'
    ]
};

async function seedSOPTemplates() {
    console.log('🌱 正在初始化 SOP 模板数据...');
    try {
        for (const [stage, content] of Object.entries(DEFAULT_SOPS)) {
            // 检查是否已存在 v1.0
            const existing = await query(
                'SELECT id FROM sop_templates WHERE stage = ? AND version = ?',
                [stage, 'v1.0']
            );

            if (existing.length === 0) {
                await query(
                    'INSERT INTO sop_templates (stage, version, content, created_by) VALUES (?, ?, ?, ?)',
                    [stage, 'v1.0', JSON.stringify(content), 'system']
                );
                console.log(`✅ 已创建 ${stage} 阶段模板 (v1.0)`);
            } else {
                console.log(`ℹ️ ${stage} 阶段模板 (v1.0) 已存在，跳过`);
            }
        }
        console.log('✨ SOP 模板初始化完成');
    } catch (error) {
        console.error('❌ SOP 模板初始化失败:', error);
    }
}

if (require.main === module) {
    seedSOPTemplates().then(() => process.exit(0));
}

module.exports = seedSOPTemplates;
