import React, { useState } from 'react';

interface ReviewDialogProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onSubmit: (approved: boolean, notes: string) => void;
    loading?: boolean;
}

const ReviewDialog: React.FC<ReviewDialogProps> = ({ isOpen, title, onClose, onSubmit, loading = false }) => {
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    aria-hidden="true"
                    onClick={onClose}
                ></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-2xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="mt-3 text-center sm:mt-5">
                            <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500">
                                    请审核当前阶段的工作内容。通过后将自动进入下一阶段，驳回则需要重新提交。
                                </p>
                            </div>
                            <div className="mt-4">
                                <textarea
                                    rows={4}
                                    className="block w-full text-sm border-gray-200 rounded-xl p-3 border focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="请输入审核意见（可选）..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    disabled={loading}
                                ></textarea>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            disabled={loading}
                            className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2.5 bg-green-600 text-sm font-bold text-white hover:bg-green-700 focus:outline-none disabled:opacity-50 transition-all"
                            onClick={() => onSubmit(true, notes)}
                        >
                            {loading ? '提交中...' : '审核通过'}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            className="w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2.5 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50 text-red-600 hover:text-red-700 hover:bg-red-50 transition-all"
                            onClick={() => onSubmit(false, notes)}
                        >
                            驳回
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewDialog;
