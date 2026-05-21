const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// GET /api/issue-classifications — 获取全部分类（按 sort_order 排序）
router.get('/', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, sort_order, created_at FROM issue_classification_types ORDER BY sort_order ASC, id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取问题分类列表失败:', error);
    res.status(500).json({ success: false, error: '获取问题分类列表失败' });
  }
});

// POST /api/issue-classifications — 新增分类
router.post('/', [
  body('name').trim().notEmpty().withMessage('分类名称不能为空').isLength({ max: 100 }).withMessage('名称最长100字'),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('排序值须为非负整数')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const { name, sort_order = 0 } = req.body;

    // 检查名称唯一性
    const existing = await query('SELECT id FROM issue_classification_types WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: '该分类名称已存在' });
    }

    const result = await query(
      'INSERT INTO issue_classification_types (name, sort_order) VALUES (?, ?)',
      [name, sort_order]
    );
    const created = await query('SELECT id, name, sort_order, created_at FROM issue_classification_types WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error('新增问题分类失败:', error);
    res.status(500).json({ success: false, error: '新增问题分类失败' });
  }
});

// PUT /api/issue-classifications/:id — 修改名称或排序
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('分类名称不能为空').isLength({ max: 100 }),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('排序值须为非负整数')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const { id } = req.params;
    const { name, sort_order } = req.body;

    const existing = await query('SELECT id FROM issue_classification_types WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '分类不存在' });
    }

    // 名称唯一性检查（排除自身）
    if (name) {
      const dup = await query('SELECT id FROM issue_classification_types WHERE name = ? AND id != ?', [name, id]);
      if (dup.length > 0) {
        return res.status(409).json({ success: false, error: '该分类名称已存在' });
      }
    }

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    values.push(id);
    await query(`UPDATE issue_classification_types SET ${fields.join(', ')} WHERE id = ?`, values);

    const updated = await query('SELECT id, name, sort_order, created_at FROM issue_classification_types WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('更新问题分类失败:', error);
    res.status(500).json({ success: false, error: '更新问题分类失败' });
  }
});

// DELETE /api/issue-classifications/:id — 删除分类（有关联 issue 时拒绝）
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT id, name FROM issue_classification_types WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '分类不存在' });
    }

    // 检查是否有关联的问题
    const usageCount = await query('SELECT COUNT(*) as cnt FROM issues WHERE classification_id = ?', [id]);
    if (usageCount[0].cnt > 0) {
      return res.status(409).json({
        success: false,
        error: `该分类下有 ${usageCount[0].cnt} 条问题记录，无法删除。请先修改这些问题的分类。`
      });
    }

    await query('DELETE FROM issue_classification_types WHERE id = ?', [id]);
    res.json({ success: true, message: '分类已删除' });
  } catch (error) {
    console.error('删除问题分类失败:', error);
    res.status(500).json({ success: false, error: '删除问题分类失败' });
  }
});

module.exports = router;
