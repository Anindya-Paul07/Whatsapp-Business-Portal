import React, { useState, useEffect } from 'react';
import {
    Send,
    History,
    Play,
    Database,
    FileSpreadsheet,
    AlertCircle,
    Loader2,
    Trash2,
    Edit2,
    RotateCcw
} from 'lucide-react';
import api from '../utils/api';
import { useApp } from '../AppContext';
import toast from 'react-hot-toast';
import CampaignProgressBar from '../components/CampaignProgressBar';

const Campaigns = () => {
    const { whatsappStatus, socket } = useApp();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Campaign State
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [source, setSource] = useState('database'); // 'database' | 'csv'
    const [submitting, setSubmitting] = useState(false);
    const [editCampaign, setEditCampaign] = useState(null); // null for create, object for edit

    // Active Running Campaign
    const [activeRunning, setActiveRunning] = useState(null);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/campaigns');
            setCampaigns(data.campaigns || []);

            // Check if any campaign is currently 'processing'
            const processing = (data.campaigns || []).find(c => c.status === 'processing');
            if (processing) {
                // Use live data if it exists, fallback to DB fields
                setActiveRunning({
                    ...processing,
                    progress: processing.progress ?? 0,
                    sentCount: processing.sentCount ?? processing.sent_count,
                    failCount: processing.failCount ?? processing.fail_count,
                    total: processing.total || (processing.sent_count + processing.fail_count) || 100
                });
            } else {
                setActiveRunning(null);
            }
        } catch (err) {
            toast.error('Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const handleOpenEdit = (campaign) => {
        setEditCampaign(campaign);
        setName(campaign.name);
        setMessage(campaign.message);
        // Scroll to top to see the form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditCampaign(null);
        setName('');
        setMessage('');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (whatsappStatus !== 'ready') {
            return toast.error('WhatsApp not connected. Please go to Connect tab.');
        }
        setSubmitting(true);
        try {
            if (editCampaign) {
                // Update existing
                await api.put(`/campaigns/${editCampaign.id}`, { name, message });
                toast.success('Campaign updated');
                setEditCampaign(null);
            } else {
                // Create new
                const { data } = await api.post('/campaigns', { name, message });
                if (data.success) {
                    // Automatically trigger 'run' after creation
                    await api.post(`/campaigns/${data.campaignId}/run`, { fromSource: source });
                    toast.success('Campaign started!');
                }
            }

            setName(''); setMessage('');
            fetchCampaigns();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this campaign?')) return;
        try {
            await api.delete(`/campaigns/${id}`);
            setCampaigns(campaigns.filter(c => c.id !== id));
            toast.success('Campaign deleted');
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="space-y-8 pb-10">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Campaigns & CRM</h2>
                    <p className="text-[#667781]">Automated broadcast and bulk messaging</p>
                </div>
                {activeRunning && (
                    <div className="badge border border-orange-200 bg-orange-50 text-orange-700 animate-pulse px-4 py-1.5 flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                        <span className="font-bold tracking-tight">Active Campaign Running</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Create Campaign Form */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            {editCampaign ? <Edit2 size={18} className="text-blue-500" /> : <Play size={18} className="text-[#00a884]" />}
                            <span>{editCampaign ? 'Update Campaign' : 'Launch New Campaign'}</span>
                        </h3>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="label">Campaign Name</label>
                                <input
                                    type="text" className="input" placeholder="e.g. Summer Sale 2024" required
                                    value={name} onChange={e => setName(e.target.value)}
                                />
                            </div>

                            {!editCampaign && (
                                <div>
                                    <label className="label">Select Audience Source</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSource('database')}
                                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${source === 'database' ? 'border-[#00a884] bg-[#e7f8f3] text-[#00a884]' : 'border-[#e9edef] bg-gray-50 text-[#667781]'}`}
                                        >
                                            <Database size={16} />
                                            <span>Database</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSource('csv')}
                                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${source === 'csv' ? 'border-[#00a884] bg-[#e7f8f3] text-[#00a884]' : 'border-[#e9edef] bg-gray-50 text-[#667781]'}`}
                                        >
                                            <FileSpreadsheet size={16} />
                                            <span>Import CSV</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <label className="label mb-0">Message Template</label>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Use {"{{name}}"} for dynamic tag</span>
                                </div>
                                <textarea
                                    className="input min-h-[150px] resize-none py-3"
                                    placeholder="Hi {{name}}, we have a special offer for you!"
                                    required
                                    value={message} onChange={e => setMessage(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting || whatsappStatus !== 'ready'}
                                    className="btn-primary flex-1 py-4 justify-center shadow-lg shadow-[#00a884]/20 disabled:grayscale disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                                        editCampaign ? <><Edit2 size={18} /><span>Update Campaign</span></> : <><Send size={18} /><span>Launch Campaign</span></>
                                    )}
                                </button>
                                {editCampaign && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="btn-ghost border p-4 text-gray-400 hover:text-red-500"
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                )}
                            </div>

                            {whatsappStatus !== 'ready' && (
                                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-[10px] font-bold uppercase flex gap-2 items-center">
                                    <AlertCircle size={14} />
                                    <span>WhatsApp session not connected</span>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* Right: History & Active Progress */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Active Progress component (Real-time tracking & Control) */}
                    {activeRunning && (
                        <CampaignProgressBar
                            campaign={activeRunning}
                            socket={socket}
                            onFinished={() => {
                                setActiveRunning(null);
                                fetchCampaigns();
                            }}
                        />
                    )}

                    <div className="card !p-0">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold flex items-center gap-2">
                                <History size={18} className="text-gray-400" />
                                <span>Campaign History</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="table-th text-xs">Name</th>
                                        <th className="table-th text-xs">Status</th>
                                        <th className="table-th text-xs">Analytics</th>
                                        <th className="table-th text-xs">Date</th>
                                        <th className="table-th text-xs text-right">Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="5" className="py-10 text-center"><Loader2 className="animate-spin inline" /></td></tr>
                                    ) : campaigns.length === 0 ? (
                                        <tr><td colSpan="5" className="py-20 text-center text-[#667781]">No campaigns launched yet</td></tr>
                                    ) : campaigns.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50 border-b last:border-0">
                                            <td className="table-td font-semibold">{c.name}</td>
                                            <td className="table-td">
                                                <span className={`badge ${c.status === 'completed' ? 'badge-green' : c.status === 'processing' ? 'badge-yellow' : 'badge-gray'}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="table-td">
                                                <div className="text-xs">
                                                    <span className="text-green-600 font-bold">{c.sent_count} Sent</span>
                                                    <span className="mx-2 text-gray-300">|</span>
                                                    <span className="text-red-500 font-bold">{c.fail_count} Fail</span>
                                                </div>
                                            </td>
                                            <td className="table-td text-[#667781] text-xs">
                                                {new Date(c.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="table-td text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenEdit(c)}
                                                        className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                                                        title="Edit Campaign"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(c.id)}
                                                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                        title="Delete Campaign"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Campaigns;
