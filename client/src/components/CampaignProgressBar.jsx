import React, { useState, useEffect } from 'react';
import {
    XCircle,
    CheckCircle2,
    AlertCircle,
    Clock,
    Phone
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const CampaignProgressBar = ({ campaign, socket, onFinished }) => {
    const [data, setData] = useState(campaign);
    const [logs, setLogs] = useState([]);
    const [stopping, setStopping] = useState(false);

    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (update) => {
            if (update.campaignId !== campaign.id) return;

            setData(prev => ({ ...prev, ...update }));

            // Update logs (keep last 5)
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
        if (!window.confirm('Are you sure you want to stop this campaign immediately?')) return;
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
        <div className="card border-[#00a884] shadow-xl animate-fade-in overflow-hidden">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h4 className="font-bold text-lg flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping"></span>
                        {data.name || 'Running Campaign'}
                    </h4>
                    <p className="text-sm text-[#667781]">Real-time broadcasting progress</p>
                </div>
                <button
                    onClick={handleStop}
                    disabled={stopping}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                    <XCircle size={16} />
                    <span>{stopping ? 'Stopping...' : 'STOP CAMPAIGN'}</span>
                </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-8">
                <div className="flex justify-between text-xs font-bold text-[#667781] uppercase">
                    <span>Completion</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#00a884] transition-all duration-500 shadow-[0_0_10px_rgba(0,168,132,0.3)]"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#e7f8f3] p-4 rounded-2xl border border-green-100">
                    <div className="flex items-center gap-2 text-[#00a884] mb-1">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Successful</span>
                    </div>
                    <p className="text-2xl font-black text-green-700">{data.sentCount || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <div className="flex items-center gap-2 text-red-500 mb-1">
                        <AlertCircle size={16} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Failed</span>
                    </div>
                    <p className="text-2xl font-black text-red-700">{data.failCount || 0}</p>
                </div>
            </div>

            {/* Live Log */}
            <div className="bg-[#f8faf9] rounded-2xl border border-[#e9edef] overflow-hidden">
                <div className="px-4 py-2 border-b border-[#e9edef] bg-gray-50 flex items-center gap-2">
                    <Clock size={12} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Live Activity Log</span>
                </div>
                <div className="p-2 space-y-1 min-h-[160px]">
                    {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400 italic py-10">
                            Waiting for activity...
                        </div>
                    ) : logs.map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#e9edef] text-[11px] animate-slide-in">
                            <div className="flex items-center gap-3">
                                <div className={`p-1 rounded-full ${log.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {log.success ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                                </div>
                                <span className="font-bold flex items-center gap-1">
                                    <Phone size={10} />
                                    +{log.phone}
                                </span>
                            </div>
                            <span className="text-gray-400 font-medium">{log.time}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CampaignProgressBar;
