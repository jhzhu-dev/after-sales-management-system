const express = require('express');
const router = express.Router();
const { query } = require('../database');

// GET /api/module-sop-templates — 获取所有SOP模板（含模块类型名称）
router.get('/', async (req, res) => {
  try {
    const templates = await query(`
      SELECT mst.*, mt.name as module_type_name, mt.code as module_type_code
      FROM module_sop_templates mst
      JOIN module_types mt ON mst.module_type_id = mt.id
      ORDER BY mt.name ASC
    `);
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('获取SOP模板失败:', error);
    res.status(500).json({ success: false, error: '获取SOP模板失败' });
  }
});

// GET /api/module-sop-templates/by-module-type/:typeId — 按模块类型获取模板
router.get('/by-module-type/:typeId', async (req, res) => {
  try {
    const { typeId } = req.params;
    const [template] = await query(`
      SELECT mst.*, mt.name as module_type_name
      FROM module_sop_templates mst
      JOIN module_types mt ON mst.module_type_id = mt.id
      WHERE mst.module_type_id = ?
    `, [typeId]);

    if (!template) {
      return res.json({ success: true, data: null });
    }

    // items 字段是JSON字符串，需要解析
    if (typeof template.items === 'string') {
      template.items = JSON.parse(template.items);
    }

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('获取SOP模板失败:', error);
    res.status(500).json({ success: false, error: '获取SOP模板失败' });
  }
});

// POST /api/module-sop-templates — 创建或更新（upsert）模板
router.post('/', async (req, res) => {
  try {
    const { module_type_id, items } = req.body;

    if (!module_type_id) {
      return res.status(400).json({ success: false, error: '模块类型ID不能为空' });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items必须是数组' });
    }

    // 验证每一项
    for (const item of items) {
      if (!item.id || typeof item.text !== 'string' || item.text.trim() === '') {
        return res.status(400).json({ success: false, error: '每个检查项必须有id和text' });
      }
    }

    // 检查模块类型是否存在
    const [moduleType] = await query('SELECT id FROM module_types WHERE id = ?', [module_type_id]);
    if (!moduleType) {
      return res.status(400).json({ success: false, error: '模块类型不存在' });
    }

    const itemsJson = JSON.stringify(items);

    // upsert
    const [existing] = await query('SELECT id FROM module_sop_templates WHERE module_type_id = ?', [module_type_id]);
    if (existing) {
      await query(
        'UPDATE module_sop_templates SET items = ?, updated_at = NOW() WHERE module_type_id = ?',
        [itemsJson, module_type_id]
      );
    } else {
      await query(
        'INSERT INTO module_sop_templates (module_type_id, items) VALUES (?, ?)',
        [module_type_id, itemsJson]
      );
    }

    const [result] = await query(`
      SELECT mst.*, mt.name as module_type_name
      FROM module_sop_templates mst
      JOIN module_types mt ON mst.module_type_id = mt.id
      WHERE mst.module_type_id = ?
    `, [module_type_id]);

    if (result && typeof result.items === 'string') {
      result.items = JSON.parse(result.items);
    }

    res.json({ success: true, data: result, message: 'SOP模板保存成功' });
  } catch (error) {
    console.error('保存SOP模板失败:', error);
    res.status(500).json({ success: false, error: '保存SOP模板失败' });
  }
});

// DELETE /api/module-sop-templates/:id — 删除模板
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT id FROM module_sop_templates WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'SOP模板不存在' });
    }
    await query('DELETE FROM module_sop_templates WHERE id = ?', [id]);
    res.json({ success: true, message: 'SOP模板已删除' });
  } catch (error) {
    console.error('删除SOP模板失败:', error);
    res.status(500).json({ success: false, error: '删除SOP模板失败' });
  }
});

module.exports = router;
