const express = require('express');
const router = express.Router();
const { query } = require('../database');

// 获取所有 SOP 模板
router.get('/', async (req, res) => {
    try {
        const { stage, is_active, product_line_id } = req.query;
        let sql = `
            SELECT t.*, pl.name as product_line_name 
            FROM sop_templates t
            LEFT JOIN product_lines pl ON t.product_line_id = pl.id
            WHERE 1=1
        `;
        const params = [];

        if (stage) {
            sql += ' AND t.stage = ?';
            params.push(stage);
        }
        if (is_active !== undefined) {
            sql += ' AND t.is_active = ?';
            params.push(is_active === 'true' ? 1 : 0);
        }
        if (product_line_id !== undefined) {
            if (product_line_id === 'null' || product_line_id === '') {
                sql += ' AND t.product_line_id IS NULL';
            } else {
                sql += ' AND t.product_line_id = ?';
                params.push(product_line_id);
            }
        }

        sql += ' ORDER BY t.created_at DESC';
        const templates = await query(sql, params);
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error('获取 SOP 模板失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 获取各阶段最新的活跃模板
router.get('/active', async (req, res) => {
    try {
        const sql = `
      SELECT t1.* FROM sop_templates t1
      INNER JOIN (
        SELECT stage, MAX(created_at) as latest 
        FROM sop_templates 
        WHERE is_active = 1 
        GROUP BY stage
      ) t2 ON t1.stage = t2.stage AND t1.created_at = t2.latest
    `;
        const templates = await query(sql);
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error('获取活跃 SOP 模板失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 创建 SOP 模板
router.post('/', async (req, res) => {
    const { stage, product_line_id, version, content, created_by } = req.body;
    if (!stage || !version || !content) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    try {
        const result = await query(
            'INSERT INTO sop_templates (stage, product_line_id, version, content, created_by) VALUES (?, ?, ?, ?, ?)',
            [stage, product_line_id || null, version, JSON.stringify(content), created_by]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        console.error('创建 SOP 模板失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 切换模板激活状态
router.patch('/:id/toggle-active', async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    try {
        await query('UPDATE sop_templates SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
        res.json({ success: true, message: '状态更新成功' });
    } catch (error) {
        console.error('更新 SOP 模板状态失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

module.exports = router;
