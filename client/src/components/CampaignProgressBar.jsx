import React, { useState, useEffect } from 'react';
import {
    XCircle, CheckCircle2, AlertCircle, Clock, Phone, Zap
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAppDialog } from './AppDialog';

const CampaignProgressBar = ({ campaign, socket, onFinished }) => {
    const { confirm, Dialog } = useAppDialog();
    const [data, setData] = useState(campaign);
    const [logs, setLogs] = useState([]);
    const [stopping, setStopping] = useState(false);

    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (update) => {
            if (update.campaignId !== campaign.id) return;

            setData(prev => ({ ...prev, ...update }));

            setLogs(prev => {
                const newLog = {
                    phone: update.lastPhone,
                    success: update.success,
                    time: new Date().toLocaleTimeString()
                };
                return [newLog, ...prev.slice(0, 4)];
            });
        };

        const handleFinished = (finish) => {
            if (finish.campaignId !== campaign.id) return;
            toast.success(`Campaign ${finish.status === 'completed' ? 'Finished' : 'Stopped'}`);
            if (onFinished) onFinished();
        };

        socket.on('campaign_update', handleUpdate);
        socket.on('campaign_finished', handleFinished);

        return () => {
            socket.off('campaign_update', handleUpdate);
            socket.off('campaign_finished', handleFinished);
        };
    }, [socket, campaign.id, onFinished]);

    const handleStop = async () => {
        const ok = await confirm({
            title: 'Stop campaign?',
            message: 'The current message will finish if it is already sending, then remaining recipients will not be sent.',
            confirmLabel: 'Stop campaign',
            danger: true
        });
        if (!ok) return;
        setStopping(true);
        try {
            await api.post(`/campaigns/${campaign.id}/stop`);
            toast.success('Stop signal sent');
        } catch (err) {
            toast.error('Failed to stop campaign');
            setStopping(false);
        }
    };

    const progress = data.progress || 0;

    return (
        <>
        <div className="bg-white rounded-[2rem] p-6 lg:p-8 border border-emerald-100 shadow-xl shadow-emerald-500/10 animate-fade-in relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 -z-10 opacity-70"></div>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-300 rounded-full blur-[80px] -z-10 opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-emerald-100/60 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
                        <Zap size={28} className="animate-pulse" />
                    </div>
                    <div>
                        <h4 className="font-black text-2xl text-gray-900 tracking-tight flex items-center gap-2">
                            {data.name || 'Running Sequence'}
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                        </h4>
                        <p className="text-sm font-bold text-emerald-600 mt-1 uppercase tracking-widest">Real-time Execution</p>
                    </div>
                </div>
                <button
                    onClick={handleStop}
                    disabled={stopping}
                    className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-red-100 text-red-600 rounded-xl text-sm font-black hover:bg-red-50 hover:border-red-200 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                >
                    <XCircle size={18} className="group-hover/btn:scale-110 transition-transform" />
                    <span>{stopping ? 'Stopping...' : 'Stop Campaign'}</span>
                </button>
            </div>

            {/* Progress Bar Area */}
            <div className="space-y-3 mb-8">
                <div className="flex justify-between items-end">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Global Completion</span>
                    <span className="text-3xl font-black text-emerald-600 tracking-tighter">{progress}%</span>
                </div>
                <div className="w-full h-4 bg-gray-100/80 rounded-full overflow-hidden border border-gray-200/50 shadow-inner">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500 transition-all duration-700 ease-out relative"
                        style={{ width: `${progress}%` }}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-emerald-100 shadow-sm relative overflow-hidden group/success hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 scale-x-0 group-hover/success:scale-x-100 origin-left transition-transform duration-500"></div>
                    <div className="flex items-center gap-3 text-emerald-600 mb-2">
                        <div className="p-2 bg-emerald-100 rounded-xl"><CheckCircle2 size={20} /></div>
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-700">Delivered</span>
                    </div>
                    <p className="text-5xl font-black text-gray-900 tracking-tighter mt-2">{data.sentCount || 0}</p>
                </div>

                <div className="bg-white/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-red-100 shadow-sm relative overflow-hidden group/fail hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-red-500 scale-x-0 group-hover/fail:scale-x-100 origin-left transition-transform duration-500"></div>
                    <div className="flex items-center gap-3 text-red-500 mb-2">
                        <div className="p-2 bg-red-100 rounded-xl"><AlertCircle size={20} /></div>
                        <span className="text-xs font-black uppercase tracking-widest text-red-700">Failed</span>
                    </div>
                    <p className="text-5xl font-black text-gray-900 tracking-tighter mt-2">{data.failCount || 0}</p>
                </div>

                <div className="bg-white/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-amber-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 text-amber-500 mb-2">
                        <div className="p-2 bg-amber-100 rounded-xl"><AlertCircle size={20} /></div>
                        <span className="text-xs font-black uppercase tracking-widest text-amber-700">Skipped</span>
                    </div>
                    <p className="text-5xl font-black text-gray-900 tracking-tighter mt-2">{data.skippedCount || 0}</p>
                </div>
            </div>

            {/* Live Log */}
            <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full max-h-[250px]">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-indigo-500" />
                        <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Event Telemetry</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md">Live feed</span>
                </div>

                <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1">
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10 opacity-70">
                            <Clock size={24} className="mb-2 animate-pulse" />
                            <span className="text-sm font-bold uppercase tracking-wider">Awaiting Dispatches</span>
                        </div>
                    ) : logs.map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50/50 hover:bg-gray-100/80 border border-gray-100 transition-all text-sm animate-fade-in group/log">
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${log.success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                    {log.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                </div>
                                <span className="font-bold text-gray-800 flex items-center gap-2">
                                    <Phone size={14} className="text-gray-400 group-hover/log:text-indigo-500 transition-colors" />
                                    +{log.phone}
                                </span>
                            </div>
                            <span className="text-[11px] font-black tracking-wider text-gray-400 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm">
                                {log.time}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
            <Dialog />
        </>
    );
};

export default CampaignProgressBar;
