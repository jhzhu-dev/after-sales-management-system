// 将系统设置页面的表格/卡片样式统一到仪表盘主样式
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'client', 'src', 'pages', 'Settings.tsx');
let text = fs.readFileSync(file, 'utf8');

const rules = [
  // 表格容器卡片
  ['bg-white shadow overflow-hidden sm:rounded-lg', 'bg-card rounded-2xl border border-border shadow-soft overflow-hidden'],
  // 表头/表体
  ['<thead className="bg-gray-50">', '<thead className="bg-muted">'],
  ['<tbody className="bg-white divide-y divide-gray-200">', '<tbody className="divide-y divide-border">'],
  ['min-w-full divide-y divide-gray-200', 'min-w-full divide-y divide-border'],
  // 表头文字更突出
  ['font-medium text-gray-500 uppercase', 'font-semibold text-foreground uppercase'],
  // 空状态
  ['text-center py-12 bg-gray-50 rounded-lg', 'text-center py-12 bg-muted rounded-2xl'],
  // 模块类型卡片（含表头/内容）与行 hover
  ['border border-gray-200 rounded-lg overflow-hidden', 'bg-card rounded-2xl border border-border shadow-soft overflow-hidden'],
  ['flex items-center justify-between px-4 py-3 bg-gray-50', 'flex items-center justify-between px-4 py-3 bg-muted'],
  ['p-4 border-t border-gray-200 bg-white', 'p-4 border-t border-border bg-transparent'],
  ['hover:bg-gray-50', 'hover:bg-muted'],
];

for (const [from, to] of rules) {
  const before = text;
  text = text.split(from).join(to);
  if (text !== before) console.log('replaced:', from);
}
fs.writeFileSync(file, text);
console.log('done');
