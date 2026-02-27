import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DevicePhoneMobileIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CubeIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { cn } from '../utils';

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 侧边栏 */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg no-print">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">售后登记系统</h1>
        </div>

        <nav className="mt-8 px-4">
          <ul className="space-y-2">
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
      <div className="pl-64 print:pl-0">
        {/* 顶部导航栏 */}
        <header className="bg-white shadow-sm border-b border-gray-200 no-print">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => item.href === location.pathname)?.name || '售后登记系统'}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('zh-CN')}
              </div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
