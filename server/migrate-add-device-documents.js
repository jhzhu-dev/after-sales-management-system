/**
 * 迁移脚本: 创建设备出厂资料表
 */
const { getPool, query } = require('./database');

async function migrate() {
    try {
        console.log('开始创建设备出厂资料表...');
        const pool = getPool();
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS device_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                device_id VARCHAR(50) NOT NULL,
                category VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                original_name VARCHAR(255),
                file_path VARCHAR(500) NOT NULL,
                file_size INT,
                uploaded_by VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
                INDEX idx_device_category (device_id, category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ device_documents 表创建成功');

        process.exit(0);
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    }
}

migrate();
