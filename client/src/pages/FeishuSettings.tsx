import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { feishuApi } from '../services/api';
import { FeishuUser } from '../types';

const MOCK_MODE = process.env.REACT_APP_FEISHU_MOCK === 'true';
const BACKEND_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const FeishuSettings: React.FC = () => {
  const [config, setConfig] = useState({
    app_id: '',
    app_secret: '',
    chat_id: '',
  });
  const [users, setUsers] = useState<FeishuUser[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const prevChatIdRef = React.useRef('');
  const [testing, setTesting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; chatName?: string; timestamp: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
    loadUsers();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await feishuApi.getConfig();
      if (res.success && res.data) {
        const chatId = res.data.chat_id || res.data.issues_chat_id || res.data.devices_chat_id || res.data.upgrades_chat_id || '';
        prevChatIdRef.current = chatId;
        setConfig({
          app_id: res.data.app_id || '',
          app_secret: res.data.app_secret || '',
          chat_id: chatId,
        });
      }
    } catch (e) {
      console.error('加载飞书配置失败', e);
    } finally {
      setConfigLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await feishuApi.getUsers();
      if (res.success && res.data) setUsers(res.data as FeishuUser[]);
    } catch (e) {}
  };

  const showMsg = (type: 'success' | 'error' | 'warning', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), type === 'warning' ? 8000 : 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await feishuApi.saveConfig(config);
      if (res.success) {
        prevChatIdRef.current = config.chat_id;
        showMsg('success', '配置已保存，正在同步群成员...');
        // 保存后始终自动同步
        setSyncing(true);
        try {
          const syncRes = await feishuApi.syncUsers();
          if (syncRes.success) {
            setSyncResult({ synced: syncRes.data.synced, chatName: syncRes.data.chatName, timestamp: syncRes.data.timestamp });
            const cleared = syncRes.data.clearedModules;
            if (cleared && cleared.length > 0) {
              showMsg('warning', `同步完成，共 ${syncRes.data.synced} 名成员。以下模块关联人员已离群，请前往基础设置重新关联：${cleared.join('、')}`);
            } else {
              showMsg('success', `同步完成，共 ${syncRes.data.synced} 名成员`);
            }
            loadUsers();
          }
        } catch (_) {
          showMsg('error', '配置已保存，但同步群成员失败，请手动点击同步');
        } finally {
          setSyncing(false);
        }
      } else {
        showMsg('error', res.message || '保存失败');
      }
    } catch (e) {
      showMsg('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await feishuApi.syncUsers();
      if (res.success) {
        setSyncResult({ synced: res.data.synced, chatName: res.data.chatName, timestamp: res.data.timestamp });
        showMsg('success', `同步成功，共 ${res.data.synced} 名用户`);
        loadUsers();
      } else {
        showMsg('error', res.message || '同步失败');
      }
    } catch (e) {
      showMsg('error', '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await feishuApi.testMessage();
      if (res.success) showMsg('success', '测试消息已发送');
      else showMsg('error', res.message || '发送失败');
    } catch (e) {
      showMsg('error', '发送失败');
    } finally {
      setTesting(false);
    }
  };

  if (configLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-500">加载中...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">飞书通知设置</h1>

        {/* Mock mode banner */}
        {MOCK_MODE && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-yellow-800">模拟模式已启用</p>
              <p className="text-sm text-yellow-700 mt-1">当前使用本地 Mock 飞书服务，无需真实 App ID/Secret。</p>
            </div>
            <a
              href={`${BACKEND_BASE}/mock-feishu-inbox`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 px-3 py-1.5 text-sm bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded font-medium whitespace-nowrap"
            >
              查看消息收件箱
            </a>
          </div>
        )}

        {/* Config form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">应用配置</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
              <input
                type="text"
                value={config.app_id}
                onChange={e => setConfig(prev => ({ ...prev, app_id: e.target.value }))}
                placeholder="cli_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">App Secret</label>
              <input
                type="password"
                value={config.app_secret}
                onChange={e => setConfig(prev => ({ ...prev, app_secret: e.target.value }))}
                placeholder="保存后显示 ***"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">通知群 Chat ID</label>
            <input
              type="text"
              value={config.chat_id}
              onChange={e => setConfig(prev => ({ ...prev, chat_id: e.target.value }))}
              placeholder="oc_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">所有通知（售后问题、设备录入、升级任务）统一发送到此群，消息卡片标题会区分类型</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving || syncing ? '保存并同步中...' : '保存并同步群组成员'}
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              {testing ? '发送中...' : '发送测试消息'}
            </button>
          </div>
        </div>

        {/* User sync */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{syncResult?.chatName || '飞书用户列表'}</h2>
          </div>

          {syncResult && (
            <p className="text-sm text-gray-500">上次同步：{syncResult.synced} 名用户，时间：{new Date(syncResult.timestamp).toLocaleString()}</p>
          )}

          {users.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">暂无用户，请先同步</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map(u => (
                <div key={u.open_id} className="flex items-center gap-3 py-2.5">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold">
                      {u.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.department}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Toast */}
      {message && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all max-w-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-300'
            : message.type === 'warning'
            ? 'bg-yellow-50 text-yellow-800 border border-yellow-300'
            : 'bg-red-50 text-red-700 border border-red-300'
        }`}>
          {message.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          ) : message.type === 'warning' ? (
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          ) : (
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          <span>{message.text}</span>
        </div>
      )}
    </Layout>
  );
};

export default FeishuSettings;
