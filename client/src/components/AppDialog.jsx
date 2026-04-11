import React, { useState } from 'react';

export const useAppDialog = () => {
    const [dialog, setDialog] = useState(null);

    const close = (value) => {
        if (dialog?.resolve) dialog.resolve(value);
        setDialog(null);
    };

    const confirm = ({ title, message, confirmLabel = 'Confirm', danger = false }) => new Promise(resolve => {
        setDialog({ type: 'confirm', title, message, confirmLabel, danger, resolve });
    });

    const alert = ({ title, message, confirmLabel = 'OK' }) => new Promise(resolve => {
        setDialog({ type: 'alert', title, message, confirmLabel, resolve });
    });

    const prompt = ({ title, message, placeholder = '', confirmLabel = 'Save' }) => new Promise(resolve => {
        setDialog({ type: 'prompt', title, message, placeholder, confirmLabel, value: '', resolve });
    });

    const Dialog = () => {
        if (!dialog) return null;
        const isPrompt = dialog.type === 'prompt';
        const isConfirm = dialog.type === 'confirm';

        return (
            <div className="fixed inset-0 z-[80] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-lg shadow-2xl border border-gray-100 overflow-hidden">
                    <div className={`h-1.5 ${dialog.danger ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <div className="p-6 space-y-4">
                        <div>
                            <h3 className="text-xl font-black text-gray-900">{dialog.title}</h3>
                            {dialog.message && <p className="text-sm font-medium text-gray-500 mt-2 leading-relaxed">{dialog.message}</p>}
                        </div>
                        {isPrompt && (
                            <input
                                autoFocus
                                value={dialog.value}
                                onChange={e => setDialog(prev => ({ ...prev, value: e.target.value }))}
                                placeholder={dialog.placeholder}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                            />
                        )}
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                        {isConfirm || isPrompt ? (
                            <button onClick={() => close(false)} className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 font-black">
                                Cancel
                            </button>
                        ) : null}
                        <button
                            onClick={() => close(isPrompt ? dialog.value : true)}
                            className={`px-4 py-2.5 rounded-lg text-white font-black ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                            {dialog.confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return { alert, confirm, prompt, Dialog };
};
