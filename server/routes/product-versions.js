const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, transaction } = require('../database');
const ossService = require('../services/oss-service');

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads/product-version-documents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// 获取迭代版本列表
router.get('/', async (req, res) => {
    try {
        const { product_id, status, page = 1, limit = 50 } = req.query;

        let sql = `
            SELECT pv.*, p.name as product_name, p.model as product_model,
                   (SELECT COUNT(*) FROM product_version_documents pvd WHERE pvd.product_version_id = pv.id) as document_count,
                   (SELECT COUNT(*) FROM devices d WHERE d.product_version_id = pv.id) as device_count
            FROM product_versions pv
            LEFT JOIN products p ON pv.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (product_id) {
            sql += ' AND pv.product_id = ?';
            params.push(product_id);
        }

        if (status) {
            sql += ' AND pv.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY pv.sort_order ASC, pv.created_at DESC';

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        // Count
        const countSql = sql.replace(/SELECT pv\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
        const countResult = await query(countSql, params);
        const total = countResult[0]?.total || 0;

        sql += ` LIMIT ${limitNum} OFFSET ${offset}`;
        const versions = await query(sql, params);

        // 为每个版本附加文档列表
        for (const ver of versions) {
            const docs = await query(
                'SELECT id, product_version_id, name, category, file_type, file_size, file_path, created_at FROM product_version_documents WHERE product_version_id = ? ORDER BY created_at DESC',
                [ver.id]
            );
            ver.documents = docs;
        }

        res.json({
            success: true,
            data: versions,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('获取迭代版本列表失败:', error);
        res.status(500).json({ success: false, error: '获取迭代版本列表失败' });
    }
});

// 获取单个迭代版本详情
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const sql = `
            SELECT pv.*, p.name as product_name, p.model as product_model
            FROM product_versions pv
            LEFT JOIN products p ON pv.product_id = p.id
            WHERE pv.id = ?
        `;
        const versions = await query(sql, [id]);

        if (versions.length === 0) {
            return res.status(404).json({ success: false, error: '迭代版本不存在' });
        }

        // 获取文档
        const documents = await query(
            'SELECT * FROM product_version_documents WHERE product_version_id = ? ORDER BY created_at DESC',
            [id]
        );

        // 关联设备数量
        const deviceCount = await query(
            'SELECT COUNT(*) as count FROM devices WHERE product_version_id = ?',
            [id]
        );

        res.json({
            success: true,
            data: {
                ...versions[0],
                documents,
                device_count: deviceCount[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('获取迭代版本详情失败:', error);
        res.status(500).json({ success: false, error: '获取迭代版本详情失败' });
    }
});

// 创建迭代版本
router.post('/', async (req, res) => {
    try {
        const { product_id, version_number, version_name, description, specifications, status, release_date, is_current, sort_order } = req.body;

        if (!product_id || !version_number) {
            return res.status(400).json({ success: false, error: '产品ID和版本号为必填项' });
        }

        // 验证产品是否存在
        const products = await query('SELECT id FROM products WHERE id = ?', [product_id]);
        if (products.length === 0) {
            return res.status(400).json({ success: false, error: '产品不存在' });
        }

        // 如果设为当前版本，先将同产品下其他版本的 is_current 设为 false
        if (is_current) {
            await query('UPDATE product_versions SET is_current = FALSE WHERE product_id = ?', [product_id]);
        }

        const result = await query(
            `INSERT INTO product_versions (product_id, version_number, version_name, description, specifications, status, release_date, is_current, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                product_id,
                version_number,
                version_name || null,
                description || null,
                specifications ? JSON.stringify(specifications) : null,
                status || '开发中',
                release_date || null,
                is_current ? true : false,
                sort_order || 0
            ]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, ...req.body },
            message: '迭代版本创建成功'
        });
    } catch (error) {
        console.error('创建迭代版本失败:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: '该产品下已存在相同版本号' });
        }
        res.status(500).json({ success: false, error: '创建迭代版本失败' });
    }
});

