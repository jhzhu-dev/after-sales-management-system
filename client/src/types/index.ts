// 设备类型
export interface Device {
  id: string;
  name: string;
  type_id?: number;
  device_type?: string;
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

// 子模块类型 (仅用于设备详情页面)
export interface Submodule {
  id: string;
  module_id: string;
  name: string;
  model?: string;
  factory_version?: string;
  current_version?: string;
  description?: string;
  status: '正常' | '异常' | '维护中';
  created_at: string;
  updated_at: string;
  module_name?: string;
  module_type?: string;
}

// 子模块版本类型 (仅用于设备详情页面)
export interface SubmoduleVersion {
  id: string;
  submodule_id: string;
  version_number: string;
  version_type: 'factory' | 'update';
  release_date?: string;
  description?: string;
  updated_by?: string;
  created_at: string;
  submodule_name?: string;
  module_name?: string;
  device_name?: string;
}

// 问题类型
export interface Issue {
  id: string;
  device_id: string;
  module_id?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  assignee?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  device_name?: string;
  device_type?: string;
  module_category?: string;
  resolution_description?: string;
  resolved_at?: string;
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
  distributions: {
    deviceStatus: Array<{ status: string; count: number }>;
    issueStatus: Array<{ status: string; count: number }>;
    issueSeverity: Array<{ severity: string; count: number }>;
    versionType: Array<{ version_type: string; count: number }>;
    deviceType: Array<{ type: string; count: number }>;
    moduleCategory: Array<{ category: string; count: number }>;
  };
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
  id?: string; // 可选，新增时由后端自动生成
  name: string;
  type_id: string | number; // 支持字符串和数字类型
  location: string;
  status: '正常' | '异常' | '维护中';
  remote_code?: string;
  password?: string;
}

export interface ModuleFormData {
  device_id: string;
  type_id: string;
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
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  assignee?: string;
  notes?: string;
  resolution_description?: string;
  resolved_at?: string;
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
  device_id?: string;
  module_id?: string;
  category?: string;
  version_type?: string;
}

// 模块类别映射
export const MODULE_CATEGORY_MAP: Record<string, string> = {
  mechanical: '机械',
  electrical: '电气',
  host: '上位机',
  server: '服务器',
  vision: '视觉'
};

// 设备类型映射
export const DEVICE_TYPE_MAP: Record<string, string> = {
  '龙门设备': '龙门设备',
  '底盘设备': '底盘设备',
  '侧扫设备': '侧扫设备',
  '检测设备': '检测设备',
  '其他设备': '其他设备'
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


// 子模块创建/更新接口
export interface SubmoduleFormData {
  module_id: string;
  name: string;
  model?: string;
  factory_version?: string;
  current_version?: string;
  description?: string;
  status: '正常' | '异常' | '维护中';
}

