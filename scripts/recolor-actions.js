// 将主 UI 动作色（按钮/链接/选中态）从 Tailwind blue 迁移到调色板 primary 色阶，
// 同时保护“状态/分类徽章”的颜色（text-blue-600 bg-blue-100 等成对出现的不改）。
// 运行: node scripts/recolor-actions.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'client', 'src');

// 状态/分类徽章蓝色（成对出现，保持不变）
const masks = [
  ['text-blue-600 bg-blue-100', '@@SB1@@'],
  ['bg-blue-100 text-blue-600', '@@SB2@@'],
  ['bg-blue-100 text-blue-700', '@@SB3@@'],
  ['bg-blue-100 text-blue-800', '@@SB4@@'],
];

// 动作色替换（长匹配优先）
const repls = [
  ['bg-blue-500/10 text-blue-600', 'bg-primary-500/10 text-primary-600'],
  ['text-blue-600 hover:text-blue-900', 'text-primary-600 hover:text-primary-700'],
  ['text-blue-600 hover:text-blue-800', 'text-primary-600 hover:text-primary-700'],
  ['hover:bg-blue-800', 'hover:bg-primary-700'],
  ['hover:bg-blue-700', 'hover:bg-primary-600'],
  ['hover:text-blue-900', 'hover:text-primary-700'],
  ['hover:text-blue-800', 'hover:text-primary-700'],
  ['hover:border-blue-400', 'hover:border-primary-400'],
  ['bg-blue-600 text-white', 'bg-primary-500 text-white'],
  ['border-blue-500 text-blue-600', 'border-primary-500 text-primary-600'],
  ['focus:ring-blue-500', 'focus:ring-primary-500/40'],
  ['border-blue-400', 'border-primary-400'],
  ['border-blue-300', 'border-primary-300'],
  ['border-blue-200', 'border-primary-200'],
  ['border-blue-500', 'border-primary-500'],
  ['bg-blue-600', 'bg-primary-500'],
  ['bg-blue-500', 'bg-primary-500'],
  ['ring-blue-400', 'ring-primary-400'],
  ['text-blue-700', 'text-primary-700'],
  ['text-blue-800', 'text-primary-800'],
  ['text-blue-500', 'text-primary-500'],
  ['text-blue-600', 'text-primary-600'],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = walk(SRC);
let changed = 0;
for (const file of files) {
  // 跳过分发的颜色映射工具
  if (file.endsWith(path.join('utils', 'index.ts'))) continue;
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  // mask
  for (const [m] of masks) text = text.split(m).join(masks.find(x => x[0] === m)[1]);
  // replace
  for (const [from, to] of repls) text = text.split(from).join(to);
  // unmask
  for (const [m, marker] of masks) text = text.split(marker).join(m);
  if (text !== before) {
    fs.writeFileSync(file, text);
    changed++;
  }
}
console.log('changed files:', changed);
