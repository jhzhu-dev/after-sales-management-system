import React from 'react';

export interface ButtonGroupOption {
  value: string;
  label: string;
}

interface ButtonGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: ButtonGroupOption[];
  colorClass?: (value: string) => string;
  error?: boolean;
  className?: string;
}

/**
 * 分段按钮组：用于少量固定选项的点击选择（如紧急程度、状态等），替代下拉框。
 * 样式与测试任务单中的“紧急程度”保持一致。
 */
const ButtonGroup: React.FC<ButtonGroupProps> = ({ value, onChange, options, colorClass, error, className }) => {
  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              active
                ? `${colorClass ? colorClass(o.value) : 'text-primary-600 bg-primary-50'} border-transparent ring-2 ring-primary-500/50 ring-offset-1`
                : `bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600 ${error ? 'border-red-400' : ''}`
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

export default ButtonGroup;
