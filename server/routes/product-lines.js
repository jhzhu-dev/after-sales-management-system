const express = require('express');
const router = express.Router();
const { query } = require('../database');

// 获取所有产品线
router.get('/', async (req, res) => {
    try {
        const { is_active } = req.query;

        let sql = 'SELECT * FROM product_lines';
        const params = [];

        if (is_active !== undefined) {
            sql += ' WHERE is_active = ?';
            // 处理多种格式：'true', 'false', '1', '0', 1, 0
            const activeValue = is_active === 'true' || is_active === '1' || is_active === 1 ? 1 : 0;
            params.push(activeValue);
        }

        sql += ' ORDER BY created_at DESC';

        const productLines = await query(sql, params);

        res.json({
            success: true,
            data: productLines
        });
    } catch (error) {
        console.error('获取产品线列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取产品线列表失败',
            message: error.message
        });
    }
});

// 获取单个产品线详情
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const productLines = await query(
            'SELECT * FROM product_lines WHERE id = ?',
            [id]
        );

        if (productLines.length === 0) {
            return res.status(404).json({
                success: false,
                error: '产品线不存在'
            });
        }

        res.json({
            success: true,
            data: productLines[0]
        });
    } catch (error) {
        console.error('获取产品线详情失败:', error);
        res.status(500).json({
            success: false,
            error: '获取产品线详情失败',
            message: error.message
        });
    }
});

// 创建产品线
router.post('/', async (req, res) => {
    try {
        const { name, code, description, is_active } = req.body;

        // 验证必填字段
        if (!name || !code) {
            return res.status(400).json({
                success: false,
                error: '产品线名称和代码为必填项'
            });
        }

        const result = await query(
            'INSERT INTO product_lines (name, code, description, is_active) VALUES (?, ?, ?, ?)',
            [name, code, description || null, is_active !== undefined ? is_active : true]
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                name,
                code,
                description,
                is_active: is_active !== undefined ? is_active : true
            },
            message: '产品线创建成功'
        });
    } catch (error) {
        console.error('创建产品线失败:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: '产品线名称或代码已存在'
            });
        }

        res.status(500).json({
            success: false,
            error: '创建产品线失败',
            message: error.message
        });
    }
});

// 更新产品线
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description, is_active } = req.body;

        // 检查产品线是否存在
        const existing = await query('SELECT id FROM product_lines WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: '产品线不存在'
            });
        }

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (code !== undefined) {
            updates.push('code = ?');
            params.push(code);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有提供要更新的字段'
            });
        }

        params.push(id);

        await query(
            `UPDATE product_lines SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json({
            success: true,
            message: '产品线更新成功'
        });
    } catch (error) {
        console.error('更新产品线失败:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: '产品线名称或代码已存在'
            });
        }

        res.status(500).json({
            success: false,
            error: '更新产品线失败',
            message: error.message
        });
    }
});

// 删除产品线
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 检查是否有关联的产品
        const products = await query(
            'SELECT COUNT(*) as count FROM products WHERE product_line_id = ?',
            [id]
        );

        if (products[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: '该产品线下还有产品，无法删除'
            });
        }

        const result = await query('DELETE FROM product_lines WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: '产品线不存在'
            });
        }

        res.json({
            success: true,
            message: '产品线删除成功'
        });
    } catch (error) {
        console.error('删除产品线失败:', error);
        res.status(500).json({
            success: false,
            error: '删除产品线失败',
            message: error.message
        });
    }
});

// 获取产品线下的所有产品
router.get('/:id/products', async (req, res) => {
    try {
        const { id } = req.params;

        const products = await query(
            'SELECT * FROM products WHERE product_line_id = ? ORDER BY created_at DESC',
            [id]
        );

        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error('获取产品列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取产品列表失败',
            message: error.message
        });
    }
});

module.exports = router;
