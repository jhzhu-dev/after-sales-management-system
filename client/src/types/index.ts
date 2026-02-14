// 客户类型
export interface Customer {
  id: number;
  name: string;
  short_name: string;
  created_at?: string;
  updated_at?: string;
}

// 设备类型
export interface Device {
  id: string;
  name: string;
  product_line_id?: number;
  product_line_name?: string;
  customer_id?: number;
  customer_name?: string;
  customer_short_name?: string;
  location?: string;
  status: '正常' | '异常' | '维护中';
  created_at: string;
  updated_at: string;
  remote_code?: string;
  password?: string;
  issue_count?: number;
  open_issues?: number;
}

// 模块类型 (仅用于设备详情页面)
export interface Module {
  id: string;
  device_id: string;
  type_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  device_name?: string;
  device_type?: string;
  module_type?: string;
}



// 版本发布库类型
export interface VersionRelease {
  id: number;
  module_type_id: number;
  module_type_name?: string;
  version_number: string;
  title: string;
  change_log?: string;
  release_date: string;
  created_at: string;
}

// 问题类型
export interface Issue {
  id: string;
  device_id: string;
  module_id?: string;
  category: '硬件故障' | '软件Bug' | '操作咨询' | '安装调试' | '其他';
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  assignee?: string;
  contact_person?: string;
  contact_phone?: string;
  is_visit_required: boolean;
  visit_at?: string;
  attachments?: string[]; // 存储附件URL的数组
  notes?: string;
  created_at: string;
  updated_at: string;
  device_name?: string;
  device_type?: string;
  device_location?: string;
  customer_name?: string;
  customer_short_name?: string;
  module_category?: string;
  resolution_description?: string;
  resolved_at?: string;
}

// 设备升级记录类型
export interface DeviceUpgrade {
  id: number;
  device_id: string;
  upgrade_type: '硬件升级' | '软件更新' | '系统重装';
  description?: string;
  old_version?: string;
  new_version?: string;
  operator_id?: string;
  upgrade_at: string;
  created_at: string;
  device_name?: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  details?: any[];
}

// 分页响应类型
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// 仪表盘统计类型
export interface DashboardStats {
  basicStats: {
    total_devices: number;
    open_issues: number;
    version_types: number;
    resolved_this_month: number;
  };
  deviceStatusDistribution: Array<{ status: string; count: number }>;
  issueStatusDistribution: Array<{ status: string; count: number }>;
  issueSeverityDistribution: Array<{ severity: string; count: number }>;
  versionTypeDistribution: Array<{ version_type: string; count: number }>;
  deviceTypeDistribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  locationStats: Array<{
    location: string;
    total: number;
    normal: number;
    abnormal: number;
    maintenance: number;
  }>;
  moduleCategoryDistribution: Array<{ category: string; count: number }>;
  recentActivities: Array<{
    type: string;
    id: number;
    name: string;
    timestamp: string;
    action: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    count: number;
    type: string;
  }>;
}

// 表单类型
export interface DeviceFormData {
  id?: string; // 可选，新增时可由用户输入或由后端自动生成
  name: string;
  product_line_id: string | number; // 支持字符串和数字类型
  product_id?: number; // 可选，用于自动绑定产品模块配置
  customer_id?: number | null;
  location?: string | null;
  status: '正常' | '异常' | '维护中';
  remote_code?: string | null;
  password?: string | null;
}

export interface ModuleFormData {
  device_id: string;
  type_id: string;
  version_id?: string;
  status: '正常' | '异常' | '维护中';
}

export interface VersionFormData {
  module_id: string;
  version_number: string;
  version_type: 'factory' | 'update';
  release_date?: string;
  description?: string;
  updated_by?: string;
}

export interface IssueFormData {
  device_id: string;
  module_id?: string;
  category?: '硬件故障' | '软件Bug' | '操作咨询' | '安装调试' | '其他';
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  assignee?: string;
  contact_person?: string;
  contact_phone?: string;
  is_visit_required?: boolean;
  visit_at?: string;
  attachments?: string[];
  notes?: string;
  resolution_description?: string;
  resolved_at?: string;
}

export interface DeviceUpgradeFormData {
  device_id: string;
  upgrade_type: '硬件升级' | '软件更新' | '系统重装';
  description?: string;
  old_version?: string;
  new_version?: string;
  operator_id?: string;
  upgrade_at?: string;
}

// 筛选选项类型
export interface FilterOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  severity?: string;
  assignee?: string;
  module?: string;
  device_type?: string;
  device_id?: string;
  module_id?: string;
  category?: string;
  version_type?: string;
  customer_id?: string;
  order_id?: string;
}

// 模块类别映射
export const MODULE_CATEGORY_MAP: Record<string, string> = {
  mechanical: '机械',
  electrical: '电气',
  host: '上位机',
  server: '服务器',
  vision: '视觉'
};

// 状态映射
export const STATUS_MAP: Record<string, string> = {
  '正常': '正常',
  '异常': '异常',
  '维护中': '维护中',
  'open': '待处理',
  'in_progress': '处理中',
  'closed': '已解决'
};

// 严重性映射
export const SEVERITY_MAP: Record<string, string> = {
  'low': '低',
  'medium': '中',
  'high': '高'
};


// ==================== Phase 1: 基础数据模块类型 ====================

// 产品线类型
export interface ProductLine {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 产品类型
export interface Product {
  id: number;
  product_line_id: number;
  name: string;
  model?: string;
  description?: string;
  specifications?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_line_name?: string;
}

// 产品模块配置类型
export interface ProductModule {
  id: number;
  product_id: number;
  module_type_id: number;
  module_type_name?: string;
  module_type_code?: string;
  is_required: boolean;
  default_config?: any;
  version_number?: string;
  change_description?: string;
  created_at: string;
}

// 产品模块配置历史类型
export interface ProductModuleHistory {
  id: number;
  product_id: number;
  module_type_id: number;
  module_type_name?: string;
  is_required: boolean;
  default_config?: any;
  version_number: string;
  change_description?: string;
  effective_date: string;
  deprecated_date?: string;
  is_current: boolean;
  created_by?: string;
  created_at: string;
}

// 模块类型（系统级）
export interface ModuleType {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 产品资料类型
export interface ProductDocument {
  id: number;
  product_id: number;
  doc_type: '规格书' | '使用说明' | '用户手册' | '其他';
  title: string;
  file_path: string;
  file_size?: number;
  uploaded_by?: string;
  created_at: string;
}

// 表单数据类型
export interface ProductLineFormData {
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
}

export interface ProductFormData {
  product_line_id: number;
  name: string;
  model?: string;
  description?: string;
  specifications?: any;
  is_active?: boolean;
}
