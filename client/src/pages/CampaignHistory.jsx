import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, RefreshCw, Trash2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAppDialog } from '../components/AppDialog';

const CampaignHistory = () => {
    const { confirm, Dialog } = useAppDialog();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    const toNumber = (value) => {
        const num = Number(value || 0);
        return Number.isFinite(num) ? num : 0;
    };

    const getRecipientCount = (campaign) => {
        const reported = toNumber(campaign.recipient_count ?? campaign.recipientCount ?? campaign.total);
        const fromResults = toNumber(campaign.sent_count ?? campaign.sentCount)
            + toNumber(campaign.fail_count ?? campaign.failCount)
            + toNumber(campaign.skipped_count ?? campaign.skippedCount);
        return Math.max(reported, fromResults);
    };

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/campaigns');
            setCampaigns(data.campaigns || []);
        } catch (_) {
            toast.error('Failed to load campaign history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCampaigns(); }, []);

    const totals = useMemo(() => {
        return campaigns.reduce((acc, item) => {
            acc.sent += item.sent_count || item.sentCount || 0;
            acc.failed += item.fail_count || item.failCount || 0;
            acc.skipped += item.skipped_count || item.skippedCount || 0;
            return acc;
        }, { sent: 0, failed: 0, skipped: 0 });
    }, [campaigns]);

    const downloadReport = async (format, campaignId = null) => {
        const key = `${format}:${campaignId || 'all'}`;
        setDownloading(key);
        try {
            const endpoint = campaignId
                ? `/campaigns/${campaignId}/report?format=${format}`
                : `/campaigns/reports/export?format=${format}`;
            const response = await api.get(endpoint, { responseType: 'blob' });
            const contentDisposition = response.headers['content-disposition'] || '';
            const match = contentDisposition.match(/filename="?([^"]+)"?/i);
            const filename = match?.[1] || `campaign-report.${format === 'excel' ? 'xls' : format}`;
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(blobUrl);
        } catch (_) {
            toast.error(`Failed to download ${format.toUpperCase()} report`);
        } finally {
            setDownloading('');
        }
    };

    const handleDelete = async (campaign) => {
        const ok = await confirm({
            title: 'Delete campaign history?',
            message: `This removes "${campaign.name}" and its recipient report history permanently.`,
            confirmLabel: 'Delete campaign',
            danger: true
        });
        if (!ok) return;

        setDeletingId(campaign.id);
        try {
            await api.delete(`/campaigns/${campaign.id}`);
            setCampaigns(prev => prev.filter(item => item.id !== campaign.id));
            toast.success('Campaign history deleted');
        } catch (_) {
            toast.error('Failed to delete campaign history');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-8 pb-12 max-w-[1600px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Campaign History</h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Track campaign performance and download reports in CSV, Excel, or PDF.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={fetchCampaigns} className="px-4 py-3 rounded-lg border border-gray-200 font-black flex items-center gap-2"><RefreshCw size={16} /> Refresh</button>
                    <button disabled={downloading === 'csv:all'} onClick={() => downloadReport('csv')} className="px-4 py-3 rounded-lg bg-white border border-gray-200 font-black flex items-center gap-2 disabled:opacity-60"><Download size={16} /> All CSV</button>
                    <button disabled={downloading === 'excel:all'} onClick={() => downloadReport('excel')} className="px-4 py-3 rounded-lg bg-white border border-gray-200 font-black flex items-center gap-2 disabled:opacity-60"><FileSpreadsheet size={16} /> All Excel</button>
                    <button disabled={downloading === 'pdf:all'} onClick={() => downloadReport('pdf')} className="px-4 py-3 rounded-lg bg-white border border-gray-200 font-black flex items-center gap-2 disabled:opacity-60"><FileText size={16} /> All PDF</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-100 p-5">
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-black">Campaigns</p>
                    <p className="text-3xl font-black text-gray-900">{campaigns.length}</p>
                </div>
                <div className="bg-white rounded-lg border border-emerald-100 p-5">
                    <p className="text-xs uppercase tracking-widest text-emerald-700 font-black">Delivered</p>
                    <p className="text-3xl font-black text-gray-900">{totals.sent}</p>
                </div>
                <div className="bg-white rounded-lg border border-red-100 p-5">
                    <p className="text-xs uppercase tracking-widest text-red-700 font-black">Failed</p>
                    <p className="text-3xl font-black text-gray-900">{totals.failed}</p>
                </div>
                <div className="bg-white rounded-lg border border-amber-100 p-5">
                    <p className="text-xs uppercase tracking-widest text-amber-700 font-black">Skipped</p>
                    <p className="text-3xl font-black text-gray-900">{totals.skipped}</p>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                            <tr>
                                <th className="p-4">Campaign</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Recipients</th>
                                <th className="p-4">Results</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-500 font-bold">Loading...</td></tr>
                            ) : campaigns.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-500 font-bold">No campaign history yet.</td></tr>
                            ) : campaigns.map(campaign => (
                                <tr key={campaign.id} className="border-t border-gray-100">
                                    <td className="p-4">
                                        <p className="font-black text-gray-900">{campaign.name}</p>
                                        <p className="text-xs text-gray-500">{campaign.scheduled_at ? `Scheduled ${new Date(campaign.scheduled_at).toLocaleString()}` : new Date(campaign.created_at).toLocaleString()}</p>
                                    </td>
                                    <td className="p-4"><span className="px-3 py-1 rounded-lg bg-gray-100 text-xs font-black uppercase">{campaign.status}</span></td>
                                    <td className="p-4 font-black">{getRecipientCount(campaign)}</td>
                                    <td className="p-4 text-sm font-black">
                                        <span className="text-emerald-600">{campaign.sent_count || campaign.sentCount || 0}</span>
                                        <span className="mx-2 text-gray-300">/</span>
                                        <span className="text-red-500">{campaign.fail_count || campaign.failCount || 0}</span>
                                        <span className="mx-2 text-gray-300">/</span>
                                        <span className="text-amber-500">{campaign.skipped_count || campaign.skippedCount || 0}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/campaigns/${campaign.id}`} className="px-3 py-2 rounded-lg border border-gray-200 font-black text-xs">Details</Link>
                                            <button disabled={downloading === `csv:${campaign.id}`} onClick={() => downloadReport('csv', campaign.id)} className="px-3 py-2 rounded-lg border border-gray-200 font-black text-xs disabled:opacity-60">CSV</button>
                                            <button disabled={downloading === `excel:${campaign.id}`} onClick={() => downloadReport('excel', campaign.id)} className="px-3 py-2 rounded-lg border border-gray-200 font-black text-xs disabled:opacity-60">Excel</button>
                                            <button disabled={downloading === `pdf:${campaign.id}`} onClick={() => downloadReport('pdf', campaign.id)} className="px-3 py-2 rounded-lg border border-gray-200 font-black text-xs disabled:opacity-60">PDF</button>
                                            <button
                                                disabled={deletingId === campaign.id}
                                                onClick={() => handleDelete(campaign)}
                                                className="px-3 py-2 rounded-lg border border-red-200 text-red-600 font-black text-xs disabled:opacity-60 flex items-center gap-1"
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Dialog />
        </div>
    );
};

export default CampaignHistory;
