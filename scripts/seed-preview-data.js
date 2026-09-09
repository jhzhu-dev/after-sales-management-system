/* eslint-disable no-console */
// =============================================================================
// seed-preview-data.js — 预览展示版虚拟数据生成（全虚构数据）
//
// 用法（在应用容器内）：
//   docker cp seed-preview-data.js device-manager-preview-app:/app/seed.js
//   docker exec device-manager-preview-app node /app/seed.js
// 本地调试：
//   $env:DB_HOST='127.0.0.1'; $env:DB_USER='els'; $env:DB_PASSWORD='111111';
//   $env:DB_NAME='dm_preview_seed'; node scripts/seed-preview-data.js
//
// 特性：幂等（先清空业务表再灌数）；确定性随机（可复现）；不写入任何真实信息；
//       不生成文件类附件记录（避免下载 404）；不触碰飞书配置。
// =============================================================================
const mysql = require('mysql2/promise');

const cfg = {
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'preview_user',
  password: process.env.DB_PASSWORD || 'preview_pass_2026',
  database: process.env.DB_NAME || 'device_management',
  charset: 'utf8mb4',
  multipleStatements: true,
};

// ── 确定性随机 ────────────────────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260909);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');

// 2026-03-01 ~ 2026-09-08 之间的随机时间
const START = new Date('2026-03-01T00:00:00+08:00').getTime();
const END = new Date('2026-09-08T18:00:00+08:00').getTime();
function randDate() {
  const d = new Date(START + rand() * (END - START));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function ymd(dt) { return dt.slice(0, 10); }

// ── 文案池 ────────────────────────────────────────────────────────────────────
const TECH = ['AI视觉', '激光雷达', '红外热成像', '3D结构光', '毫米波雷达', '高清成像', '深度学习', '多光谱', '线扫相机', '双目立体'];
const KINDS = ['检测设备', '测量系统', '识别终端', '质检平台', '扫描工作站', '分析一体机'];
const VARIANTS = ['标准版', '高配版', '旗舰版', '精简版', 'SE版', 'Pro版', 'Lite版', '增强版'];
const CITIES = ['上海', '北京', '深圳', '广州', '杭州', '苏州', '南京', '成都', '武汉', '重庆', '西安', '青岛', '宁波', '合肥', '长沙'];
const BRANDS = ['万达', '恒信', '华创', '启明', '瑞丰', '博远', '中科', '天工', '泰华', '锦程', '凌云', '海纳', '智联', '宏图', '新锐'];
const SUFFIX = ['智能科技有限公司', '自动化设备有限公司', '精密机械有限公司', '汽车零部件有限公司', '电子科技有限公司', '工业系统有限公司'];
const PEOPLE = ['张伟', '王芳', '李强', '刘洋', '陈静', '杨帆', '赵敏', '黄磊', '周杰', '吴婷', '徐辉', '孙丽', '马超', '朱琳', '胡军'];
const MODULE_TYPES = ['视觉算法模块', '运动控制模块', '光源模块', '工业相机模组', '激光传感器', 'PLC控制模块', '数据采集模块', '通信模块', '电源模块', '机械传动模块', '气路模块', 'AI推理模块', '3D视觉模块', '深度相机模组', '红外测温模块', '条码识别模块', 'RFID读写模块', '光电传感器', '接近开关模组', '编码器模块', '变频器模块', '继电器模组', 'IO扩展模块', 'CAN总线模块', '以太网交换模块', '4G通信模块', 'WiFi传输模块', '蓝牙信标模块', '温控模块', '散热风扇模组', 'UPS备用电源', '电池管理模块', '液压控制模块', '真空发生模块', '吸盘执行模块', '机器人夹爪模块', '导轨滑台模组', '步进电机模块', '伺服电机模块', '减速机模块', '联轴器模组', '安全光栅模块', '急停控制模块', '触摸屏模块', '声光报警模块', '边缘计算网关', '工控机主板', '存储扩展模块', '防护外壳组件', '伺服驱动模块', '定位校准模块', '视觉光源控制模块'];
const ISSUE_CATS = ['硬件故障', '软件Bug', '操作咨询', '安装调试', '其他'];
const REGIONS = ['华东', '华南', '华北', '西南', '华中', '东北', '西北'];
const CLASSIFICATIONS = ['相机异常', '光源故障', '软件报错', '网络通信', '机械卡滞', '识别精度', '系统崩溃', '操作指导', '供电异常', '传感器失灵', '气路泄漏', '过热保护', '参数丢失', '固件升级失败', '数据不同步', '接口松动', '镜头污染', '标定漂移', '触发异常', '扫码失败', '通讯丢包', 'PLC无响应', '伺服报警', '电机异响', '皮带磨损', '定位偏差', '吸盘脱落', '真空不足', '液压不稳', '风扇停转', 'UPS告警', '蓝牙断连', '4G信号弱', '存储满', '蓝屏死机', '权限错误', '登录异常', '导出失败', '打印异常', '附件丢失', '页面卡顿', '接口超时', '数据重复', '编码错误', '固件兼容', '驱动缺失', '防护门报警', '安全光栅触发', '急停动作', '触摸屏失灵', '电源浪涌', '机械抖动'];
const DEV_STATUSES = ['生产中', '已发货', '使用中(正常)', '使用中(正常)', '使用中(正常)', '使用中(异常)', '已停用'];
const ISSUE_STATUS = ['open', 'open', 'in_progress', 'in_progress', 'closed', 'closed'];
const SEVERITY = ['low', 'medium', 'medium', 'high'];
const REQ_TYPES = ['接口对接', '功能定制', '输出结果定制'];
const REQ_STATUSES = ['需求收集', '待评估', '评估中', '已评估待开发', '开发中', '已开发待测试', '测试中', '已测试待发布', '已发布', '已发布', '废弃'];
const TT_STATUSES = ['测试中', '测试中', '已测试', '通过', '通过', '不通过'];
const ISSUE_DESC = [
  '设备开机后相机无图像输出，重启后恢复，已连续出现两次',
  '检测软件在保存报表时偶发崩溃，错误码 0x800F，需排查内存占用',
  '客户反馈识别准确率下降，白天正常夜间偏低，疑似光源衰减',
  '传送带急停后机械臂未回到零位，重新上电后恢复',
  '升级到最新版本后扫码枪通信中断，驱动回退后正常',
  '触摸屏响应卡顿，切换页面延迟超过 3 秒',
  '气路压力不稳导致压紧机构动作不到位，已调整减压阀',
  '导出 Excel 时中文字段乱码，英文版正常',
  '激光标定数据丢失，需重新做全场标定',
  '客户咨询多工位切换的配置方法，已远程指导完成',
  '设备运行中风扇异响，已安排更换风扇备件',
  '软件授权激活失败，提示机器码与授权文件不匹配',
  '网络丢包导致图片上传超时，建议客户检查交换机',
  '新增产品型号后模板未生效，重启服务后正常',
  '伺服电机报警 E230，检查为编码器线缆松动',
];
const LOG_TEMPLATES = [
  '已联系客户了解现场情况，安排远程排查',
  '初步定位为{c}相关问题，已准备备件',
  '现场更换{c}后运行观察 24 小时',
  '提供临时解决方案，等待客户反馈结果',
  '升级至最新固件版本验证，问题未再复现',
  '与研发确认该问题已知晓，将在下个版本修复',
  '客户确认恢复正常，关闭工单',
  '远程登录抓取日志分析，发现{c}异常告警',
];
const REQ_DESC = [
  '希望系统支持将检测结果推送到客户 MES 系统（Webhook 方式）',
  '需要在报表中增加班次维度的统计字段',
  '对接客户 WMS，入库时回写检测结论',
  '增加批量导出缺陷图片打包下载的功能',
  '识别结果增加置信度阈值可配置项',
  '对接钉钉/企业微信消息通知',
  '首页看板增加本周设备稼动率趋势图',
  '支持按产品型号配置不同的判定规则',
  '增加操作审计日志导出功能',
  '检测数据保留策略支持按客户分别配置',
];
const UPGRADE_DESC = [
  '视觉算法版本升级，优化夜间识别率',
  '运动控制固件升级，修复急停回零问题',
  '光源驱动板更换并重新标定亮度',
  '系统重装并迁移历史数据',
  '通信模块协议栈升级到 v2',
  '相机固件升级，提升长曝光稳定性',
];

async function main() {
  const conn = await mysql.createConnection(cfg);

  console.log('🧹 清空业务表（保留飞书配置）...');
  const wipeOrder = [
    'issue_logs', 'customer_requirement_logs', 'customer_requirement_devices', 'customer_requirement_attachments',
    'test_task_products', 'test_task_attachments', 'customer_requirements', 'test_tasks',
    'device_upgrades', 'device_documents', 'module_versions', 'submodule_versions', 'submodules', 'modules',
    'issues', 'release_attachments', 'version_release_products', 'version_releases',
    'product_version_documents', 'product_versions', 'product_submodule_specs', 'product_module_history',
    'product_modules', 'product_documents', 'products', 'module_sop_templates',
    'devices', 'device_bundles', 'kb_articles', 'customers', 'product_lines',
    'issue_classification_types', 'module_types',
  ];
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of wipeOrder) await conn.query(`TRUNCATE TABLE \`${t}\``);
  await conn.query('SET FOREIGN_KEY_CHECKS=1');

  // ── 模块类型（12） ──
  const moduleTypeIds = [];
  for (let i = 0; i < MODULE_TYPES.length; i++) {
    const [r] = await conn.execute(
      'INSERT INTO module_types (name, code, description, is_active) VALUES (?,?,?,1)',
      [MODULE_TYPES[i], `MT${pad(i + 1)}`, `${MODULE_TYPES[i]}基础资料（虚拟数据）`]
    );
    moduleTypeIds.push(r.insertId);
  }
  // 部分模块类型配置 SOP 模板
  for (const id of moduleTypeIds.slice(0, 5)) {
    await conn.execute('INSERT INTO module_sop_templates (module_type_id, items) VALUES (?,?)', [
      id,
      JSON.stringify([
        { id: 1, text: '断电后再操作，佩戴防静电手环', required: true },
        { id: 2, text: '拍照记录接线位置', required: true },
        { id: 3, text: '更换后执行自检程序', required: false },
      ]),
    ]);
  }

  // ── 问题归属分类（8） ──
  const classificationIds = [];
  for (let i = 0; i < CLASSIFICATIONS.length; i++) {
    const [r] = await conn.execute('INSERT INTO issue_classification_types (name, sort_order) VALUES (?,?)', [CLASSIFICATIONS[i], i * 10]);
    classificationIds.push(r.insertId);
  }

  // ── 产品线（52） ──
  const productLineIds = [];
  for (let i = 1; i <= 52; i++) {
    const name = `${TECH[(i - 1) % TECH.length]}${KINDS[(i - 1) % KINDS.length]}-${pad(i)}系列`;
    const [r] = await conn.execute(
      'INSERT INTO product_lines (name, code, description, is_active, created_at) VALUES (?,?,?,1,?)',
      [name, `PL${pad(i)}`, `${name}，面向工业质检场景的虚拟产品线`, randDate()]
    );
    productLineIds.push(r.insertId);
  }

  // ── 产品（65） ──
  const products = [];
  let prodSeq = 1;
  for (let i = 0; i < 65; i++) {
    const lineId = productLineIds[i % productLineIds.length];
    const lineName = `${TECH[i % TECH.length]}${KINDS[i % KINDS.length]}`;
    const name = `${lineName}-${VARIANTS[i % VARIANTS.length]}`;
    const shortName = `视检${pad(i + 1, 3)}`;
    const model = `TSD-${pad((i % 9) + 1)}${pad((i % 7) + 1)}-${pad(1000 + i, 4)}`;
    const createdAt = randDate();
    const [r] = await conn.execute(
      'INSERT INTO products (product_line_id, name, short_name, model, description, is_active, created_at) VALUES (?,?,?,?,?,1,?)',
      [lineId, name, shortName, model, `${name}（${model}），适用于多场景在线检测`, createdAt]
    );
    products.push({ id: r.insertId, lineId, name, shortName, model, createdAt });
    prodSeq++;
  }
  // 产品-模块配置（每个产品 2~4 个模块）
  for (const p of products) {
    for (const mtId of pickN(moduleTypeIds, int(2, 4))) {
      await conn.execute(
        'INSERT INTO product_modules (product_id, module_type_id, is_required, default_config) VALUES (?,?,?,?)',
        [p.id, mtId, rand() > 0.3 ? 1 : 0, JSON.stringify({ remark: '默认配置（虚拟）' })]
      );
    }
  }

  // ── 产品迭代版本（约 90） ──
  const productVersions = [];
  for (let i = 0; i < products.length; i++) {
    const n = i % 3 === 0 ? 2 : 1;
    for (let v = 1; v <= n; v++) {
      const version = `V${v}.${int(0, 9)}.${int(0, 9)}`;
      const statuses = ['开发中', '量产中', '量产中', '已停产'];
      const status = v === 1 ? pick(statuses) : '开发中';
      const isCurrent = status === '量产中' && v === 1 ? 1 : 0;
      const [r] = await conn.execute(
        `INSERT INTO product_versions (product_id, version_number, version_name, description, status, release_date, is_current, sort_order, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [products[i].id, version, `${version} 迭代版`, `版本${version}：优化检测节拍与误检率（虚拟）`, status, ymd(products[i].createdAt), isCurrent, v, randDate()]
      );
      productVersions.push(r.insertId);
    }
  }

  // ── 版本库发布记录（55）+ 产品关联 ──
  const releaseIds = [];
  for (let i = 1; i <= 55; i++) {
    const mtId = moduleTypeIds[i % moduleTypeIds.length];
    const version = `R${pad(int(1, 3))}.${int(0, 9)}.${int(0, 9)}`;
    const [r] = await conn.execute(
      `INSERT INTO version_releases (module_type_id, version_number, title, change_log, category, release_date, source, created_at)
       VALUES (?,?,?,?,?,?, 'manual', ?)`,
      [mtId, version, `${MODULE_TYPES[i % MODULE_TYPES.length]} ${version} 正式版`,
        '1. 优化稳定性\n2. 修复已知问题\n3. 提升兼容性（虚拟变更记录）', pick(['软件', '固件', '硬件']), ymd(randDate()), randDate()]
    );
    releaseIds.push(r.insertId);
    for (const p of pickN(products, int(1, 3))) {
      await conn.execute('INSERT IGNORE INTO version_release_products (release_id, product_id) VALUES (?,?)', [r.insertId, p.id]);
    }
  }

  // ── 客户（55） ──
  const customers = [];
  const usedShort = new Set();
  for (let i = 0; i < 55; i++) {
    let shortName;
    do {
      shortName = `${CITIES[i % CITIES.length].slice(0, 1)}${BRANDS[Math.floor(rand() * BRANDS.length)]}`;
    } while (usedShort.has(shortName));
    usedShort.add(shortName);
    const fullName = `${CITIES[i % CITIES.length]}${shortName.slice(1)}${pick(SUFFIX)}`;
    const [r] = await conn.execute('INSERT INTO customers (name, short_name, created_at) VALUES (?,?,?)', [fullName, shortName, randDate()]);
    customers.push({ id: r.insertId, name: fullName, shortName });
  }

  // ── 多合一设备组合（52） ──
  const bundleIds = [];
  for (let i = 1; i <= 52; i++) {
    const customer = pick(customers);
    const [r] = await conn.execute(
      'INSERT INTO device_bundles (bundle_code, name, customer_id, description, factory_docs_complete, created_at) VALUES (?,?,?,?,?,?)',
      [`BD-2026-${pad(i, 3)}`, `${customer.shortName}多合一检测单元-${pad(i)}`, customer.id, '多设备组合交付单元（虚拟）', rand() > 0.3 ? 1 : 0, randDate()]
    );
    bundleIds.push(r.insertId);
  }

  // ── 设备（120） ──
  const devices = [];
  for (let i = 1; i <= 120; i++) {
    const product = products[i % products.length];
    const customer = customers[i % customers.length];
    const status = pick(DEV_STATUSES);
    const id = String(10000000 + i);
    const name = `ORD-2026-${pad(int(1, 900), 4)}-${pad(int(1, 99), 2)}`;
    const nickname = `${customer.shortName}${product.shortName}${id.slice(-4)}`;
    const createdAt = randDate();
    const shippedAt = status === '生产中' ? null : createdAt;
    await conn.execute(
      `INSERT INTO devices (id, name, nickname, device_code, product_line_id, product_id, customer_id, status,
         remote_code, password, merchant_id, merchant_password, notes, factory_docs_complete, shipped_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, name, nickname, `EL-${product.model}-${pad(i, 4)}`, product.lineId, product.id, customer.id, status,
       `RM${pad(int(100000, 999999))}`, `Pwd${int(1000, 9999)}`, `MID${pad(i, 5)}`, `MP${int(100000, 999999)}`,
       '出厂前完成老化测试 72 小时（虚拟）', status === '生产中' ? 0 : 1, shippedAt, createdAt, randDate()]
    );
    devices.push({ id, product, customer, status, createdAt });
  }
  // 洗牌设备后，每组合分配 2 台（共 104 台，保证每个组合非空），其中一台主设备
  const shuffled = devices.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let devCursor = 0;
  for (let b = 0; b < bundleIds.length; b++) {
    for (let idx = 0; idx < 2; idx++) {
      const member = shuffled[devCursor++ % shuffled.length];
      await conn.execute('UPDATE devices SET bundle_id=?, is_primary=? WHERE id=?', [bundleIds[b], idx === 0 ? 1 : 0, member.id]);
    }
  }

  // ── 设备模块（约 60% 的设备 1~2 个模块）+ 模块版本 ──
  const moduleRows = [];
  for (const d of devices) {
    if (rand() > 0.6) continue;
    for (const mtId of pickN(moduleTypeIds, int(1, 2))) {
      const [r] = await conn.execute('INSERT INTO modules (device_id, type_id, created_at) VALUES (?,?,?)', [d.id, mtId, d.createdAt]);
      const moduleId = r.insertId;
      moduleRows.push({ id: moduleId, device: d });
      await conn.execute(
        "INSERT INTO module_versions (module_id, version_number, version_type, release_date, description, updated_by, created_at) VALUES (?,?, 'factory', ?, '出厂版本（虚拟）', ?, ?)",
        [moduleId, `FV${int(1, 2)}.0`, ymd(d.createdAt), pick(PEOPLE), d.createdAt]
      );
      if (rand() > 0.5) {
        await conn.execute(
          "INSERT INTO module_versions (module_id, version_number, version_type, release_date, description, updated_by, created_at) VALUES (?,?, 'update', ?, '现场升级（虚拟）', ?, ?)",
          [moduleId, `UV${int(2, 3)}.${int(0, 9)}`, ymd(randDate()), pick(PEOPLE), randDate()]
        );
      }
    }
  }

  // ── 问题（160）+ 处理记录 ──
  for (let i = 1; i <= 160; i++) {
    const d = pick(devices);
    const status = pick(ISSUE_STATUS);
    const severity = pick(SEVERITY);
    const createdAt = randDate();
    const issueId = `ISS${createdAt.slice(0, 10).replace(/-/g, '')}${pad(int(0, 23))}${pad(int(0, 59))}${pad(int(0, 59))}-${i}`;
    const moduleRow = moduleRows.find((m) => m.device.id === d.id);
    const closedAt = status === 'closed' ? randDate() : null;
    await conn.execute(
      `INSERT INTO issues (id, device_id, module_id, custom_module_name, category, classification_id, description,
         contact_person, contact_phone, is_visit_required, visit_at, feedback_time, feedback_no, region, occurrence_count,
         is_first_occurrence, severity, status, assignee, resolution_description, resolved_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [issueId, d.id, moduleRow ? moduleRow.id : null, null, pick(ISSUE_CATS),
       rand() > 0.4 ? pick(classificationIds) : null, pick(ISSUE_DESC),
       pick(PEOPLE), `139${pad(int(10000000, 99999999), 8)}`, rand() > 0.75 ? 1 : 0,
       rand() > 0.8 ? randDate() : null, createdAt, `FB2026${pad(int(1000, 9999))}`, pick(REGIONS),
       int(1, 8), rand() > 0.6 ? 1 : 0, severity, status,
       status === 'open' ? null : pick(PEOPLE),
       status === 'closed' ? '已更换备件并连续观察 48 小时无复现（虚拟处理结论）' : null,
       closedAt, createdAt, randDate()]
    );
    // 处理记录 1~4 条
    const logCount = status === 'open' ? int(1, 2) : int(2, 4);
    for (let k = 0; k < logCount; k++) {
      const tpl = pick(LOG_TEMPLATES).replace('{c}', pick(MODULE_TYPES));
      await conn.execute('INSERT INTO issue_logs (issue_id, content, operator, created_at) VALUES (?,?,?,?)',
        [issueId, tpl, pick(PEOPLE), randDate()]);
    }
  }

  // ── 设备升级记录（70） ──
  for (let i = 1; i <= 70; i++) {
    const d = pick(devices);
    const t = pick(['硬件升级', '软件更新', '系统重装']);
    await conn.execute(
      'INSERT INTO device_upgrades (device_id, upgrade_type, description, old_version, new_version, operator_id, upgrade_at) VALUES (?,?,?,?,?,?,?)',
      [d.id, t, pick(UPGRADE_DESC), `V1.${int(0, 5)}.${int(0, 9)}`, `V1.${int(6, 9)}.${int(0, 9)}`, pick(PEOPLE), randDate()]
    );
  }

  // ── 客户需求（55）+ 关联设备 + 流转日志 ──
  const dayCounters = {};
  for (let i = 1; i <= 55; i++) {
    const customer = pick(customers);
    const status = pick(REQ_STATUSES);
    const createdAt = randDate();
    const day = createdAt.slice(0, 10).replace(/-/g, '');
    dayCounters[day] = (dayCounters[day] || 0) + 1;
    const reqCode = `XQ-${day}-${pad(dayCounters[day], 3)}`;
    const publishVersion = status === '已发布' ? `V${int(1, 3)}.${int(0, 9)}.${int(0, 9)}` : null;
    const publishTime = status === '已发布' ? randDate() : null;
    const deprecatedReason = status === '废弃' ? '客户取消该需求，按废弃处理（虚拟原因）' : null;
    const [r] = await conn.execute(
      `INSERT INTO customer_requirements
         (req_code, customer_id, requirement_type, proposed_date, urgency, status, description,
          publish_version, publish_time, deprecated_reason, remarks, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [reqCode, customer.id, pick(REQ_TYPES), ymd(createdAt), pick(['低', '中', '高']), status, pick(REQ_DESC),
       publishVersion, publishTime, deprecatedReason, null, pick(PEOPLE), createdAt, randDate()]
    );
    const reqId = r.insertId;
    for (const d of pickN(devices, int(1, 3))) {
      await conn.execute('INSERT IGNORE INTO customer_requirement_devices (requirement_id, device_id) VALUES (?,?)', [reqId, d.id]);
    }
    if (status !== '需求收集') {
      await conn.execute(
        'INSERT INTO customer_requirement_logs (requirement_id, from_status, to_status, operator, remark, created_at) VALUES (?,?,?,?,?,?)',
        [reqId, '需求收集', status, pick(PEOPLE), '状态流转（虚拟流程数据）', createdAt]
      );
    }
  }

  // ── 测试任务（55）+ 关联产品 ──
  const ttDayCounters = {};
  for (let i = 1; i <= 55; i++) {
    const product = pick(products);
    const status = pick(TT_STATUSES);
    const createdAt = randDate();
    const day = createdAt.slice(0, 10).replace(/-/g, '');
    ttDayCounters[day] = (ttDayCounters[day] || 0) + 1;
    const taskCode = `T-${day}-${pad(ttDayCounters[day], 3)}`;
    const finished = ['已测试', '通过', '不通过'].includes(status);
    const decided = ['通过', '不通过'].includes(status);
    const [r] = await conn.execute(
      `INSERT INTO test_tasks
         (task_code, product_id, target_type, model_name, module_category, model_version, current_version,
          upgrade_content, model_features, test_focus, test_requirements, vehicle_requirements, test_scenarios,
          planned_completion_date, priority, shenzhen_requester_name, shanghai_tester, test_summary,
          status, upgrade_decision, decision_note, decided_by, decided_at, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [taskCode, product.id, 'product', null, pick(MODULE_TYPES), `V1.${int(0, 3)}.0`, `V1.${int(4, 8)}.0`,
       pick(UPGRADE_DESC), '小批量试产机型，节拍提升约 15%（虚拟）', '重点回归缺陷识别与夜间工况',
       '覆盖高/中/低三档光照（虚拟要求）', '乘用车 2 台、商用车 1 台', '白班/夜班各 2 轮，每轮 200 件',
       ymd(randDate()), pick(['低', '中', '高']), pick(PEOPLE), pick(PEOPLE),
       finished ? '已完成全部场景测试，整体表现符合预期，详见反馈单（虚拟总结）' : null,
       status, decided ? (status === '通过' ? pick(['升级', '待定']) : '不升级') : '待定',
       decided ? '评审会结论（虚拟决策说明）' : null, decided ? pick(PEOPLE) : null, decided ? randDate() : null,
       pick(PEOPLE), createdAt, randDate()]
    );
    await conn.execute('INSERT INTO test_task_products (task_id, product_id) VALUES (?,?)', [r.insertId, product.id]);
  }

  // ── 知识库词条（55） ──
  for (let i = 1; i <= 55; i++) {
    const cls = pick(CLASSIFICATIONS);
    await conn.execute(
      `INSERT INTO kb_articles (title, symptom, cause, solution, category, product_line_id, tags, is_pinned, view_count, helpful_count, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`${cls}处理手册-${pad(i, 2)}`, `现场表现为${cls}，伴随告警或功能异常（虚拟症状描述）`,
       '常见原因为相关部件老化、接线松动或参数配置漂移（虚拟原因分析）',
       '1. 确认现场环境与告警代码\n2. 按 SOP 检查相关部件\n3. 更换/校准后执行自检并观察 24 小时（虚拟解决方案）',
       pick(ISSUE_CATS), rand() > 0.5 ? pick(productLineIds) : null,
       JSON.stringify([cls, '常见问题', '运维手册']), rand() > 0.85 ? 1 : 0, int(12, 980), int(0, 60), pick(PEOPLE), randDate()]
    );
  }

  // ── 汇总 ────────────────────────────────────────────────────────────────────
  const expect = {
    product_lines: 52, products: 65, product_versions: productVersions.length,
    version_releases: 55, customers: 55, device_bundles: 52, devices: 120,
    modules: moduleRows.length, issues: 160, device_upgrades: 70,
    customer_requirements: 55, test_tasks: 55, kb_articles: 55,
    module_types: MODULE_TYPES.length, issue_classification_types: CLASSIFICATIONS.length,
  };
  console.log('✅ 虚拟数据生成完成：');
  for (const [k, v] of Object.entries(expect)) console.log(`   ${k}: ${v}`);
  await conn.end();
}

main().catch((e) => {
  console.error('❌ 种子数据生成失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
