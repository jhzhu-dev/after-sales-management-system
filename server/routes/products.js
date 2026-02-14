const express = require('express');
const router = express.Router();
const { query } = require('../database');

// 获取所有产品
router.get('/', async (req, res) => {
    try {
        const { product_line_id, is_active } = req.query;

        console.log('📦 获取产品列表请求:', { product_line_id, is_active, type_of_is_active: typeof is_active });

        let sql = `
      SELECT p.*, pl.name as product_line_name 
      FROM products p
      LEFT JOIN product_lines pl ON p.product_line_id = pl.id
      WHERE 1=1
    `;
        const params = [];

        if (product_line_id) {
            sql += ' AND p.product_line_id = ?';
            params.push(product_line_id);
        }

        if (is_active !== undefined) {
            sql += ' AND p.is_active = ?';
            // 支持多种格式: 'true', 'false', '1', '0', 1, 0
            const activeValue = (is_active === 'true' || is_active === '1' || is_active === 1) ? 1 : 0;
            params.push(activeValue);
        }

        sql += ' ORDER BY p.created_at DESC';

        console.log('执行SQL:', sql);
        console.log('参数:', params);

        const products = await query(sql, params);

        console.log('查询结果数量:', products.length);

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

// 获取单个产品详情
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const products = await query(
            `SELECT p.*, pl.name as product_line_name 
       FROM products p
       LEFT JOIN product_lines pl ON p.product_line_id = pl.id
       WHERE p.id = ?`,
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                error: '产品不存在'
            });
        }

        res.json({
            success: true,
            data: products[0]
        });
    } catch (error) {
        console.error('获取产品详情失败:', error);
        res.status(500).json({
            success: false,
            error: '获取产品详情失败',
            message: error.message
        });
    }
});

// 创建产品
router.post('/', async (req, res) => {
    try {
        const { product_line_id, name, model, description, specifications, is_active } = req.body;

        // 验证必填字段
        if (!product_line_id || !name) {
            return res.status(400).json({
                success: false,
                error: '产品线ID和产品名称为必填项'
            });
        }

        // 验证产品线是否存在
        const productLines = await query('SELECT id FROM product_lines WHERE id = ?', [product_line_id]);
        if (productLines.length === 0) {
            return res.status(400).json({
                success: false,
                error: '指定的产品线不存在'
            });
        }

        const result = await query(
            'INSERT INTO products (product_line_id, name, model, description, specifications, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [
                product_line_id,
                name,
                model || null,
                description || null,
                specifications ? JSON.stringify(specifications) : null,
                is_active !== undefined ? is_active : true
            ]
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                product_line_id,
                name,
                model,
                description,
                specifications,
                is_active: is_active !== undefined ? is_active : true
            },
            message: '产品创建成功'
        });
    } catch (error) {
        console.error('创建产品失败:', error);
        res.status(500).json({
            success: false,
            error: '创建产品失败',
            message: error.message
        });
    }
});

// 更新产品
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { product_line_id, name, model, description, specifications, is_active } = req.body;

        // 检查产品是否存在
        const existing = await query('SELECT id FROM products WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: '产品不存在'
            });
        }

        const updates = [];
        const params = [];

        if (product_line_id !== undefined) {
            // 验证产品线是否存在
            const productLines = await query('SELECT id FROM product_lines WHERE id = ?', [product_line_id]);
            if (productLines.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '指定的产品线不存在'
                });
            }
            updates.push('product_line_id = ?');
            params.push(product_line_id);
        }
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (model !== undefined) {
            updates.push('model = ?');
            params.push(model);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (specifications !== undefined) {
            updates.push('specifications = ?');
            params.push(JSON.stringify(specifications));
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
            `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json({
            success: true,
            message: '产品更新成功'
        });
    } catch (error) {
        console.error('更新产品失败:', error);
        res.status(500).json({
            success: false,
            error: '更新产品失败',
            message: error.message
        });
    }
});

// 删除产品
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query('DELETE FROM products WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: '产品不存在'
            });
        }

        res.json({
            success: true,
            message: '产品删除成功'
        });
    } catch (error) {
        console.error('删除产品失败:', error);
        res.status(500).json({
            success: false,
            error: '删除产品失败',
            message: error.message
        });
    }
});

module.exports = router;
