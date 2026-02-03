const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取所有版本发布记录
router.get('/', async (req, res) => {
    try {
        const { module_type_id } = req.query;

        let whereClause = '';
        let params = [];

        if (module_type_id) {
            whereClause = 'WHERE vr.module_type_id = ?';
            params.push(module_type_id);
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

        const { module_type_id, version_number, title, change_log } = req.body;

        // 检查模块类型是否存在
        const [moduleType] = await query('SELECT id FROM module_types WHERE id = ?', [module_type_id]);
        if (!moduleType) {
            return res.status(400).json({ success: false, error: '指定的模块类型不存在' });
        }

        const insertQuery = `
      INSERT INTO version_releases (module_type_id, version_number, title, change_log)
      VALUES (?, ?, ?, ?)
    `;

        const result = await query(insertQuery, [module_type_id, version_number, title, change_log]);

        res.status(201).json({
            success: true,
            message: '版本发布记录创建成功',
            data: { id: result.insertId, module_type_id, version_number, title, change_log }
        });
    } catch (error) {
        console.error('创建版本发布记录失败:', error);
        res.status(500).json({ success: false, error: '创建版本发布记录失败' });
    }
});

module.exports = router;
