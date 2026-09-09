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
  BookOpenIcon,
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
  { name: '知识库', href: '/knowledge', icon: BookOpenIcon },
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
      {/* 侧边栏 - 悬浮玻璃面板：与顶部卡片四边同距 15px */}
      <aside className="fixed left-[15px] top-[15px] bottom-[15px] z-50 flex w-56 3xl:w-64 flex-col glass-strong bg-popover rounded-2xl overflow-hidden no-print">
        <div className="flex h-14 3xl:h-16 shrink-0 items-center justify-center border-b border-gray-200/60 px-4 dark:border-white/10">
          <h1 className="text-base 3xl:text-xl font-bold text-gray-900">ELSCOPEVISION</h1>
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
                        ? 'bg-primary-500/10 text-primary-600 dark:bg-blue-400/15 dark:text-[#9ccbe8]'
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

        {/* 侧边栏底部：主题切换 / 日期 / 用户 / 退出 */}
        <div className="shrink-0 border-t border-gray-200/60 px-3 py-3 space-y-2 dark:border-white/10 no-print">
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
          {user && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-gray-600 dark:text-gray-300" title={user.username}>
                {user.username}
              </span>
              <span className="shrink-0 text-xs text-gray-500">{new Date().toLocaleDateString('zh-CN')}</span>
              <button
                onClick={handleLogout}
                title="退出登录"
                className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-500/10 hover:text-red-600 transition-colors dark:hover:bg-white/10 dark:hover:text-red-400"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                <span>退出</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* 主内容区域：偏移 = 侧边栏左距15px + rem宽度，随根字号(14/16px)自动适配 1080p/2K/4K */}
      <div className="pl-[calc(15px+14rem)] 3xl:pl-[calc(15px+16rem)] print:pl-0">
        {/* 页面内容：左右各留 15px */}
        <main className="py-4 px-[15px] 3xl:py-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
