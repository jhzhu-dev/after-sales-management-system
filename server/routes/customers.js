const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取所有客户（支持搜索）
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;

    let sql = 'SELECT * FROM customers';
    let params = [];

    if (search) {
      sql += ' WHERE name LIKE ? OR short_name LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY name ASC';
    sql += ` LIMIT ${parseInt(limit)}`;

    const customers = await query(sql, params);

    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('获取客户列表失败:', error);
    res.status(500).json({ success: false, error: '获取客户列表失败' });
  }
});

// 获取单个客户
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM customers WHERE id = ?', [id]);
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('获取客户详情失败:', error);
    res.status(500).json({ success: false, error: '获取客户详情失败' });
  }
});

// 创建客户
router.post('/', [
  body('name').notEmpty().withMessage('客户名称不能为空'),
  body('short_name').notEmpty().withMessage('客户简写不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: '输入数据无效', details: errors.array() });
    }

    const { name, short_name } = req.body;

    // 检查简写是否已存在
    const existing = await query('SELECT id FROM customers WHERE short_name = ?', [short_name]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: '客户简写已存在' });
    }

    const result = await query(
      'INSERT INTO customers (name, short_name) VALUES (?, ?)',
      [name, short_name]
    );

    res.status(201).json({
      success: true,
      message: '客户创建成功',
      data: { id: result.insertId, name, short_name }
    });
  } catch (error) {
    console.error('创建客户失败:', error);
    res.status(500).json({ success: false, error: '创建客户失败' });
  }
});

// 更新客户
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('客户名称不能为空'),
  body('short_name').optional().notEmpty().withMessage('客户简写不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: '输入数据无效', details: errors.array() });
    }

    const { id } = req.params;
    const { name, short_name } = req.body;

    // 检查客户是否存在
    const existing = await query('SELECT id, name FROM customers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }
    const oldName = existing[0].name;

    // 检查简写是否被其他客户占用
    if (short_name) {
      const duplicate = await query('SELECT id FROM customers WHERE short_name = ? AND id != ?', [short_name, id]);
      if (duplicate.length > 0) {
        return res.status(400).json({ success: false, error: '客户简写已被其他客户使用' });
      }
    }

    const updateFields = [];
    const updateValues = [];
    if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
    if (short_name !== undefined) { updateFields.push('short_name = ?'); updateValues.push(short_name); }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    updateValues.push(id);
    await query(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    // 客户名称变更时，用 REPLACE() 精准替换 nickname 中的旧客户名，不重算数字后缀
    if (name !== undefined && name !== oldName) {
      try {
        await query(
          `UPDATE devices SET nickname = REPLACE(nickname, ?, ?) WHERE customer_id = ? AND nickname IS NOT NULL`,
          [oldName, name, id]
        );
      } catch (e) {
        console.warn('级联更新设备nickname失败:', e.message);
      }
    }

    res.json({ success: true, message: '客户更新成功' });
  } catch (error) {
    console.error('更新客户失败:', error);
    res.status(500).json({ success: false, error: '更新客户失败' });
  }
});

// 删除客户（禁止删除已关联设备的客户）
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查客户是否存在
    const existing = await query('SELECT id, name FROM customers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }

    // 检查是否有关联设备
    const deviceCount = await query('SELECT COUNT(*) as count FROM devices WHERE customer_id = ?', [id]);
    if (deviceCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: `无法删除客户"${existing[0].name}"，该客户下有 ${deviceCount[0].count} 台关联设备，请先解除关联`
      });
    }

    await query('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ success: true, message: '客户删除成功' });
  } catch (error) {
    console.error('删除客户失败:', error);
    res.status(500).json({ success: false, error: '删除客户失败' });
  }
});

module.exports = router;
