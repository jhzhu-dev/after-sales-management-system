const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ossService = require('../services/oss-service');
const router = express.Router();

// 配置文件上传
const uploadDir = path.join(__dirname, '../../uploads/release-attachments');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const prefix = Date.now() + '_';
        const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, prefix + safeName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// 获取所有分类（去重）
router.get('/categories', async (req, res) => {
    try {
        const { module_type_id } = req.query;
        let sql = 'SELECT DISTINCT category FROM version_releases WHERE category IS NOT NULL AND category != ""';
        const params = [];
        if (module_type_id) {
            sql += ' AND module_type_id = ?';
            params.push(module_type_id);
        }
        sql += ' ORDER BY category';
        const rows = await query(sql, params);
        res.json({ success: true, data: rows.map(r => r.category) });
    } catch (error) {
        console.error('获取分类列表失败:', error);
        res.status(500).json({ success: false, error: '获取分类列表失败' });
    }
});

// ==================== 附件管理（放在 /:id 路由之前避免冲突）====================

// 下载附件（获取签名URL或本地路径）
router.get('/attachments/:attachmentId/download', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const [attachment] = await query('SELECT * FROM release_attachments WHERE id = ?', [attachmentId]);
        
        if (!attachment) {
            return res.status(404).json({ success: false, error: '附件不存在' });
        }

        if (ossService.isOSSPath(attachment.file_path)) {
            const signedUrl = await ossService.getSignedUrl(attachment.file_path);
            return res.json({ success: true, data: { url: signedUrl, original_name: attachment.original_name } });
        } else {
            const localPath = path.join(__dirname, '..', attachment.file_path);
            if (fs.existsSync(localPath)) {
                res.download(localPath, attachment.original_name);
            } else {
                res.status(404).json({ success: false, error: '文件不存在' });
            }
        }
    } catch (error) {
        console.error('下载附件失败:', error);
        res.status(500).json({ success: false, error: '下载附件失败' });
    }
});

// 删除附件
router.delete('/attachments/:attachmentId', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const [attachment] = await query('SELECT * FROM release_attachments WHERE id = ?', [attachmentId]);
        
        if (!attachment) {
            return res.status(404).json({ success: false, error: '附件不存在' });
        }

        if (ossService.isOSSPath(attachment.file_path)) {
            try { await ossService.deleteFile(attachment.file_path); } catch (e) {
                console.error('OSS删除失败:', e.message);
            }
        } else {
            const localPath = path.join(__dirname, '..', attachment.file_path);
            try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (e) {}
        }

        await query('DELETE FROM release_attachments WHERE id = ?', [attachmentId]);
        res.json({ success: true, message: '附件删除成功' });
    } catch (error) {
        console.error('删除附件失败:', error);
        res.status(500).json({ success: false, error: '删除附件失败' });
    }
});

// ==================== 版本CRUD ====================

// 获取所有版本发布记录
router.get('/', async (req, res) => {
    try {
        const { module_type_id, category } = req.query;

        let whereClause = '';
        let params = [];

        if (module_type_id) {
            whereClause = 'WHERE vr.module_type_id = ?';
            params.push(module_type_id);
        }

        if (category) {
            whereClause += (whereClause ? ' AND' : 'WHERE') + ' vr.category = ?';
            params.push(category);
        }

        const releasesQuery = `
      SELECT 
        vr.*,
        mt.name as module_type_name
      FROM version_releases vr
      LEFT JOIN module_types mt ON vr.module_type_id = mt.id
      ${whereClause}
      ORDER BY vr.release_date DESC, vr.created_at DESC
    `;

        const releases = await query(releasesQuery, params);

        res.json({
            success: true,
            data: releases
        });
    } catch (error) {
        console.error('获取版本发布列表失败:', error);
        res.status(500).json({ success: false, error: '获取版本发布列表失败' });
    }
});

// 获取单个版本发布详情
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const releaseQuery = `
      SELECT 
        vr.*,
        mt.name as module_type_name
      FROM version_releases vr
      LEFT JOIN module_types mt ON vr.module_type_id = mt.id
      WHERE vr.id = ?
    `;

        const result = await query(releaseQuery, [id]);

        if (result.length === 0) {
            return res.status(404).json({ success: false, error: '版本发布记录不存在' });
        }

        res.json({
            success: true,
            data: result[0]
        });
    } catch (error) {
        console.error('获取版本发布详情失败:', error);
        res.status(500).json({ success: false, error: '获取版本发布详情失败' });
    }
});

