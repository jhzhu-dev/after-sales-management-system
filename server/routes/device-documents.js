const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../database');
const ossService = require('../services/oss-service');

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads/device-documents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 使用时间戳前缀 + 原始文件名，避免重名
        const prefix = Date.now() + '_';
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, prefix + safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

// 获取设备的所有出厂资料
router.get('/', async (req, res) => {
    try {
        const { device_id, category } = req.query;

        let sql = 'SELECT * FROM device_documents WHERE 1=1';
        const params = [];

        if (device_id) {
            sql += ' AND device_id = ?';
            params.push(device_id);
        }

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        sql += ' ORDER BY category, created_at DESC';

        const documents = await query(sql, params);

        res.json({
            success: true,
            data: documents
        });
    } catch (error) {
        console.error('获取设备资料列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取设备资料列表失败',
            message: error.message
        });
    }
});

// 获取设备资料的分类列表
router.get('/categories', async (req, res) => {
    try {
        const { device_id } = req.query;

        let sql = 'SELECT DISTINCT category FROM device_documents';
        const params = [];

        if (device_id) {
            sql += ' WHERE device_id = ?';
            params.push(device_id);
        }

        sql += ' ORDER BY category';

        const categories = await query(sql, params);

        res.json({
            success: true,
            data: categories.map(c => c.category)
        });
    } catch (error) {
        console.error('获取分类列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取分类列表失败'
        });
    }
});

// 获取设备信息辅助函数（含客户和产品信息，用于构建设备标识）
async function getDeviceInfo(device_id) {
    const devices = await query(
        `SELECT d.id, d.name, d.product_line_id,
                pl.name as product_line_name,
                c.short_name as customer_short_name, c.name as customer_name,
                p.name as product_name
         FROM devices d
         LEFT JOIN product_lines pl ON d.product_line_id = pl.id
         LEFT JOIN customers c ON d.customer_id = c.id
         LEFT JOIN products p ON d.product_id = p.id
         WHERE d.id = ?`,
        [device_id]
    );
    return devices.length > 0 ? devices[0] : null;
}

// OSS上传带重试 (最多3次，间隔2秒)
async function ossUploadWithRetry(ossPath, localPath, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await ossService.client.put(ossPath, localPath);
            return result;
        } catch (err) {
            console.error(`OSS上传第${attempt}次失败:`, err.code || err.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw err;
            }
        }
    }
}

