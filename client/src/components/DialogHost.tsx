import React, { useEffect, useState } from 'react';
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from './ui/button';

type DialogKind = 'info' | 'warning' | 'danger';

interface DialogOptions {
  title?: string;
  kind?: DialogKind;
  confirmText?: string;
  cancelText?: string;
}

interface DialogItem extends DialogOptions {
  id: number;
  type: 'alert' | 'confirm';
  message: string;
  kind: DialogKind;
  resolve: (value: boolean) => void;
}

let seq = 0;
let queue: DialogItem[] = [];
const listeners = new Set<(q: DialogItem[]) => void>();

const emit = () => listeners.forEach(fn => fn([...queue]));

const detectKind = (message: string): DialogKind => {
  if (/失败|错误|失效|异常|不可恢复/.test(message)) return 'danger';
  if (/请|必须|至少|不能为空|必填/.test(message)) return 'warning';
  return 'info';
};

const open = (type: 'alert' | 'confirm', message: string, opts: DialogOptions = {}): Promise<boolean> =>
  new Promise(resolve => {
    const item: DialogItem = {
      id: ++seq,
      type,
      message,
      title: opts.title || (type === 'confirm' ? '确认操作' : '提示'),
      kind: opts.kind || (type === 'confirm'
        ? (/删除|移除|发货|废弃/.test(message) ? 'danger' : 'warning')
        : detectKind(message)),
      confirmText: opts.confirmText || '确定',
      cancelText: opts.cancelText || '取消',
      resolve,
    };
    queue = [...queue, item];
    emit();
  });

export const alertDialog = (message: string, opts?: DialogOptions): Promise<boolean> =>
  open('alert', String(message ?? ''), opts);

export const confirmDialog = (message: string, opts?: DialogOptions): Promise<boolean> =>
  open('confirm', String(message ?? ''), opts);

const close = (id: number, value: boolean) => {
  const item = queue.find(d => d.id === id);
  queue = queue.filter(d => d.id !== id);
  item?.resolve(value);
  emit();
};

const KIND_STYLE: Record<DialogKind, { icon: React.ElementType; wrap: string; iconColor: string }> = {
  info: { icon: InformationCircleIcon, wrap: 'bg-blue-50 text-blue-500', iconColor: 'text-blue-500' },
  warning: { icon: ExclamationTriangleIcon, wrap: 'bg-amber-50 text-amber-500', iconColor: 'text-amber-500' },
  danger: { icon: XCircleIcon, wrap: 'bg-red-50 text-red-500', iconColor: 'text-red-500' },
};

export default function DialogHost() {
  const [items, setItems] = useState<DialogItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);

  // 统一接管浏览器原生 alert，保证所有提示弹框样式一致
  useEffect(() => {
    const nativeAlert = window.alert.bind(window);
    window.alert = (message?: any) => { void alertDialog(String(message ?? '')); };
    return () => { window.alert = nativeAlert; };
  }, []);

  const current = items[0];

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT';
      if (e.key === 'Enter' && !typing) { e.preventDefault(); close(current.id, true); }
      else if (e.key === 'Escape') { e.preventDefault(); close(current.id, false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (!current) return null;
  const { icon: Icon, wrap } = KIND_STYLE[current.kind];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print font-sans">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-lg"
        onClick={() => close(current.id, false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-popover shadow-soft-lg overflow-hidden"
      >
        <div className="flex items-start gap-3 p-5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${wrap}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold text-foreground">{current.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/80 whitespace-pre-line break-words">{current.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-border px-5 py-3.5">
          {current.type === 'confirm' && (
            <Button variant="outline" size="sm" onClick={() => close(current.id, false)}>
              {current.cancelText}
            </Button>
          )}
          <Button
            variant={current.kind === 'danger' ? 'destructive' : 'default'}
            size="sm"
            onClick={() => close(current.id, true)}
            autoFocus
          >
            {current.confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
