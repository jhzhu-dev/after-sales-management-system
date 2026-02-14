/**
 * 文件迁移脚本：将本地存储的文件迁移到阿里云OSS
 * 
 * 使用方法：
 * 1. 确保 .env 文件中配置了正确的OSS凭证
 * 2. 运行：node server/migrate-files-to-oss.js
 * 
 * 功能：
 * - 扫描数据库中所有产品文档记录
 * - 检查文件路径是否为本地路径
 * - 查询产品所属的产品线
 * - 上传文件到OSS（按产品线组织）
 * - 更新数据库中的文件路径
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, query } = require('./database');
const ossService = require('./services/oss-service');

async function migrateFilesToOSS() {
    console.log('🚀 开始迁移文件到阿里云OSS...\n');

    if (!ossService.enabled) {
        console.error('❌ OSS服务未启用！请在 .env 文件中设置 USE_OSS_STORAGE=true');
        process.exit(1);
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
        // 1. 迁移产品文档
        console.log('📄 开始迁移产品文档...');
        const documents = await query(`
            SELECT pd.*, p.product_line_id, pl.name as product_line_name, pl.short_name as product_line_short_name
            FROM product_documents pd
            JOIN products p ON pd.product_id = p.id
            JOIN product_lines pl ON p.product_line_id = pl.id
            WHERE pd.file_path NOT LIKE 'oss://%'
        `);

        console.log(`找到 ${documents.length} 个需要迁移的产品文档文件\n`);

        for (const doc of documents) {
            try {
                console.log(`处理文件 [ID: ${doc.id}]: ${doc.title}`);
                console.log(`  本地路径: ${doc.file_path}`);

                // 检查本地文件是否存在
                if (!fs.existsSync(doc.file_path)) {
                    console.warn(`  ⚠️ 本地文件不存在，跳过`);
                    skippedCount++;
                    continue;
                }

                // 获取文件信息
                const fileName = path.basename(doc.file_path);
                const productLineName = doc.product_line_short_name || doc.product_line_name;

                // 模拟multer文件对象
                const fileObj = {
                    path: doc.file_path,
                    filename: fileName,
                    size: doc.file_size || fs.statSync(doc.file_path).size
                };

                // 上传到OSS
                console.log(`  上传到产品线: ${productLineName}`);
                const ossResult = await ossService.uploadFile(
                    fileObj,
                    productLineName,
                    'product-documents'
                );

                console.log(`  ✅ OSS路径: ${ossResult.ossPath}`);

                // 更新数据库
                await query(
                    'UPDATE product_documents SET file_path = ? WHERE id = ?',
                    [ossResult.ossPath, doc.id]
                );

                // 可选：删除本地文件（注释掉以保留备份）
                // fs.unlinkSync(doc.file_path);
                // console.log(`  🗑️ 本地文件已删除`);

                migratedCount++;
                console.log(`  ✅ 迁移成功\n`);

            } catch (error) {
                console.error(`  ❌ 迁移失败: ${error.message}\n`);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 迁移统计：');
        console.log(`  ✅ 成功: ${migratedCount}`);
        console.log(`  ⚠️ 跳过: ${skippedCount}`);
        console.log(`  ❌ 失败: ${errorCount}`);
        console.log('='.repeat(60) + '\n');

        if (migratedCount > 0) {
            console.log('✅ 文件迁移完成！');
            console.log('💡 提示：本地文件已保留作为备份，如需删除请手动处理');
        } else {
            console.log('ℹ️ 没有文件需要迁移');
        }

    } catch (error) {
        console.error('❌ 迁移过程中发生错误:', error);
    } finally {
        // 关闭数据库连接
        await pool.end();
        console.log('\n数据库连接已关闭');
    }
}

// 执行迁移
if (require.main === module) {
    migrateFilesToOSS().catch(error => {
        console.error('脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { migrateFilesToOSS };
