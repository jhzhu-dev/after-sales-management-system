const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database');
const router = express.Router();

// ─── 枚举常量（预设建议项；除运输方式固定外，其余字段均允许用户自定义输入，长度 ≤50） ──
const TRANSPORT_MODES = ['海运', '空运', '陆运'];

const ALLOWED_SORT = ['id', 'order_no', 'plan_ship_date', 'actual_ship_date', 'transport_mode', 'created_at', 'updated_at'];

function fail(res, status, error, details) {
  return res.status(status).json({ success: false, error, ...(details ? { details } : {}) });
}

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

// 订单号 → 关联设备（单台：devices.name = 订单号；多合一：bundle_code = 订单号）
// 注意：conn（事务内连接）的 query 返回 [rows, fields] 元组，pool 封装的 query 返回 rows
async function getOrderDevices(orderNo, conn = null) {
  const sql = `SELECT d.id, d.name, d.notes, d.status, d.factory_docs_complete, d.shipped_at,
                      b.bundle_code, b.id AS bundle_id_val
     FROM devices d
     LEFT JOIN device_bundles b ON d.bundle_id = b.id
     WHERE d.name = ? OR b.bundle_code = ?
     ORDER BY d.id`;
  if (conn) {
    const [rows] = await conn.query(sql, [orderNo, orderNo]);
    return rows || [];
  }
  return query(sql, [orderNo, orderNo]);
}

function docsComplete(v) {
  return v === true || v === 1 || v === '1';
}

function canShipDevice(d) {
  if (d.status === '已发货') return { ok: false, reason: '已是已发货状态' };
  if (d.status !== '生产中') return { ok: false, reason: `状态为「${d.status}」，仅「生产中」可发货` };
  if (!docsComplete(d.factory_docs_complete)) return { ok: false, reason: '出厂资料未完善' };
  return { ok: true, reason: '' };
}

