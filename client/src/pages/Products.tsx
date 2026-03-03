import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProductForm from '../components/ProductForm';
import { Product, ProductLine, ApiResponse } from '../types';
import api, { productApi, productLineApi } from '../services/api';
import { PencilIcon, TrashIcon, PrinterIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';

const Products: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const productLineId = searchParams.get('product_line_id');

    const [products, setProducts] = useState<Product[]>([]);
    const [productLines, setProductLines] = useState<ProductLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const navigate = useNavigate();

    useEffect(() => {
        fetchInitialData();
    }, [productLineId]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [pLinesRes, productsRes] = await Promise.all([
                productLineApi.getProductLines(),
                productApi.getProducts(productLineId ? { product_line_id: parseInt(productLineId) } : undefined)
            ]);

            if (pLinesRes.success) setProductLines(pLinesRes.data);
            if (productsRes.success) setProducts(productsRes.data);
        } catch (err) {
            setError('获取数据失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value) {
            setSearchParams({ product_line_id: value });
        } else {
            setSearchParams({});
        }
    };

    const handleAddProduct = () => {
        setEditingProduct(null);
        setShowForm(true);
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingProduct(null);
    };

    const handleSubmit = async (formData: any) => {
        try {
            if (editingProduct) {
                // 更新产品
                const response = await api.put(`/products/${editingProduct.id}`, formData);
                if (response.data.success) {
                    setSuccessMessage('产品更新成功');
                    await fetchInitialData();
                }
            } else {
                // 创建产品
                const response = await api.post('/products', formData);
                if (response.data.success) {
                    setSuccessMessage('产品创建成功');
                    await fetchInitialData();
                }
            }
            
            // 3秒后清除成功消息
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error: any) {
            console.error('操作失败:', error);
            throw error;
        }
    };

    const handleDeleteProduct = async (product: Product) => {
        if (!window.confirm(`确定要删除产品"${product.name}"吗？此操作不可恢复。`)) {
            return;
        }

        try {
            const response = await api.delete(`/products/${product.id}`);
            if (response.data.success) {
                setSuccessMessage('产品删除成功');
                await fetchInitialData();
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (error: any) {
            console.error('删除失败:', error);
            alert(error.response?.data?.error || '删除失败，请稍后重试');
        }
    };

    const handleToggleActive = async (product: Product) => {
        try {
            const response = await api.put(`/products/${product.id}`, {
                is_active: !product.is_active
            });
            if (response.data.success) {
                setSuccessMessage(`产品已${!product.is_active ? '启用' : '停用'}`);
                await fetchInitialData();
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
                  <h1 style={{fontSize:'13pt',fontWeight:'800',margin:0}}>产品管理</h1>
                  <p style={{fontSize:'8pt',color:'#6b7280',marginTop:'2pt'}}>打印时间：{new Date().toLocaleString('zh-CN')} · 共 {products.length} 个产品</p>
                </div>

                <div className="flex justify-between items-center mb-6 print:hidden">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">产品管理</h1>
                        <p className="mt-1 text-sm text-gray-600">管理各产品线下的具体产品型号</p>
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
                            onClick={handleAddProduct}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            + 新增产品
                        </button>
                    </div>
                </div>

                {/* 成功消息提示 */}
                {successMessage && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-700">{successMessage}</p>
                    </div>
                )}

                <div className="bg-white p-4 rounded-lg shadow mb-6 flex items-center space-x-4 no-print">
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700">筛选产品线:</label>
                        <select
                            value={productLineId || ''}
                            onChange={handleLineChange}
                            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">全部产品线</option>
                            {productLines.map(line => (
                                <option key={line.id} value={line.id}>{line.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <p className="text-gray-500 mb-4">暂无产品数据</p>
                        <button
                            onClick={handleAddProduct}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            创建第一个产品
                        </button>
                    </div>
                ) : viewMode === 'grid' ? (
                    // 方块视图
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products.map(product => (
                            <div key={product.id}
                                onClick={() => navigate(`/products/${product.id}`)}
                                className="bg-white rounded-lg shadow hover:shadow-lg hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer p-6 border border-gray-100"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-base text-gray-900 leading-snug flex-1 min-w-0 mr-3">{product.name}</h3>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleActive(product); }}
                                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 ${
                                            product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}
                                        title={product.is_active ? '点击停用' : '点击启用'}
                                    >
                                        {product.is_active ? '启用' : '停用'}
                                    </button>
                                </div>
                                <p className="text-xs text-blue-600 font-medium mb-2">{product.product_line_name}</p>
                                <p className="text-sm text-gray-500 mb-4 font-mono">{product.model || '未设定型号'}</p>
                                <p className="text-sm text-gray-600 mb-6 line-clamp-2 h-10">{product.description || '暂无描述'}</p>
                                <div className="pt-4 border-t border-gray-50">
                                    <div className="flex gap-2 mb-2">
                                        <Link
                                            to={`/products/${product.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 text-center px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded text-sm font-medium transition-colors"
                                        >
                                            配置详情
                                        </Link>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
                                            className="flex-1 px-3 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
                                            title="编辑"
                                        >
                                            <PencilIcon className="w-4 h-4 mr-1" />
                                            <span className="text-sm">编辑</span>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product); }}
                                            className="flex-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors flex items-center justify-center"
                                            title="删除"
                                        >
                                            <TrashIcon className="w-4 h-4 mr-1" />
                                            <span className="text-sm">删除</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // 列表视图
                    <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                        {products.map(product => (
                            <div key={product.id}
                                onClick={() => navigate(`/products/${product.id}`)}
                                className="flex items-center justify-between px-5 py-4 hover:bg-blue-50 hover:ring-1 hover:ring-inset hover:ring-blue-100 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-5 flex-1 min-w-0">
                                    {/* 型号标签 */}
                                    <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold font-mono text-sm min-w-[120px] text-center shadow-sm shrink-0">
                                        {product.model || '未设定型号'}
                                    </div>
                                    {/* 名称 + 产品线 + 描述 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="text-base font-bold text-gray-900 truncate">{product.name}</h3>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleActive(product); }}
                                                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 ${
                                                    product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}
                                                title={product.is_active ? '点击停用' : '点击启用'}
                                            >
                                                {product.is_active ? '启用' : '停用'}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-blue-600 font-medium">{product.product_line_name}</span>
                                            <span className="text-sm text-gray-500 truncate">{product.description || '暂无描述'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                    <Link
                                        to={`/products/${product.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-100 rounded-lg transition-colors text-sm whitespace-nowrap"
                                    >
                                        配置详情
                                    </Link>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
                                        className="px-3 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                                        title="编辑"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product); }}
                                        className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                        title="删除"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 表单弹窗 */}
            {showForm && (
                <ProductForm
                    product={editingProduct}
                    productLines={productLines}
                    onClose={handleCloseForm}
                    onSubmit={handleSubmit}
                />
            )}
        </Layout>
    );
};

export default Products;
