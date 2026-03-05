import axios from 'axios';
import {
  Device,
  Module,
  Issue,
  DashboardStats,
  DeviceFormData,
  ModuleFormData,
  IssueFormData,
  FilterOptions,
  ApiResponse,
  PaginatedResponse,
  VersionRelease,
  DeviceUpgrade,
  DeviceUpgradeFormData,
  ProductLine,
  Product,
  ProductModule,
  ProductModuleHistory,
  ModuleType,
  Customer,
  ProductVersion,
  ProductVersionFormData,
  ProductVersionDocument
} from '../types';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API请求错误:', error);

    // 处理401错误（未授权/token失效）
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_username');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // 处理429错误（请求过于频繁）
    if (error.response && error.response.status === 429) {
      console.warn('请求过于频繁，稍后重试');
      // 可以在这里添加重试逻辑或显示用户友好的提示
    }

    // 处理404错误
    if (error.response && error.response.status === 404) {
      console.warn('资源不存在');
    }

    return Promise.reject(error);
  }
);

// 设备相关API
export const deviceApi = {
  // 获取设备列表
  getDevices: (params?: FilterOptions): Promise<PaginatedResponse<Device>> =>
    api.get('/devices', { params }).then(res => res.data),

  // 获取单个设备
  getDevice: (id: string): Promise<ApiResponse<Device>> =>
    api.get(`/devices/${id}`).then(res => res.data),

  // 创建设备
  createDevice: (data: DeviceFormData): Promise<ApiResponse<Device>> =>
    api.post('/devices', data).then(res => res.data),

  // 更新设备
  updateDevice: (id: string, data: Partial<DeviceFormData>): Promise<ApiResponse<Device>> =>
    api.put(`/devices/${id}`, data).then(res => res.data),

  // 删除设备
  deleteDevice: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/devices/${id}`).then(res => res.data),

  // 获取设备统计
  getDeviceStats: (id: string): Promise<ApiResponse<any>> =>
    api.get(`/devices/${id}/stats`).then(res => res.data),
};


// 问题相关API
export const issueApi = {
  // 获取问题列表
  getIssues: (params?: FilterOptions): Promise<PaginatedResponse<Issue>> =>
    api.get('/issues', { params }).then(res => res.data),

  // 获取单个问题
  getIssue: (id: string): Promise<ApiResponse<Issue>> =>
    api.get(`/issues/${id}`).then(res => res.data),

  // 创建问题
  createIssue: (data: IssueFormData): Promise<ApiResponse<Issue>> =>
    api.post('/issues', data).then(res => res.data),

  // 更新问题
  updateIssue: (id: string, data: Partial<IssueFormData>): Promise<ApiResponse<Issue>> =>
    api.put(`/issues/${id}`, data).then(res => res.data),

  // 删除问题
  deleteIssue: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/issues/${id}`).then(res => res.data),

  // 获取问题统计
  getIssueStats: (): Promise<ApiResponse<any>> =>
    api.get('/issues/stats/overview').then(res => res.data),

  // 批量更新问题状态
  batchUpdateStatus: (issueIds: (string | number)[], status: string): Promise<ApiResponse<void>> =>
    api.patch('/issues/batch/status', { issue_ids: issueIds, status }).then(res => res.data),
};

// 售后统计相关API
export const afterSalesApi = {
  // 获取售后趋势
  getTrend: (): Promise<ApiResponse<any[]>> =>
    api.get('/after-sales/stats/trend').then(res => res.data),

  // 获取分类统计
  getCategories: (): Promise<ApiResponse<any[]>> =>
    api.get('/after-sales/stats/categories').then(res => res.data),

  // 获取严重性统计
  getSeverities: (): Promise<ApiResponse<any[]>> =>
    api.get('/after-sales/stats/severities').then(res => res.data),

  // 获取成本统计
  getCosts: (): Promise<ApiResponse<any>> =>
    api.get('/after-sales/stats/costs').then(res => res.data),

  // 获取售后概览
  getOverview: (): Promise<ApiResponse<any>> =>
    api.get('/after-sales/overview').then(res => res.data),
};

