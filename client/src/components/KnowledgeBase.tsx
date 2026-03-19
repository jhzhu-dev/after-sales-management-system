import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  BookOpenIcon,
  HandThumbUpIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { kbArticleApi, moduleTypeApi } from '../services/api';
import { KbArticle } from '../types';

const CAT_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-yellow-100 text-yellow-700',
  'bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-red-100 text-red-700',
  'bg-indigo-100 text-indigo-700',
  'bg-gray-100 text-gray-600',
];

interface Props {
  productLines: Array<{ id: number; name: string }>;
}

interface FormData {
  title: string;
  symptom: string;
  cause: string;
  solution: string;
  category: string;
  product_line_id: string;
  tags: string;
  is_pinned: boolean;
}

const BLANK: FormData = {
  title: '',
  symptom: '',
  cause: '',
  solution: '',
  category: '',
  product_line_id: '',
  tags: '',
  is_pinned: false,
};

export default function KnowledgeBase({ productLines }: Props) {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [plFilter, setPlFilter] = useState('');
  const [detail, setDetail] = useState<KbArticle | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [moduleTypes, setModuleTypes] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    moduleTypeApi.getModuleTypes().then(r => {
      if (r.success) setModuleTypes(r.data);
    }).catch(() => {});
  }, []);

  const getCatStyle = (name: string) => {
    const idx = moduleTypes.findIndex(m => m.name === name);
    return CAT_PALETTE[idx >= 0 ? idx % CAT_PALETTE.length : CAT_PALETTE.length - 1];
  };
  const [form, setForm] = useState<FormData>(BLANK);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: any = {};
      if (search) p.search = search;
      if (catFilter) p.category = catFilter;
      if (plFilter) p.product_line_id = parseInt(plFilter);
      const r = await kbArticleApi.getArticles(p);
      if (r.success) {
        setArticles(r.data.map((a: any) => ({
          ...a,
          tags: a.tags ? (typeof a.tags === 'string' ? JSON.parse(a.tags) : a.tags) : [],
        })));
      }
    } catch (e) {
      console.error('加载知识库失败:', e);
    } finally {
      setLoading(false);
    }
  }, [search, catFilter, plFilter]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = () => {
    setEditId(null);
    setForm(BLANK);
    setErrs({});
    setShowForm(true);
  };

  const openEdit = (a: KbArticle) => {
    setEditId(a.id);
    setForm({
      title: a.title,
      symptom: a.symptom,
      cause: a.cause || '',
      solution: a.solution,
      category: a.category,
      product_line_id: a.product_line_id ? String(a.product_line_id) : '',
      tags: a.tags ? a.tags.join(', ') : '',
      is_pinned: a.is_pinned,
    });
    setErrs({});
    setShowForm(true);
    setDetail(null);
  };

  const handleView = (a: KbArticle) => {
    setDetail(a);
    setArticles(prev => prev.map(x => x.id === a.id ? { ...x, view_count: x.view_count + 1 } : x));
    kbArticleApi.getArticle(a.id).catch(() => {});
  };

  const handleDelete = async (a: KbArticle) => {
    if (!window.confirm(`确定删除"${a.title}"吗？`)) return;
    await kbArticleApi.deleteArticle(a.id);
    setArticles(prev => prev.filter(x => x.id !== a.id));
    if (detail?.id === a.id) setDetail(null);
  };

  const handleHelpful = async (a: KbArticle) => {
    await kbArticleApi.markHelpful(a.id).catch(() => {});
    const upd = (x: KbArticle) => x.id === a.id ? { ...x, helpful_count: x.helpful_count + 1 } : x;
    setArticles(prev => prev.map(upd));
    if (detail) setDetail(upd(detail));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = '标题不能为空';
    if (!form.symptom.trim()) e.symptom = '问题现象不能为空';
    if (!form.solution.trim()) e.solution = '解决方案不能为空';
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        symptom: form.symptom.trim(),
        cause: form.cause.trim() || undefined,
        solution: form.solution.trim(),
        category: form.category,
        product_line_id: form.product_line_id ? parseInt(form.product_line_id) : undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_pinned: form.is_pinned,
      };
      if (editId) {
        await kbArticleApi.updateArticle(editId, payload);
      } else {
        await kbArticleApi.createArticle(payload);
      }
      setShowForm(false);
      load();
    } catch {
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: keyof FormData, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索标题、现象或解决方案..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部分类</option>
            {moduleTypes.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
          <select
            value={plFilter}
            onChange={e => setPlFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部产品线</option>
            {productLines.map(pl => <option key={pl.id} value={String(pl.id)}>{pl.name}</option>)}
          </select>
          <div className="flex-1" />
          <span className="text-sm text-gray-400">共 {articles.length} 条</span>
          <button
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            新增词条
          </button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <BookOpenIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">暂无知识词条</p>
          <p className="text-gray-400 text-sm mt-1">点击"新增词条"开始积累运维知识</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {articles.map(a => (
            <div
              key={a.id}
              onClick={() => handleView(a)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3 cursor-pointer"
            >
              <div className="flex items-start gap-2">
                {a.is_pinned && <StarIcon className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />}
                <h3
                  className="font-semibold text-gray-900 text-sm leading-snug flex-1"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}
                >
                  {a.title}
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCatStyle(a.category)}`}>
                  {a.category}
                </span>
                {a.product_line_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{a.product_line_name}</span>
                )}
                {a.tags?.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">#{t}</span>
                ))}
              </div>
              <p
                className="text-xs text-gray-500"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}
              >
                {a.symptom}
              </p>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><EyeIcon className="h-3.5 w-3.5" />{a.view_count}</span>
                  <span className="flex items-center gap-1"><HandThumbUpIcon className="h-3.5 w-3.5" />{a.helpful_count}</span>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                    title="编辑"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                    title="删除"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 详情弹窗 */}
      {detail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  {detail.is_pinned && <StarIcon className="h-4 w-4 text-yellow-400 flex-shrink-0" />}
                  <h2 className="text-lg font-bold text-gray-900">{detail.title}</h2>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCatStyle(detail.category)}`}>
                    {detail.category}
                  </span>
                  {detail.product_line_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{detail.product_line_name}</span>
                  )}
                  {detail.tags?.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">#{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(detail)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="编辑">
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(detail)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="删除">
                  <TrashIcon className="h-4 w-4" />
                </button>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">问题现象</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-orange-50 rounded-lg p-3">{detail.symptom}</p>
              </div>
              {detail.cause && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">原因分析</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-blue-50 rounded-lg p-3">{detail.cause}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">解决方案</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-green-50 rounded-lg p-3">{detail.solution}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 pb-5 border-t pt-4">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><EyeIcon className="h-3.5 w-3.5" />查看 {detail.view_count} 次</span>
                {detail.created_by && <span>由 {detail.created_by} 创建</span>}
                <span>{new Date(detail.updated_at).toLocaleDateString('zh-CN')}</span>
              </div>
              <button
                onClick={() => handleHelpful(detail)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700 text-sm text-gray-500 transition-colors"
              >
                <HandThumbUpIcon className="h-4 w-4" />
                有用 ({detail.helpful_count})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增 / 编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">{editId ? '编辑词条' : '新增知识词条'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => f('title', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errs.title ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="简洁描述问题，如：设备开机无显示"
                />
                {errs.title && <p className="text-red-500 text-xs mt-1">{errs.title}</p>}
              </div>

              {/* 分类 + 产品线 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                  <select
                    value={form.category}
                    onChange={e => f('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择模块</option>
                    {moduleTypes.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">产品线</label>
                  <select
                    value={form.product_line_id}
                    onChange={e => f('product_line_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">通用</option>
                    {productLines.map(pl => <option key={pl.id} value={String(pl.id)}>{pl.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 问题现象 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  问题现象 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={form.symptom}
                  onChange={e => f('symptom', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errs.symptom ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="描述什么情况下会出现此问题..."
                />
                {errs.symptom && <p className="text-red-500 text-xs mt-1">{errs.symptom}</p>}
              </div>

              {/* 原因分析（选填） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  原因分析 <span className="text-gray-400 font-normal text-xs">（选填）</span>
                </label>
                <textarea
                  rows={2}
                  value={form.cause}
                  onChange={e => f('cause', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="分析造成此问题的原因..."
                />
              </div>

              {/* 解决方案 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  解决方案 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={form.solution}
                  onChange={e => f('solution', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono ${errs.solution ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder={"1. 检查连接线是否牢固\n2. 重启设备，观察是否恢复\n3. 若仍无效，执行 xxx 命令"}
                />
                {errs.solution && <p className="text-red-500 text-xs mt-1">{errs.solution}</p>}
              </div>

              {/* 标签 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签 <span className="text-gray-400 font-normal text-xs">（逗号分隔）</span>
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => f('tags', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：屏幕, 断电, 底盘"
                />
              </div>

              {/* 置顶 */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={e => f('is_pinned', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">置顶此词条</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : (editId ? '更新词条' : '创建词条')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