// 将订单下可发货设备置为已发货（复用设备/多合一发货的同一套校验）
async function shipOrderDevices(orderNo, conn) {
  const devices = await getOrderDevices(orderNo, conn);
  const shipped = [];
  const skipped = [];
  for (const d of devices) {
    const check = canShipDevice(d);
    if (!check.ok) {
      skipped.push({ id: d.id, name: d.name, status: d.status, reason: check.reason });
      continue;
    }
    await conn.query(
      `UPDATE devices SET status = '已发货', shipped_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [d.id]
    );
    shipped.push({ id: d.id, name: d.name });
  }
  return { shipped, skipped };
}

// ─── 保存字段组装（部分更新：仅 body 中出现的字段生效） ───────────────────────
const DATE_FIELDS = ['plan_ship_date', 'actual_ship_date'];
const TEXT_FIELDS = ['transport_mode', 'packing_method', 'logistics_type', 'logistics_company', 'logistics_no'];const TEXT_LABELS = {
  transport_mode: '运输方式',
  packing_method: '包装方式',
  logistics_type: '物流方式',
  logistics_company: '物流公司',
  logistics_no: '车牌/运单号',
};const MAX_TEXT_LEN = { transport_mode: 50, packing_method: 100, logistics_type: 50, logistics_company: 100, logistics_no: 100 };

function buildMainFields(body, forInsert) {
  const fields = {};
  if (forInsert || body.customer_id !== undefined) fields.customer_id = body.customer_id || null;
  if (forInsert || body.bundle_id !== undefined) fields.bundle_id = body.bundle_id || null;
  for (const f of DATE_FIELDS) {
    if (forInsert || body[f] !== undefined) {
      fields[f] = isBlank(body[f]) ? null : String(body[f]).slice(0, 10);
    }
  }
  for (const f of TEXT_FIELDS) {
    if (forInsert || body[f] !== undefined) {
      const v = isBlank(body[f]) ? null : String(body[f]).trim();
      if (v && v.length > MAX_TEXT_LEN[f]) throw new Error(`${TEXT_LABELS[f]}长度不能超过${MAX_TEXT_LEN[f]}个字符`);
      fields[f] = v;
    }
  }
  if (forInsert || body.battery_removed !== undefined) {
    fields.battery_removed = body.battery_removed === true || body.battery_removed === 1 || body.battery_removed === '1' ? 1 : 0;
  }
  if (forInsert || body.remark !== undefined) {
    const v = isBlank(body.remark) ? null : String(body.remark).trim();
    if (v && v.length > 5000) throw new Error('备注长度不能超过5000个字符');
    fields.remark = v;
  }
  if (forInsert || body.updated_by !== undefined) fields.updated_by = isBlank(body.updated_by) ? null : String(body.updated_by).trim();
  return fields;
}

function normalizeBatteries(list) {
  if (!Array.isArray(list)) throw new Error('batteries 必须是数组');
  return list.map((b, i) => {
    const deviceType = String(b.device_type || '').trim();
    if (!deviceType) throw new Error(`第 ${i + 1} 行电池记录的设备类型不能为空`);
    if (deviceType.length > 50) throw new Error(`第 ${i + 1} 行设备类型过长`);
    const kind = isBlank(b.battery_kind) ? null : String(b.battery_kind).trim();
    if (kind && kind.length > 50) throw new Error(`第 ${i + 1} 行电池类别过长`);
    const handling = isBlank(b.handling) ? null : String(b.handling).trim();
    if (handling && handling.length > 50) throw new Error(`第 ${i + 1} 行处理方式过长`);
    const quantity = Number.isInteger(Number(b.quantity)) && Number(b.quantity) >= 1 ? Number(b.quantity) : 1;
    const remark = isBlank(b.remark) ? null : String(b.remark).trim();
    if (remark && remark.length > 255) throw new Error(`第 ${i + 1} 行电池备注过长`);
    return { device_type: deviceType, quantity, battery_kind: kind, handling, remark };
  });
}

function normalizePackages(list) {
  if (!Array.isArray(list)) throw new Error('packages 必须是数组');
  const num = (v) => {
    if (isBlank(v)) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error('包装规格的尺寸/重量必须是非负数字');
    return Math.round(n * 100) / 100;
  };
  return list.map((p, i) => {
    const label = isBlank(p.box_label) ? `箱${i + 1}` : String(p.box_label).trim().slice(0, 20);
    const remark = isBlank(p.remark) ? null : String(p.remark).trim();
    if (remark && remark.length > 255) throw new Error(`第 ${i + 1} 行箱规备注过长`);
    // 装入设备：生产序列号列表（去重；与订单下设备的交集在事务内校验）
    const rawIds = Array.isArray(p.device_ids) ? p.device_ids : [];
    const deviceIds = [...new Set(rawIds.map(x => String(x).trim()).filter(Boolean))];
    return {
      box_label: label,
      length_cm: num(p.length_cm),
      width_cm: num(p.width_cm),
      height_cm: num(p.height_cm),
      weight_kg: num(p.weight_kg),
      remark,
      device_ids: deviceIds,
    };
  });
}

async function replaceChildren(conn, logisticsId, batteries, packages) {
  if (Array.isArray(batteries)) {
    await conn.query('DELETE FROM order_logistics_batteries WHERE logistics_id = ?', [logisticsId]);
    for (const b of batteries) {
      await conn.query(
        `INSERT INTO order_logistics_batteries (logistics_id, device_type, quantity, battery_kind, handling, remark)
         VALUES (?,?,?,?,?,?)`,
        [logisticsId, b.device_type, b.quantity, b.battery_kind, b.handling, b.remark]
      );
    }
  }
  if (Array.isArray(packages)) {
    await conn.query('DELETE FROM order_logistics_packages WHERE logistics_id = ?', [logisticsId]);
    for (const p of packages) {
      await conn.query(
        `INSERT INTO order_logistics_packages (logistics_id, box_label, length_cm, width_cm, height_cm, weight_kg, remark, device_ids)
         VALUES (?,?,?,?,?,?,?,?)`,
        [logisticsId, p.box_label, p.length_cm, p.width_cm, p.height_cm, p.weight_kg, p.remark, JSON.stringify(p.device_ids || [])]
      );
    }
  }
}

// 箱规装入设备：仅保留订单下真实存在的设备（宽松交集，防止设备已删/已移出导致保存失败）
async function filterPackageDevices(orderNo, packages, conn) {
  if (!Array.isArray(packages) || packages.length === 0) return packages;
  const devices = await getOrderDevices(orderNo, conn);
  const valid = new Set(devices.map(d => String(d.id)));
  return packages.map(p => ({ ...p, device_ids: (p.device_ids || []).filter(id => valid.has(id)) }));
}

async function loadFull(id) {
  const rows = await query('SELECT * FROM order_logistics WHERE id = ?', [id]);
  if (!rows[0]) return null;
  const record = rows[0];
  record.batteries = await query('SELECT * FROM order_logistics_batteries WHERE logistics_id = ? ORDER BY id', [id]);
  record.packages = await query('SELECT * FROM order_logistics_packages WHERE logistics_id = ? ORDER BY id', [id]);
  return record;
}

// ─── 校验规则（运输方式固定三选；其余自由文本字段仅做长度限制） ────────────────────
const validateSave = [
  body('order_no').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('订单号长度不能超过255个字符'),
  body('transport_mode').optional({ nullable: true }).custom(v => isBlank(v) || TRANSPORT_MODES.includes(String(v).trim()) ? true : Promise.reject(`运输方式非法（允许：${TRANSPORT_MODES.join('/')}）`)),
];

// GET /api/order-logistics - 分页列表
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 10,
      keyword, transport_mode, logistics_type,
      ship_date_from, ship_date_to,
      sortBy = 'updated_at', sortOrder = 'DESC',
    } = req.query;

    const pageNum = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    const limitNum = Number.isInteger(parseInt(limit)) ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;
    const validSortBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'updated_at';
    const validSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where = [];
    const params = [];
    if (keyword) {
      where.push('(ol.order_no LIKE ? OR c.name LIKE ? OR c.short_name LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (transport_mode) { where.push('ol.transport_mode = ?'); params.push(transport_mode); }
    if (logistics_type) { where.push('ol.logistics_type = ?'); params.push(logistics_type); }
    if (ship_date_from) { where.push('ol.actual_ship_date >= ?'); params.push(ship_date_from); }
    if (ship_date_to) { where.push('ol.actual_ship_date <= ?'); params.push(ship_date_to); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
      `SELECT ol.*, c.name AS customer_name, c.short_name AS customer_short_name,
              (SELECT COUNT(*) FROM devices d LEFT JOIN device_bundles b ON d.bundle_id = b.id
                WHERE d.name = ol.order_no OR b.bundle_code = ol.order_no) AS device_count,
              (SELECT COUNT(*) FROM order_logistics_packages p WHERE p.logistics_id = ol.id) AS package_count,
              (SELECT SUM(p.weight_kg) FROM order_logistics_packages p WHERE p.logistics_id = ol.id) AS total_weight
       FROM order_logistics ol
       LEFT JOIN customers c ON c.id = ol.customer_id
       ${whereClause}
       ORDER BY ol.${validSortBy} ${validSortOrder}
       LIMIT ${parseInt(limitNum)} OFFSET ${parseInt(offset)}`,
      params
    );
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM order_logistics ol LEFT JOIN customers c ON c.id = ol.customer_id ${whereClause}`,
      params
    );
    res.json({ success: true, data: rows, total: countRows[0] ? countRows[0].total : 0, page: pageNum, pageSize: limitNum });
  } catch (error) {
    console.error('获取物流信息列表失败:', error);
    fail(res, 500, '获取物流信息列表失败');
  }
});

