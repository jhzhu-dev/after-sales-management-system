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
 * 解析订单信息表：自动识别旧版「订单信息表」与新版「订单评审信息表(20260923)」两种样式。
 */
function parseOrderExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  // 新版模板：优先在所有 sheet 中探测「售后登记系统名称 / 产品信息-硬件」等新样式标记
  for (const name of wb.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    if (isNewReviewTemplate(rows)) {
      return parseOrderReviewExcel(rows);
    }
  }
  const sheetName = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  return parseOrderLegacyExcel(rows);
}

// 是否为新版「订单评审信息表」样式
function isNewReviewTemplate(rows) {
  for (const r of rows) {
    const joined = (r || []).map(clean).join('|');
    if (joined.includes('售后登记系统名称') || joined.includes('-硬件-') || joined.includes('订单评审')) return true;
  }
  return false;
}

// 判断单元格文本是否是“标签/表头”而非填写值（新版模板所有标签都带冒号或是固定关键词）
const LABEL_KEYWORDS = [
  '产品明细', '数量', '计划发货时间', '电池是否需要取出', '货款情况', '是否全款', '预付款比例',
  '服务器', '上位机', '视觉器', '运输方式', '包装方式', '其他信息',
  '客户信息', '售后登记系统名称', '国家/区域', '使用场景', '安装场景',
  '联系人', '联系方式', '公司名称', '收货地址', '邮箱',
  '中文', '英文', '商户号', '登录密码', '登录邮箱', 'logo使用',
  '产品名称', '设备编码', '产品信息', '出货要求', '物流要求', '订单补充', '版本', '附带配件',
  '电源方向', '线缆', '电脑', '显示器', '车牌识别器', '条纹板', '纽扣电池', '默认',
];
function normLabel(v) {
  return clean(v).replace(/\s+/g, '').toLowerCase().replace(/[:：（()）√]/g, '');
}
function isLabelLike(v) {
  const raw = clean(v);
  if (!raw) return true;
  if (/[:：]/.test(raw)) return true;
  const n = normLabel(raw);
  return LABEL_KEYWORDS.some(k => n === k || (k.length >= 3 && n.startsWith(k)));
}

// 从 startCol 起在同一行找第一个“非标签”的非空单元格（兼容合并单元格）
function valueAfter(r, startCol, maxCols = 6) {
  if (!r) return '';
  for (let c = startCol; c < startCol + maxCols && c < r.length; c++) {
    const v = clean(r[c]);
    if (v && !isLabelLike(v)) return v;
  }
  return '';
}

// 找到 col0/col1 含指定关键字的行号
function findRowByLabel(rows, keyword, from = 0) {
  for (let i = from; i < rows.length; i++) {
    const r = rows[i] || [];
    if (clean(r[0]).includes(keyword) || clean(r[1]).includes(keyword)) return i;
  }
  return -1;
}

/**
 * 新版「订单评审信息表」样式解析（20260923 模板）。
 * 布局：订单信息头（订单号/时间/名称 + 产品明细 + 数量 + 发货/运输/包装/电池/货款）
 *       客户信息（售后登记系统名称 中文/英文 + 国家/使用/安装场景 + 联系人/公司/地址）
 *       产品信息-硬件（版本勾选表） + 产品信息-软件（商户号/登录邮箱/密码 + 设备编码 A/B/C 列）
 *       出货要求 / 物流要求 / 订单补充
 */
