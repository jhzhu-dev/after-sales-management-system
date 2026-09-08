// 让所有表头文字更突出：font-medium -> font-semibold，text-muted-foreground -> text-foreground
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'client', 'src');
const rules = [
  [/font-medium text-muted-foreground uppercase/g, 'font-semibold text-foreground uppercase'],
  [/font-semibold text-muted-foreground uppercase/g, 'font-semibold text-foreground uppercase'],
];

const files = ['client/src/components/DataTable.tsx', 'client/src/pages/Devices.tsx', 'client/src/pages/Issues.tsx'];
let changed = 0;
for (const rel of files) {
  const file = path.join(SRC, rel.replace('client/src/', ''));
  if (!fs.existsSync(file)) { console.log('skip', rel); continue; }
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [re, to] of rules) text = text.replace(re, to);
  if (text !== before) { fs.writeFileSync(file, text); changed++; }
}
console.log('changed files:', changed);
