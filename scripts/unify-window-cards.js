// 将各页面“窗口/内容卡片”统一为仪表盘 Card 风格：
//   bg-card rounded-2xl border border-border shadow-soft
// 仅替换带 shadow 的窗口卡片容器，避开弹窗(shadow-xl/2xl)与装饰性 inner cards。
// 运行: node scripts/unify-window-cards.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'client', 'src');

// 有序规则：先更具体，后一般。仅匹配 shadow + 空格/引号，避免命中 shadow-xl/2xl/lg/md。
const rules = [
  [/bg-white rounded-lg border border-gray-200 shadow(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-xl shadow-sm border border-gray-100(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-xl border border-gray-100 shadow-sm(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-xl shadow-sm border border-gray-200(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-xl border border-gray-200 shadow-sm(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-2xl border border-gray-100 shadow-sm(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-xl border border-gray-100(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-xl shadow-sm(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-lg shadow-sm(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-lg shadow(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
  [/bg-white rounded-2xl shadow-sm border border-gray-100(?=[\s"])/g, 'bg-card rounded-2xl border border-border shadow-soft'],
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
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [re, to] of rules) text = text.replace(re, to);
  if (text !== before) {
    fs.writeFileSync(file, text);
    changed++;
  }
}
console.log('changed files:', changed);
