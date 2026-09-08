// 统一弹窗/模态框容器样式为仪表盘风格：
//   bg-card rounded-2xl border border-border shadow-2xl
// 仅替换模态框的 bg-white rounded-* shadow-xl/2xl 前缀，保留 max-w/max-h/overflow 等其余类。
// 运行: node scripts/unify-modals.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'client', 'src');

const rules = [
  [/bg-white rounded-lg shadow-xl/g, 'bg-card rounded-2xl border border-border shadow-2xl'],
  [/bg-white rounded-lg shadow-2xl/g, 'bg-card rounded-2xl border border-border shadow-2xl'],
  [/bg-white rounded-xl shadow-xl/g, 'bg-card rounded-2xl border border-border shadow-2xl'],
  [/bg-white rounded-xl shadow-2xl/g, 'bg-card rounded-2xl border border-border shadow-2xl'],
  [/bg-white rounded-2xl shadow-xl/g, 'bg-card rounded-2xl border border-border shadow-2xl'],
  [/bg-white rounded-2xl shadow-2xl/g, 'bg-card rounded-2xl border border-border shadow-2xl'],
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
