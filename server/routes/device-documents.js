const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../database');
const ossService = require('../services/oss-service');
const archiver = require('archiver');

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
        fileSize: 200 * 1024 * 1024 // 200MB
    }
});

// 获取设备的所有出厂资料
router.get('/', async (req, res) => {
    try {
        const { device_id, bundle_id, category } = req.query;

        let sql = 'SELECT * FROM device_documents WHERE 1=1';
        const params = [];

        if (device_id) {
            sql += ' AND device_id = ?';
            params.push(device_id);
        }

        if (bundle_id) {
            sql += ' AND bundle_id = ?';
            params.push(bundle_id);
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
        const { device_id, bundle_id } = req.query;

        let sql = 'SELECT DISTINCT category FROM device_documents';
        const params = [];
        const conditions = [];

        if (device_id) {
            conditions.push('device_id = ?');
            params.push(device_id);
        }

        if (bundle_id) {
            conditions.push('bundle_id = ?');
            params.push(bundle_id);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
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

// 清洗相对路径，防止路径穿越，保留合法文件夹层级
function sanitizeRelativePath(relPath) {
    const normalized = (relPath || '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(p => p && p !== '.' && p !== '..');
    return parts.map(p => p.replace(/[<>:"|?*]/g, '').trim()).filter(Boolean).join('/');
}

// 并发执行异步任务（最大并发数 = concurrency）
async function runConcurrent(items, concurrency, fn) {
    const results = new Array(items.length);
    let i = 0;
    async function worker() {
        while (i < items.length) {
            const idx = i++;
            results[idx] = await fn(items[idx], idx);
        }
    }
    const workers = [];
    for (let w = 0; w < Math.min(concurrency, items.length); w++) {
        workers.push(worker());
    }
    await Promise.all(workers);
    return results;
}

// 上传前检查文件是否已存在（按 OSS 路径对比），用于前端去重跳过
router.post('/check-exists', async (req, res) => {
    try {
        const { device_id, bundle_id, category, files } = req.body;
        if ((!device_id && !bundle_id) || !category || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ success: false, error: '参数不完整' });
        }

        // bundle_id 模式：按 original_name 去重（兼容本地存储和 OSS）
        if (bundle_id && !device_id) {
            const existingRows = await query(
                'SELECT original_name FROM device_documents WHERE bundle_id = ? AND category = ?',
                [bundle_id, category]
            );
            const existingNames = new Set(existingRows.map(r => r.original_name));
            const exists = files.map(f => existingNames.has(f.originalName));
            return res.json({ success: true, exists });
        }

        if (!ossService.enabled) {
            // OSS 未启用，无法按路径去重，全部允许上传
            return res.json({ success: true, exists: files.map(() => false) });
        }
        const device = await getDeviceInfo(device_id);
        if (!device) {
            return res.status(400).json({ success: false, error: '指定的设备不存在' });
        }
        // 计算每个文件对应的 OSS file_path
        const ossFilePaths = files.map(f => {
            const relativePath = sanitizeRelativePath(f.relativePath) || f.originalName;
            const ossKey = ossService.buildPathByType('device-docs', { device, category, fileName: relativePath });
            return `oss://${ossService.bucket}/${ossKey}`;
        });
        // 一次查询获取所有已存在的路径
        const placeholders = ossFilePaths.map(() => '?').join(',');
        const existing = await query(
            `SELECT file_path FROM device_documents WHERE device_id = ? AND file_path IN (${placeholders})`,
            [device_id, ...ossFilePaths]
        );
        const existingSet = new Set(existing.map(r => r.file_path));
        res.json({ success: true, exists: ossFilePaths.map(p => existingSet.has(p)) });
    } catch (error) {
        console.error('检查文件存在失败:', error);
        res.status(500).json({ success: false, error: '检查失败', message: error.message });
    }
});

// 批量上传设备出厂资料 (支持多文件，最多 500 个)
router.post('/upload', upload.array('files', 2000), async (req, res) => {
    const uploadedFiles = req.files || [];
    try {
        const { device_id, bundle_id, category, uploaded_by } = req.body;
        // titles 可以是单个字符串或数组
        let titles = req.body.titles || req.body.title;
        if (!Array.isArray(titles)) {
            titles = titles ? [titles] : [];
        }
        // relative_paths 携带文件夹层级信息（如 "v1.2/firmware/image.bin"）
        let relativePaths = req.body.relative_paths || req.body.relative_path;
        if (!Array.isArray(relativePaths)) {
            relativePaths = relativePaths ? [relativePaths] : [];
        }

        if (uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有上传文件'
            });
        }

        if (!category || (!device_id && !bundle_id)) {
            uploadedFiles.forEach(f => fs.unlinkSync(f.path));
            return res.status(400).json({
                success: false,
                error: '分类和设备ID或多合一设备ID为必填项'
            });
        }

        let device = null;
        if (device_id) {
            device = await getDeviceInfo(device_id);
            if (!device) {
                uploadedFiles.forEach(f => fs.unlinkSync(f.path));
                return res.status(400).json({
                    success: false,
                    error: '指定的设备不存在'
                });
            }
        }

        const results = [];
        const errors = [];

        // 8 并发处理文件（OSS 上传 + DB 写入）
        const processedItems = await runConcurrent(uploadedFiles, 8, async (file, i) => {
            try {
                const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                const rawRelPath = relativePaths[i] || originalName;
                const relativePath = sanitizeRelativePath(rawRelPath) || originalName;
                const rawTitle = (titles[i] || relativePath.replace(/\.([^./]+)$/, '')).trim();
                const title = rawTitle.length > 240 ? rawTitle.slice(0, 240) : rawTitle;
                const safeOriginalName = originalName.length > 240 ? originalName.slice(0, 240) : originalName;
                let filePath = file.path;
                let fileSize = file.size;

                if (ossService.enabled) {
                    try {
                        const ossKey = ossService.buildPathByType('device-docs', {
                            device,
                            category,
                            fileName: relativePath
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
                     (device_id, bundle_id, category, title, original_name, file_path, file_size, uploaded_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [device_id || null, bundle_id || null, category, title, safeOriginalName, filePath, fileSize, uploaded_by || null]
                );
                return {
                    ok: true,
                    data: {
                        id: result.insertId,
                        device_id: device_id || null,
                        bundle_id: bundle_id || null,
                        category,
                        title,
                        original_name: safeOriginalName,
                        file_path: filePath,
                        file_size: fileSize
                    }
                };
            } catch (fileError) {
                console.error(`文件 ${i} 处理失败:`, fileError.message);
                try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
                return { ok: false, error: { index: i, name: file.originalname, error: fileError.message } };
            }
        });
        processedItems.forEach(item => {
            if (item.ok) results.push(item.data);
            else errors.push(item.error);
        });

        if (results.length === 0 && errors.length > 0) {
            return res.status(500).json({
                success: false,
                error: `所有 ${errors.length} 个文件上传失败`,
                errors
            });
        }

        res.status(201).json({
            success: true,
            data: results,
            message: errors.length > 0
                ? `成功上传 ${results.length} 个文件，${errors.length} 个文件跳过`
                : `成功上传 ${results.length} 个文件`,
            errors: errors.length > 0 ? errors : undefined
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

// 批量打包下载（ZIP，按ID列表）
router.post('/batch-download', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: '请提供要下载的文档ID列表' });
        }
        const placeholders = ids.map(() => '?').join(',');
        const documents = await query(
            `SELECT * FROM device_documents WHERE id IN (${placeholders}) ORDER BY category, title`,
            ids
        );
        if (documents.length === 0) {
            return res.status(404).json({ success: false, error: '未找到要下载的文档' });
        }
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('批量下载.zip')}`);
        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.on('error', err => {
            console.error('批量打包ZIP失败:', err);
            if (!res.headersSent) res.status(500).end();
        });
        archive.pipe(res);
        // 按分类放入子目录
        const usedNames = new Map();
        for (const doc of documents) {
            const dir = doc.category ? doc.category.replace(/[<>:"/\\|?*]/g, '_') + '/' : '';
            let baseName = doc.original_name || doc.title || `file_${doc.id}`;
            const nameKey = dir + baseName;
            const count = (usedNames.get(nameKey) || 0) + 1;
            usedNames.set(nameKey, count);
            if (count > 1) {
                const dotIdx = baseName.lastIndexOf('.');
                baseName = dotIdx >= 0
                    ? baseName.slice(0, dotIdx) + `(${count})` + baseName.slice(dotIdx)
                    : baseName + `(${count})`;
            }
            const entryName = dir + baseName;
            if (ossService.isOSSPath(doc.file_path)) {
                try {
                    const ossPathMatch = doc.file_path.match(/^\/\/[^\/]+\/(.+)$|^oss:\/\/[^\/]+\/(.+)$/);
                    const objectKey = ossPathMatch ? (ossPathMatch[1] || ossPathMatch[2]) : null;
                    if (objectKey) {
                        const result = await ossService.client.get(objectKey);
                        archive.append(result.content, { name: entryName });
                    }
                } catch (e) {
                    console.error('OSS获取文件失败:', doc.file_path, e.message);
                }
            } else if (fs.existsSync(doc.file_path)) {
                archive.file(doc.file_path, { name: entryName });
            }
        }
        await archive.finalize();
    } catch (error) {
        console.error('批量下载失败:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: '批量下载失败' });
    }
});

// 按分类打包下载（ZIP）
router.get('/download-category', async (req, res) => {
    try {
        const { device_id, category } = req.query;
        if (!device_id || !category) {
            return res.status(400).json({ success: false, error: 'device_id 和 category 为必填项' });
        }
        const documents = await query(
            'SELECT * FROM device_documents WHERE device_id = ? AND category = ? ORDER BY title',
            [device_id, category]
        );
        if (documents.length === 0) {
            return res.status(404).json({ success: false, error: '该分类下无文件' });
        }
        const safeCat = category.replace(/[<>:"/\\|?*]/g, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeCat + '.zip')}`);
        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.on('error', err => {
            console.error('打包ZIP失败:', err);
            if (!res.headersSent) res.status(500).end();
        });
        archive.pipe(res);
        for (const doc of documents) {
            const entryName = doc.original_name || doc.title || `file_${doc.id}`;
            if (ossService.isOSSPath(doc.file_path)) {
                try {
                    const ossPathMatch = doc.file_path.match(/^\/\/[^\/]+\/(.+)$|^oss:\/\/[^\/]+\/(.+)$/);
                    const objectKey = ossPathMatch ? (ossPathMatch[1] || ossPathMatch[2]) : null;
                    if (objectKey) {
                        const result = await ossService.client.get(objectKey);
                        archive.append(result.content, { name: entryName });
                    }
                } catch (e) {
                    console.error('OSS获取文件失败:', doc.file_path, e.message);
                }
            } else if (fs.existsSync(doc.file_path)) {
                archive.file(doc.file_path, { name: entryName });
            }
        }
        await archive.finalize();
    } catch (error) {
        console.error('按分类下载失败:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: '下载失败' });
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
                const downloadName = document.original_name || document.title;
                const signedUrl = await ossService.getSignedUrl(document.file_path, 3600, downloadName);
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

        // 立即响应，OSS清理在后台异步执行，避免大批量删除超时
        res.json({ success: true, message: `成功删除 ${documents.length} 个文件` });

        setImmediate(async () => {
            for (const document of documents) {
                try {
                    if (ossService.isOSSPath(document.file_path)) {
                        await ossService.deleteFile(document.file_path);
                        console.log(`✅ 已从OSS删除文件: ${document.file_path}`);
                    } else if (fs.existsSync(document.file_path)) {
                        fs.unlinkSync(document.file_path);
                    }
                } catch (err) {
                    console.error('后台清理文件失败:', document.file_path, err.message);
                }
            }
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
