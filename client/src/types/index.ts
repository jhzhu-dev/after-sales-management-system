// 飞书用户
export interface FeishuUser {
  open_id: string;
  name: string;
  department: string;
  avatar_url?: string;
  synced_at?: string;
}

// 系统对接
export type IntegrationStatus = '洽谈中' | '对接中' | '已完成' | '暂停';

export interface Integration {
  id: number;
  title: string;
  customer_id?: number;
  customer_name?: string;
  customer_short_name?: string;
  status: IntegrationStatus;
  description?: string;
  responsible_person?: string;
  started_at?: string;
  completed_at?: string;
  device_count?: number;
  log_count?: number;
  devices?: IntegrationDevice[];
  logs?: IntegrationLog[];
  created_at: string;
  updated_at: string;
}

export interface IntegrationDevice {
  id: string;
  nickname?: string;
  device_code?: string;
  status?: string;
  product_name?: string;
  customer_name?: string;
  customer_short_name?: string;
  added_at: string;
}

export interface IntegrationLog {
  id: number;
  integration_id: number;
  content: string;
  operator?: string;
  attachments: Array<{ name: string; url: string; size?: number; type?: string }>;
  created_at: string;
}

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
  nickname?: string | null;
  device_code?: string | null;
  product_line_id?: number;
  product_line_name?: string;
  product_id?: number | null;
  product_name?: string | null;
  product_model?: string | null;
  customer_id?: number;
  customer_name?: string;
  customer_short_name?: string;
  status: '生产中' | '使用中(正常)' | '使用中(异常)' | '已停用';
  created_at: string;
  updated_at: string;
  remote_code?: string;
  password?: string;
  merchant_id?: string | null;
  merchant_password?: string | null;
  issue_count?: number;
  open_issues?: number;
  bundle_id?: number | null;
  bundle_id_val?: number | null;
  bundle_code?: string | null;
  bundle_name?: string | null;
  notes?: string | null;
  mechanical_version?: string | null;
  module_total?: number;
  module_versioned?: number;
}

// 模块类型 (仅用于设备详情页面)
export interface Module {
  id: number;
  device_id: string;
  type_id: number;
  created_at: string;
  updated_at: string;
  device_name?: string;
  device_type?: string;
  module_type?: string;
  current_version?: string;
  current_version_type?: string;
  current_version_date?: string;
}



// 版本发布库类型
export interface VersionRelease {
  id: number;
  module_type_id: number;
  module_type_name?: string;
  version_number: string;
  title: string;
  change_log?: string;
  category?: string;
  release_date: string;
  source?: 'manual' | 'synced';
  created_at: string;
  products?: { id: number; name: string; model: string; product_line_id?: number; product_line_name?: string }[];
}