// 更新迭代版本
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // 检查是否存在
        const existing = await query('SELECT * FROM product_versions WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: '迭代版本不存在' });
        }

        const allowedFields = ['version_number', 'version_name', 'description', 'specifications', 'status', 'release_date', 'is_current', 'sort_order'];
        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key) && updates[key] !== undefined) {
                if (key === 'specifications' && typeof updates[key] === 'object') {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(JSON.stringify(updates[key]));
                } else {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(updates[key]);
                }
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: '没有要更新的字段' });
        }

        // 如果设为当前版本，先将同产品下其他版本的 is_current 设为 false
        if (updates.is_current === true) {
            await query('UPDATE product_versions SET is_current = FALSE WHERE product_id = ?', [existing[0].product_id]);
        }

        updateValues.push(id);
        await query(`UPDATE product_versions SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

        res.json({ success: true, message: '迭代版本更新成功' });
    } catch (error) {
        console.error('更新迭代版本失败:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: '该产品下已存在相同版本号' });
        }
        res.status(500).json({ success: false, error: '更新迭代版本失败' });
    }
});

// 删除迭代版本
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 检查是否存在
        const existing = await query('SELECT * FROM product_versions WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: '迭代版本不存在' });
        }

        // 检查是否有关联设备
        const devices = await query('SELECT COUNT(*) as count FROM devices WHERE product_version_id = ?', [id]);
        if (devices[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: `该版本下有 ${devices[0].count} 台关联设备，无法删除。请先取消设备关联。`
            });
        }

        // 删除相关文档文件
        const docs = await query('SELECT * FROM product_version_documents WHERE product_version_id = ?', [id]);
        for (const doc of docs) {
            try {
                if (ossService.isOSSPath(doc.file_path)) {
                    await ossService.deleteFile(doc.file_path);
                } else if (fs.existsSync(doc.file_path)) {
                    fs.unlinkSync(doc.file_path);
                }
            } catch (e) {
                console.warn('删除文件警告:', e.message);
            }
        }

        await query('DELETE FROM product_versions WHERE id = ?', [id]);

        res.json({ success: true, message: '迭代版本删除成功' });
    } catch (error) {
        console.error('删除迭代版本失败:', error);
        res.status(500).json({ success: false, error: '删除迭代版本失败' });
    }
});

// 设置为当前版本
router.put('/:id/set-current', async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await query('SELECT * FROM product_versions WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: '迭代版本不存在' });
        }

        // 同产品下其他版本设为非当前
        await query('UPDATE product_versions SET is_current = FALSE WHERE product_id = ?', [existing[0].product_id]);
        // 当前版本设为当前
        await query('UPDATE product_versions SET is_current = TRUE WHERE id = ?', [id]);

        res.json({ success: true, message: '已设为当前版本' });
    } catch (error) {
        console.error('设置当前版本失败:', error);
        res.status(500).json({ success: false, error: '设置当前版本失败' });
    }
});

// 获取版本文档列表
router.get('/:id/documents', async (req, res) => {
    try {
        const { id } = req.params;
        const documents = await query(
            'SELECT * FROM product_version_documents WHERE product_version_id = ? ORDER BY created_at DESC',
            [id]
        );
        res.json({ success: true, data: documents });
    } catch (error) {
        console.error('获取版本文档失败:', error);
        res.status(500).json({ success: false, error: '获取版本文档失败' });
    }
});

// 上传版本文档
router.post('/:id/documents', upload.array('files', 10), async (req, res) => {
    try {
        const { id } = req.params;
        const { category, uploaded_by } = req.body;

        // 验证版本是否存在
        const versions = await query(
            `SELECT pv.id, pv.version_number, pv.version_name, p.name as product_name, p.model as product_model,
                    pl.name as product_line_name, pl.code as product_line_code
             FROM product_versions pv
             JOIN products p ON pv.product_id = p.id
             JOIN product_lines pl ON p.product_line_id = pl.id
             WHERE pv.id = ?`,
            [id]
        );

        if (versions.length === 0) {
            // 删除已上传的文件
            if (req.files) {
                req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
            }
            return res.status(404).json({ success: false, error: '迭代版本不存在' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: '没有上传文件' });
        }

        const version = versions[0];
        const results = [];

        for (const file of req.files) {
            let filePath = file.path;
            const fileSize = file.size;
            const fileType = path.extname(file.originalname).replace('.', '');

            // OSS 上传
            if (ossService.enabled) {
                try {
                    // 构建路径: Product Line Information/产品线/产品型号/版本号-版本名称/原始文件名
                    const versionFolder = version.version_name
                        ? `${version.version_number}-${version.version_name}`
                        : version.version_number;
                    const originalName = file.originalname;
                    const normalizedProductLine = ossService.normalizeProductLineName(version.product_line_name || version.product_line_code);
                    const normalizedModel = ossService.normalizeProductModel(version.product_model);
                    const ossPath = `${ossService.basePath}/Product Line Information/${normalizedProductLine}/${normalizedModel}/${versionFolder}/${originalName}`;
                    const result = await ossService.client.put(ossPath, file.path);
                    filePath = `oss://${ossService.bucket}/${ossPath}`;
                    console.log(`✅ 版本文档上传成功: ${ossPath}`);
                    try { fs.unlinkSync(file.path); } catch(e) {}
                } catch (ossError) {
                    console.error('OSS上传失败，保存到本地:', ossError);
                }
            }

            const result = await query(
                `INSERT INTO product_version_documents (product_version_id, name, file_path, file_type, file_size, category, uploaded_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, file.originalname, filePath, fileType, fileSize, category || '其他', uploaded_by || null]
            );
            results.push({ id: result.insertId, name: file.originalname, file_path: filePath, file_size: fileSize });
        }

        res.status(201).json({
            success: true,
            data: results,
            message: `${results.length} 个文件上传成功`
        });
    } catch (error) {
        console.error('上传版本文档失败:', error);
        if (req.files) {
            req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
        }
        res.status(500).json({ success: false, error: '上传版本文档失败' });
    }
});

// 预览版本文档（返回签名URL或本地文件流）
router.get('/documents/:docId/preview', async (req, res) => {
    try {
        const { docId } = req.params;
        const documents = await query('SELECT * FROM product_version_documents WHERE id = ?', [docId]);

        if (documents.length === 0) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        const document = documents[0];

        if (ossService.isOSSPath(document.file_path)) {
            try {
                const signedUrl = await ossService.getSignedUrl(document.file_path, 3600);
                return res.json({ success: true, data: { url: signedUrl, name: document.name, file_type: document.file_type } });
            } catch (ossError) {
                console.error('获取OSS签名URL失败:', ossError);
                return res.status(500).json({ success: false, error: '获取预览链接失败' });
            }
        }

        if (!fs.existsSync(document.file_path)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        // 本地文件：设置inline头让浏览器预览
        const mimeTypes = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'bmp': 'image/bmp', 'webp': 'image/webp',
            'txt': 'text/plain',
            'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
        const ext = document.file_type?.toLowerCase();
        const mime = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.name)}"`);
        fs.createReadStream(document.file_path).pipe(res);
    } catch (error) {
        console.error('预览版本文档失败:', error);
        res.status(500).json({ success: false, error: '预览版本文档失败' });
    }
});