// 设备升级相关API
export const deviceUpgradeApi = {
  // 获取升级记录
  getUpgrades: (params?: any): Promise<PaginatedResponse<DeviceUpgrade>> =>
    api.get('/device-upgrades', { params }).then(res => res.data),

  // 创建升级记录
  createUpgrade: (data: DeviceUpgradeFormData): Promise<ApiResponse<any>> =>
    api.post('/device-upgrades', data).then(res => res.data),

  // 更新审计记录
  updateUpgrade: (id: number, data: Partial<DeviceUpgradeFormData>): Promise<ApiResponse<any>> =>
    api.put(`/device-upgrades/${id}`, data).then(res => res.data),

  // 删除升级记录
  deleteUpgrade: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/device-upgrades/${id}`).then(res => res.data),
};

// 仪表盘相关API
export const dashboardApi = {
  // 获取仪表盘统计
  getStats: (): Promise<ApiResponse<DashboardStats>> =>
    api.get('/dashboard/stats').then(res => res.data),

  // 获取设备概览
  getDevicesOverview: (): Promise<ApiResponse<Device[]>> =>
    api.get('/dashboard/devices/overview').then(res => res.data),

  // 获取问题概览
  getIssuesOverview: (): Promise<ApiResponse<Issue[]>> =>
    api.get('/dashboard/issues/overview').then(res => res.data),

  // 获取版本概览
  getVersionsOverview: (): Promise<ApiResponse<any[]>> =>
    api.get('/dashboard/versions/overview').then(res => res.data),

  // 获取性能指标
  getPerformance: (): Promise<ApiResponse<any>> =>
    api.get('/dashboard/performance').then(res => res.data),
};

// 设备类型API
export const deviceTypeApi = {
  // 获取设备类型列表
  getDeviceTypes: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<PaginatedResponse<any>> =>
    api.get('/device-types', { params }).then(res => res.data),

  // 获取单个设备类型
  getDeviceType: (id: number): Promise<ApiResponse<any>> =>
    api.get(`/device-types/${id}`).then(res => res.data),

  // 创建设备类型
  createDeviceType: (data: any): Promise<ApiResponse<any>> =>
    api.post('/device-types', data).then(res => res.data),

  // 更新设备类型
  updateDeviceType: (id: number, data: any): Promise<ApiResponse<any>> =>
    api.put(`/device-types/${id}`, data).then(res => res.data),

  // 删除设备类型
  deleteDeviceType: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/device-types/${id}`).then(res => res.data),
};

// 模块相关API (仅用于设备详情页面)
export const moduleApi = {
  // 获取模块列表
  getModules: (params?: FilterOptions): Promise<PaginatedResponse<Module>> =>
    api.get('/modules', { params }).then(res => res.data),

  // 获取单个模块
  getModule: (id: string): Promise<ApiResponse<Module>> =>
    api.get(`/modules/${id}`).then(res => res.data),

  // 创建模块
  createModule: (data: ModuleFormData): Promise<ApiResponse<Module>> =>
    api.post('/modules', data).then(res => res.data),

  // 更新模块
  updateModule: (id: string, data: Partial<ModuleFormData>): Promise<ApiResponse<Module>> =>
    api.put(`/modules/${id}`, data).then(res => res.data),

  // 删除模块
  deleteModule: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/modules/${id}`).then(res => res.data),
};



// 模块版本管理API (新增)
export const moduleVersionApi = {
  getModuleVersions: (params?: any): Promise<PaginatedResponse<any>> =>
    api.get('/versions', { params }).then(res => res.data),

  createModuleVersion: (data: any): Promise<ApiResponse<any>> =>
    api.post('/versions', data).then(res => res.data),
};

// 版本发布库相关API (新增)
export const versionReleaseApi = {
  // 获取发布记录列表
  getReleases: (params?: { module_type_id?: number }): Promise<ApiResponse<VersionRelease[]>> =>
    api.get('/version-releases', { params }).then(res => res.data),

  // 获取单个发布记录
  getRelease: (id: number): Promise<ApiResponse<VersionRelease>> =>
    api.get(`/version-releases/${id}`).then(res => res.data),

  // 创建发布记录
  createRelease: (data: Partial<VersionRelease>): Promise<ApiResponse<VersionRelease>> =>
    api.post('/version-releases', data).then(res => res.data),
};

// 产品线相关API
export const productLineApi = {
  getProductLines: (params?: { is_active?: boolean }): Promise<ApiResponse<ProductLine[]>> =>
    api.get('/product-lines', { params }).then(res => res.data),

  getProductsByLine: (id: number): Promise<ApiResponse<Product[]>> =>
    api.get(`/product-lines/${id}/products`).then(res => res.data),

  getProductLine: (id: number): Promise<ApiResponse<ProductLine>> =>
    api.get(`/product-lines/${id}`).then(res => res.data),

  createProductLine: (data: any): Promise<ApiResponse<ProductLine>> =>
    api.post('/product-lines', data).then(res => res.data),

  updateProductLine: (id: number, data: any): Promise<ApiResponse<any>> =>
    api.put(`/product-lines/${id}`, data).then(res => res.data),

  deleteProductLine: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/product-lines/${id}`).then(res => res.data),
};

