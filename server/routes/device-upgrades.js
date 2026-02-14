const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database');
const router = express.Router();

/**
 * @route GET /api/device-upgrades
 * @desc Get all device upgrades with filtering
 */
router.get('/', async (req, res) => {
    try {
        const { device_id, upgrade_type, page = 1, limit = 10 } = req.query;

        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 10, 1000); // 限制最大1000条
        const offset = (pageNum - 1) * limitNum;

        let whereConditions = [];
        let params = [];

        if (device_id) {
            whereConditions.push('du.device_id = ?');
            params.push(device_id);
        }

        if (upgrade_type) {
            whereConditions.push('du.upgrade_type = ?');
            params.push(upgrade_type);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const upgradesQuery = `
      SELECT 
        du.*,
        d.name as device_name
      FROM device_upgrades du
      LEFT JOIN devices d ON du.device_id = d.id
      ${whereClause}
      ORDER BY du.upgrade_at DESC
      LIMIT ? OFFSET ?
    `;

        console.log('查询参数:', { 
          device_id, 
          page, 
          limit, 
          pageNum, 
          limitNum, 
          offset, 
          params, 
          paramsType: params.map(p => typeof p),
          limitType: typeof limitNum,
          offsetType: typeof offset,
          fullParams: [...params, Number(limitNum), Number(offset)] 
        });
        const queryParams = [...params, Number(limitNum), Number(offset)];
        const upgrades = await query(upgradesQuery, queryParams);

        const countQuery = `
      SELECT COUNT(*) as total FROM device_upgrades du ${whereClause}
    `;
        const countResult = await query(countQuery, params);
        const total = countResult[0].total;

        res.json({
            success: true,
            data: upgrades,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('获取升级记录失败:', error);
        res.status(500).json({ success: false, error: '获取升级记录失败' });
    }
});

/**
 * @route POST /api/device-upgrades
 * @desc Create a new upgrade record
 */
router.post('/', [
    body('device_id').notEmpty().withMessage('设备ID不能为空'),
    body('upgrade_type').isIn(['硬件升级', '软件更新', '系统重装']).withMessage('无效的升级类型'),
    body('upgrade_at').optional().isISO8601().withMessage('无效的日期格式')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const {
            device_id, upgrade_type, description,
            old_version, new_version, operator_id,
            upgrade_at
        } = req.body;

        const insertQuery = `
      INSERT INTO device_upgrades (
        device_id, upgrade_type, description, 
        old_version, new_version, operator_id, 
        upgrade_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

        const result = await query(insertQuery, [
            device_id, upgrade_type, description || null,
            old_version || null, new_version || null, operator_id || null,
            upgrade_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]);

        res.status(201).json({
            success: true,
            data: { id: result.insertId },
            message: '升级记录创建成功'
        });
    } catch (error) {
        console.error('创建升级记录失败:', error);
        res.status(500).json({ success: false, error: '创建升级记录失败' });
    }
});

/**
 * @route PUT /api/device-upgrades/:id
 * @desc Update an upgrade record
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(key => {
            if (['upgrade_type', 'description', 'old_version', 'new_version', 'operator_id', 'upgrade_at'].includes(key)) {
                updateFields.push(`${key} = ?`);
                if (key === 'upgrade_at' && updates[key]) {
                    updateValues.push(new Date(updates[key]).toISOString().slice(0, 19).replace('T', ' '));
                } else {
                    updateValues.push(updates[key]);
                }
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: '没有提供更新数据' });
        }

        const updateQuery = `
      UPDATE device_upgrades 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

        await query(updateQuery, [...updateValues, id]);

        res.json({ success: true, message: '记录更新成功' });
    } catch (error) {
        console.error('更新记录失败:', error);
        res.status(500).json({ success: false, error: '更新记录失败' });
    }
});

/**
 * @route DELETE /api/device-upgrades/:id
 * @desc Delete an upgrade record
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM device_upgrades WHERE id = ?', [id]);
        res.json({ success: true, message: '记录删除成功' });
    } catch (error) {
        console.error('删除记录失败:', error);
        res.status(500).json({ success: false, error: '删除记录失败' });
    }
});

module.exports = router;
