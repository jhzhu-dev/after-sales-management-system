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
  Submodule,
  SubmoduleFormData,
  SubmoduleVersion
} from '../types';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.host}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token
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
  batchUpdateStatus: (issueIds: string[], status: string): Promise<ApiResponse<void>> =>
    api.patch('/issues/batch/status', { issue_ids: issueIds, status }).then(res => res.data),
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
  getVersionsOverview: (): Promise<ApiResponse<SubmoduleVersion[]>> =>
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

// 模块类型API
export const moduleTypeApi = {
  // 获取模块类型列表
  getModuleTypes: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<PaginatedResponse<any>> =>
    api.get('/module-types', { params }).then(res => res.data),

  // 获取单个模块类型
  getModuleType: (id: number): Promise<ApiResponse<any>> =>
    api.get(`/module-types/${id}`).then(res => res.data),

  // 创建模块类型
  createModuleType: (data: any): Promise<ApiResponse<any>> =>
    api.post('/module-types', data).then(res => res.data),

  // 更新模块类型
  updateModuleType: (id: number, data: any): Promise<ApiResponse<any>> =>
    api.put(`/module-types/${id}`, data).then(res => res.data),

  // 删除模块类型
  deleteModuleType: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/module-types/${id}`).then(res => res.data),
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

// 子模块API (仅用于设备详情页面)
export const submoduleApi = {
  // 获取子模块列表
  getSubmodules: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    module_id?: string;
  }): Promise<PaginatedResponse<Submodule>> =>
    api.get('/submodules', { params }).then(res => res.data),

  // 获取单个子模块
  getSubmodule: (id: string): Promise<ApiResponse<Submodule>> =>
    api.get(`/submodules/${id}`).then(res => res.data),

  // 创建子模块
  createSubmodule: (data: SubmoduleFormData): Promise<ApiResponse<Submodule>> =>
    api.post('/submodules', data).then(res => res.data),

  // 更新子模块
  updateSubmodule: (id: string, data: SubmoduleFormData): Promise<ApiResponse<Submodule>> =>
    api.put(`/submodules/${id}`, data).then(res => res.data),

  // 删除子模块
  deleteSubmodule: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/submodules/${id}`).then(res => res.data),

  // 获取指定模块的子模块列表
  getSubmodulesByModule: (moduleId: string): Promise<ApiResponse<Submodule[]>> =>
    api.get(`/submodules/module/${moduleId}`).then(res => res.data),
};

// 子模块版本管理API (仅用于设备详情页面)
export const submoduleVersionApi = {
  getSubmoduleVersions: (params?: any): Promise<PaginatedResponse<SubmoduleVersion>> =>
    api.get('/submodule-versions', { params }).then(res => res.data),
  
  getSubmoduleVersion: (id: string): Promise<ApiResponse<SubmoduleVersion>> =>
    api.get(`/submodule-versions/${id}`).then(res => res.data),
  
  createSubmoduleVersion: (data: Partial<SubmoduleVersion>): Promise<ApiResponse<SubmoduleVersion>> =>
    api.post('/submodule-versions', data).then(res => res.data),
  
  updateSubmoduleVersion: (id: string, data: Partial<SubmoduleVersion>): Promise<ApiResponse<SubmoduleVersion>> =>
    api.put(`/submodule-versions/${id}`, data).then(res => res.data),
  
  deleteSubmoduleVersion: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/submodule-versions/${id}`).then(res => res.data),
  
  getSubmoduleVersionsBySubmodule: (submoduleId: string, params?: any): Promise<PaginatedResponse<SubmoduleVersion>> =>
    api.get(`/submodule-versions/submodule/${submoduleId}`, { params }).then(res => res.data),
};

// 健康检查API
export const healthApi = {
  check: (): Promise<ApiResponse<any>> =>
    api.get('/health').then(res => res.data),
};

export default api;
