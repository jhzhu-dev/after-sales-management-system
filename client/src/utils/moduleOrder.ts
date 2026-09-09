// 模块类型的统一展示顺序：机械、电气、上位机、视觉、服务器、车牌相机
// 按关键词匹配（兼容"上位机软件""车牌相机"等全名），未匹配的类型排在最后
const MODULE_ORDER_KEYWORDS = ['机械', '电气', '上位', '视觉', '服务器', '车牌'];

export function getModuleTypeOrder(name?: string | null): number {
  const n = (name || '').trim();
  for (let i = 0; i < MODULE_ORDER_KEYWORDS.length; i++) {
    if (n.includes(MODULE_ORDER_KEYWORDS[i])) return i;
  }
  return MODULE_ORDER_KEYWORDS.length;
}

// 稳定排序：同序号的项保持原有先后顺序
export function sortByModuleTypeOrder<T>(items: T[], getName: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => getModuleTypeOrder(getName(a)) - getModuleTypeOrder(getName(b)));
}
