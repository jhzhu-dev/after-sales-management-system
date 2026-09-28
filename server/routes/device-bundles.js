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
        CASE
          WHEN COUNT(DISTINCT d.id) = 0 THEN '生产中'
          WHEN SUM(CASE WHEN d.status = '使用中(异常)' THEN 1 ELSE 0 END) > 0 THEN '使用中(异常)'
          WHEN SUM(CASE WHEN d.status = '已发货' THEN 1 ELSE 0 END) > 0 THEN '已发货'
          WHEN SUM(CASE WHEN d.status = '生产中' THEN 1 ELSE 0 END) > 0 THEN '生产中'
          WHEN COUNT(DISTINCT d.id) = SUM(CASE WHEN d.status = '已停用' THEN 1 ELSE 0 END) THEN '已停用'
          ELSE '使用中(正常)'
        END as bundle_status,
        COUNT(DISTINCT d.id) as device_count,
        (SELECT COUNT(*) FROM device_documents dd WHERE dd.bundle_id = b.id) as document_count,
        (SELECT d2.remote_code FROM devices d2 WHERE d2.bundle_id = b.id AND d2.remote_code IS NOT NULL LIMIT 1) as remote_code,
        (SELECT COUNT(*) FROM devices d4 WHERE d4.bundle_id = b.id AND d4.is_primary = 1 AND d4.remote_code IS NOT NULL) as primary_count,
        (SELECT GROUP_CONCAT(d5.remote_code SEPARATOR ',') FROM devices d5 WHERE d5.bundle_id = b.id AND d5.is_primary = 1 AND d5.remote_code IS NOT NULL) as primary_remote_codes,
        (SELECT GROUP_CONCAT(d6.remote_code SEPARATOR ',') FROM devices d6 JOIN product_lines pl6 ON d6.product_line_id = pl6.id WHERE d6.bundle_id = b.id AND pl6.name LIKE '%龙门%' AND d6.remote_code IS NOT NULL) as longmen_remote_codes,
        (SELECT d2.merchant_id FROM devices d2 WHERE d2.bundle_id = b.id AND d2.merchant_id IS NOT NULL LIMIT 1) as merchant_id,
        (SELECT d2.merchant_password FROM devices d2 WHERE d2.bundle_id = b.id AND d2.merchant_password IS NOT NULL LIMIT 1) as merchant_password,
        (SELECT COUNT(*) FROM issues i WHERE i.device_id IN (SELECT d3.id FROM devices d3 WHERE d3.bundle_id = b.id) AND i.status = 'open') as open_issues,
        GROUP_CONCAT(DISTINCT d.id ORDER BY d.id SEPARATOR ',') as device_ids,
        GROUP_CONCAT(DISTINCT d.name ORDER BY d.id SEPARATOR ',') as device_names,
        GROUP_CONCAT(DISTINCT d.nickname ORDER BY d.id SEPARATOR ',') as device_nicknames,
        GROUP_CONCAT(p.name ORDER BY d.id SEPARATOR ',') as device_product_names
      FROM device_bundles b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN devices d ON d.bundle_id = b.id
      LEFT JOIN products p ON d.product_id = p.id
      ${whereClause}
      GROUP BY b.id
      ORDER BY b.bundle_code DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limitNum, offset);

    const bundles = await query(bundlesQuery, params);

    // 远程码展示规则：优先主设备远程码；否则用龙门设备；都为空则无
    bundles.forEach((b) => {
      const hasPrimary = Number(b.primary_count) > 0;
      const primaryCodes = b.primary_remote_codes ? String(b.primary_remote_codes).split(',') : [];
      const longmenCodes = b.longmen_remote_codes ? String(b.longmen_remote_codes).split(',') : [];
      const remoteCodes = hasPrimary ? primaryCodes : longmenCodes;
      b.remote_codes = remoteCodes;
      b.primary_set = hasPrimary;
      b.remote_code = remoteCodes[0] || null;
    });

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

    // 远程码展示规则：优先主设备；否则用龙门设备；都没有则提示设置主设备
    const primaryDevices = devices.filter(d => Number(d.is_primary) === 1 && d.remote_code);
    const longMenDevices = devices.filter(d => (d.product_line_name || '').includes('龙门') && d.remote_code);
    const remoteCodes = primaryDevices.length > 0
      ? primaryDevices.map(d => d.remote_code)
      : longMenDevices.length > 0
        ? longMenDevices.map(d => d.remote_code)
        : [];
    bundle.remote_code = remoteCodes[0] || null;
    bundle.remote_codes = remoteCodes;
    bundle.primary_set = primaryDevices.length > 0;

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

