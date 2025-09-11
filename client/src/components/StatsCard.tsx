import React from 'react';
import { cn } from '../utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  className?: string;
}

const colorClasses = {
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  yellow: 'bg-yellow-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
  gray: 'bg-gray-500 text-white',
};

const changeColorClasses = {
  increase: 'text-green-600',
  decrease: 'text-red-600',
  neutral: 'text-gray-600',
};

export default function StatsCard({ 
  title, 
  value, 
  change, 
  icon, 
  color = 'blue',
  className 
}: StatsCardProps) {
  return (
    <div className={cn('bg-white rounded-lg shadow p-6', className)}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {icon && (
            <div className={cn('p-3 rounded-md', colorClasses[color])}>
              {icon}
            </div>
          )}
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">
              {title}
            </dt>
            <dd className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">
                {value}
              </div>
              {change && (
                <div className={cn('ml-2 flex items-baseline text-sm font-semibold', changeColorClasses[change.type])}>
                  {change.type === 'increase' && '+'}
                  {change.value}%
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