// 产品相关API
export const productApi = {
  getProducts: (params?: { product_line_id?: number; is_active?: boolean }): Promise<ApiResponse<Product[]>> =>
    api.get('/products', { params }).then(res => res.data),

  getProduct: (id: string | number): Promise<ApiResponse<Product>> =>
    api.get(`/products/${id}`).then(res => res.data),

  createProduct: (data: any): Promise<ApiResponse<Product>> =>
    api.post('/products', data).then(res => res.data),

  updateProduct: (id: number, data: any): Promise<ApiResponse<any>> =>
    api.put(`/products/${id}`, data).then(res => res.data),

  deleteProduct: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/products/${id}`).then(res => res.data),
};

// 产品模块配置相关API
export const productModuleApi = {
  // 获取产品的模块配置
  getProductModules: (productId: number): Promise<ApiResponse<ProductModule[]>> =>
    api.get(`/product-modules/${productId}/modules`).then(res => res.data),

  // 获取模块配置历史
  getModuleHistory: (productId: number, moduleTypeId: number, params?: { limit?: number }): Promise<ApiResponse<ProductModuleHistory[]>> =>
    api.get(`/product-modules/${productId}/modules/${moduleTypeId}/history`, { params }).then(res => res.data),

  // 添加模块到产品
  createProductModule: (productId: number, data: {
    module_type_id: number;
    is_required?: boolean;
    default_config?: any;
    version_number?: string;
    change_description?: string;
    created_by?: string;
  }): Promise<ApiResponse<ProductModule>> =>
    api.post(`/product-modules/${productId}/modules`, data).then(res => res.data),

  // 更新产品模块配置（创建新版本）
  updateProductModule: (productId: number, moduleId: number, data: {
    is_required?: boolean;
    default_config?: any;
    version_number: string;
    change_description: string;
    created_by?: string;
  }): Promise<ApiResponse<any>> =>
    api.put(`/product-modules/${productId}/modules/${moduleId}`, data).then(res => res.data),

  // 删除产品模块配置
  deleteProductModule: (productId: number, moduleId: number, created_by?: string): Promise<ApiResponse<void>> =>
    api.delete(`/product-modules/${productId}/modules/${moduleId}`, { data: { created_by } }).then(res => res.data),

  // 批量添加模块配置（带冲突检测）
  batchAdd: (data: {
    product_ids: number[];
    modules: Array<{
      module_type_id: number;
      is_required?: boolean;
      default_config?: any;
    }>;
    version_number?: string;
    created_by?: string;
  }): Promise<ApiResponse<any>> =>
    api.post('/product-modules/batch', data).then(res => res.data),

  // 批量覆盖模块配置
  batchOverwrite: (data: {
    product_ids: number[];
    modules: Array<{
      module_type_id: number;
      is_required?: boolean;
      default_config?: any;
    }>;
    version_number?: string;
    created_by?: string;
  }): Promise<ApiResponse<any>> =>
    api.post('/product-modules/batch-overwrite', data).then(res => res.data),
};

// 模块类型相关API
export const moduleTypeApi = {
  // 获取所有模块类型
  getModuleTypes: (params?: { search?: string; is_active?: boolean; page?: number; limit?: number }): Promise<ApiResponse<ModuleType[]>> =>
    api.get('/module-types', { params }).then(res => res.data),

  // 获取活跃的模块类型（用于下拉选择）
  getActiveModuleTypes: (): Promise<ApiResponse<ModuleType[]>> =>
    api.get('/module-types/active').then(res => res.data),

  // 获取单个模块类型
  getModuleType: (id: number): Promise<ApiResponse<ModuleType>> =>
    api.get(`/module-types/${id}`).then(res => res.data),

  // 创建模块类型
  createModuleType: (data: {
    name: string;
    code: string;
    description?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<ModuleType>> =>
    api.post('/module-types', data).then(res => res.data),

  // 更新模块类型
  updateModuleType: (id: number, data: {
    name?: string;
    code?: string;
    description?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<any>> =>
    api.put(`/module-types/${id}`, data).then(res => res.data),

  // 删除模块类型
  deleteModuleType: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/module-types/${id}`).then(res => res.data),
};

