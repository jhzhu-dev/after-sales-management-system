import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProductLineForm from '../components/ProductLineForm';
import { ProductLine } from '../types';
import { PencilIcon, TrashIcon, PrinterIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import { productLineApi } from '../services/api';

const ProductLines: React.FC = () => {
    const [productLines, setProductLines] = useState<ProductLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingProductLine, setEditingProductLine] = useState<ProductLine | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const navigate = useNavigate();

    useEffect(() => {
        fetchProductLines();
    }, []);

    const fetchProductLines = async () => {
        try {
            setLoading(true);
            const data = await productLineApi.getProductLines();

            if (data.success) {
                setProductLines(data.data);
            } else {
                setError(data.error || '获取产品线列表失败');
            }
        } catch (err) {
            setError('网络错误，请稍后重试');
            console.error('获取产品线失败:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddProductLine = () => {
        setEditingProductLine(null);
        setShowForm(true);
    };

    const handleEditProductLine = (productLine: ProductLine) => {
        setEditingProductLine(productLine);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingProductLine(null);
    };

    const handleSubmit = async (formData: any) => {
        try {
            if (editingProductLine) {
                // 更新产品线
                const response = await productLineApi.updateProductLine(editingProductLine.id, formData);
                if (response.success) {
                    setSuccessMessage('产品线更新成功');
                    await fetchProductLines();
                }
            } else {
                // 创建产品线
                const response = await productLineApi.createProductLine(formData);
                if (response.success) {
                    setSuccessMessage('产品线创建成功');
                    await fetchProductLines();
                }
            }
            
            // 3秒后清除成功消息
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error: any) {
            console.error('操作失败:', error);
            throw error;
        }
    };

    const handleDeleteProductLine = async (productLine: ProductLine) => {
        if (!window.confirm(`确定要删除产品线"${productLine.name}"吗？此操作不可恢复。`)) {
            return;
        }

        try {
            const response = await productLineApi.deleteProductLine(productLine.id);
            if (response.success) {
                setSuccessMessage('产品线删除成功');
                await fetchProductLines();
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (error: any) {
            console.error('删除失败:', error);
            alert(error.response?.data?.error || '删除失败，请稍后重试');
        }
    };

    const handleToggleActive = async (productLine: ProductLine) => {
        try {
            const response = await productLineApi.updateProductLine(productLine.id, {
                is_active: !productLine.is_active
            });
            if (response.success) {
                setSuccessMessage(`产品线已${!productLine.is_active ? '启用' : '停用'}`);
                await fetchProductLines();
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (error: any) {
            console.error('操作失败:', error);
            alert(error.response?.data?.error || '操作失败，请稍后重试');
        }
    };

    const handlePrint = () => window.print();

    return (
        <Layout>
            <div className="p-6">
                {/* 打印专用页眉 */}
                <div className="hidden print:block print-header" style={{marginBottom:'8pt'}}>
                  <h1 style={{fontSize:'13pt',fontWeight:'800',margin:0}}>产品线管理</h1>
                  <p style={{fontSize:'8pt',color:'#6b7280',marginTop:'2pt'}}>打印时间：{new Date().toLocaleString('zh-CN')}</p>
                </div>

                <div className="flex justify-between items-center mb-6 print:hidden">
                    <div>
                        <h1 className="text-xl 3xl:text-2xl font-bold text-gray-900">产品线管理</h1>
                        <p className="mt-1 text-sm text-gray-600">
                            管理公司的核心产品线系列
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <PrinterIcon className="h-4 w-4 mr-2" />
                            打印
                        </button>
                        {/* 视图切换按钮 */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                title="方块视图"
                            >
                                <Squares2X2Icon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                title="列表视图"
                            >
                                <ListBulletIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <button
                            onClick={handleAddProductLine}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            + 新增产品线
                        </button>
                    </div>
                </div>

                {/* 成功消息提示 */}
                {successMessage && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-700">{successMessage}</p>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">加载中...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                        {error}
                    </div>
                ) : viewMode === 'grid' ? (
                    // 方块视图
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 3xl:gap-6">
                        {productLines.map((line) => (
                            <div
                                key={line.id}
                                onClick={() => navigate(`/products?product_line_id=${line.id}`)}
                                className="bg-white rounded-lg shadow hover:shadow-lg hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer overflow-hidden"
                            >
                                <div className="p-4 3xl:p-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-gray-900 leading-snug flex-1 min-w-0 mr-3">
                                            {line.name}
                                        </h3>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleActive(line); }}
                                            className={`px-2.5 py-0.5 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 ${line.is_active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}
                                            title={line.is_active ? '点击停用' : '点击启用'}
                                        >
                                            {line.is_active ? '启用' : '停用'}
                                        </button>
                                    </div>

                                    <div className="mb-3">
                                        <span className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">
                                            {line.code}
                                        </span>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-4 h-10 line-clamp-2">
                                        {line.description || '暂无描述'}
                                    </p>

                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-gray-500">
                                                更新于: {new Date(line.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/products?product_line_id=${line.id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex-1 text-center px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded text-sm font-medium transition-colors"
                                            >
                                                查看产品
                                            </Link>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditProductLine(line); }}
                                                className="px-3 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                                                title="编辑"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteProductLine(line); }}
                                                className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                                title="删除"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // 列表视图
                    <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                        {productLines.map((line) => (
                            <div key={line.id}
                                onClick={() => navigate(`/products?product_line_id=${line.id}`)}
                                className="flex items-center justify-between px-5 py-4 hover:bg-blue-50 hover:ring-1 hover:ring-inset hover:ring-blue-100 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-5 flex-1 min-w-0">
                                    {/* Code 标签 */}
                                    <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold font-mono text-sm min-w-[120px] text-center shadow-sm shrink-0">
                                        {line.code}
                                    </div>
                                    {/* 名称 + 描述 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="text-base font-bold text-gray-900 truncate">{line.name}</h3>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleActive(line); }}
                                                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 ${
                                                    line.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                }`}
                                                title={line.is_active ? '点击停用' : '点击启用'}
                                            >
                                                {line.is_active ? '启用' : '停用'}
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500 truncate">{line.description || '暂无描述'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0 ml-4">
                                    <span className="text-sm text-gray-400 whitespace-nowrap">
                                        更新于: {new Date(line.updated_at).toLocaleDateString()}
                                    </span>
                                    <div className="flex gap-2">
                                        <Link
                                            to={`/products?product_line_id=${line.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-100 rounded-lg transition-colors text-sm whitespace-nowrap"
                                        >
                                            查看产品
                                        </Link>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEditProductLine(line); }}
                                            className="px-3 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                                            title="编辑"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteProductLine(line); }}
                                            className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                            title="删除"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {productLines.length === 0 && !loading && !error && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">暂无产品线数据</p>
                        <button
                            onClick={handleAddProductLine}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            创建第一个产品线
                        </button>
                    </div>
                )}
            </div>

            {/* 表单弹窗 */}
            {showForm && (
                <ProductLineForm
                    productLine={editingProductLine}
                    onClose={handleCloseForm}
                    onSubmit={handleSubmit}
                />
            )}
        </Layout>
    );
};

export default ProductLines;
