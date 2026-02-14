require('dotenv').config();
const mysql = require('mysql2/promise');

async function addIsFullPaymentField() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'els',
            password: process.env.DB_PASSWORD || '111111',
            database: process.env.DB_NAME || 'device_management'
        });

        console.log('✅ 数据库连接成功');

        // 检查字段是否存在
        const [columns] = await connection.query(
            "SHOW COLUMNS FROM order_payments LIKE 'is_full_payment'"
        );

        if (columns.length > 0) {
            console.log('⚠️  字段 is_full_payment 已存在，无需添加');
            return;
        }

        // 添加 is_full_payment 字段
        await connection.query(`
            ALTER TABLE order_payments 
            ADD COLUMN is_full_payment TINYINT(1) DEFAULT 0 COMMENT '是否全款' 
            AFTER is_paid
        `);

        console.log('✅ 成功添加 is_full_payment 字段到 order_payments 表');

        // 验证字段已添加
        const [newColumns] = await connection.query(
            "SHOW COLUMNS FROM order_payments LIKE 'is_full_payment'"
        );
        console.log('✅ 验证字段:', newColumns[0]);

    } catch (error) {
        console.error('❌ 添加字段失败:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('✅ 数据库连接已关闭');
        }
    }
}

// 执行迁移
addIsFullPaymentField()
    .then(() => {
        console.log('✅ 迁移完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    });
