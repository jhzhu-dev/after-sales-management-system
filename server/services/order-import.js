const xlsx = require('xlsx');

function clean(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\r?\n/g, ' ').trim();
}

// 从产品明细全名中提取型号代码（如 TSD-PV-UG-2010）
function extractModel(fullName) {
  const tokens = clean(fullName).split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (/^[A-Z0-9][A-Z0-9_-]{2,}$/i.test(t) && /-/.test(t)) return t.toUpperCase();
  }
  return '';
}

/**
 * 解析订单信息表（Sheet1），还原订单 + 设备 + 客户 + 商户信息。
 * 针对“订单信息表”模板：订单头 + 产品明细 + 客户信息 + 产品信息-软件（设备编码）。
 */
function parseOrderExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  const order = {
    orderNo: '',
    orderName: '',
    sendTime: '',
    planShip: '',
    transport: '',
    packaging: '',
    battery: '',
    customer: { name: '', country: '', contact: '', address: '', email: '', usage: '', install: '' },
    merchantId: '',
    loginEmail: '',
    loginPassword: '',
    note: '',
    devices: [],
    deviceCodes: [],
  };

  // 找到订单信息区（含“订单号”标签）
  let orderStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i] && rows[i][1]).includes('订单号')) { orderStart = i; break; }
  }
  if (orderStart < 0) return order;

  // 订单数据行直到“客户信息”为止
  for (let i = orderStart + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (clean(r[0]).includes('客户信息')) break;
    if (!clean(r[1]) && !clean(r[3]) && !clean(r[4])) continue;

    // 订单头字段（首次）
    if (!order.orderNo && clean(r[1])) {
      order.orderNo = clean(r[1]);
      order.orderName = clean(r[3]);
      order.sendTime = clean(r[8]);
      order.planShip = clean(r[9]);
      order.transport = clean(r[11]);
      order.packaging = clean(r[14]);
      order.battery = clean(r[13]);
    }

    // 产品明细行：第4列有产品名
    if (clean(r[4])) {
      order.devices.push({
        fullName: clean(r[4]),
        model: extractModel(clean(r[4])),
        quantity: parseInt(clean(r[7])) || 1,
      });
    }
  }

  // 客户信息区（含“客户信息”）
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i] && rows[i][0]).includes('客户信息')) {
      for (let j = i + 1; j < rows.length; j++) {
        const r = rows[j] || [];
        if (clean(r[0]).includes('货款情况')) break;
        // 客户/代理名称（售后登记名称）在第1列
        if (!order.customer.name && clean(r[1])) {
          order.customer.name = clean(r[1]);
          order.customer.country = clean(r[3]);
          order.customer.usage = clean(r[11]);
          order.customer.install = clean(r[13]);
        }
        // 联系人/公司/地址/邮箱 连续行
        const line = clean(r[5]) || clean(r[6]);
        if (line) {
          if (line.includes('联系人')) order.customer.contact = line.replace(/联系人[:：]?/, '').trim();
          else if (line.includes('公司名称')) order.customer.company = line.replace(/公司名称[:：]?/, '').trim();
          else if (line.includes('地址')) order.customer.address = line.replace(/地址[:：]?/, '').trim();
          else if (line.includes('邮箱') || /@/.test(line)) order.customer.email = line.replace(/.*[:：]?/, '').trim();
          else if (line.includes('联系方式')) order.customer.contact = line.replace(/联系方式[:：]?/, '').trim();
        }
      }
      break;
    }
  }

  // 产品信息-软件区：商户号 + 设备编码
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i] && rows[i][0]).includes('产品信息-软件')) {
      for (let j = i; j < rows.length; j++) {
        const r = rows[j] || [];
        if (j > i && clean(r[0]).includes('出货信息')) break;
        const label = clean(r[1]).replace(/\s+/g, '');
        if (label === '商户号') order.merchantId = clean(r[2]);
        if (label === '登录邮箱') order.loginEmail = clean(r[2]);
        if (label === '初始密码') order.loginPassword = clean(r[2]);
        // 设备编码（A列：产品名称=col5, 编码=col6）
        const c5 = clean(r[5]);
        const c6 = clean(r[6]);
        if (c5 && c6 && !c5.includes('产品名称') && !c6.includes('设备编码')) {
          order.deviceCodes.push({ name: c5, code: c6 });
        }
        // 设备编码（B列：产品名称=col10, 编码=col11）
        const c10 = clean(r[10]);
        const c11 = clean(r[11]);
        if (c10 && c11 && !c10.includes('产品名称') && !c11.includes('设备编码')) {
          order.deviceCodes.push({ name: c10, code: c11 });
        }
      }
      break;
    }
  }

  // 其他备注
  for (const r of rows) {
    if (clean(r[0]).includes('其他备注')) {
      order.note = clean(r[1]);
      break;
    }
  }

  return order;
}

// 关键词重合度评分（用于设备编码匹配）
function matchScore(a, b) {
  const x = clean(a);
  const y = clean(b);
  if (!x || !y) return 0;
  let score = 0;
  const chars = y.replace(/\s+/g, '');
  for (const ch of chars) {
    if (/[\u4e00-\u9fa5A-Za-z0-9]/.test(ch) && x.includes(ch)) score += 1;
  }
  if (y.length > 1 && x.includes(y)) score += 20;
  else if (/[\u4e00-\u9fa5]/.test(y) && y.split(/\s+/).every((w) => w.length <= 2 || x.includes(w))) score += 5;
  return score;
}

// 从产品标准化名称 / 全名中挑选最匹配的设备编码
function matchDeviceCode(deviceCodes, productShortName, productName, fullName) {
  const candidates = [productShortName, productName, fullName].filter(Boolean);
  let best = '';
  let bestScore = 0;
  for (const dc of deviceCodes) {
    for (const cand of candidates) {
      const score = matchScore(cand, dc.name);
      if (score > bestScore) { bestScore = score; best = dc.code; }
    }
  }
  return best;
}

module.exports = { parseOrderExcel, extractModel, matchScore, matchDeviceCode };