// 下载版本文档
router.get('/documents/:docId/download', async (req, res) => {
    try {
        const { docId } = req.params;
        const documents = await query('SELECT * FROM product_version_documents WHERE id = ?', [docId]);

        if (documents.length === 0) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        const document = documents[0];

        if (ossService.isOSSPath(document.file_path)) {
            try {
                const signedUrl = await ossService.getSignedUrl(document.file_path, 3600);
                return res.redirect(signedUrl);
            } catch (ossError) {
                console.error('获取OSS签名URL失败:', ossError);
                return res.status(500).json({ success: false, error: '获取文件下载链接失败' });
            }
        }

        if (!fs.existsSync(document.file_path)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        res.download(document.file_path, document.name);
    } catch (error) {
        console.error('下载版本文档失败:', error);
        res.status(500).json({ success: false, error: '下载版本文档失败' });
    }
});

// 删除版本文档
router.delete('/documents/:docId', async (req, res) => {
    try {
        const { docId } = req.params;
        const documents = await query('SELECT * FROM product_version_documents WHERE id = ?', [docId]);

        if (documents.length === 0) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        const document = documents[0];

        // 删除文件
        try {
            if (ossService.isOSSPath(document.file_path)) {
                await ossService.deleteFile(document.file_path);
            } else if (fs.existsSync(document.file_path)) {
                fs.unlinkSync(document.file_path);
            }
        } catch (e) {
            console.warn('删除文件警告:', e.message);
        }

        await query('DELETE FROM product_version_documents WHERE id = ?', [docId]);

        res.json({ success: true, message: '文档删除成功' });
    } catch (error) {
        console.error('删除版本文档失败:', error);
        res.status(500).json({ success: false, error: '删除版本文档失败' });
    }
});

module.exports = router;
