import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import Select from './Select';
import ButtonGroup from './ButtonGroup';
import { customerRequirementApi, customerApi, deviceApi } from '../services/api';
import { Button } from '../components/ui/button';
import { CustomerRequirement, CustomerRequirementFormData, Customer, Device, RequirementType, RequirementUrgency } from '../types';
import { getUrgencyColor } from '../utils';

interface CustomerRequirementFormProps {
  requirement?: CustomerRequirement | null;
  onClose: () => void;
  onSubmit: (data: CustomerRequirementFormData) => Promise<void>;
}

const REQ_TYPES: RequirementType[] = ['接口对接', '功能定制', '输出结果定制'];
const URGENCIES = ['高', '中', '低'] as const;

const CustomerRequirementForm: React.FC<CustomerRequirementFormProps> = ({ requirement, onClose, onSubmit }) => {
  const isEdit = !!requirement?.id;

  const [customerId, setCustomerId] = useState('');
  const [requirementType, setRequirementType] = useState<RequirementType>('接口对接');
  const [proposedDate, setProposedDate] = useState('');
  const [urgency, setUrgency] = useState<RequirementUrgency>('中');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [custRes, devRes] = await Promise.all([
          customerApi.getCustomers({ search: '' }),
          deviceApi.getDevices({ limit: 500 }),
        ]);
        setCustomers(custRes.data || []);
        setDevices(devRes.data || []);
      } catch (e) {
        console.error('加载选项失败:', e);
      }
    })();
  }, []);

  // 编辑时回填
  useEffect(() => {
    if (!isEdit || !requirement) return;
    setCustomerId(String(requirement.customer_id || ''));
    setRequirementType(requirement.requirement_type);
    setProposedDate(requirement.proposed_date ? String(requirement.proposed_date).slice(0, 10) : '');
    setUrgency(requirement.urgency);
    setDescription(requirement.description || '');
    setRemarks(requirement.remarks || '');
    customerRequirementApi.getDetail(requirement.id).then(res => {
      if (res.success && res.data) {
        const ids = (res.data.devices || []).map(d => String(d.id));
        setDeviceIds(ids);
      }
    }).catch((e) => console.error('加载需求详情失败:', e));
  }, [isEdit, requirement]);

  useEffect(() => { setLoading(false); }, []);

  const customerOptions: SearchableSelectOption[] = useMemo(
    () => customers.map(c => ({ id: String(c.id), name: c.name, short_name: c.short_name })),
    [customers]
  );

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(d =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.id && String(d.id).toLowerCase().includes(q)) ||
      (d.device_code && String(d.device_code).toLowerCase().includes(q)) ||
      (d.nickname && d.nickname.toLowerCase().includes(q))
    );
  }, [devices, deviceSearch]);

  const toggleDevice = (deviceId: string) => {
    setDeviceIds(prev => prev.includes(deviceId) ? prev.filter(x => x !== deviceId) : [...prev, deviceId]);
  };

  const validate = (): boolean => {
    const ne: { [key: string]: string } = {};
    if (!customerId) ne.customerId = '请选择客户名称';
    if (!requirementType) ne.requirementType = '请选择需求分类';
    if (!proposedDate) ne.proposedDate = '请选择需求提出日期';
    if (!description.trim()) ne.description = '请填写需求详情描述';
    if (deviceIds.length === 0) ne.deviceIds = '请至少选择一台涉及设备';
    setErrors(ne);
    return Object.keys(ne).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError('');
    try {
      await onSubmit({
        customer_id: Number(customerId),
        requirement_type: requirementType,
        proposed_date: proposedDate,
        urgency,
        description,
        remarks,
        device_ids: deviceIds,
      });
      onClose();
    } catch (err: any) {
      setServerError(err?.response?.data?.error || '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? '编辑需求' : '新增需求'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{serverError}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客户名称 <span className="text-red-500">*</span></label>
              <SearchableSelect value={customerId} onChange={setCustomerId} options={customerOptions} placeholder="请选择客户" />
              {errors.customerId && <p className="mt-1 text-xs text-red-500">{errors.customerId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">需求分类 <span className="text-red-500">*</span></label>
              <Select value={requirementType} onChange={v => setRequirementType(v as RequirementType)} options={REQ_TYPES.map(t => ({ value: t, label: t }))} className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">需求提出日期 <span className="text-red-500">*</span></label>
              <input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)} className={inputCls} />
              {errors.proposedDate && <p className="mt-1 text-xs text-red-500">{errors.proposedDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">紧急程度</label>
              <ButtonGroup value={urgency} onChange={v => setUrgency(v as RequirementUrgency)} options={URGENCIES.map(u => ({ value: u, label: u }))} colorClass={getUrgencyColor} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">需求详情描述 <span className="text-red-500">*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className={inputCls} placeholder="请描述客户需求详情..." />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className={inputCls} placeholder="需求变更时写入原需求编号等信息" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">涉及设备 <span className="text-red-500">*</span></label>
            <div className="border border-gray-300 rounded-md">
              <input
                type="text"
                value={deviceSearch}
                onChange={e => setDeviceSearch(e.target.value)}
                placeholder="搜索设备名称 / 编号 / 昵称..."
                className="w-full px-3 py-2 border-b border-gray-200 text-sm focus:outline-none"
              />
              <div className="max-h-48 overflow-y-auto p-2">
                {filteredDevices.map(d => (
                  <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none hover:bg-gray-50">
                    <input type="checkbox" checked={deviceIds.includes(d.id)} onChange={() => toggleDevice(d.id)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40" />
                    <span className="text-sm text-gray-800">
                      <span className="font-medium">{d.id || d.name}</span>
                      {d.nickname ? <span className="text-gray-400 ml-2">· {d.nickname}</span> : null}
                    </span>
                  </label>
                ))}
                {filteredDevices.length === 0 && <div className="px-2 py-2 text-sm text-gray-500">无匹配设备</div>}
              </div>
            </div>
            {errors.deviceIds && <p className="mt-1 text-xs text-red-500">{errors.deviceIds}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={submitting}>{submitting ? '提交中...' : '保存'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerRequirementForm;