// 创建版本发布记录
router.post('/', [
    body('module_type_id').notEmpty().withMessage('模块类型ID不能为空'),
    body('version_number').notEmpty().withMessage('版本号不能为空'),
    body('title').notEmpty().withMessage('标题不能为空'),
    body('change_log').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '输入数据无效',
                details: errors.array()
            });
        }

        const { module_type_id, version_number, title, change_log, category } = req.body;

        // 检查模块类型是否存在
        const [moduleType] = await query('SELECT id FROM module_types WHERE id = ?', [module_type_id]);
        if (!moduleType) {
            return res.status(400).json({ success: false, error: '指定的模块类型不存在' });
        }

        const insertQuery = `
      INSERT INTO version_releases (module_type_id, version_number, title, change_log, category, release_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

        const releaseDate = req.body.release_date || new Date().toISOString().split('T')[0];
        const result = await query(insertQuery, [module_type_id, version_number, title, change_log, category || null, releaseDate]);

        res.status(201).json({
            success: true,
            message: '版本发布记录创建成功',
            data: { id: result.insertId, module_type_id, version_number, title, change_log, category, release_date: releaseDate }
        });
    } catch (error) {
        console.error('创建版本发布记录失败:', error);
        res.status(500).json({ success: false, error: '创建版本发布记录失败' });
    }
});

// 更新版本发布记录
router.put('/:id', [
    body('version_number').optional().notEmpty().withMessage('版本号不能为空'),
    body('title').optional().notEmpty().withMessage('标题不能为空'),
    body('change_log').optional().isString(),
    body('release_date').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '输入数据无效',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { version_number, title, change_log, release_date, category } = req.body;

        // 检查版本发布记录是否存在
        const existing = await query('SELECT id FROM version_releases WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: '版本发布记录不存在'
            });
        }

        const updates = [];
        const params = [];

        if (version_number !== undefined) {
            updates.push('version_number = ?');
            params.push(version_number);
        }
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (change_log !== undefined) {
            updates.push('change_log = ?');
            params.push(change_log);
        }
        if (release_date !== undefined) {
            updates.push('release_date = ?');
            params.push(release_date);
        }
        if (category !== undefined) {
            updates.push('category = ?');
            params.push(category || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有提供要更新的字段'
            });
        }

        params.push(id);

        await query(
            `UPDATE version_releases SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
        );

        res.json({
            success: true,
            message: '版本发布记录更新成功'
        });
    } catch (error) {
        console.error('更新版本发布记录失败:', error);
        res.status(500).json({
            success: false,
            error: '更新版本发布记录失败',
            message: error.message
        });
    }
});

// 删除版本发布记录
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 检查是否有模块使用该版本
        const modulesUsingVersion = await query(
            'SELECT COUNT(*) as count FROM modules WHERE version_id = ?',
            [id]
        );

        if (modulesUsingVersion[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: `无法删除：有 ${modulesUsingVersion[0].count} 个模块正在使用该版本`
            });
        }

        // 删除关联的附件文件（OSS/本地）
        const attachments = await query('SELECT * FROM release_attachments WHERE release_id = ?', [id]);
        for (const att of attachments) {
            if (ossService.isOSSPath(att.file_path)) {
                try { await ossService.deleteFile(att.file_path); } catch (e) {
                    console.error('删除OSS附件失败:', e.message);
                }
            } else {
                const localPath = path.join(__dirname, '..', att.file_path);
                try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (e) {}
            }
        }

        const result = await query('DELETE FROM version_releases WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: '版本发布记录不存在'
            });
        }

        res.json({
            success: true,
            message: '版本发布记录删除成功'
        });
    } catch (error) {
        console.error('删除版本发布记录失败:', error);
        res.status(500).json({
            success: false,
            error: '删除版本发布记录失败',
            message: error.message
        });
    }
});

// 获取版本的附件列表
router.get('/:id/attachments', async (req, res) => {
    try {
        const { id } = req.params;
        const attachments = await query(
            'SELECT * FROM release_attachments WHERE release_id = ? ORDER BY created_at DESC',
            [id]
        );
        res.json({ success: true, data: attachments });
    } catch (error) {
        console.error('获取附件列表失败:', error);
        res.status(500).json({ success: false, error: '获取附件列表失败' });
    }
});

// 上传附件到版本
router.post('/:id/attachments', upload.array('files', 10), async (req, res) => {
    try {
        const { id } = req.params;

        // 检查版本是否存在
        const [release] = await query(
            `SELECT vr.*, mt.name as module_type_name FROM version_releases vr 
             LEFT JOIN module_types mt ON vr.module_type_id = mt.id 
             WHERE vr.id = ?`, [id]
        );
        if (!release) {
            return res.status(404).json({ success: false, error: '版本记录不存在' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: '未检测到上传文件' });
        }

        const results = [];
        for (const file of req.files) {
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            let filePath = `/uploads/release-attachments/${file.filename}`;

            // 上传到OSS
            if (ossService.enabled) {
                try {
                    const safeSeg = (s) => (s || 'unknown').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim();
                    const moduleTypeName = safeSeg(release.module_type_name);
                    const versionNumber = safeSeg(release.version_number);
                    const ossPath = `${ossService.basePath}/version-releases/${moduleTypeName}/${versionNumber}/${originalName}`;
                    
                    const ossResult = await ossService.client.put(ossPath, file.path);
                    filePath = `oss://${ossService.bucket}/${ossPath}`;
                    console.log(`✅ 版本附件上传OSS成功: ${ossPath}`);

                    // 删除本地临时文件
                    try { fs.unlinkSync(file.path); } catch (e) {}
                } catch (ossErr) {
                    console.error('OSS上传失败，使用本地存储:', ossErr.message);
                }
            }

            const insertResult = await query(
                `INSERT INTO release_attachments (release_id, file_name, original_name, file_path, file_size) 
                 VALUES (?, ?, ?, ?, ?)`,
                [id, file.filename, originalName, filePath, file.size]
            );

            results.push({
                id: insertResult.insertId,
                file_name: file.filename,
                original_name: originalName,
                file_path: filePath,
                file_size: file.size
            });
        }

        res.json({ success: true, data: results, message: `${results.length}个附件上传成功` });
    } catch (error) {
        console.error('上传附件失败:', error);
        res.status(500).json({ success: false, error: '上传附件失败' });
    }
});

module.exports = router;
