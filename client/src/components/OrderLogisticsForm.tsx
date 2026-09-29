import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from './ui/button';
import ButtonGroup from './ButtonGroup';
import { orderLogisticsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils';
import {
  OrderLogistics,
  OrderLogisticsBattery,
  OrderLogisticsPackage,
  OrderLogisticsShipCheckResult,
} from '../types';

interface OrderLogisticsFormProps {
  orderNo: string;
  customerName?: string;
  onClose: () => void;
  onSaved: (record: OrderLogistics, message?: string) => void;
}

const TRANSPORT_MODES = ['海运', '空运', '陆运'];
const LOGISTICS_TYPES = ['客户货代自提', '货拉拉', '快递物流', '其他'];
const BATTERY_DEVICE_TYPES = ['视觉器', '上位机', '服务器', '其他'];
const BATTERY_KINDS = ['内置电池', '纽扣电池', '其他'];
const BATTERY_HANDLINGS = ['随机发货', '单独邮寄', '客户自购'];

const inputCls = 'w-full px-3 py-2 border border-border bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-sm text-foreground placeholder:text-muted-foreground/70';

/** 可选择 + 可自由输入的组合框（预设选项作为建议，无合适项时直接输入自定义值） */
const CreatableSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}> = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = value.trim();
    if (!q || options.includes(q)) return options;
    return options.filter(t => t.includes(q));
  }, [options, value]);
  return (
    <div className="relative z-20">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder || '选择或直接输入'}
        autoComplete="off"
        className={inputCls}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-popover rounded-lg border border-border shadow-soft-lg max-h-44 overflow-y-auto z-30">
          {filtered.map(t => (
            <div
              key={t}
              onMouseDown={e => { e.preventDefault(); onChange(t); setOpen(false); }}
              className="px-3 py-2 text-sm cursor-pointer text-gray-800 hover:bg-gray-50"
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** 数字输入 + 常驻单位后缀（如 mm/kg）：单位固定显示在输入框内，输入后仍可见 */
const UnitInput: React.FC<{
  value: number | string | null | undefined;
  onChange: (v: number | '') => void;
  placeholder: string;
  unit: string;
}> = ({ value, onChange, placeholder, unit }) => (
  <div className="relative w-28 shrink-0">
    <input
      type="number" min={0} step="0.01"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      placeholder={placeholder}
      className={`${inputCls} pr-9`}
    />
    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
  </div>
);

const OrderLogisticsForm: React.FC<OrderLogisticsFormProps> = ({ orderNo, customerName, onClose, onSaved }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<OrderLogistics | null>(null);

  const [planShipDate, setPlanShipDate] = useState('');
  const [actualShipDate, setActualShipDate] = useState('');
  const [transportMode, setTransportMode] = useState('');
  const [packingMethod, setPackingMethod] = useState('');
  const [packingOptions, setPackingOptions] = useState<string[]>([]);
  const [packingOpen, setPackingOpen] = useState(false);
  const [batteryRemoved, setBatteryRemoved] = useState(false);
  const [batteries, setBatteries] = useState<OrderLogisticsBattery[]>([]);
  const [packages, setPackages] = useState<OrderLogisticsPackage[]>([]);
  const [logisticsType, setLogisticsType] = useState('');
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');
  const [remark, setRemark] = useState('');

  const [shipDevices, setShipDevices] = useState(true);
  const [shipCheck, setShipCheck] = useState<OrderLogisticsShipCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  // 箱规「装入设备」下拉展开的行下标
  const [pkgDevOpen, setPkgDevOpen] = useState<number | null>(null);
  const pkgDevRef = useRef<HTMLDivElement | null>(null);

  // 装入设备下拉：点击面板外任意位置自动收起
  useEffect(() => {
    if (pkgDevOpen === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (pkgDevRef.current && !pkgDevRef.current.contains(e.target as Node)) setPkgDevOpen(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [pkgDevOpen]);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState('');

  const loadShipCheck = useCallback(async () => {
    try {
      const res = await orderLogisticsApi.shipCheck(orderNo);
      if (res.success && res.data) setShipCheck(res.data);
    } catch {
      /* 订单下无设备时静默 */
    }
  }, [orderNo]);

  useEffect(() => {
    (async () => {
      try {
        const [pmRes, checkRes] = await Promise.all([
          orderLogisticsApi.getPackingMethods().catch(() => ({ data: [] })),
          orderLogisticsApi.shipCheck(orderNo).catch(() => null),
        ]);
        setPackingOptions(((pmRes.data || []) as Array<{ name: string }>).map(p => p.name).filter(Boolean));
        if (checkRes && checkRes.success && checkRes.data) setShipCheck(checkRes.data);
        const res = await orderLogisticsApi.getByOrder(orderNo);
        if (res.success && res.data) {
          const r = res.data;
          setExisting(r);
          setPlanShipDate(r.plan_ship_date ? formatDate(r.plan_ship_date, 'yyyy-MM-dd') : '');
          setActualShipDate(r.actual_ship_date ? formatDate(r.actual_ship_date, 'yyyy-MM-dd') : '');
          setTransportMode(r.transport_mode || '');
          setPackingMethod(r.packing_method || '');
          setBatteryRemoved(!!r.battery_removed);
          setBatteries((r.batteries || []).map(b => ({
            device_type: b.device_type,
            quantity: Number(b.quantity) || 1,
            battery_kind: b.battery_kind || '',
            handling: b.handling || '',
            remark: b.remark || '',
          })) as OrderLogisticsBattery[]);
          setPackages((r.packages || []).map(p => ({
            box_label: p.box_label,
            length_cm: p.length_cm ?? '',
            width_cm: p.width_cm ?? '',
            height_cm: p.height_cm ?? '',
            weight_kg: p.weight_kg ?? '',
            remark: p.remark || '',
            device_ids: Array.isArray(p.device_ids) ? p.device_ids.map(String) : [],
          })));
          setLogisticsType(r.logistics_type || '');
          setLogisticsCompany(r.logistics_company || '');
          setLogisticsNo(r.logistics_no || '');
          setRemark(r.remark || '');
        }
      } catch {
        /* 404 = 未登记，按新登记处理 */
      } finally {
        setLoading(false);
      }
    })();
  }, [orderNo]);

  const filteredPacking = useMemo(() => {
    const q = packingMethod.trim();
    if (!q || packingOptions.includes(q)) return packingOptions;
    return packingOptions.filter(t => t.includes(q));
  }, [packingOptions, packingMethod]);

  const totalWeight = useMemo(
    () => packages.reduce((sum, p) => sum + (Number(p.weight_kg) || 0), 0),
    [packages]
  );

  const updateBattery = (idx: number, patch: Partial<OrderLogisticsBattery>) =>
    setBatteries(prev => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  const updatePackage = (idx: number, patch: Partial<OrderLogisticsPackage>) =>
    setPackages(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const addBattery = () =>
    setBatteries(prev => [...prev, { device_type: '视觉器', quantity: 1, battery_kind: null, handling: null, remark: '' }]);
  const addPackage = () =>
    setPackages(prev => [...prev, { box_label: `箱${prev.length + 1}`, length_cm: '', width_cm: '', height_cm: '', weight_kg: '', remark: '', device_ids: [] }]);

  const togglePackageDevice = (idx: number, deviceId: string) =>
    setPackages(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const cur = p.device_ids || [];
      return { ...p, device_ids: cur.includes(deviceId) ? cur.filter(x => x !== deviceId) : [...cur, deviceId] };
    }));

  const validate = (): boolean => {
    const ne: { [key: string]: string } = {};
    if (!actualShipDate) ne.actualShipDate = '请选择实际发货时间';
    if (!transportMode) ne.transportMode = '请选择运输方式';
    if (batteryRemoved && batteries.length === 0) ne.batteries = '已勾选电池取出，请至少添加一行电池情况';
    setErrors(ne);
    return Object.keys(ne).length === 0;
  };

  const runShipCheck = async () => {
    setChecking(true);
    await loadShipCheck();
    setChecking(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError('');
    try {
      const payload = {
        order_no: orderNo,
        plan_ship_date: planShipDate || null,
        actual_ship_date: actualShipDate || null,
        transport_mode: transportMode || null,
        packing_method: packingMethod.trim() || null,
        battery_removed: batteryRemoved,
        batteries: batteryRemoved ? batteries : [],
        packages,
        logistics_type: logisticsType || null,
        logistics_company: logisticsCompany.trim() || null,
        logistics_no: logisticsNo.trim() || null,
        remark: remark.trim() || null,
        ship_devices: !!shipDevices,
        updated_by: user?.username || null,
      };
      const res = existing
        ? await orderLogisticsApi.update(existing.id, payload)
        : await orderLogisticsApi.create(payload);
      if (!res.success) throw new Error(res.error || '保存失败');
      onSaved(res.data as OrderLogistics, res.message);
      onClose();
    } catch (err: any) {
      setServerError(err?.response?.data?.error || err?.message || '保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const checkDevices = shipCheck?.devices || [];
  const shippableCount = shipCheck?.shippable_count ?? 0;
  const hasDevices = checkDevices.length > 0;

  // Portal 到 body：避免被带 backdrop-filter 的祖先（如 .bg-card）限制模糊边界，
  // 导致遮罩的 backdrop-blur 无法模糊整页背景
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-lg" onClick={onClose} />
      <div className="relative z-10 bg-popover/95 backdrop-blur-2xl rounded-2xl border border-border shadow-soft-lg w-full max-w-4xl mx-4 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{existing ? '编辑物流信息' : '登记物流信息'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              订单号：{orderNo}{customerName ? ` · ${customerName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{serverError}</div>
          )}

          {/* 发货时间 + 运输方式 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">计划发货时间</label>
              <input type="date" value={planShipDate} onChange={e => setPlanShipDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">实际发货时间 <span className="text-red-500">*</span></label>
              <input type="date" value={actualShipDate} onChange={e => setActualShipDate(e.target.value)} className={inputCls} />
              {errors.actualShipDate && <p className="mt-1 text-xs text-red-500">{errors.actualShipDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">运输方式 <span className="text-red-500">*</span></label>
              <ButtonGroup
                value={transportMode}
                onChange={v => setTransportMode(v)}
                options={TRANSPORT_MODES.map(m => ({ value: m, label: m }))}
                error={!!errors.transportMode}
              />
              {errors.transportMode && <p className="mt-1 text-xs text-red-500">{errors.transportMode}</p>}
            </div>
          </div>

          {/* 包装方式（自由文本 + 历史建议下拉） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">包装方式</label>
            <div className="relative z-20">
              <input
                type="text"
                value={packingMethod}
                onChange={e => { setPackingMethod(e.target.value); setPackingOpen(true); }}
                onFocus={() => setPackingOpen(true)}
                onBlur={() => setTimeout(() => setPackingOpen(false), 120)}
                placeholder="自由填写，如：木箱 / 纸箱 / 珍珠棉…（可从历史记录选择）"
                autoComplete="off"
                className={inputCls}
              />
              {packingOpen && filteredPacking.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-popover rounded-lg border border-border shadow-soft-lg max-h-44 overflow-y-auto z-30">
                  {filteredPacking.map(t => (
                    <div
                      key={t}
                      onMouseDown={e => { e.preventDefault(); setPackingMethod(t); setPackingOpen(false); }}
                      className="px-3 py-2 text-sm cursor-pointer text-gray-800 hover:bg-gray-50"
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 电池取出和邮寄情况 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={batteryRemoved}
                  onChange={e => setBatteryRemoved(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40"
                />
                电池是否需要取出
              </label>
              {batteryRemoved && (
                <Button type="button" variant="outline" size="sm" onClick={addBattery}>
                  <PlusIcon className="h-4 w-4" /> 添加电池行
                </Button>
              )}
            </div>
            {batteryRemoved && (
              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
                  <span className="col-span-3">设备类型</span>
                  <span className="col-span-2">数量</span>
                  <span className="col-span-2">电池类别</span>
                  <span className="col-span-3">处理方式（单选）</span>
                  <span className="col-span-2" />
                </div>
                {batteries.map((b, i) => (
                  <div key={i} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:items-center">
                    <div className="md:col-span-3">
                      <CreatableSelect
                        value={b.device_type}
                        onChange={v => updateBattery(i, { device_type: v })}
                        options={BATTERY_DEVICE_TYPES}
                        placeholder="设备类型（可输入）"
                      />
                    </div>
                    <input
                      type="number" min={1}
                      value={b.quantity}
                      onChange={e => updateBattery(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className={`${inputCls} md:col-span-2`}
                    />
                    <div className="md:col-span-2">
                      <CreatableSelect
                        value={b.battery_kind || ''}
                        onChange={v => updateBattery(i, { battery_kind: v || null })}
                        options={BATTERY_KINDS}
                        placeholder="电池类别（可输入）"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <CreatableSelect
                        value={b.handling || ''}
                        onChange={v => updateBattery(i, { handling: v || null })}
                        options={BATTERY_HANDLINGS}
                        placeholder="处理方式（可输入）"
                      />
                    </div>
                    <div className="md:col-span-2 flex md:justify-end">
                      <button type="button" onClick={() => setBatteries(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-red-500">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {batteries.length === 0 && (
                  <p className="text-sm text-gray-400">暂无电池行，点击「添加电池行」记录各设备电池的取出与邮寄情况</p>
                )}
                {errors.batteries && <p className="text-xs text-red-500">{errors.batteries}</p>}
              </div>
            )}
          </div>

          {/* 包装规格 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">包装规格</label>
              <Button type="button" variant="outline" size="sm" onClick={addPackage}>
                <PlusIcon className="h-4 w-4" /> 添加箱规
              </Button>
            </div>
            <div className="space-y-3">
              {packages.map((p, i) => (
                <div key={i} className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text" value={p.box_label}
                    onChange={e => updatePackage(i, { box_label: e.target.value })}
                    placeholder={`箱${i + 1}`}
                    className={`${inputCls} w-24 shrink-0`}
                  />
                  <UnitInput value={p.length_cm} onChange={v => updatePackage(i, { length_cm: v })} placeholder="长" unit="mm" />
                  <UnitInput value={p.width_cm} onChange={v => updatePackage(i, { width_cm: v })} placeholder="宽" unit="mm" />
                  <UnitInput value={p.height_cm} onChange={v => updatePackage(i, { height_cm: v })} placeholder="高" unit="mm" />
                  <UnitInput value={p.weight_kg} onChange={v => updatePackage(i, { weight_kg: v })} placeholder="重量" unit="kg" />
                  <input
                    type="text" value={p.remark || ''}
                    onChange={e => updatePackage(i, { remark: e.target.value })}
                    placeholder="备注"
                    className={`${inputCls} flex-1 min-w-[120px]`}
                  />
                  <button type="button" onClick={() => setPackages(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-red-500 shrink-0">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                {/* 装入设备多选：相机等多台设备时勾选每箱装入的设备 */}
                {checkDevices.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center md:pl-1">
                    <div className="relative" ref={pkgDevRef}>
                      <button
                        type="button"
                        onClick={() => setPkgDevOpen(pkgDevOpen === i ? null : i)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:border-primary-400 bg-white"
                      >
                        装入设备 ({(p.device_ids || []).length}) ▾
                      </button>
                      {pkgDevOpen === i && (
                        <div className="absolute left-0 top-full mt-1 w-80 bg-popover rounded-lg border border-border shadow-soft-lg max-h-44 overflow-y-auto z-30 p-1">
                          {checkDevices.map(d => (
                            <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded">
                              <input
                                type="checkbox"
                                checked={(p.device_ids || []).includes(d.id)}
                                onChange={() => { togglePackageDevice(i, d.id); setPkgDevOpen(null); }}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40"
                              />
                              <span className="font-mono text-primary-600">{d.id}</span>
                              {d.notes && <span className="text-gray-500 truncate">{d.notes}</span>}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {(p.device_ids || []).map(id => (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 border border-primary-200">
                        {id}
                        <button type="button" onClick={() => togglePackageDevice(i, id)} className="text-primary-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                    {(p.device_ids || []).length === 0 && (
                      <span className="text-xs text-gray-400">未勾选则表示该箱未指定设备</span>
                    )}
                  </div>
                )}
                </div>
              ))}
              {packages.length > 0 && (
                <p className="text-xs text-gray-500 px-1">共 {packages.length} 箱 · 合计 {Math.round(totalWeight * 100) / 100} kg</p>
              )}
              {packages.length === 0 && <p className="text-sm text-gray-400">暂无箱规，点击「添加箱规」记录每箱尺寸与重量</p>}
            </div>
          </div>

          {/* 物流公司 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">物流公司</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <CreatableSelect
                  value={logisticsType}
                  onChange={v => setLogisticsType(v)}
                  options={LOGISTICS_TYPES}
                  placeholder="物流方式（可输入）"
                />
              </div>
              <input
                type="text" value={logisticsCompany}
                onChange={e => setLogisticsCompany(e.target.value)}
                placeholder="承运商（货拉拉 / 跨越…）"
                className={inputCls}
              />
              <input
                type="text" value={logisticsNo}
                onChange={e => setLogisticsNo(e.target.value)}
                placeholder="车牌号 / 运单号"
                className={inputCls}
              />
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} className={inputCls} placeholder="订单补充说明…" />
          </div>

          {/* 发货联动 + 核对 */}
          {hasDevices && (
            <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={shipDevices && shippableCount > 0}
                    disabled={shippableCount === 0}
                    onChange={e => setShipDevices(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40"
                  />
                  保存后将订单下设备标记为已发货
                  {shippableCount > 0 && <span className="text-xs text-primary-500">（{shippableCount} 台可发货）</span>}
                </label>
                <Button type="button" variant="outline" size="sm" onClick={runShipCheck} disabled={checking}>
                  <ArrowPathIcon className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> 核对
                </Button>
              </div>
              <div className="space-y-1">
                {checkDevices.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    {d.can_ship ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                    <span className="text-foreground/90">{d.name || d.id}</span>
                    {d.bundle_code && <span className="text-muted-foreground">（多合一 {d.bundle_code}）</span>}
                    <span className="text-muted-foreground">当前：{d.status}</span>
                    {!d.can_ship && <span className="text-muted-foreground">— {d.reason || '不可发货'}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting || loading}>
            {submitting ? '保存中...' : existing ? '保存修改' : '保存登记'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderLogisticsForm;