// 客户管理API
export const customerApi = {
  // 获取客户列表
  getCustomers: (params?: { search?: string }): Promise<ApiResponse<Customer[]>> =>
    api.get('/customers', { params }).then(res => res.data),

  // 获取单个客户
  getCustomer: (id: number): Promise<ApiResponse<Customer>> =>
    api.get(`/customers/${id}`).then(res => res.data),

  // 创建客户
  createCustomer: (data: { name: string; short_name: string }): Promise<ApiResponse<Customer>> =>
    api.post('/customers', data).then(res => res.data),

  // 更新客户
  updateCustomer: (id: number, data: { name?: string; short_name?: string }): Promise<ApiResponse<Customer>> =>
    api.put(`/customers/${id}`, data).then(res => res.data),

  // 删除客户
  deleteCustomer: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/customers/${id}`).then(res => res.data),
};

// 健康检查API
export const healthApi = {
  check: (): Promise<ApiResponse<any>> =>
    api.get('/health').then(res => res.data),
};

// 产品迭代版本相关API
export const productVersionApi = {
  // 获取版本列表
  getVersions: (params?: { product_id?: number; status?: string }): Promise<PaginatedResponse<ProductVersion>> =>
    api.get('/product-versions', { params }).then(res => res.data),

  // 获取单个版本详情
  getVersion: (id: number): Promise<ApiResponse<ProductVersion>> =>
    api.get(`/product-versions/${id}`).then(res => res.data),

  // 创建版本
  createVersion: (data: ProductVersionFormData): Promise<ApiResponse<ProductVersion>> =>
    api.post('/product-versions', data).then(res => res.data),

  // 更新版本
  updateVersion: (id: number, data: Partial<ProductVersionFormData>): Promise<ApiResponse<any>> =>
    api.put(`/product-versions/${id}`, data).then(res => res.data),

  // 删除版本
  deleteVersion: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/product-versions/${id}`).then(res => res.data),

  // 设为当前版本
  setCurrentVersion: (id: number): Promise<ApiResponse<any>> =>
    api.put(`/product-versions/${id}/set-current`).then(res => res.data),

  // 获取版本文档
  getDocuments: (versionId: number): Promise<ApiResponse<ProductVersionDocument[]>> =>
    api.get(`/product-versions/${versionId}/documents`).then(res => res.data),

  // 上传版本文档
  uploadDocuments: (versionId: number, formData: FormData): Promise<ApiResponse<any>> =>
    api.post(`/product-versions/${versionId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(res => res.data),

  // 删除版本文档
  deleteDocument: (docId: number): Promise<ApiResponse<void>> =>
    api.delete(`/product-versions/documents/${docId}`).then(res => res.data),

  // 预览版本文档（获取签名URL）
  previewDocument: (docId: number): Promise<ApiResponse<{ url: string; name: string; file_type: string }>> =>
    api.get(`/product-versions/documents/${docId}/preview`).then(res => res.data),

  // 下载版本文档
  downloadDocument: (docId: number): string => {
    const token = localStorage.getItem('auth_token');
    return `${api.defaults.baseURL}/product-versions/documents/${docId}/download?token=${token}`;
  },
};

export default api;
