import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils';

/* 统一圆角毛玻璃按钮：
   - 基座统一圆角 rounded-xl + 柔和阴影 + hover 微浮起
   - variant 只控制颜色，形状/质感完全一致 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:!translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 shadow-soft hover:shadow-soft-lg',
  {
    variants: {
      variant: {
        // 主操作：品牌蓝渐变（与分段选择器选中态 .segmented-item-active 完全一致）
        default:
          'text-white bg-[image:var(--accent-grad)] hover:bg-[image:linear-gradient(180deg,#5dade2_0%,#3498db_100%)] ring-1 ring-inset ring-white/25 shadow-primary/30',
        // 玻璃中性：半透明白/深灰玻璃面
        secondary:
          'glass text-foreground bg-secondary hover:bg-secondary/80',
        outline:
          'glass border-border-strong text-foreground hover:bg-accent hover:text-accent-foreground',
        // 无底色轻量按钮：用于分区折叠头等布局场景，不参与悬停发光
        ghost: 'no-glow text-foreground hover:bg-accent hover:text-accent-foreground shadow-none hover:shadow-none',
        destructive:
          'text-white bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-red-500/25',
        // 琥珀：发货/提醒类
        amber:
          'text-white bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/25',
        // 成功：添加/上传类
        success:
          'text-white bg-gradient-to-b from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-emerald-500/25',
        // 紫色：版本迭代类
        purple:
          'text-white bg-gradient-to-b from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 shadow-violet-500/25',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs rounded-lg',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
