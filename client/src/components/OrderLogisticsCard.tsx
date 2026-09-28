import React, { useState, useEffect, useCallback } from 'react';
import { TruckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Button } from './ui/button';
import OrderLogisticsForm from './OrderLogisticsForm';
import { orderLogisticsApi } from '../services/api';
import { OrderLogistics } from '../types';
import { formatDate } from '../utils';

interface OrderLogisticsCardProps {
  orderNo: string;
  customerName?: string;
  onChanged?: () => void;
  /** 详情页标签页内嵌模式：去掉外层卡片壳，仅渲染标题+内容 */
  embedded?: boolean;
}

function fmtDate(v?: string | null) {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v).slice(0, 10) : formatDate(v, 'yyyy-MM-dd');
}

/**
 * 订单物流信息卡片：用于设备详情 / 多合一详情页，按订单号自动加载（一单一档）。
 */
const OrderLogisticsCard: React.FC<OrderLogisticsCardProps> = ({ orderNo, customerName, onChanged, embedded }) => {
  const [record, setRecord] = useState<OrderLogistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchRecord = useCallback(async () => {
    if (!orderNo) return;
    setLoading(true);
    try {
      const res = await orderLogisticsApi.getByOrder(orderNo);
      setRecord(res.success && res.data ? res.data : null);
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [orderNo]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  const handleSaved = (_record: OrderLogistics, message?: string) => {
    fetchRecord();
    if (message) {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
    if (onChanged) onChanged();
  };

  if (!orderNo) return null;

  const cellCls = 'text-sm text-gray-900 mt-1 break-words';
  const batteries = record?.batteries || [];
  const packages = record?.packages || [];
  const totalWeight = packages.reduce((s, p) => s + (Number(p.weight_kg) || 0), 0);

  // 装入设备展示：尽量带出设备描述（备注/产品名称）
  const deviceLabel = (id: string) => {
    const d = (record?.devices || []).find(x => x.id === id);
    return d?.notes ? `${id}（${d.notes}）` : id;
  };

  return (
    <div className={embedded ? '' : 'bg-card rounded-2xl border border-border shadow-soft p-5'}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TruckIcon className="h-5 w-5 text-primary-600" /> 物流信息
        </h2>
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          disabled={loading}
        >
          <PencilSquareIcon className="h-4 w-4" />
          {record ? '编辑' : '登记物流信息'}
        </Button>
      </div>

      {successMsg && (
        <div className="mb-3 p-2.5 bg-green-500/10 border border-green-500/30 rounded-md text-green-500 text-sm">{successMsg}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">加载中…</p>
      ) : !record ? (
        <p className="text-sm text-gray-400">暂无物流信息，点击右上角「登记物流信息」记录发货与运输情况</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">计划发货时间</p>
              <p className={cellCls}>{fmtDate(record.plan_ship_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">实际发货时间</p>
              <p className={cellCls}>{fmtDate(record.actual_ship_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">运输方式</p>
              <p className={cellCls}>{record.transport_mode || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">包装方式</p>
              <p className={cellCls}>{record.packing_method || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">电池是否需要取出</p>
              <p className={cellCls}>{record.battery_removed ? '是' : '否'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">物流公司</p>
              <p className={cellCls}>
                {record.logistics_type === '客户货代自提'
                  ? '客户货代自提'
                  : [record.logistics_type, record.logistics_company, record.logistics_no].filter(Boolean).join(' · ') || '-'}
              </p>
            </div>
          </div>

          {batteries.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">电池取出和邮寄情况</p>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted backdrop-blur border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">设备类型</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">数量</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">电池类别</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">处理方式</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {batteries.map((b, i) => (
                      <tr key={b.id ?? i}>
                        <td className="px-4 py-2 text-sm text-gray-900">{b.device_type}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{b.quantity}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{b.battery_kind || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{b.handling || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{b.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {packages.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">包装规格</p>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted backdrop-blur border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">箱号</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">长(cm)</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">宽(cm)</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">高(cm)</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">重量(kg)</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">装入设备</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {packages.map((p, i) => (
                      <tr key={p.id ?? i}>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.box_label}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.length_cm ?? '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.width_cm ?? '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.height_cm ?? '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.weight_kg ?? '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {(p.device_ids || []).length > 0
                            ? (p.device_ids || []).map(deviceLabel).join('、')
                            : <span className="text-gray-400">未指定</span>}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{p.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">共 {packages.length} 箱 · 合计 {Math.round(totalWeight * 100) / 100} kg</p>
            </div>
          )}

          {record.remark && (
            <div>
              <p className="text-xs text-gray-500">备注</p>
              <p className={cellCls}>{record.remark}</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <OrderLogisticsForm
          orderNo={orderNo}
          customerName={customerName}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default OrderLogisticsCard;
