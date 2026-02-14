import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { DeviceUpgradeFormData, Device } from '../types';
import { deviceApi } from '../services/api';

interface UpgradeFormProps {
    deviceId: string;
    onClose: () => void;
    onSubmit: (data: DeviceUpgradeFormData) => Promise<void>;
}

const UpgradeForm: React.FC<UpgradeFormProps> = ({ deviceId, onClose, onSubmit }) => {
    const [formData, setFormData] = useState<DeviceUpgradeFormData>({
        device_id: deviceId || '',
        upgrade_type: '软件更新',
        description: '',
        old_version: '',
        new_version: '',
        operator_id: ''
    });
    const [loading, setLoading] = useState(false);
    const [devices, setDevices] = useState<Device[]>([]);

    useEffect(() => {
        if (!deviceId) {
            fetchDevices();
        }
    }, [deviceId]);

    const fetchDevices = async () => {
        try {
            const res = await deviceApi.getDevices({ limit: 1000 });
            if (res.success) setDevices(res.data);
        } catch (error) {
            console.error('获取设备列表失败:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error) {
            console.error('保存升级记录失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">登记设备升级记录</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {!deviceId && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">选择设备 *</label>
                            <select
                                name="device_id"
                                value={formData.device_id}
                                onChange={handleChange}
                                required
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">请选择要升级的设备</option>
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>{d.id} - {d.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">升级类型 *</label>
                            <select
                                name="upgrade_type"
                                value={formData.upgrade_type}
                                onChange={handleChange}
                                required
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="软件更新">软件更新</option>
                                <option value="硬件升级">硬件升级</option>
                                <option value="系统优化">系统优化</option>
                                <option value="其他">其他</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">执行人 *</label>
                            <input
                                type="text"
                                name="operator_id"
                                value={formData.operator_id}
                                onChange={handleChange}
                                required
                                placeholder="执行工程师姓名"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">原版本号</label>
                            <input
                                type="text"
                                name="old_version"
                                value={formData.old_version}
                                onChange={handleChange}
                                placeholder="例如 V1.2.0"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">新版本号 *</label>
                            <input
                                type="text"
                                name="new_version"
                                value={formData.new_version}
                                onChange={handleChange}
                                required
                                placeholder="例如 V1.3.0"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>



                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">升级说明 *</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            required
                            rows={4}
                            placeholder="请详细描述本次升级的具体内容、解决的问题或改进的项目..."
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                        >
                            {loading ? '正在保存...' : '确认登记'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UpgradeForm;
