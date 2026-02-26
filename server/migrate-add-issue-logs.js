const mysql = require('mysql2/promise');
require('dotenv').config();

async function createIssueLogsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root_password',
    database: process.env.DB_NAME || 'device_manager',
    charset: 'utf8mb4'
  });

  try {
    console.log('开始创建 issue_logs 表...');

    // 创建 issue_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS issue_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id BIGINT NOT NULL,
        content TEXT NOT NULL COMMENT '处理内容描述',
        handler VARCHAR(100) NOT NULL COMMENT '处理人',
        handled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '处理时间',
        attachments JSON NULL COMMENT '附件（JSON数组，存储文件路径）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        INDEX idx_issue_id (issue_id),
        INDEX idx_handled_at (handled_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='售后问题处理记录表'
    `);
    
    console.log('✓ issue_logs 表创建成功');
    console.log('\n表结构:');
    console.log('- id: 主键');
    console.log('- issue_id: 关联的问题ID（外键到issues表）');
    console.log('- content: 处理内容描述');
    console.log('- handler: 处理人');
    console.log('- handled_at: 处理时间');
    console.log('- attachments: 附件（JSON格式）');
    
    console.log('\n✅ 迁移完成！售后问题处理记录功能已就绪');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createIssueLogsTable()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