// 多合一设备发货：出厂资料完善且全部成员为「生产中」时，将全部成员置为已发货
router.post('/:id/ship', async (req, res) => {
  try {
    const { id } = req.params;
    const bundleResult = await query('SELECT id, factory_docs_complete FROM device_bundles WHERE id = ?', [id]);
    const bundle = bundleResult[0];
    if (!bundle) {
      return res.status(404).json({ success: false, error: '多合一设备不存在' });
    }
    const docsComplete = bundle.factory_docs_complete === true
      || bundle.factory_docs_complete === 1
      || bundle.factory_docs_complete === '1';
    if (!docsComplete) {
      return res.status(400).json({ success: false, error: '出厂资料未完善，无法发货' });
    }
    const members = await query('SELECT id, status FROM devices WHERE bundle_id = ?', [id]);
    if (members.length === 0) {
      return res.status(400).json({ success: false, error: '该多合一设备下没有成员设备' });
    }
    const notProduction = members.filter(d => d.status !== '生产中');
    if (notProduction.length > 0) {
      return res.status(400).json({
        success: false,
        error: `存在非「生产中」状态的成员设备，无法发货：${notProduction.map(d => d.id).join('、')}`
      });
    }
    await transaction(async (conn) => {
      for (const member of members) {
        await conn.execute(
          `UPDATE devices SET status = '已发货', shipped_at = NOW(), updated_at = NOW() WHERE id = ?`,
          [member.id]
        );
      }
    });

    // ── 飞书催填版本号通知（异步，整箱一条消息，不阻塞响应）──
    const { notify_open_ids } = req.body;
    const recipientIds = Array.isArray(notify_open_ids) ? notify_open_ids.filter(Boolean) : [];
    if (recipientIds.length > 0) {
      const feishuService = require('../services/feishu-service');
      feishuService.sendBundleShipNotification(bundle, members.map(m => m.id), recipientIds);
    }

    res.json({ success: true, message: `多合一设备已发货，共 ${members.length} 台设备已标记为已发货` });
  } catch (error) {
    console.error('多合一设备发货失败:', error);
    res.status(500).json({ success: false, error: '多合一设备发货失败' });
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
    const newDeviceCodes = [];
    for (const nd of new_devices) {
      nd.id = typeof nd.id === 'string' ? nd.id.trim() : nd.id;
      nd.device_code = typeof nd.device_code === 'string' ? nd.device_code.trim() : nd.device_code;
      if (!nd.id || !nd.product_line_id) {
        return res.status(400).json({ success: false, error: '新增设备必须填写生产序列号和产品线' });
      }
      if (nd.id.length > 50) {
        return res.status(400).json({ success: false, error: `设备序列号 "${nd.id}" 长度不能超过50个字符` });
      }
      // 检查 ID 唯一
      const dup = await query('SELECT id FROM devices WHERE id = ?', [nd.id]);
      if (dup.length > 0) {
        return res.status(400).json({ success: false, error_code: 'DEVICE_ID_DUPLICATED', error: `设备序列号 "${nd.id}" 已存在，请勿重复录入` });
      }
      if (device_ids.includes(nd.id) || newDeviceIds.includes(nd.id)) {
        return res.status(400).json({ success: false, error: `设备序列号 "${nd.id}" 在本次提交中重复` });
      }
      newDeviceIds.push(nd.id);
      // 产品线存在性校验
      const plRows = await query('SELECT id FROM product_lines WHERE id = ?', [nd.product_line_id]);
      if (plRows.length === 0) {
        return res.status(400).json({ success: false, error: `设备 ${nd.id} 的产品线不存在，请刷新后重试` });
      }
      // 产品型号存在性校验
      if (nd.product_id) {
        const pRows = await query('SELECT id FROM products WHERE id = ?', [nd.product_id]);
        if (pRows.length === 0) {
          return res.status(400).json({ success: false, error: `设备 ${nd.id} 的产品型号不存在，请刷新后重试` });
        }
      }
      // 设备编码唯一性校验（库内 + 本次提交内）
      if (nd.device_code) {
        const dupCode = await query('SELECT id FROM devices WHERE device_code = ?', [nd.device_code]);
        if (dupCode.length > 0) {
          return res.status(400).json({ success: false, error_code: 'DEVICE_CODE_DUPLICATED', error: `设备编码 "${nd.device_code}" 已被设备 ${dupCode[0].id} 使用（设备 ${nd.id}），请勿重复录入` });
        }
        if (newDeviceCodes.includes(nd.device_code)) {
          return res.status(400).json({ success: false, error: `设备编码 "${nd.device_code}" 在本次提交中重复` });
        }
        newDeviceCodes.push(nd.device_code);
      }
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
    if (error.code === 'ER_DUP_ENTRY') {
      const sqlMessage = String(error.sqlMessage || '');
      let friendly = '提交的数据与已有记录冲突，请检查序列号、设备编码、订单号是否重复';
      if (sqlMessage.includes("'PRIMARY'")) {
        friendly = '设备序列号已存在，请勿重复录入';
      } else if (sqlMessage.includes('unique_bundle_code')) {
        friendly = `多合一设备订单号 "${finalCode}" 已存在`;
      } else if (sqlMessage.includes('unique_device_module')) {
        friendly = '同一设备的模块类型重复，请调整选配模块后重试';
      }
      return res.status(400).json({ success: false, error: friendly });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, error: '关联的客户、产品线或产品型号不存在，请刷新页面后重试' });
    }
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
  body('merchant_password').optional({ nullable: true }).isString(),
  body('customer_id').optional().isInt().withMessage('客户ID必须是整数')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: '输入数据无效', details: errors.array() });
    }

    const { id } = req.params;
    const { name, bundle_code, description } = req.body;
    const customer_id = req.body.customer_id !== undefined ? parseInt(req.body.customer_id, 10) : undefined;
    const remote_code = req.body.remote_code !== undefined ? (req.body.remote_code?.trim() || null) : undefined;
    const password = req.body.password !== undefined ? (req.body.password?.trim() || null) : undefined;
    const merchant_id = req.body.merchant_id !== undefined ? (req.body.merchant_id?.trim() || null) : undefined;
    const merchant_password = req.body.merchant_password !== undefined ? (req.body.merchant_password?.trim() || null) : undefined;

    const existing = await query('SELECT id, customer_id FROM device_bundles WHERE id = ?', [id]);
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

    if (customer_id !== undefined) {
      const customerRows = await query('SELECT id FROM customers WHERE id = ?', [customer_id]);
      if (customerRows.length === 0) {
        return res.status(400).json({ success: false, error: '客户不存在' });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
    if (bundle_code !== undefined) { updateFields.push('bundle_code = ?'); updateValues.push(bundle_code); }
    if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
    if (customer_id !== undefined) { updateFields.push('customer_id = ?'); updateValues.push(customer_id); }

    if (req.body.factory_docs_complete !== undefined) {
      const complete = req.body.factory_docs_complete === true || req.body.factory_docs_complete === 1 || req.body.factory_docs_complete === '1';
      updateFields.push('factory_docs_complete = ?');
      updateValues.push(complete ? 1 : 0);
      updateFields.push('factory_docs_completed_at = ?');
      updateValues.push(complete ? new Date() : null);
      updateFields.push('factory_docs_completed_by = ?');
      updateValues.push(complete ? (req.body.factory_docs_completed_by || null) : null);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await query(`UPDATE device_bundles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, updateValues);
    }

    // 客户变更时，同步所有成员设备的 customer_id 并更新 nickname 中的客户名
    const oldCustomerId = existing[0].customer_id;
    if (customer_id !== undefined && customer_id !== oldCustomerId) {
      await query('UPDATE devices SET customer_id = ? WHERE bundle_id = ?', [customer_id, id]);
      try {
        const oldCustRows = await query('SELECT name FROM customers WHERE id = ?', [oldCustomerId]);
        const newCustRows = await query('SELECT name FROM customers WHERE id = ?', [customer_id]);
        if (oldCustRows.length > 0 && newCustRows.length > 0) {
          await query(
            'UPDATE devices SET nickname = REPLACE(nickname, ?, ?) WHERE bundle_id = ? AND nickname IS NOT NULL',
            [oldCustRows[0].name, newCustRows[0].name, id]
          );
        }
      } catch (e) {
        console.warn('更新成员设备nickname客户名失败:', e.message);
      }
    }

    // 更新所有成员设备的共享字段（远程码、密码）
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

    // 出厂资料完善不再自动置为已发货：发货统一走「发货」按钮（POST /:id/ship），
    // 以便在发货确认弹窗中选择飞书催填版本号通知人
    res.json({
      success: true,
      message: '多合一设备更新成功'
    });
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
