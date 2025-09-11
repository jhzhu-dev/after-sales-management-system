import { clsx, type ClassValue } from 'clsx';
import { format, parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 合并CSS类名
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// 格式化日期
export function formatDate(date: string | Date, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      return '无效日期';
    }
    return format(dateObj, formatStr, { locale: zhCN });
  } catch (error) {
    return '无效日期';
  }
}

// 格式化相对时间
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      return '无效日期';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return '刚刚';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}分钟前`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}小时前`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}天前`;
    } else {
      return format(dateObj, 'yyyy-MM-dd', { locale: zhCN });
    }
  } catch (error) {
    return '无效日期';
  }
}

// 获取状态颜色
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    '正常': 'text-green-600 bg-green-100',
    '异常': 'text-red-600 bg-red-100',
    '维护中': 'text-yellow-600 bg-yellow-100',
    'open': 'text-blue-600 bg-blue-100',
    'in_progress': 'text-orange-600 bg-orange-100',
    'closed': 'text-gray-600 bg-gray-100',
    '待处理': 'text-blue-600 bg-blue-100',
    '处理中': 'text-orange-600 bg-orange-100',
    '已解决': 'text-gray-600 bg-gray-100',
  };
  return statusColors[status] || 'text-gray-600 bg-gray-100';
}

// 获取严重性颜色
export function getSeverityColor(severity: string): string {
  const severityColors: Record<string, string> = {
    'low': 'text-green-600 bg-green-100',
    'medium': 'text-yellow-600 bg-yellow-100',
    'high': 'text-red-600 bg-red-100',
    '低': 'text-green-600 bg-green-100',
    '中': 'text-yellow-600 bg-yellow-100',
    '高': 'text-red-600 bg-red-100',
  };
  return severityColors[severity] || 'text-gray-600 bg-gray-100';
}

// 获取设备类型颜色
export function getDeviceTypeColor(type: string): string {
  const typeColors: Record<string, string> = {
    '龙门设备': 'text-blue-600 bg-blue-100',
    '底盘设备': 'text-green-600 bg-green-100',
    '侧扫设备': 'text-purple-600 bg-purple-100',
    '检测设备': 'text-orange-600 bg-orange-100',
    '其他设备': 'text-pink-600 bg-pink-100',
  };
  return typeColors[type] || 'text-gray-600 bg-gray-100';
}

// 获取版本类型颜色
export function getVersionTypeColor(type: string): string {
  const typeColors: Record<string, string> = {
    'factory': 'text-blue-600 bg-blue-100',
    'update': 'text-green-600 bg-green-100',
    '出厂': 'text-blue-600 bg-blue-100',
    '更新': 'text-green-600 bg-green-100',
  };
  return typeColors[type] || 'text-gray-600 bg-gray-100';
}

// 截断文本
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

// 生成随机ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// 验证邮箱
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证手机号
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 深拷贝
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  
  return obj;
}

// 数组去重
export function uniqueArray<T>(array: T[], key?: keyof T): T[] {
  if (!key) {
    return Array.from(new Set(array));
  }
  
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

// 排序数组
export function sortArray<T>(
  array: T[],
  key: keyof T,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) {
      return direction === 'asc' ? -1 : 1;
    }
    if (aVal > bVal) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

// 分页数组
export function paginateArray<T>(
  array: T[],
  page: number = 1,
  limit: number = 10
): { data: T[]; total: number; pages: number; currentPage: number } {
  const total = array.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const data = array.slice(startIndex, endIndex);
  
  return {
    data,
    total,
    pages,
    currentPage: page,
  };
}
