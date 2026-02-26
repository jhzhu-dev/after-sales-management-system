const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

// 获取指定问题的所有处理记录
router.get('/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;

    // 验证问题是否存在
    const issue = await query('SELECT id FROM issues WHERE id = ?', [issueId]);
    if (issue.length === 0) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }

    // 获取处理记录，按时间倒序
    const logs = await query(
      `SELECT 
        id, issue_id, content, handler, handled_at, attachments,
        created_at, updated_at
      FROM issue_logs
      WHERE issue_id = ?
      ORDER BY handled_at DESC`,
      [issueId]
    );

    // 解析附件JSON
    const logsWithAttachments = logs.map(log => ({
      ...log,
      attachments: log.attachments ? JSON.parse(log.attachments) : []
    }));

    res.json({
      success: true,
      data: logsWithAttachments
    });
  } catch (error) {
    console.error('获取处理记录失败:', error);
    res.status(500).json({ success: false, error: '获取处理记录失败' });
  }
});

// 创建处理记录
router.post('/', [
  body('issue_id').notEmpty().withMessage('问题ID不能为空'),
  body('content').notEmpty().withMessage('处理内容不能为空'),
  body('handler').notEmpty().withMessage('处理人不能为空'),
  body('handled_at').optional().isISO8601().withMessage('处理时间格式不正确'),
  body('attachments').optional().isArray().withMessage('附件必须是数组')
], async (req, res) => {
  try {
    // 验证请求
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { issue_id, content, handler, handled_at, attachments } = req.body;

    // 验证问题是否存在
    const issue = await query('SELECT id FROM issues WHERE id = ?', [issue_id]);
    if (issue.length === 0) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }

    // 插入处理记录
    const insertQuery = `
      INSERT INTO issue_logs (issue_id, content, handler, handled_at, attachments)
      VALUES (?, ?, ?, ?, ?)
    `;

    const attachmentsJson = attachments && attachments.length > 0 
      ? JSON.stringify(attachments) 
      : null;

    const result = await query(insertQuery, [
      issue_id,
      content,
      handler,
      handled_at || new Date(),
      attachmentsJson
    ]);

    // 获取新创建的记录
    const newLog = await query(
      'SELECT * FROM issue_logs WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: '处理记录创建成功',
      data: {
        ...newLog[0],
        attachments: newLog[0].attachments ? JSON.parse(newLog[0].attachments) : []
      }
    });
  } catch (error) {
    console.error('创建处理记录失败:', error);
    res.status(500).json({ success: false, error: '创建处理记录失败' });
  }
});

// 删除处理记录
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查记录是否存在
    const log = await query('SELECT id FROM issue_logs WHERE id = ?', [id]);
    if (log.length === 0) {
      return res.status(404).json({ success: false, error: '处理记录不存在' });
    }

    // 删除记录
    await query('DELETE FROM issue_logs WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '处理记录删除成功'
    });
  } catch (error) {
    console.error('删除处理记录失败:', error);
    res.status(500).json({ success: false, error: '删除处理记录失败' });
  }
});

module.exports = router;
