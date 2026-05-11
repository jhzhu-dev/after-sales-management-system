const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database');
const crypto = require('crypto');
const router = express.Router();

// 获取多合一设备列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, customer_id } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push('(b.bundle_code LIKE ? OR b.name LIKE ? OR c.name LIKE ? OR c.short_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (customer_id) {
      whereConditions.push('b.customer_id = ?');
      params.push(customer_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const bundlesQuery = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.short_name as customer_short_name,
        COUNT(DISTINCT d.id) as device_count,
        (SELECT COUNT(*) FROM device_documents dd WHERE dd.bundle_id = b.id) as document_count,
        (SELECT d2.remote_code FROM devices d2 WHERE d2.bundle_id = b.id AND d2.remote_code IS NOT NULL LIMIT 1) as remote_code,
        (SELECT COUNT(*) FROM issues i WHERE i.device_id IN (SELECT d3.id FROM devices d3 WHERE d3.bundle_id = b.id) AND i.status = 'open') as open_issues
      FROM device_bundles b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN devices d ON d.bundle_id = b.id
      ${whereClause}
      GROUP BY b.id
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limitNum, offset);

    const bundles = await query(bundlesQuery, params);

    const countQuery = `
      SELECT COUNT(DISTINCT b.id) as total
      FROM device_bundles b
      LEFT JOIN customers c ON b.customer_id = c.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: bundles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取多合一设备列表失败:', error);
    res.status(500).json({ success: false, error: '获取多合一设备列表失败' });
  }
});

// 获取多合一设备详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const bundleQuery = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.short_name as customer_short_name,
        (SELECT d2.remote_code FROM devices d2 WHERE d2.bundle_id = b.id AND d2.remote_code IS NOT NULL LIMIT 1) as remote_code,
        (SELECT d2.password FROM devices d2 WHERE d2.bundle_id = b.id AND d2.password IS NOT NULL LIMIT 1) as password,
        (SELECT d2.merchant_id FROM devices d2 WHERE d2.bundle_id = b.id AND d2.merchant_id IS NOT NULL LIMIT 1) as merchant_id,
        (SELECT d2.merchant_password FROM devices d2 WHERE d2.bundle_id = b.id AND d2.merchant_password IS NOT NULL LIMIT 1) as merchant_password
      FROM device_bundles b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `;
    const bundleResult = await query(bundleQuery, [id]);
    if (bundleResult.length === 0) {
      return res.status(404).json({ success: false, error: '多合一设备不存在' });
    }

    const bundle = bundleResult[0];

    // 获取成员设备
    const devicesQuery = `
      SELECT 
        d.*,
        pl.name as product_line_name,
        p.name as product_name,
        p.model as product_model,
        c.name as customer_name,
        c.short_name as customer_short_name,
        COUNT(DISTINCT i.id) as issue_count,
        COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) as open_issues
      FROM devices d
      LEFT JOIN product_lines pl ON d.product_line_id = pl.id
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN issues i ON d.id = i.device_id
      WHERE d.bundle_id = ?
      GROUP BY d.id
      ORDER BY d.created_at ASC
    `;
    const devices = await query(devicesQuery, [id]);

    // 统计
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM modules m WHERE m.device_id IN (SELECT id FROM devices WHERE bundle_id = ?)) as total_modules,
        (SELECT COUNT(*) FROM issues i WHERE i.device_id IN (SELECT id FROM devices WHERE bundle_id = ?)) as total_issues,
        (SELECT COUNT(*) FROM issues i WHERE i.device_id IN (SELECT id FROM devices WHERE bundle_id = ?) AND i.status = 'open') as open_issues,
        (SELECT COUNT(*) FROM device_documents dd WHERE dd.bundle_id = ?) as bundle_documents
    `;
    const statsResult = await query(statsQuery, [id, id, id, id]);

    res.json({
      success: true,
      data: {
        ...bundle,
        devices,
        stats: statsResult[0]
      }
    });
  } catch (error) {
    console.error('获取多合一设备详情失败:', error);
    res.status(500).json({ success: false, error: '获取多合一设备详情失败' });
  }
});

// 创建组合
router.post('/', [
  body('bundle_code').optional({ nullable: true }).isString(),
  body('name').optional({ nullable: true }).isString(),
  body('customer_id').notEmpty().isInt().withMessage('客户ID必填'),
  body('description').optional({ nullable: true }).isString(),
  body('remote_code').optional({ nullable: true }).isString(),
  body('password').optional({ nullable: true }).isString(),
  body('merchant_id').optional({ nullable: true }).isString(),
  body('merchant_password').optional({ nullable: true }).isString(),
  body('device_ids').optional().isArray().withMessage('device_ids 必须是数组'),
  body('new_devices').optional().isArray().withMessage('new_devices 必须是数组')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: '输入数据无效', details: errors.array() });
    }

    const { bundle_code, name, customer_id, description, remote_code, password, merchant_id, merchant_password, device_ids = [], new_devices = [] } = req.body;
    const totalCount = device_ids.length + new_devices.length;

    if (totalCount < 2 || totalCount > 5) {
      return res.status(400).json({ success: false, error: '多合一设备需要包含2-5台设备' });
    }

    // 生成多合一设备订单号：优先用提交的 bundle_code（订单号），否则自动生成 T- 前缀
    let finalCode = bundle_code && bundle_code.trim() ? bundle_code.trim() : `T-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 检查编号唯一性
    const existing = await query('SELECT id FROM device_bundles WHERE bundle_code = ?', [finalCode]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: `多合一设备订单号 "${finalCode}" 已存在` });
    }

    // 校验已有设备存在且属于同一客户
    if (device_ids.length > 0) {
      const deviceRows = await query(
        `SELECT id, customer_id, bundle_id FROM devices WHERE id IN (${device_ids.map(() => '?').join(',')})`,
        device_ids
      );

      if (deviceRows.length !== device_ids.length) {
        return res.status(400).json({ success: false, error: '部分设备不存在' });
      }

      for (const d of deviceRows) {
        if (d.customer_id !== parseInt(customer_id)) {
          return res.status(400).json({ success: false, error: '所有设备必须属于同一客户' });
        }
        if (d.bundle_id) {
          return res.status(400).json({ success: false, error: `设备 ${d.id} 已属于其他多合一设备` });
        }
      }
    }

    // 校验新设备信息
    const newDeviceIds = [];
    for (const nd of new_devices) {
      if (!nd.id || !nd.product_line_id) {
        return res.status(400).json({ success: false, error: '新增设备必须填写生产序列号和产品线' });
      }
      // 检查 ID 唯一
      const dup = await query('SELECT id FROM devices WHERE id = ?', [nd.id]);
      if (dup.length > 0) {
        return res.status(400).json({ success: false, error: `设备序列号 "${nd.id}" 已存在` });
      }
      if (device_ids.includes(nd.id) || newDeviceIds.includes(nd.id)) {
        return res.status(400).json({ success: false, error: `设备序列号 "${nd.id}" 重复` });
      }
      newDeviceIds.push(nd.id);
    }

    // 创建多合一设备、新增设备、绑定所有设备（事务）
    await transaction(async (connection) => {
      // 1. 创建多合一设备
      const [result] = await connection.execute(
        'INSERT INTO device_bundles (bundle_code, name, customer_id, description) VALUES (?, ?, ?, ?)',
        [finalCode, name || null, customer_id, description || null]
      );
      const bundleId = result.insertId;

      // 2. 创建新设备（继承多合一设备共享字段）
      const IDGenerator = require('../../id-generator');
      const idGenerator = new IDGenerator();

      for (const nd of new_devices) {
        const deviceId = nd.id;
        const deviceStatus = nd.status || '正常';

        // 生成 nickname
        let nickname = null;
        try {
          let customerName = '';
          let productShort = '';
          const cRows = await query('SELECT name FROM customers WHERE id = ?', [customer_id]);
          if (cRows.length > 0) customerName = cRows[0].name || '';
          if (nd.product_id) {
            const pRows = await query('SELECT short_name FROM products WHERE id = ?', [nd.product_id]);
            if (pRows.length > 0) productShort = pRows[0].short_name || '';
          }
          const digits = deviceId.replace(/\D/g, '');
          const idSuffix = digits.length >= 4 ? digits.slice(-4) : digits;
          if (customerName && productShort && idSuffix) {
            nickname = `${customerName}${productShort}${idSuffix}`;
          }
        } catch (e) {
          console.warn('生成设备俗称失败:', e.message);
        }

        await connection.execute(
          `INSERT INTO devices (id, name, nickname, device_code, product_line_id, product_id, customer_id, status, remote_code, password, merchant_id, merchant_password, bundle_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deviceId,
            finalCode,  // 订单号 = 多合一设备订单号
            nickname,
            nd.device_code || null,
            nd.product_line_id,
            nd.product_id || null,
            customer_id,
            deviceStatus,
            remote_code || null,
            password || null,
            merchant_id || null,
            merchant_password || null,
            bundleId,
            nd.notes || null
          ]
        );

        // 创建选配模块
        if (nd.module_type_ids && nd.module_type_ids.length > 0) {
          for (const typeId of nd.module_type_ids) {
            await connection.execute(
              'INSERT INTO modules (device_id, type_id) VALUES (?, ?)',
              [deviceId, typeId]
            );
          }
        }
      }

      // 3. 绑定已有设备并更新共享字段
      for (const deviceId of device_ids) {
        const updateFields = ['bundle_id = ?'];
        const updateValues = [bundleId];

        // 更新共享字段到已有设备
        updateFields.push('name = ?');
        updateValues.push(finalCode);  // 订单号 = 多合一设备订单号

        if (remote_code !== undefined && remote_code !== null) {
          updateFields.push('remote_code = ?');
          updateValues.push(remote_code);
        }
        if (password !== undefined && password !== null) {
          updateFields.push('password = ?');
          updateValues.push(password);
        }
        if (merchant_id !== undefined && merchant_id !== null) {
          updateFields.push('merchant_id = ?');
          updateValues.push(merchant_id);
        }
        if (merchant_password !== undefined && merchant_password !== null) {
          updateFields.push('merchant_password = ?');
          updateValues.push(merchant_password);
        }

        updateValues.push(deviceId);
        await connection.execute(
          `UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      res.status(201).json({
        success: true,
        message: '多合一设备创建成功',
        data: { id: bundleId, bundle_code: finalCode, name, customer_id, description, device_count: totalCount }
      });
    });

    // ── 飞书通知（异步，不阻塞响应）──
    const notifyItems = new_devices.filter(nd => Array.isArray(nd.notify_open_ids) && nd.notify_open_ids.length > 0);
    if (notifyItems.length > 0) {
      const feishuService = require('../services/feishu-service');
      notifyItems.forEach(nd => {
        query(
          `SELECT d.*, pl.name as product_line_name, p.model as product_model, c.name as customer_name
           FROM devices d
           LEFT JOIN product_lines pl ON d.product_line_id = pl.id
           LEFT JOIN products p ON d.product_id = p.id
           LEFT JOIN customers c ON d.customer_id = c.id
           WHERE d.id = ?`,
          [nd.id]
        ).then(rows => {
          if (rows[0]) {
            // 每台设备只发一条消息，同时 @ 所有相关人员
            feishuService.sendDeviceNotification(rows[0], nd.notify_open_ids);
          }
        }).catch(() => {});
      });
    }
  } catch (error) {
    console.error('创建多合一设备失败:', error);
    res.status(500).json({ success: false, error: '创建多合一设备失败' });
  }
});

