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
        const uploadDir = path.join(__dirname, '../../uploads/product-documents');
        // 确保目录存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB 限制
    }
});

// 获取产品的所有资料
router.get('/', async (req, res) => {
    try {
        const { product_id, doc_type } = req.query;

        let sql = 'SELECT * FROM product_documents WHERE 1=1';
        const params = [];

        if (product_id) {
            sql += ' AND product_id = ?';
            params.push(product_id);
        }

        if (doc_type) {
            sql += ' AND doc_type = ?';
            params.push(doc_type);
        }

        sql += ' ORDER BY created_at DESC';

        const documents = await query(sql, params);

        res.json({
            success: true,
            data: documents
        });
    } catch (error) {
        console.error('获取产品资料列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取产品资料列表失败',
            message: error.message
        });
    }
});

// 上传产品资料
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { product_id, doc_type, title, uploaded_by } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '没有上传文件'
            });
        }

        if (!product_id || !doc_type || !title) {
            // 删除已上传的文件
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: '产品ID、文档类型和标题为必填项'
            });
        }

        // 验证产品是否存在并获取产品线信息
        const products = await query(
            `SELECT p.id, p.model, p.product_line_id, pl.name as product_line_name, pl.code as product_line_code
             FROM products p
             JOIN product_lines pl ON p.product_line_id = pl.id
             WHERE p.id = ?`,
            [product_id]
        );
        if (products.length === 0) {
            // 删除已上传的文件
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: '指定的产品不存在'
            });
        }

        const product = products[0];
        let filePath = req.file.path;
        let fileSize = req.file.size;

        // 如果启用了OSS存储，上传到阿里云
        if (ossService.enabled) {
            try {
                // 使用产品线名称和产品型号构建路径
                const ossResult = await ossService.uploadFile(
                    req.file,
                    product.product_line_name || product.product_line_code,
                    product.model,  // 传入产品型号
                    'product-documents'
                );
                filePath = ossResult.ossPath;
                
                // 上传成功后删除本地临时文件
                fs.unlinkSync(req.file.path);
                
                console.log(`✅ 产品文档已上传到OSS: ${filePath}`);
                console.log(`   路径结构: ${product.product_line_name}/${product.model || 'default'}/文件名`);
            } catch (ossError) {
                console.error('OSS上传失败，保存到本地:', ossError);
                // OSS上传失败时继续使用本地路径
            }
        }

        const result = await query(
            `INSERT INTO product_documents 
       (product_id, doc_type, title, file_path, file_size, uploaded_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
            [
                product_id,
                doc_type,
                title,
                filePath,
                fileSize,
                uploaded_by || null
            ]
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                product_id,
                doc_type,
                title,
                file_path: filePath,
                file_size: fileSize,
                uploaded_by
            },
            message: '文件上传成功'
        });
    } catch (error) {
        console.error('上传产品资料失败:', error);
        // 删除已上传的文件
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: '上传产品资料失败',
            message: error.message
        });
    }
});

// 下载产品资料
router.get('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;

        const documents = await query(
            'SELECT * FROM product_documents WHERE id = ?',
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
            // 从OSS生成签名URL并重定向
            try {
                const signedUrl = await ossService.getSignedUrl(document.file_path, 3600); // 1小时有效期
                return res.redirect(signedUrl);
            } catch (ossError) {
                console.error('生成OSS下载链接失败:', ossError);
                return res.status(500).json({
                    success: false,
                    error: '生成下载链接失败',
                    message: ossError.message
                });
            }
        }

        // 本地文件处理
        if (!fs.existsSync(document.file_path)) {
            return res.status(404).json({
                success: false,
                error: '文件不存在'
            });
        }

        res.download(document.file_path, document.title);
    } catch (error) {
        console.error('下载产品资料失败:', error);
        res.status(500).json({
            success: false,
            error: '下载产品资料失败',
            message: error.message
        });
    }
});

// 删除产品资料
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const documents = await query(
            'SELECT * FROM product_documents WHERE id = ?',
            [id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                error: '文档不存在'
            });
        }

        const document = documents[0];

        // 删除数据库记录
        await query('DELETE FROM product_documents WHERE id = ?', [id]);

        // 删除文件 - 判断是OSS还是本地文件
        if (ossService.isOSSPath(document.file_path)) {
            // 从OSS删除
            try {
                await ossService.deleteFile(document.file_path);
                console.log(`✅ 已从OSS删除文件: ${document.file_path}`);
            } catch (ossError) {
                console.error('从OSS删除文件失败:', ossError);
                // 继续执行，即使OSS删除失败也返回成功
            }
        } else {
            // 删除本地文件
            if (fs.existsSync(document.file_path)) {
                fs.unlinkSync(document.file_path);
            }
        }

        res.json({
            success: true,
            message: '产品资料删除成功'
        });
    } catch (error) {
        console.error('删除产品资料失败:', error);
        res.status(500).json({
            success: false,
            error: '删除产品资料失败',
            message: error.message
        });
    }
});

module.exports = router;
