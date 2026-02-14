import React, { useState, useEffect } from 'react';
import {
    PlusIcon,
    TrashIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

interface SOPTemplate {
    id: number;
    stage: '装配' | '部署' | '调试' | '打包' | '物流';
    product_line_id: number | null;
    product_line_name?: string;
    version: string;
    content: any;
    is_active: boolean;
    created_at: string;
}

interface ProductLine {
    id: number;
    name: string;
    code: string;
}

interface ChecklistItem {
    id: number;
    name: string;
    checked: boolean;
}

const STAGES = ['装配', '部署', '调试', '打包', '物流'] as const;

export default function SOPConfig() {
    const [templates, setTemplates] = useState<SOPTemplate[]>([]);
    const [productLines, setProductLines] = useState<ProductLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingStage, setEditingStage] = useState<typeof STAGES[number]>('装配');
    const [selectedProductLine, setSelectedProductLine] = useState<number | null>(null);
    const [newItem, setNewItem] = useState('');
    const [currentContent, setCurrentContent] = useState<ChecklistItem[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProductLines();
        fetchTemplates();
    }, []);

    const fetchProductLines = async () => {
        try {
            const response = await fetch('/api/product-lines');
            const data = await response.json();
            if (data.success) {
                setProductLines(data.data);
            }
        } catch (err) {
            console.error('获取产品线失败', err);
        }
    };

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sop-templates');
            const data = await response.json();
            if (data.success) {
                setTemplates(data.data);
                // 默认加载选中阶段和产品线的最新模版内容
                const latest = data.data.find((t: SOPTemplate) => 
                    t.stage === editingStage && 
                    t.product_line_id === selectedProductLine && 
                    t.is_active
                );
                if (latest) {
                    const parsed = typeof latest.content === 'string' ? JSON.parse(latest.content) : latest.content;
                    setCurrentContent(Array.isArray(parsed) ? parsed : []);
                } else {
                    setCurrentContent([]);
                }
            }
        } catch (err) {
            console.error('获取模版失败', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStageChange = (stage: typeof STAGES[number]) => {
        setEditingStage(stage);
        loadCurrentTemplate(stage, selectedProductLine);
    };

    const handleProductLineChange = (productLineId: number | null) => {
        setSelectedProductLine(productLineId);
        loadCurrentTemplate(editingStage, productLineId);
    };

    const loadCurrentTemplate = (stage: typeof STAGES[number], productLineId: number | null) => {
        const latest = templates.find(t => 
            t.stage === stage && 
            t.product_line_id === productLineId && 
            t.is_active
        );
        if (latest) {
            const parsed = typeof latest.content === 'string' ? JSON.parse(latest.content) : latest.content;
            setCurrentContent(Array.isArray(parsed) ? parsed : []);
        } else {
            setCurrentContent([]);
        }
    };

    const addItem = () => {
        if (!newItem.trim()) return;
        const newId = currentContent.length > 0 ? Math.max(...currentContent.map(item => item.id)) + 1 : 1;
        setCurrentContent([...currentContent, { id: newId, name: newItem.trim(), checked: false }]);
        setNewItem('');
    };

    const removeItem = (index: number) => {
        const next = [...currentContent];
        next.splice(index, 1);
        setCurrentContent(next);
    };

    const saveAsNewVersion = async () => {
        if (currentContent.length === 0) {
            alert('请至少添加一个检查项');
            return;
        }
        setSaving(true);
        try {
            const version = `v${new Date().getTime().toString().slice(-6)}`;
            const response = await fetch('/api/sop-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stage: editingStage,
                    product_line_id: selectedProductLine,
                    version,
                    content: currentContent,
                    created_by: '管理员'
                })
            });
            const data = await response.json();
            if (data.success) {
                alert(`新版本 ${version} 已发布并自动生效`);
                await fetchTemplates();
            }
        } catch (err) {
            alert('发布失败');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (id: number, active: boolean) => {
        try {
            const response = await fetch(`/api/sop-templates/${id}/toggle-active`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: active })
            });
            if ((await response.json()).success) {
                fetchTemplates();
            }
        } catch (err) {
            console.error('更新状态失败', err);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧配置区 */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/30">
                    <div className="mb-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">产品线</label>
                        <select
                            value={selectedProductLine || ''}
                            onChange={(e) => handleProductLineChange(e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="">通用模板（适用所有产品线）</option>
                            {productLines.map(pl => (
                                <option key={pl.id} value={pl.id}>{pl.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                    {STAGES.map(s => (
                        <button
                            key={s}
                            onClick={() => handleStageChange(s)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${editingStage === s
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                    : 'bg-white text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                    </div>
                </div>

                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">标准检查项编辑器</h3>
                        <span className="text-xs text-gray-400 italic">
                            正在编辑 {editingStage} 阶段流程
                            {selectedProductLine && ` - ${productLines.find(p => p.id === selectedProductLine)?.name}`}
                        </span>
                    </div>

                    <div className="space-y-3 mb-6">
                        {currentContent.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                <CheckCircleIcon className="h-5 w-5 text-gray-300" />
                                <span className="flex-1 text-sm text-gray-700">{item.name}</span>
                                <button
                                    onClick={() => removeItem(idx)}
                                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {currentContent.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <ExclamationCircleIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm italic">暂无检查项，请从下方添加</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            placeholder="输入新的 SOP 检查项文字描述..."
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && addItem()}
                        />
                        <button
                            onClick={addItem}
                            className="px-4 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
                        >
                            <PlusIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-50 flex justify-end">
                        <button
                            onClick={saveAsNewVersion}
                            disabled={saving}
                            className="inline-flex items-center px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-100 transition-all disabled:opacity-50"
                        >
                            {saving ? '保存中...' : '发布为新版本'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 右侧历史列表 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="p-4 border-b border-gray-50 font-bold text-gray-900 flex items-center">
                    <ArrowPathIcon className="h-5 w-5 mr-2 text-blue-500" />
                    版本迭代历史
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {templates.filter(t => t.stage === editingStage && t.product_line_id === selectedProductLine).map(t => (
                        <div key={t.id} className={`p-4 rounded-2xl border transition-all ${t.is_active ? 'border-blue-200 bg-blue-50/30' : 'border-gray-50'
                            }`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold font-mono ${t.is_active ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {t.version}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={t.is_active}
                                        onChange={e => toggleActive(t.id, e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <div className="text-[10px] text-gray-400">
                                发布于: {new Date(t.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