// GET /api/order-logistics/packing-methods - 历史使用过的包装方式（去重，供表单下拉建议）
router.get('/packing-methods', async (req, res) => {
  try {
    const rows = await query(
      `SELECT packing_method AS name, COUNT(*) AS count
       FROM order_logistics
       WHERE packing_method IS NOT NULL AND packing_method <> ''
       GROUP BY packing_method
       ORDER BY count DESC, packing_method`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取包装方式列表失败:', error);
    fail(res, 500, '获取包装方式列表失败');
  }
});

// GET /api/order-logistics/by-order/:orderNo - 按订单号取单条（详情页卡片）
router.get('/by-order/:orderNo', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM order_logistics WHERE order_no = ?', [req.params.orderNo]);
    if (!rows[0]) return fail(res, 404, '该订单尚未登记物流信息');
    const record = await loadFull(rows[0].id);
    const devices = await getOrderDevices(record.order_no);
    record.devices = devices.map((d) => {
      const check = canShipDevice(d);
      return { ...d, can_ship: check.ok, ship_block_reason: check.reason };
    });
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('获取订单物流信息失败:', error);
    fail(res, 500, '获取订单物流信息失败');
  }
});

// GET /api/order-logistics/ship-check/:orderNo - 发货核对（列出订单下设备与可发货状态）
router.get('/ship-check/:orderNo', async (req, res) => {
  try {
    const devices = await getOrderDevices(req.params.orderNo);
    const items = devices.map((d) => {
      const check = canShipDevice(d);
      return { id: d.id, name: d.name, status: d.status, bundle_code: d.bundle_code, can_ship: check.ok, reason: check.reason };
    });
    res.json({
      success: true,
      data: {
        order_no: req.params.orderNo,
        devices: items,
        shippable_count: items.filter(i => i.can_ship).length,
      },
    });
  } catch (error) {
    console.error('发货核对失败:', error);
    fail(res, 500, '发货核对失败');
  }
});