// 更新多合一设备
router.put('/:id', [
  body('name').optional({ nullable: true }).isString(),
  body('bundle_code').optional({ nullable: true }).isString(),
  body('description').optional({ nullable: true }).isString(),
  body('remote_code').optional({ nullable: true }).isString(),
  body('password').optional({ nullable: true }).isString(),
  body('merchant_id').optional({ nullable: true }).isString(),
  body('merchant_password').optional({ nullable: true }).isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: '输入数据无效', details: errors.array() });
    }

    const { id } = req.params;
    const { name, bundle_code, description } = req.body;
    const remote_code = req.body.remote_code !== undefined ? (req.body.remote_code?.trim() || null) : undefined;
    const password = req.body.password !== undefined ? (req.body.password?.trim() || null) : undefined;
    const merchant_id = req.body.merchant_id !== undefined ? (req.body.merchant_id?.trim() || null) : undefined;
    const merchant_password = req.body.merchant_password !== undefined ? (req.body.merchant_password?.trim() || null) : undefined;

    const existing = await query('SELECT id FROM device_bundles WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '多合一设备不存在' });
    }

    // 如果更新编号，检查唯一性
    if (bundle_code !== undefined) {
      const codeExists = await query('SELECT id FROM device_bundles WHERE bundle_code = ? AND id != ?', [bundle_code, id]);
      if (codeExists.length > 0) {
        return res.status(400).json({ success: false, error: `多合一设备订单号 "${bundle_code}" 已被使用` });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
    if (bundle_code !== undefined) { updateFields.push('bundle_code = ?'); updateValues.push(bundle_code); }
    if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await query(`UPDATE device_bundles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, updateValues);
    }

    // 更新所有成员设备的共享字段（远程码、密码、商户号、商户密码）
    if (remote_code !== undefined || password !== undefined || merchant_id !== undefined || merchant_password !== undefined) {
      const devUpdateFields = [];
      const devUpdateValues = [];
      if (remote_code !== undefined) { devUpdateFields.push('remote_code = ?'); devUpdateValues.push(remote_code || null); }
      if (password !== undefined) { devUpdateFields.push('password = ?'); devUpdateValues.push(password || null); }
      if (merchant_id !== undefined) { devUpdateFields.push('merchant_id = ?'); devUpdateValues.push(merchant_id || null); }
      if (merchant_password !== undefined) { devUpdateFields.push('merchant_password = ?'); devUpdateValues.push(merchant_password || null); }
      if (devUpdateFields.length > 0) {
        devUpdateValues.push(id);
        await query(`UPDATE devices SET ${devUpdateFields.join(', ')} WHERE bundle_id = ?`, devUpdateValues);
      }
    }

    res.json({ success: true, message: '多合一设备更新成功' });
  } catch (error) {
    console.error('更新多合一设备失败:', error);
    res.status(500).json({ success: false, error: '更新多合一设备失败' });
  }
});

// 删除多合一设备（解绑设备，不删除设备本身）
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT id FROM device_bundles WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '多合一设备不存在' });
    }

    await transaction(async (connection) => {
      // 解绑设备
      await connection.execute('UPDATE devices SET bundle_id = NULL WHERE bundle_id = ?', [id]);
      // 删除多合一设备级文档
      await connection.execute('DELETE FROM device_documents WHERE bundle_id = ?', [id]);
      // 删除多合一设备
      await connection.execute('DELETE FROM device_bundles WHERE id = ?', [id]);
    });

    res.json({ success: true, message: '多合一设备已删除' });
  } catch (error) {
    console.error('删除多合一设备失败:', error);
    res.status(500).json({ success: false, error: '删除多合一设备失败' });
  }
});

// 添加设备到多合一设备
router.post('/:id/devices', [
  body('device_id').notEmpty().isString().withMessage('设备ID必填')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: '输入数据无效', details: errors.array() });
    }

    const bundleId = req.params.id;
    const { device_id } = req.body;

    // 检查多合一设备存在
    const bundle = await query('SELECT id, customer_id FROM device_bundles WHERE id = ?', [bundleId]);
    if (bundle.length === 0) {
      return res.status(404).json({ success: false, error: '多合一设备不存在' });
    }

    // 检查多合一设备数量上限
    const countResult = await query('SELECT COUNT(*) as cnt FROM devices WHERE bundle_id = ?', [bundleId]);
    if (countResult[0].cnt >= 5) {
      return res.status(400).json({ success: false, error: '多合一设备最多包含5台设备' });
    }

    // 检查设备存在且未绑定
    const device = await query('SELECT id, customer_id, bundle_id FROM devices WHERE id = ?', [device_id]);
    if (device.length === 0) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }
    if (device[0].bundle_id) {
      return res.status(400).json({ success: false, error: '该设备已属于其他多合一设备' });
    }
    if (device[0].customer_id !== bundle[0].customer_id) {
      return res.status(400).json({ success: false, error: '设备与多合一设备不属于同一客户' });
    }

    await query('UPDATE devices SET bundle_id = ? WHERE id = ?', [bundleId, device_id]);

    res.json({ success: true, message: '设备已添加到多合一设备' });
  } catch (error) {
    console.error('添加设备到多合一设备失败:', error);
    res.status(500).json({ success: false, error: '添加设备到多合一设备失败' });
  }
});

// 从多合一设备移除设备
router.delete('/:id/devices/:deviceId', async (req, res) => {
  try {
    const { id, deviceId } = req.params;

    const device = await query('SELECT id, bundle_id FROM devices WHERE id = ? AND bundle_id = ?', [deviceId, id]);
    if (device.length === 0) {
      return res.status(404).json({ success: false, error: '该设备不在此多合一设备中' });
    }

    // 检查移除后多合一设备是否至少还有1台设备（允许剩1台,用户可以后续删除多合一设备）
    await query('UPDATE devices SET bundle_id = NULL WHERE id = ?', [deviceId]);

    res.json({ success: true, message: '设备已从多合一设备移除' });
  } catch (error) {
    console.error('从多合一设备移除设备失败:', error);
    res.status(500).json({ success: false, error: '从多合一设备移除设备失败' });
  }
});

module.exports = router;
