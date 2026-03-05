import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  DevicePhoneMobileIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { cn } from '../utils';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: '仪表盘', href: '/', icon: HomeIcon },
  { name: '设备管理', href: '/devices', icon: DevicePhoneMobileIcon },
  { name: '故障与升级', href: '/issues', icon: ChartBarIcon },
  { name: '产品线管理', href: '/product-lines', icon: CubeIcon },
  { name: '版本库中心', href: '/releases', icon: WrenchScrewdriverIcon },
  { name: '系统设置', href: '/settings', icon: Cog6ToothIcon },
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
    <div className="min-h-screen bg-gray-50">
      {/* 侧边栏 */}
      <div className="fixed inset-y-0 left-0 z-50 w-56 3xl:w-64 bg-white shadow-lg no-print">
        <div className="flex h-14 3xl:h-16 items-center justify-center border-b border-gray-200">
          <h1 className="text-base 3xl:text-xl font-bold text-gray-900">售后登记系统</h1>
        </div>

        <nav className="mt-4 3xl:mt-8 px-3 3xl:px-4">
          <ul className="space-y-1 3xl:space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* 主内容区域 */}
      <div className="pl-56 3xl:pl-64 print:pl-0">
        {/* 顶部导航栏 */}
        <header className="bg-white shadow-sm border-b border-gray-200 no-print">
          <div className="flex h-14 3xl:h-16 items-center justify-between px-4 3xl:px-6">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => item.href === location.pathname)?.name || '售后登记系统'}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('zh-CN')}
              </div>
              {user && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{user.username}</span>
                  <button
                    onClick={handleLogout}
                    title="退出登录"
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
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
