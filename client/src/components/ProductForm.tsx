import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ProductLine } from '../types';

interface Product {
  id: number;
  product_line_id: number;
  name: string;
  model?: string;
  description?: string;
  specifications?: any;
  is_active: boolean;
}

interface ProductFormProps {
  product?: Product | null;
  productLines: ProductLine[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, productLines, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    product_line_id: '',
    name: '',
    short_name: '',
    model: '',
    description: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (product) {
      setFormData({
        product_line_id: product.product_line_id.toString(),
        name: product.name || '',
        short_name: (product as any).short_name || '',
        model: product.model || '',
        description: product.description || '',
        is_active: product.is_active !== undefined ? product.is_active : true
      });
    }
  }, [product]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.product_line_id) {
      newErrors.product_line_id = '请选择产品线';
    }
    
    if (!formData.name.trim()) {
      newErrors.name = '产品名称不能为空';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        product_line_id: parseInt(formData.product_line_id)
      });
      onClose();
    } catch (error: any) {
      console.error('提交失败:', error);
      if (error.response?.data?.error) {
        setErrors({ submit: error.response.data.error });
      } else {
        setErrors({ submit: '操作失败，请稍后重试' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 清除该字段的错误提示
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">
            {product ? '编辑产品' : '新增产品'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 3xl:p-6 space-y-4">
          {/* 产品线选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              所属产品线 <span className="text-red-500">*</span>
            </label>
            <select
              name="product_line_id"
              value={formData.product_line_id}
              onChange={handleInputChange}
              disabled={!!product}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.product_line_id ? 'border-red-500' : 'border-gray-300'
              } ${product ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value="">请选择产品线</option>
              {productLines.filter(line => line.is_active).map(line => (
                <option key={line.id} value={line.id}>
                  {line.name} ({line.code})
                </option>
              ))}
            </select>
            {errors.product_line_id && (
              <p className="mt-1 text-sm text-red-500">{errors.product_line_id}</p>
            )}
            {product && (
              <p className="mt-1 text-xs text-gray-500">产品线不可修改</p>
            )}
          </div>

          {/* 产品名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              产品名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入产品名称"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* 产品简称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              产品简称
            </label>
            <input
              type="text"
              name="short_name"
              value={formData.short_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如：侧面、底盘、胎纹、龙门"
              maxLength={20}
            />
            <p className="mt-1 text-xs text-gray-500">
              用于自动生成设备俗称，如"美国侧扫29"
            </p>
          </div>

          {/* 产品型号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              产品型号
            </label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如: ELS-DM-2024-V1"
            />
            <p className="mt-1 text-xs text-gray-500">
              产品型号将用于OSS文件存储路径：产品线/{'{'}产品型号{'}'}
            </p>
          </div>

          {/* 产品描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              产品描述
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入产品描述（可选）"
            />
          </div>

          {/* 是否启用 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleCheckboxChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              启用该产品
            </label>
          </div>

          {/* 错误提示 */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? '提交中...' : (product ? '保存' : '创建')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