// 问题归属分类配置类型
export interface IssueClassification {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

// 问题类型
export interface Issue {
  id: number;
  device_id: string;
  module_id?: number;  custom_module_name?: string;  category: '硬件故障' | '软件Bug' | '操作咋询' | '安装调试' | '其他';
  classification_id?: number;
  classification_name?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  assignee?: string;
  assignee_open_id?: string;
  follower_open_ids?: string[];
  follower_names?: string[];
  contact_person?: string;
  contact_phone?: string;
  is_visit_required: boolean;
  visit_at?: string;
  attachments?: string[];
  created_at: string;
  updated_at: string;
  device_name?: string;
  device_nickname?: string;
  device_type?: string;
  product_name?: string;
  customer_name?: string;
  customer_short_name?: string;
  module_category?: string;
  resolution_description?: string;
  resolved_at?: string;
}

// 问题处理记录类型
export interface IssueLog {
  id: number;
  issue_id: number;
  content: string;
  operator?: string;
  attachments?: Array<{ name: string; url: string; ossPath: string; size: number }>;
  created_at: string;
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
  id?: string;
  name: string | null;
  device_code?: string | null;
  product_line_id: string | number;
  product_id?: number | null;
  customer_id?: number | null;
  status: '生产中' | '使用中(正常)' | '使用中(异常)' | '已停用';
  remote_code?: string | null;
  password?: string | null;
  merchant_id?: string | null;
  merchant_password?: string | null;
  notes?: string | null;
  selectedModuleTypeIds?: number[];
  // 飞书通知字段（仅前端用，不入库）
  notify_open_ids?: string[];  // 多人通知
  send_notify?: boolean;
  // 展个居学兼容
  notify_open_id?: string;
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
  module_id?: string;  custom_module_name?: string;  category?: '硬件故障' | '软件Bug' | '操作咨询' | '安装调试' | '其他';  classification_id?: number;  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  assignee?: string;  assignee_open_id?: string;
  notify_assignee?: boolean;  contact_person?: string;
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
  operator_open_id?: string;
  notify_operator?: boolean;
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
  classification_id?: string;
  version_type?: string;
  customer_id?: string;
  customer?: string;
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
  '生产中': '生产中',
  '使用中(正常)': '使用中(正常)',
  '使用中(异常)': '使用中(异常)',
  '已停用': '已停用',
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
  feishu_user_open_id?: string | null;  // 关联飞书默认负责人
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

// 产品迭代版本类型
export interface ProductVersion {
  id: number;
  product_id: number;
  version_number: string;
  version_name?: string;
  description?: string;
  specifications?: any;
  status: '开发中' | '量产中' | '已停产';
  release_date?: string;
  is_current: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_model?: string;
  document_count?: number;
  device_count?: number;
  documents?: ProductVersionDocument[];
}

// 产品迭代版本表单数据
export interface ProductVersionFormData {
  product_id: number;
  version_number: string;
  version_name?: string;
  description?: string;
  specifications?: any;
  status?: '开发中' | '量产中' | '已停产';
  release_date?: string;
  is_current?: boolean;
  sort_order?: number;
}

// 产品迭代版本文档类型
export interface ProductVersionDocument {
  id: number;
  product_version_id: number;
  name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  category: '规格书' | '变更记录' | '图纸' | '其他';
  uploaded_by?: string;
  created_at: string;
}

// 运维知识库词条
export interface KbArticle {
  id: number;
  title: string;
  symptom: string;
  cause?: string | null;
  solution: string;
  category: string;
  product_line_id?: number | null;
  product_line_name?: string | null;
  tags?: string[] | null;
  attachments?: Array<{ name: string; url: string; ossPath?: string | null; size?: number }> | null;
  is_pinned: boolean;
  view_count: number;
  helpful_count: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== SOP 检查清单 ====================

export interface SOPTemplateItem {
  id: string;
  text: string;
  required: boolean;
}

export interface SOPTemplate {
  id: number;
  module_type_id: number;
  module_type_name?: string;
  module_type_code?: string;
  items: SOPTemplateItem[];
  created_at: string;
  updated_at: string;
}

/** 提交版本更新时，每一项检查清单的完成状态快照 */
export type ChecklistItemStatus = 'pending' | 'done' | 'na';

export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  status: ChecklistItemStatus;
  /** 图片附件列表（status = done 时上传） */
  attachments: ChecklistAttachment[];
}

export interface ChecklistAttachment {
  name: string;
  url: string;
  size: number;
}

// ==================== 多合一设备 ====================

export interface DeviceBundle {
  id: number;
  bundle_code: string;
  name?: string | null;
  customer_id: number;
  customer_name?: string;
  customer_short_name?: string;
  description?: string | null;
  device_count?: number;
  document_count?: number;
  remote_code?: string | null;
  open_issues?: number;
  password?: string | null;
  merchant_id?: string | null;
  merchant_password?: string | null;
  devices?: Device[];
  stats?: {
    total_modules: number;
    total_issues: number;
    open_issues: number;
    bundle_documents: number;
  };
  created_at: string;
  updated_at: string;
}

export interface NewBundleDevice {
  id: string;
  device_code?: string;
  product_line_id: number;
  product_id?: number;
  status?: string;
  module_type_ids?: number[];
  notes?: string;
  notify_open_ids?: string[];
}

export interface DeviceBundleFormData {
  bundle_code?: string;
  name?: string;
  customer_id: number;
  description?: string;
  device_ids?: string[];
  new_devices?: NewBundleDevice[];
  remote_code?: string;
  password?: string;
  merchant_id?: string;
  merchant_password?: string;
}
