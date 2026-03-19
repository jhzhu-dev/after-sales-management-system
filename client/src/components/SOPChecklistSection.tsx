import React, { useRef } from 'react';
import { ChecklistItem, ChecklistItemStatus } from '../types';

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  disabled?: boolean;
}

const statusLabel: Record<ChecklistItemStatus, string> = {
  pending: '待确认',
  done: '已完成',
  na: '不涉及',
};

const statusColor: Record<ChecklistItemStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  done: 'bg-green-100 text-green-700',
  na: 'bg-yellow-50 text-yellow-600',
};

const SOPChecklistSection: React.FC<Props> = ({ items, onChange, disabled = false }) => {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!items || items.length === 0) return null;

  const updateItem = (id: string, patch: Partial<ChecklistItem>) => {
    onChange(items.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const cycleStatus = (item: ChecklistItem) => {
    if (disabled) return;
    const order: ChecklistItemStatus[] = ['pending', 'done', 'na'];
    const next = order[(order.indexOf(item.status) + 1) % order.length];
    // Clear attachments when moving away from done
    if (next !== 'done') {
      updateItem(item.id, { status: next, attachments: [] });
    } else {
      updateItem(item.id, { status: next });
    }
  };

  const handleFileChange = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newAttachments = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        name: f.name,
        url: URL.createObjectURL(f),
        size: f.size,
        // attach the raw File for upload
        _file: f,
      }));

    updateItem(itemId, {
      attachments: [...(item.attachments as any[]), ...newAttachments],
    });

    // Reset input
    if (fileInputRefs.current[itemId]) {
      fileInputRefs.current[itemId]!.value = '';
    }
  };

  const removeAttachment = (itemId: string, idx: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const updated = item.attachments.filter((_, i) => i !== idx);
    updateItem(itemId, { attachments: updated });
  };

  const pendingRequired = items.filter(i => i.required && i.status === 'pending').length;

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700">版本更新检查项核对</h4>
        {pendingRequired > 0 && (
          <span className="text-xs text-red-500 font-medium">
            {pendingRequired} 项必填待确认
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {items.map((item, idx) => (
          <div key={item.id} className="px-4 py-3">
            {/* Row: index, text, status button */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-400 mt-0.5 w-5 shrink-0">{idx + 1}.</span>

              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-800 break-words">
                  {item.text}
                  {item.required && (
                    <span className="ml-1 text-red-400 text-xs">*必填</span>
                  )}
                </span>
              </div>

              {/* Status cycle button */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => cycleStatus(item)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  statusColor[item.status]
                } ${disabled ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
              >
                {statusLabel[item.status]}
              </button>
            </div>

            {/* Attachments section (shown when done) */}
            {item.status === 'done' && (
              <div className="mt-2 ml-8">
                {item.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {item.attachments.map((att, aIdx) => (
                      <div key={aIdx} className="relative group">
                        <img
                          src={(att as any).url || att.url}
                          alt={att.name}
                          className="w-16 h-16 object-cover rounded border border-gray-200"
                        />
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => removeAttachment(item.id, aIdx)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!disabled && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      ref={el => { fileInputRefs.current[item.id] = el; }}
                      onChange={e => handleFileChange(item.id, e)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[item.id]?.click()}
                      className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition-colors"
                    >
                      + 上传图片佐证
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SOPChecklistSection;
