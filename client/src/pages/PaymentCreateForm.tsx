import React, { useState } from 'react';

interface PaymentCreateFormProps {
    orderId: string;
    onCreated: () => void;
}

const PaymentCreateForm: React.FC<PaymentCreateFormProps> = ({ orderId, onCreated }) => {
    const [form, setForm] = useState({
        payment_type: '预付款',
        is_paid: false,
        prepay_percentage: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let newValue: any = value;
        if (type === 'checkbox') {
            newValue = (e.target as HTMLInputElement).checked;
        }
        setForm(prev => ({
            ...prev,
            [name]: newValue
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/orders/${orderId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment_type: form.payment_type,
                    is_paid: form.is_paid,
                    prepay_percentage: form.prepay_percentage ? Number(form.prepay_percentage) : null,
                    description: form.description
                })
            });
            if (!response.ok) {
                throw new Error(`创建失败，状态码：${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                onCreated();
                setForm({
                    payment_type: '预付款',
                    is_paid: false,
                    prepay_percentage: '',
                    description: ''
                });
            } else {
                setError(data.error || '创建失败');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '网络错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">付款类型</label>
                <select name="payment_type" value={form.payment_type} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                    <option value="预付款">预付款</option>
                    <option value="全款">全款</option>
                </select>
            </div>
            {form.payment_type === '预付款' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">预付比例</label>
                    <input type="number" name="prepay_percentage" value={form.prepay_percentage} onChange={handleChange} className="w-full px-3 py-2 border rounded" placeholder="如30" min="0" max="100" step="0.01" />
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">是否已支付</label>
                <select
                    name="is_paid"
                    value={form.is_paid ? '1' : '0'}
                    onChange={e => setForm(prev => ({ ...prev, is_paid: e.target.value === '1' }))}
                    className="w-full px-3 py-2 border rounded"
                >
                    <option value="0">未支付</option>
                    <option value="1">已支付</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">付款信息备注</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={2} className="w-full px-3 py-2 border rounded" placeholder="输入付款相关备注信息" />
            </div>
            <div className="flex justify-end">
                <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">{loading ? '保存中...' : '保存付款信息'}</button>
            </div>
        </form>
    );
};

export default PaymentCreateForm;