function parseOrderReviewExcel(rows) {
  const order = {
    orderNo: '', orderName: '', sendTime: '', planShip: '', transport: '', packaging: '', battery: '',
    customer: { name: '', country: '', contact: '', address: '', email: '', usage: '', install: '' },
    merchantId: '', loginEmail: '', loginPassword: '', note: '',
    devices: [], deviceCodes: [],
  };

  /* ── 订单头 ── */
  let i = findRowByLabel(rows, '订单号');
  if (i >= 0) order.orderNo = valueAfter(rows[i], 2, 3);
  i = findRowByLabel(rows, '订单时间');
  if (i >= 0) order.sendTime = valueAfter(rows[i], 2, 3);
  i = findRowByLabel(rows, '订单名称');
  if (i >= 0) order.orderName = valueAfter(rows[i], 2, 4);

  // 行内标签定位（标签和值可能分散在同一行的不同列）
  const findCellLabel = (kw) => {
    const target = normLabel(kw);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (normLabel(row[c]).includes(target)) return { r, c };
      }
    }
    return null;
  };
  const planShip = findCellLabel('计划发货时间');
  if (planShip) order.planShip = valueAfter(rows[planShip.r], planShip.c + 1);
  const transport = findCellLabel('运输方式');
  if (transport) order.transport = valueAfter(rows[transport.r], transport.c + 1);
  const packaging = findCellLabel('包装方式');
  if (packaging) order.packaging = valueAfter(rows[packaging.r], packaging.c + 1);
  const battery = findCellLabel('电池是否需要取出');
  if (battery) {
    let val = '';
    for (let r = battery.r; r < battery.r + 4 && !val; r++) {
      const row = rows[r] || [];
      for (let c = battery.c + 1; c < row.length && !val; c++) {
        const v = clean(row[c]);
        if (/^是\s*$|^是[:：]/.test(v)) {
          const rest = v.replace(/^是[:：]?\s*/, '');
          val = '是 ' + (rest || valueAfter(row, c + 1, 2));
        } else if (/^否\s*$|^否[:：]/.test(v)) {
          const rest = v.replace(/^否[:：]?\s*/, '');
          val = '否 ' + (rest || valueAfter(row, c + 1, 2));
        }
      }
    }
    order.battery = val.trim();
  }

  /* ── 产品明细（标准名称）→ 设备列表 ── */
  const detailHeader = findCellLabel('产品明细');
  if (detailHeader) {
    const nameCol = detailHeader.c;
    const qtyCol = nameCol + 3; // 模板中“数量”在名称右侧第 3 列
    for (let r = detailHeader.r + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (clean(row[0]).includes('客户信息')) break;
      const fullName = clean(row[nameCol]);
      if (!fullName || isLabelLike(fullName)) continue;
      order.devices.push({
        fullName,
        model: extractModel(fullName),
        quantity: parseInt(clean(row[qtyCol])) || 1,
      });
    }
  }

  /* ── 客户信息 ── */
  const custRow = findRowByLabel(rows, '售后登记系统名称');
  if (custRow >= 0) {
    const head = rows[custRow] || [];
    const colOf = (kw) => {
      const t = normLabel(kw);
      for (let c = 0; c < head.length; c++) if (normLabel(head[c]).includes(t)) return c;
      return -1;
    };
    const nameCol = colOf('售后登记系统名称') >= 0 ? colOf('售后登记系统名称') : 1;
    const countryCol = colOf('国家/区域');
    const usageCol = colOf('使用场景');
    const installCol = colOf('安装场景');
    const stripPrefix = (v) => v.replace(/^[^:：]*[:：]\s*/, '').trim();
    const isZh = (v) => /[\u4e00-\u9fa5]/.test(v);
    for (let r = custRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (clean(row[0]).includes('产品信息')) break;
      // 名称：中文优先，其次英文（排除标签行）
      const candidates = [stripPrefix(clean(row[nameCol])), stripPrefix(clean(row[nameCol + 1]))];
      for (const v of candidates) {
        if (!v || isLabelLike(v) || v === '中文' || v === '英文') continue;
        if (!order.customer.name) { order.customer.name = v; break; }
      }
      // 国家 / 使用场景 / 安装场景：取对应列下方几行的非标签值
      const pick = (col) => {
        if (col < 0) return '';
        for (let rr = custRow + 1; rr < Math.min(custRow + 4, rows.length); rr++) {
          const v = stripPrefix(clean((rows[rr] || [])[col]));
          if (v && !isLabelLike(v) && !['中文', '英文'].includes(v)) return v;
        }
        return '';
      };
      if (!order.customer.country) order.customer.country = pick(countryCol);
      if (!order.customer.usage) order.customer.usage = pick(usageCol);
      if (!order.customer.install) order.customer.install = pick(installCol);
      // 联系人 / 公司 / 地址 / 邮箱：整行扫描带冒号的标签单元格
      for (let c = 0; c < row.length; c++) {
        const v = clean(row[c]);
        if (!v || !/[:：]/.test(v)) continue;
        const n = normLabel(v);
        const rest = stripPrefix(v);
        const next = valueAfter(row, c + 1, 3);
        if (!order.customer.contact && (n.startsWith('联系人') || n.startsWith('联系方式'))) {
          order.customer.contact = rest || next;
        } else if (!order.customer.company && n.startsWith('公司名称')) {
          order.customer.company = rest || next;
        } else if (!order.customer.address && (n.startsWith('收货地址') || n.startsWith('地址'))) {
          order.customer.address = rest || next;
        } else if (!order.customer.email && n.startsWith('邮箱')) {
          order.customer.email = rest || next;
        }
      }
      if (!order.customer.email) {
        for (let c = 0; c < row.length; c++) {
          const v = clean(row[c]);
          if (/@/.test(v) && !isLabelLike(v)) { order.customer.email = v; break; }
        }
      }
    }
  }

  /* ── 产品信息-软件：商户号 / 登录邮箱 / 登录密码 / 设备编码 ── */
  const softStart = (() => {
    for (let r = 0; r < rows.length; r++) {
      const joined = normLabel((rows[r] || []).join('|'));
      if (joined.includes('-软件-') || (joined.includes('商户号') && joined.includes('设备编码'))) return r;
    }
    return -1;
  })();
  if (softStart >= 0) {
    // 从表头行动态定位“产品名称-X”列（设备编码在其右侧一列）
    const nameCols = [];
    for (let c = 0; c < (rows[softStart] || []).length; c++) {
      if (/产品名称/.test(normLabel(rows[softStart][c]))) nameCols.push(c);
    }
    for (let r = softStart; r < rows.length; r++) {
      const row = rows[r] || [];
      const joined = normLabel(row.join('|'));
      if (r > softStart && (clean(row[0]).includes('出货') || joined.includes('出货要求'))) break;
      for (let c = 0; c < row.length; c++) {
        const n = normLabel(row[c]);
        const next = valueAfter(row, c + 1, 3);
        if (n === '商户号' && !order.merchantId) order.merchantId = next;
        if (n === '登录邮箱' && !order.loginEmail) order.loginEmail = next;
        if (n === '登录密码' && !order.loginPassword) order.loginPassword = next;
      }
      // 设备编码成对列：仅使用表头声明的产品名称列
      for (const nc of nameCols) {
        if (r === softStart) continue; // 跳过表头行
        const name = clean(row[nc]);
        const code = clean(row[nc + 1]);
        if (!name || !code) continue;
        if (isLabelLike(name) || isLabelLike(code)) continue;
        if (name.includes('产品信息') || name.includes('出货')) continue;
        if (/@/.test(name)) continue; // 邮箱等值不是产品名称
        order.deviceCodes.push({ name, code });
      }
    }
  }

  /* ── 订单补充 → note ── */
  i = findRowByLabel(rows, '订单补充');
  if (i >= 0) order.note = valueAfter(rows[i], 1, 12);

  return order;
}

/**
 * 旧版「订单信息表」样式解析（保留原有逻辑）。
 */
function parseOrderLegacyExcel(rows) {

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

module.exports = { parseOrderExcel, parseOrderReviewExcel, isNewReviewTemplate, extractModel, matchScore, matchDeviceCode };