// POST /api/order-logistics - 登记（按订单号 upsert，可顺带发货）
router.post('/', validateSave, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, 400, errors.array()[0].msg);

  const orderNo = String(req.body.order_no || '').trim();
  if (!orderNo) return fail(res, 400, '订单号不能为空');
  if (orderNo.length > 255) return fail(res, 400, '订单号长度不能超过255个字符');

  let batteries = null;
  let packages = null;
  try {
    if (req.body.batteries !== undefined && req.body.batteries !== null) batteries = normalizeBatteries(req.body.batteries);
    if (req.body.packages !== undefined && req.body.packages !== null) packages = normalizePackages(req.body.packages);
  } catch (e) {
    return fail(res, 400, e.message);
  }

  try {
    const result = await transaction(async (conn) => {
      const existing = await conn.query('SELECT id FROM order_logistics WHERE order_no = ?', [orderNo]);
      let id;
      let created = false;
      if (existing[0] && existing[0][0]) {
        id = existing[0][0].id;
        const fields = buildMainFields(req.body, false);
        if (Object.keys(fields).length > 0) {
          const setSql = Object.keys(fields).map(k => `${k} = ?`).join(', ');
          await conn.query(`UPDATE order_logistics SET ${setSql} WHERE id = ?`, [...Object.values(fields), id]);
        }
      } else {
        created = true;
        const fields = buildMainFields(req.body, true);
        fields.order_no = orderNo;
        if (!fields.customer_id || !fields.bundle_id) {
          // 订单号补全客户/多合一关联（取订单下任一设备）
          const devs = await getOrderDevices(orderNo, conn);
          if (devs.length > 0) {
            const meta = await conn.query(
              `SELECT d.customer_id, d.bundle_id FROM devices d WHERE d.id = ?`,
              [devs[0].id]
            );
            const m = meta[0] && meta[0][0];
            if (m) {
              if (!fields.customer_id) fields.customer_id = m.customer_id || null;
              if (!fields.bundle_id) fields.bundle_id = m.bundle_id || null;
            }
          }
        }
        const cols = Object.keys(fields);
        const [ins] = await conn.query(
          `INSERT INTO order_logistics (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          Object.values(fields)
        );
        id = ins.insertId;
      }

      // 箱规装入设备与订单下设备取交集
      packages = await filterPackageDevices(orderNo, packages, conn);

      await replaceChildren(conn, id, batteries, packages);

      let shipResult = null;
      if (req.body.ship_devices === true) {
        shipResult = await shipOrderDevices(orderNo, conn);
      }
      return { id, created, shipResult };
    });

    const record = await loadFull(result.id);
    let message = result.created ? '物流信息登记成功' : '物流信息更新成功';
    if (result.shipResult) {
      message += `，已发货 ${result.shipResult.shipped.length} 台设备`;
      if (result.shipResult.skipped.length > 0) {
        message += `，${result.shipResult.skipped.length} 台未发货（${result.shipResult.skipped.map(s => `${s.name || s.id}:${s.reason}`).join('；')}）`;
      }
    }
    res.json({ success: true, data: record, ship_result: result.shipResult, message });
  } catch (error) {
    console.error('保存物流信息失败:', error);
    fail(res, error.message && /长度|非法|必须|不能/.test(error.message) ? 400 : 500, error.message || '保存物流信息失败');
  }
});

// PUT /api/order-logistics/:id - 更新（订单号不可变）
router.put('/:id', validateSave, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, 400, errors.array()[0].msg);

  try {
    const rows = await query('SELECT id, order_no FROM order_logistics WHERE id = ?', [req.params.id]);
    if (!rows[0]) return fail(res, 404, '物流信息不存在');
    const current = rows[0];

    let batteries = null;
    let packages = null;
    try {
      if (req.body.batteries !== undefined && req.body.batteries !== null) batteries = normalizeBatteries(req.body.batteries);
      if (req.body.packages !== undefined && req.body.packages !== null) packages = normalizePackages(req.body.packages);
    } catch (e) {
      return fail(res, 400, e.message);
    }

    const result = await transaction(async (conn) => {
      const fields = buildMainFields(req.body, false);
      // 更新时不改动关联（客户/多合一以订单下设备为准）
      delete fields.customer_id;
      delete fields.bundle_id;
      if (Object.keys(fields).length > 0) {
        const setSql = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        await conn.query(`UPDATE order_logistics SET ${setSql} WHERE id = ?`, [...Object.values(fields), current.id]);
      }
      packages = await filterPackageDevices(current.order_no, packages, conn);

      await replaceChildren(conn, current.id, batteries, packages);
      let shipResult = null;
      if (req.body.ship_devices === true) {
        shipResult = await shipOrderDevices(current.order_no, conn);
      }
      return shipResult;
    });

    const record = await loadFull(current.id);
    let message = '物流信息更新成功';
    if (result) {
      message += `，已发货 ${result.shipped.length} 台设备`;
      if (result.skipped.length > 0) {
        message += `，${result.skipped.length} 台未发货（${result.skipped.map(s => `${s.name || s.id}:${s.reason}`).join('；')}）`;
      }
    }
    res.json({ success: true, data: record, ship_result: result, message });
  } catch (error) {
    console.error('更新物流信息失败:', error);
    fail(res, error.message && /长度|非法|必须|不能/.test(error.message) ? 400 : 500, error.message || '更新物流信息失败');
  }
});

// DELETE /api/order-logistics/:id - 删除（订单下存在已发货设备时禁止，防止误删物流档案）
router.delete('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT id, order_no FROM order_logistics WHERE id = ?', [req.params.id]);
    if (!rows[0]) return fail(res, 404, '物流信息不存在');
    const devices = await getOrderDevices(rows[0].order_no);
    if (devices.some(d => d.status === '已发货')) {
      return fail(res, 400, '订单下存在已发货设备，不允许删除物流档案');
    }
    await query('DELETE FROM order_logistics WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '物流信息已删除' });
  } catch (error) {
    console.error('删除物流信息失败:', error);
    fail(res, 500, '删除物流信息失败');
  }
});

module.exports = router;
