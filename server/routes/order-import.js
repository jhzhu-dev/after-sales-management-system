const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../database');
const { parseOrderExcel, matchDeviceCode } = require('../services/order-import');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function fail(res, status, error) {
  return res.status(status).json({ success: false, error });
}

function shortNameFromName(name) {
  const n = (name || '').trim();
  const idx = n.indexOf('-');
  if (idx >= 0 && idx < n.length - 1) return n.slice(idx + 1).trim() || n;
  return n;
}

// POST /api/orders-import/preview
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, '请上传 Excel 文件');

    const tmpPath = path.join(require('os').tmpdir(), `order-import-${Date.now()}.xlsx`);
    fs.writeFileSync(tmpPath, req.file.buffer);
    let order;
    try {
      order = parseOrderExcel(tmpPath);
    } finally {
      fs.unlinkSync(tmpPath);
    }

    if (!order.orderNo) return fail(res, 400, '未能识别订单号，请确认上传的是订单信息表');

    // 载入产品 / 客户
    const products = await query('SELECT id, product_line_id, name, short_name, model FROM products');
    const customers = await query('SELECT id, name, short_name FROM customers');

    const productsByModel = new Map();
    for (const p of products) {
      const m = (p.model || '').trim().toUpperCase();
      if (!m) continue;
      if (!productsByModel.has(m)) productsByModel.set(m, []);
      productsByModel.get(m).push(p);
    }

    const customersByName = new Map();
    const customersByShort = new Map();
    for (const c of customers) {
      customersByName.set(c.name.trim(), c);
      customersByShort.set(c.short_name.trim().toLowerCase(), c);
    }

    // 客户匹配
    const cName = (order.customer.name || '').trim();
    let customerMatch = {
      status: 'missing',
      name: cName,
      short_name: shortNameFromName(cName),
      country: order.customer.country || '',
      contact: order.customer.contact || '',
      address: order.customer.address || '',
      email: order.customer.email || '',
      usage: order.customer.usage || '',
      install: order.customer.install || '',
      id: null,
    };
    if (cName) {
      const exact = customersByName.get(cName);
      if (exact) {
        customerMatch.status = 'exact';
        customerMatch.id = exact.id;
      } else {
        const byShort = customersByShort.get(customerMatch.short_name.toLowerCase());
        if (byShort) {
          customerMatch.status = 'short';
          customerMatch.id = byShort.id;
        } else {
          customerMatch.status = 'new';
        }
      }
    }

    // 设备解析
    const devices = [];
    for (const dev of order.devices) {
      const model = (dev.model || '').toUpperCase();
      const hits = model ? productsByModel.get(model) || [] : [];
      let product = null;
      let status = 'unknown';
      if (model && hits.length === 1) {
        product = hits[0];
        status = 'resolved';
      } else if (hits.length > 1) {
        status = 'ambiguous';
      } else if (!model) {
        status = 'missing_model';
      }
      devices.push({
        fullName: dev.fullName,
        model: dev.model,
        quantity: dev.quantity,
        device_code: product ? matchDeviceCode(order.deviceCodes, product.short_name, product.name, dev.fullName) : (dev.device_code || ''),
        serial: '',
        status,
        product_id: product ? product.id : null,
        product_line_id: product ? product.product_line_id : null,
        product_name: product ? product.name : '',
        product_short_name: product ? product.short_name : '',
        product_model: model,
      });
    }

    res.json({
      success: true,
      data: {
        orderNo: order.orderNo,
        orderName: order.orderName,
        sendTime: order.sendTime,
        planShip: order.planShip,
        transport: order.transport,
        packaging: order.packaging,
        battery: order.battery,
        merchantId: order.merchantId,
        note: order.note,
        customer: customerMatch,
        devices,
      },
    });
  } catch (error) {
    console.error('解析订单表失败:', error);
    fail(res, 500, '解析订单表失败');
  }
});

module.exports = router;
