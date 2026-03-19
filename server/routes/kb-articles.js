const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// GET /api/kb-articles
router.get('/', async (req, res) => {
  try {
    const { search, category, product_line_id } = req.query;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('(a.title LIKE ? OR a.symptom LIKE ? OR a.solution LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) { conditions.push('a.category = ?'); params.push(category); }
    if (product_line_id) { conditions.push('a.product_line_id = ?'); params.push(parseInt(product_line_id, 10)); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const articles = await query(
      `SELECT a.*, pl.name AS product_line_name FROM kb_articles a
       LEFT JOIN product_lines pl ON a.product_line_id = pl.id
       ${where} ORDER BY a.is_pinned DESC, a.updated_at DESC`,
      params
    );
    res.json({ success: true, data: articles });
  } catch (e) {
    console.error('获取知识库列表失败:', e);
    res.status(500).json({ success: false, error: '获取知识库列表失败' });
  }
});

// GET /api/kb-articles/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT a.*, pl.name AS product_line_name FROM kb_articles a
       LEFT JOIN product_lines pl ON a.product_line_id = pl.id WHERE a.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: '词条不存在' });
    await query('UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error('获取知识库详情失败:', e);
    res.status(500).json({ success: false, error: '获取知识库详情失败' });
  }
});

// POST /api/kb-articles
router.post('/', [
  body('title').notEmpty().withMessage('标题不能为空').isString(),
  body('symptom').notEmpty().withMessage('问题现象不能为空').isString(),
  body('solution').notEmpty().withMessage('解决方案不能为空').isString(),
  body('cause').optional({ nullable: true }).isString(),
  body('category').optional().isString(),
  body('product_line_id').optional({ nullable: true }).isInt(),
  body('tags').optional({ nullable: true }).isArray(),
  body('is_pinned').optional().isBoolean(),
  body('created_by').optional({ nullable: true }).isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: '输入数据无效', details: errors.array() });
    }
    const { title, symptom, cause, solution, category = '其他', product_line_id, tags, is_pinned = false, created_by } = req.body;
    const result = await query(
      `INSERT INTO kb_articles (title, symptom, cause, solution, category, product_line_id, tags, is_pinned, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(), symptom.trim(), cause ? cause.trim() : null, solution.trim(), category,
        product_line_id || null,
        tags && tags.length ? JSON.stringify(tags) : null,
        is_pinned ? 1 : 0,
        created_by || null,
      ]
    );
    res.status(201).json({ success: true, data: { id: result.insertId }, message: '词条创建成功' });
  } catch (e) {
    console.error('创建知识库词条失败:', e);
    res.status(500).json({ success: false, error: '创建知识库词条失败' });
  }
});

// PUT /api/kb-articles/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT id FROM kb_articles WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: '词条不存在' });

    const allowed = ['title', 'symptom', 'cause', 'solution', 'category', 'product_line_id', 'tags', 'is_pinned'];
    const updates = {};
    allowed.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    if (updates.tags !== undefined) updates.tags = updates.tags && updates.tags.length ? JSON.stringify(updates.tags) : null;
    if (updates.product_line_id !== undefined) updates.product_line_id = updates.product_line_id || null;
    if (updates.is_pinned !== undefined) updates.is_pinned = updates.is_pinned ? 1 : 0;
    if (updates.cause !== undefined) updates.cause = updates.cause ? updates.cause.trim() : null;
    if (updates.title !== undefined) updates.title = updates.title.trim();
    if (updates.symptom !== undefined) updates.symptom = updates.symptom.trim();
    if (updates.solution !== undefined) updates.solution = updates.solution.trim();

    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: '没有要更新的字段' });

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await query(
      `UPDATE kb_articles SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...Object.values(updates), id]
    );
    res.json({ success: true, message: '词条更新成功' });
  } catch (e) {
    console.error('更新知识库词条失败:', e);
    res.status(500).json({ success: false, error: '更新知识库词条失败' });
  }
});

// DELETE /api/kb-articles/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT id FROM kb_articles WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: '词条不存在' });
    await query('DELETE FROM kb_articles WHERE id = ?', [id]);
    res.json({ success: true, message: '词条删除成功' });
  } catch (e) {
    console.error('删除知识库词条失败:', e);
    res.status(500).json({ success: false, error: '删除知识库词条失败' });
  }
});

// POST /api/kb-articles/:id/helpful
router.post('/:id/helpful', async (req, res) => {
  try {
    await query('UPDATE kb_articles SET helpful_count = helpful_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

module.exports = router;