// 批量上传设备出厂资料 (支持多文件)
router.post('/upload', upload.array('files', 20), async (req, res) => {
    const uploadedFiles = req.files || [];
    try {
        const { device_id, category, uploaded_by } = req.body;
        // titles 可以是单个字符串或数组
        let titles = req.body.titles || req.body.title;
        if (!Array.isArray(titles)) {
            titles = titles ? [titles] : [];
        }

        if (uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有上传文件'
            });
        }

        if (!device_id || !category) {
            uploadedFiles.forEach(f => fs.unlinkSync(f.path));
            return res.status(400).json({
                success: false,
                error: '设备ID和分类为必填项'
            });
        }

        const device = await getDeviceInfo(device_id);
        if (!device) {
            uploadedFiles.forEach(f => fs.unlinkSync(f.path));
            return res.status(400).json({
                success: false,
                error: '指定的设备不存在'
            });
        }

        const results = [];

        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const title = (titles[i] || file.originalname.replace(/\.[^/.]+$/, '')).trim();
            let filePath = file.path;
            let fileSize = file.size;

            // OSS上传: devices/{设备标识}/device-docs/{分类}/{原始文件名}
            if (ossService.enabled) {
                try {
                    const ossKey = ossService.buildPathByType('device-docs', {
                        device,
                        category,
                        fileName: file.originalname
                    });
                    await ossUploadWithRetry(ossKey, file.path);
                    filePath = `oss://${ossService.bucket}/${ossKey}`;
                    fs.unlinkSync(file.path);
                    console.log(`✅ 设备出厂资料已上传到OSS: ${filePath}`);
                } catch (ossError) {
                    console.error('OSS上传失败(已重试)，保存到本地:', ossError.message);
                }
            }

            const result = await query(
                `INSERT INTO device_documents 
                 (device_id, category, title, original_name, file_path, file_size, uploaded_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [device_id, category, title, file.originalname, filePath, fileSize, uploaded_by || null]
            );

            results.push({
                id: result.insertId,
                device_id,
                category,
                title,
                original_name: file.originalname,
                file_path: filePath,
                file_size: fileSize
            });
        }

        res.status(201).json({
            success: true,
            data: results,
            message: `成功上传 ${results.length} 个文件`
        });
    } catch (error) {
        console.error('上传设备资料失败:', error);
        uploadedFiles.forEach(f => {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
        res.status(500).json({
            success: false,
            error: '上传设备资料失败',
            message: error.message
        });
    }
});

// 预览设备资料（返回签名URL用于前端内联预览）
router.get('/:id/preview', async (req, res) => {
    try {
        const { id } = req.params;

        const documents = await query(
            'SELECT * FROM device_documents WHERE id = ?',
            [id]
        );

        if (documents.length === 0) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        const document = documents[0];

        if (ossService.isOSSPath(document.file_path)) {
            try {
                const ossPathMatch = document.file_path.match(/^oss:\/\/([^\/]+)\/(.+)$/);
                if (!ossPathMatch) {
                    return res.status(500).json({ success: false, error: '无效的OSS路径' });
                }
                const [, , objectName] = ossPathMatch;
                // 预览：不设置 content-disposition，允许浏览器内联显示
                const url = ossService.client.signatureUrl(objectName, { expires: 3600 });
                return res.json({
                    success: true,
                    data: { url, original_name: document.original_name, title: document.title }
                });
            } catch (ossError) {
                console.error('生成预览链接失败:', ossError);
                return res.status(500).json({ success: false, error: '生成预览链接失败' });
            }
        }

        // 本地文件返回下载链接
        return res.json({
            success: true,
            data: {
                url: `/api/device-documents/${id}/download`,
                original_name: document.original_name,
                title: document.title
            }
        });
    } catch (error) {
        console.error('获取预览链接失败:', error);
        res.status(500).json({ success: false, error: '获取预览链接失败' });
    }
});

// 下载设备资料
router.get('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;

        const documents = await query(
            'SELECT * FROM device_documents WHERE id = ?',
            [id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                error: '文档不存在'
            });
        }

        const document = documents[0];

        // 判断是否为OSS路径
        if (ossService.isOSSPath(document.file_path)) {
            try {
                const signedUrl = await ossService.getSignedUrl(document.file_path, 3600);
                return res.redirect(signedUrl);
            } catch (ossError) {
                console.error('生成OSS下载链接失败:', ossError);
                return res.status(500).json({
                    success: false,
                    error: '生成下载链接失败'
                });
            }
        }

        if (!fs.existsSync(document.file_path)) {
            return res.status(404).json({
                success: false,
                error: '文件不存在'
            });
        }

        res.download(document.file_path, document.original_name || document.title);
    } catch (error) {
        console.error('下载设备资料失败:', error);
        res.status(500).json({
            success: false,
            error: '下载设备资料失败'
        });
    }
});

// 批量删除设备资料
router.post('/batch-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: '请提供要删除的文档ID列表' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const documents = await query(
            `SELECT * FROM device_documents WHERE id IN (${placeholders})`,
            ids
        );

        if (documents.length === 0) {
            return res.status(404).json({ success: false, error: '未找到要删除的文档' });
        }

        await query(`DELETE FROM device_documents WHERE id IN (${placeholders})`, ids);

        for (const document of documents) {
            if (ossService.isOSSPath(document.file_path)) {
                try {
                    await ossService.deleteFile(document.file_path);
                    console.log(`✅ 已从OSS删除文件: ${document.file_path}`);
                } catch (ossError) {
                    console.error('从OSS删除文件失败:', ossError);
                }
            } else {
                if (fs.existsSync(document.file_path)) {
                    fs.unlinkSync(document.file_path);
                }
            }
        }

        res.json({
            success: true,
            message: `成功删除 ${documents.length} 个文件`
        });
    } catch (error) {
        console.error('批量删除设备资料失败:', error);
        res.status(500).json({ success: false, error: '批量删除失败' });
    }
});

// 删除设备资料
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const documents = await query(
            'SELECT * FROM device_documents WHERE id = ?',
            [id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                error: '文档不存在'
            });
        }

        const document = documents[0];

        await query('DELETE FROM device_documents WHERE id = ?', [id]);

        if (ossService.isOSSPath(document.file_path)) {
            try {
                await ossService.deleteFile(document.file_path);
                console.log(`✅ 已从OSS删除文件: ${document.file_path}`);
            } catch (ossError) {
                console.error('从OSS删除文件失败:', ossError);
            }
        } else {
            if (fs.existsSync(document.file_path)) {
                fs.unlinkSync(document.file_path);
            }
        }

        res.json({
            success: true,
            message: '设备资料删除成功'
        });
    } catch (error) {
        console.error('删除设备资料失败:', error);
        res.status(500).json({
            success: false,
            error: '删除设备资料失败'
        });
    }
});

module.exports = router;
