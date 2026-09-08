import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { orderImportApi, bundleApi, customerApi } from '../services/api';

interface PreviewDevice {
  fullName: string;
  model: string;
  quantity: number;
  device_code: string;
  serial: string;
  status: string;
  product_id: number | null;
  product_line_id: number | null;
  product_name: string;
  product_short_name: string;
  product_model: string;
}

interface PreviewCustomer {
  status: string;
  name: string;
  short_name: string;
  country: string;
  contact: string;
  address: string;
  email: string;
  usage: string;
  install: string;
  id: number | null;
}

interface PreviewData {
  orderNo: string;
  orderName: string;
  sendTime: string;
  planShip: string;
  transport: string;
  packaging: string;
  battery: string;
  merchantId: string;
  note: string;
  customer: PreviewCustomer;
  devices: PreviewDevice[];
}

const STATUS_LABEL: Record<string, string> = {
  resolved: '已识别',
  ambiguous: '型号多解',
  unknown: '未识别',
  missing_model: '缺型号',
};

const OrderImport: React.FC = () => {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [customer, setCustomer] = useState<PreviewCustomer | null>(null);
  const [devices, setDevices] = useState<PreviewDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await orderImportApi.preview(file);
      if (res.success && res.data) {
        setPreview(res.data);
        setCustomer({ ...res.data.customer });
        setDevices(res.data.devices.map((d: any) => ({ ...d })));
      } else {
        setError(res.error || '解析失败');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || '解析失败，请确认是订单信息表');
    } finally {
      setLoading(false);
    }
  };

  const updateDevice = (idx: number, patch: Partial<PreviewDevice>) => {
    setDevices(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const nameColor = (s: string) =>
    s === 'resolved' ? 'text-green-600' : s === 'ambiguous' ? 'text-orange-600' : 'text-red-600';

  const handleSubmit = async () => {
    if (!preview || !customer) return;
    setError('');

    // 校验
    if (!customer.name.trim()) { setError('请填写客户名称'); return; }
    if (!customer.short_name.trim()) { setError('请填写客户简称'); return; }
    for (let i = 0; i < devices.length; i++) {
      if (!devices[i].serial.trim()) { setError(`第 ${i + 1} 台设备未填写序列号`); return; }
      if (!devices[i].product_line_id) { setError(`第 ${i + 1} 台设备未识别到产品线（产品为 ${devices[i].fullName}）`); return; }
    }

    setSubmitting(true);
    try {
      // 客户
      let customerId = customer.id;
      if (!customerId) {
        const cRes = await customerApi.createCustomer({ name: customer.name, short_name: customer.short_name });
        if (!cRes.success) throw new Error(cRes.error || '创建客户失败');
        customerId = cRes.data?.id;
      }

      const newDevices = devices.map(d => ({
        id: d.serial.trim(),
        device_code: d.device_code?.trim() || undefined,
        product_line_id: d.product_line_id!,
        product_id: d.product_id || undefined,
        status: '使用中(正常)',
        notes: d.fullName,
      }));

      const res = await bundleApi.createBundle({
        bundle_code: preview.orderNo,
        name: preview.orderName || preview.orderNo,
        customer_id: customerId,
        description: preview.note || preview.orderName || '',
        merchant_id: preview.merchantId || undefined,
        new_devices: newDevices,
      });
      if (res.success) {
        setSuccessMsg(`已成功创建多合一「${preview.orderNo}」，包含 ${newDevices.length} 台设备`);
        const bundleId = res.data?.id;
        setTimeout(() => navigate(bundleId ? `/bundles/${bundleId}` : '/devices'), 1500);
      } else {
        setError(res.error || '创建失败');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40';

  return (
    <Layout>
      <div className="p-4 3xl:p-6">
        <button onClick={() => navigate('/devices')} className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> 返回设备管理
        </button>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-800">导入订单信息表</h2>
            <label className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
              <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
              {loading ? '解析中...' : '选择 Excel'}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={loading} />
            </label>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-500">上传《订单信息表.xlsx》，自动识别订单号、客户、产品与设备编码；每台设备需手工填写序列号后确认创建。</p>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-start gap-2">
                <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" /> {error}
              </div>
            )}
            {successMsg && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" /> {successMsg}
              </div>
            )}
          </div>
        </div>

        {preview && (
          <>
            {/* 订单信息 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-800">订单信息</h2>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><dt className="text-xs text-gray-500">订单号</dt><dd className="text-sm text-gray-900 mt-1">{preview.orderNo}</dd></div>
                <div><dt className="text-xs text-gray-500">订单名称（简称）</dt><dd className="text-sm text-gray-900 mt-1">{preview.orderName}</dd></div>
                <div><dt className="text-xs text-gray-500">订单发送时间</dt><dd className="text-sm text-gray-900 mt-1">{preview.sendTime}</dd></div>
                <div><dt className="text-xs text-gray-500">计划发货</dt><dd className="text-sm text-gray-900 mt-1">{preview.planShip}</dd></div>
                <div><dt className="text-xs text-gray-500">运输方式</dt><dd className="text-sm text-gray-900 mt-1">{preview.transport}</dd></div>
                <div><dt className="text-xs text-gray-500">包装方式</dt><dd className="text-sm text-gray-900 mt-1">{preview.packaging}</dd></div>
                <div><dt className="text-xs text-gray-500">商户号</dt><dd className="text-sm text-gray-900 mt-1">{preview.merchantId || '-'}</dd></div>
                <div><dt className="text-xs text-gray-500">电池/备注</dt><dd className="text-sm text-gray-900 mt-1">{preview.battery}</dd></div>
              </div>
              {preview.note && (
                <div className="px-4 pb-4">
                  <dt className="text-xs text-gray-500">其他备注</dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-md p-3 mt-1">{preview.note}</dd>
                </div>
              )}
            </div>

            {/* 客户信息 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-800">客户信息</h2>
                <span className={`text-xs font-medium ${customer?.status === 'new' ? 'text-orange-600' : customer?.status === 'missing' ? 'text-red-600' : 'text-green-600'}`}>
                  {customer?.status === 'new' ? '提交时将新建客户' : customer?.status === 'missing' ? '客户名称为空' : '已匹配现有客户'}
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">客户 / 代理（售后登记名称）*</label>
                  <input value={customer?.name || ''} onChange={e => setCustomer(c => c ? { ...c, name: e.target.value } : c)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">客户简称 *</label>
                  <input value={customer?.short_name || ''} onChange={e => setCustomer(c => c ? { ...c, short_name: e.target.value } : c)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">国家/区域</label>
                  <input value={customer?.country || ''} onChange={e => setCustomer(c => c ? { ...c, country: e.target.value } : c)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">使用场景</label>
                  <input value={customer?.usage || ''} onChange={e => setCustomer(c => c ? { ...c, usage: e.target.value } : c)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">安装场景</label>
                  <input value={customer?.install || ''} onChange={e => setCustomer(c => c ? { ...c, install: e.target.value } : c)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">联系电话</label>
                  <input value={customer?.contact || ''} onChange={e => setCustomer(c => c ? { ...c, contact: e.target.value } : c)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">地址</label>
                  <input value={customer?.address || ''} onChange={e => setCustomer(c => c ? { ...c, address: e.target.value } : c)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">邮箱</label>
                  <input value={customer?.email || ''} onChange={e => setCustomer(c => c ? { ...c, email: e.target.value } : c)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* 设备清单 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-800">设备清单（共 {devices.length} 台）</h2>
                <p className="text-xs text-gray-400">型号已自动识别，请确认/编辑设备编码并填写序列号</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">产品 / 型号</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">数量</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">识别状态</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">产品（简称）</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">设备编码</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">序列号 *</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {devices.map((d, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-gray-800">
                          <div>{d.fullName}</div>
                          <div className="text-xs text-gray-400">{d.model}</div>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-800">{d.quantity}</td>
                        <td className={`px-4 py-2 text-sm font-medium ${nameColor(d.status)}`}>{STATUS_LABEL[d.status] || d.status}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{d.product_short_name || '-'}</td>
                        <td className="px-4 py-2">
                          <input value={d.device_code} onChange={e => updateDevice(idx, { device_code: e.target.value })} className={inputCls} placeholder="设备编码" />
                        </td>
                        <td className="px-4 py-2">
                          <input value={d.serial} onChange={e => updateDevice(idx, { serial: e.target.value })} className={inputCls} placeholder="序列号（必填）" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 mb-4">
              <Button type="button" variant="outline" onClick={() => navigate('/devices')}>取消</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? '创建中...' : '确认创建多合一'}</Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default OrderImport;
