import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  DevicePhoneMobileIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  ArrowRightOnRectangleIcon,
  ClipboardDocumentListIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../utils';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: '仪表盘', href: '/', icon: HomeIcon },
  { name: '设备管理', href: '/devices', icon: DevicePhoneMobileIcon },
  { name: '需求管理', href: '/customer-requirements', icon: ClipboardDocumentListIcon },
  { name: '测试管理', href: '/test-tasks', icon: BeakerIcon },
  { name: '运维中心', href: '/issues', icon: ChartBarIcon },
  { name: '产品线管理', href: '/product-lines', icon: CubeIcon },
  { name: '版本库中心', href: '/releases', icon: WrenchScrewdriverIcon },
  { name: '系统设置', href: '/settings', icon: Cog6ToothIcon },
  { name: '飞书设置', href: '/feishu-settings', icon: Cog6ToothIcon, adminOnly: true },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      {/* 侧边栏 - 悬浮玻璃面板 */}
      <aside className="fixed left-3 top-3 bottom-3 z-50 flex w-56 3xl:w-64 flex-col glass-strong rounded-2xl overflow-hidden no-print">
        <div className="flex h-14 3xl:h-16 shrink-0 items-center justify-center border-b border-gray-200/60 px-4 dark:border-white/10">
          <h1 className="text-base 3xl:text-xl font-bold text-gray-900">售后登记系统</h1>
        </div>

        <nav className="mt-4 3xl:mt-6 flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {navigation.filter(item => item.adminOnly ? user?.role === 'admin' : true).map((item) => {
              const isActive = item.href === '/'
                ? location.pathname === '/'
                : location.pathname === item.href || location.pathname.startsWith(item.href + '/');
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all',
                      isActive
                        ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-200'
                        : 'text-gray-600 hover:bg-gray-500/10 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* 主内容区域 */}
      <div className="pl-72 3xl:pl-80 print:pl-0">
        {/* 顶部导航栏 - 玻璃 */}
        <header className="sticky top-0 z-30 glass-strong rounded-b-2xl no-print">
          <div className="flex h-14 3xl:h-16 items-center justify-between px-4 3xl:px-6">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => item.href === location.pathname)?.name || '售后登记系统'}
              </h2>
            </div>

            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <div className="hidden text-sm text-gray-500 sm:block">
                {new Date().toLocaleDateString('zh-CN')}
              </div>
              {user && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600">{user.username}</span>
                  <button
                    onClick={handleLogout}
                    title="退出登录"
                    className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-500/10 hover:text-red-600 transition-colors dark:hover:bg-white/10 dark:hover:text-red-400"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    <span>退出</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-4 3xl:p-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
