import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    AlertTriangle, ArrowLeft, Download, FileText, PauseCircle, PlayCircle,
    RefreshCw, Send, Square, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useApp } from '../AppContext';
import CampaignProgressBar from '../components/CampaignProgressBar';
import { useAppDialog } from '../components/AppDialog';

const apiOrigin = (api.defaults.baseURL || '').replace(/\/$/, '');

const safeJson = (value, fallback = []) => {
    if (!value) return fallback;
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value); } catch (_) { return fallback; }
};

const CampaignDetail = () => {
    const { id } = useParams();
    const { socket } = useApp();
    const { confirm, Dialog } = useAppDialog();
    const [campaign, setCampaign] = useState(null);
    const [recipients, setRecipients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const [campaignRes, recipientRes] = await Promise.all([
                api.get(`/campaigns/${id}`),
                api.get(`/campaigns/${id}/recipients`)
            ]);
            setCampaign(campaignRes.data.campaign);
            setRecipients(recipientRes.data.recipients || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load campaign');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDetail(); }, [id]);

    const counts = useMemo(() => recipients.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
    }, { pending: 0, sent: 0, failed: 0, skipped: 0 }), [recipients]);

    const message = campaign?.template_message || campaign?.message || '';
    const mediaUrl = campaign?.template_media_url || campaign?.media_url || '';
    const mediaSource = campaign?.template_media_url ? 'Template media' : (campaign?.media_url ? 'Campaign upload' : '');
    const buttons = safeJson(campaign?.buttons, []);
    const failureRows = recipients.filter(row => row.status === 'failed');

    const exportRecipients = () => {
        const header = ['name', 'phone', 'status', 'failure_code', 'error_message', 'sent_at'];
        const lines = recipients.map(row => header.map(key => `"${String(row[key] || '').replace(/"/g, '""')}"`).join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${campaign?.name || 'campaign'}-results.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const pauseCampaign = async () => {
        await api.post(`/campaigns/${id}/pause`);
        toast.success('Campaign pause signal sent');
        fetchDetail();
    };

    const resumeCampaign = async () => {
        await api.post(`/campaigns/${id}/resume`);
        toast.success('Campaign resumed');
        fetchDetail();
    };

    const stopCampaign = async () => {
        const ok = await confirm({
            title: 'Stop campaign?',
            message: 'Stop is final for this run. Pending recipients will stay unsent unless you retry or resume later.',
            confirmLabel: 'Stop campaign',
            danger: true
        });
        if (!ok) return;
        await api.post(`/campaigns/${id}/stop`);
        toast.success('Stop signal sent');
        fetchDetail();
    };

    const retryFailed = async () => {
        await api.post(`/campaigns/${id}/retry-failed`);
        toast.success('Retry started for failed recipients');
        fetchDetail();
    };

    if (loading && !campaign) {
        return <div className="max-w-[1400px] mx-auto text-gray-500 font-bold">Loading campaign...</div>;
    }

    if (!campaign) {
        return (
            <div className="max-w-[1400px] mx-auto bg-white rounded-lg border border-gray-100 p-8">
                <p className="font-black text-gray-900">Campaign not found.</p>
                <Link to="/campaigns" className="text-emerald-700 font-black">Back to campaigns</Link>
            </div>
        );
    }

    const progressCampaign = {
        ...campaign,
        sentCount: campaign.sentCount ?? campaign.sent_count ?? counts.sent,
        failCount: campaign.failCount ?? campaign.fail_count ?? counts.failed,
        skippedCount: campaign.skippedCount ?? campaign.skipped_count ?? counts.skipped,
        total: campaign.total || recipients.length,
        progress: campaign.progress ?? (recipients.length ? Math.round(((counts.sent + counts.failed + counts.skipped) / recipients.length) * 100) : 0)
    };
    const completedCount = counts.sent + counts.failed + counts.skipped;
    const successRate = completedCount ? Math.round((counts.sent / completedCount) * 100) : 0;
    const tabs = [
        ['overview', 'Overview'],
        ['recipients', `Recipients (${recipients.length})`],
        ['failures', `Failures (${failureRows.length})`],
        ['message', 'Message'],
        ['settings', 'Settings']
    ];

    return (
        <div className="space-y-8 pb-12 max-w-[1400px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-5 xl:items-center justify-between">
                <div>
                    <Link to="/campaigns" className="inline-flex items-center gap-2 text-sm font-black text-gray-500 hover:text-emerald-700 mb-3">
                        <ArrowLeft size={16} /> Back to Send Campaign
                    </Link>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">{campaign.name}</h2>
                    <p className="text-gray-500 font-medium mt-1">Audience, message, media, and delivery results in one place.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {campaign.status === 'processing' && (
                        <>
                            <button onClick={pauseCampaign} className="px-4 py-3 rounded-lg border border-amber-200 text-amber-700 font-black flex items-center gap-2"><PauseCircle size={18} /> Pause</button>
                            <button onClick={stopCampaign} className="px-4 py-3 rounded-lg border border-red-200 text-red-600 font-black flex items-center gap-2"><Square size={18} /> Stop</button>
                        </>
                    )}
                    {['paused', 'pending', 'failed'].includes(campaign.status) && counts.pending > 0 && (
                        <button onClick={resumeCampaign} className="px-4 py-3 rounded-lg bg-emerald-600 text-white font-black flex items-center gap-2"><PlayCircle size={18} /> Resume pending</button>
                    )}
                    {counts.failed > 0 && (
                        <button onClick={retryFailed} className="px-4 py-3 rounded-lg border border-gray-200 font-black flex items-center gap-2"><RefreshCw size={18} /> Retry failed</button>
                    )}
                    <button onClick={exportRecipients} className="px-4 py-3 rounded-lg border border-gray-200 font-black flex items-center gap-2"><Download size={18} /> Export CSV</button>
                </div>
            </div>

            {campaign.status === 'processing' && (
                <CampaignProgressBar campaign={progressCampaign} socket={socket} onFinished={fetchDetail} />
            )}

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[
                    ['Total', recipients.length, 'bg-gray-50 text-gray-700'],
                    ['Sent', counts.sent || 0, 'bg-emerald-50 text-emerald-700'],
                    ['Failed', counts.failed || 0, 'bg-red-50 text-red-700'],
                    ['Skipped', counts.skipped || 0, 'bg-amber-50 text-amber-700'],
                    ['Pending', counts.pending || 0, 'bg-blue-50 text-blue-700'],
                    ['Success', `${successRate}%`, 'bg-emerald-50 text-emerald-700']
                ].map(([label, value, cls]) => (
                    <div key={label} className={`rounded-lg border border-gray-100 p-5 ${cls}`}>
                        <p className="text-xs font-black uppercase tracking-widest">{label}</p>
                        <p className="text-3xl font-black text-gray-900 mt-1">{value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex flex-wrap gap-2">
                {tabs.map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`px-4 py-3 rounded-xl text-sm font-black transition-all ${activeTab === id ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'text-gray-500 hover:bg-gray-50 border border-transparent'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Send className="text-emerald-600" />
                            <h3 className="text-xl font-black text-gray-900">Campaign status</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Current state</p>
                                <p className="text-2xl font-black text-gray-900 mt-1">{campaign.status}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Started</p>
                                <p className="font-black text-gray-900 mt-1">{campaign.started_at ? new Date(campaign.started_at).toLocaleString() : '-'}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Finished</p>
                                <p className="font-black text-gray-900 mt-1">{campaign.finished_at ? new Date(campaign.finished_at).toLocaleString() : '-'}</p>
                            </div>
                        </div>
                        {failureRows.length > 0 && (
                            <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3">
                                <AlertTriangle className="text-red-600 shrink-0" />
                                <p className="text-sm font-bold text-red-700">{failureRows.length} recipients failed. Open Failures to review reasons, then retry failed only.</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Users className="text-blue-600" />
                            <h3 className="text-xl font-black text-gray-900">Audience</h3>
                        </div>
                        <div className="space-y-3 text-sm font-medium text-gray-600">
                            <p><span className="font-black text-gray-900">Mode:</span> {campaign.audience_type || 'saved audience'}</p>
                            <p><span className="font-black text-gray-900">Recipients:</span> {recipients.length}</p>
                            {campaign.scheduled_at && <p><span className="font-black text-gray-900">Scheduled:</span> {new Date(campaign.scheduled_at).toLocaleString()}</p>}
                            <p><span className="font-black text-gray-900">Batch limit:</span> {campaign.batch_limit || 50}</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'message' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <FileText className="text-emerald-600" />
                        <h3 className="text-xl font-black text-gray-900">Message preview</h3>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-5 whitespace-pre-wrap text-gray-800 font-medium">
                        {message}
                    </div>
                    {mediaUrl && (
                        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-blue-700">{mediaSource}</p>
                            <p className="font-bold text-gray-900 mt-1">{mediaUrl.split('/').pop()}</p>
                            {/\.(png|jpg|jpeg|gif|webp)$/i.test(mediaUrl) && (
                                <img src={`${apiOrigin}/${mediaUrl}`} alt="" className="mt-3 max-h-56 rounded-lg border border-blue-100 object-contain bg-white" />
                            )}
                        </div>
                    )}
                    {buttons.length > 0 && (
                        <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-100 flex gap-3">
                            <AlertTriangle className="text-amber-600 shrink-0" />
                            <p className="text-sm font-bold text-amber-800">Native WhatsApp buttons will be attempted. If WhatsApp Web rejects them, failures are recorded with a button support reason.</p>
                        </div>
                    )}
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-xl font-black text-gray-900">Message rules</h3>
                        <div className="mt-4 space-y-3 text-sm font-medium text-gray-600">
                            <p><span className="font-black text-gray-900">Template:</span> {campaign.template_name || 'One-time message'}</p>
                            <p><span className="font-black text-gray-900">Media:</span> {mediaUrl ? `${mediaSource}: ${mediaUrl.split('/').pop()}` : 'No media'}</p>
                            <p><span className="font-black text-gray-900">Buttons:</span> {buttons.length ? `${buttons.length} attempted` : 'None'}</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'recipients' && (
                <RecipientTable recipients={recipients} title="Recipient results" detail="Every recipient keeps its own status and failure reason." />
            )}

            {activeTab === 'failures' && (
                <RecipientTable recipients={failureRows} title="Failed recipients" detail="Fix the problem, then use Retry failed to send only these recipients again." empty="No failed recipients." />
            )}

            {activeTab === 'settings' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-xl font-black text-gray-900">Sending settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
                        {[
                            ['Batch limit', campaign.batch_limit || 50],
                            ['Delay', `${campaign.delay_min_seconds || 20}-${campaign.delay_max_seconds || 45}s`],
                            ['Deep pause', `Every ${campaign.deep_pause_every || 15}`],
                            ['Send window', `${(campaign.send_window_start || '10:00:00').slice(0, 5)}-${(campaign.send_window_end || '20:00:00').slice(0, 5)}`],
                        ].map(([label, value]) => (
                            <div key={label} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</p>
                                <p className="font-black text-gray-900 mt-1">{value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3">
                        <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                        <p className="text-sm font-medium text-amber-800">Use slow batches and only message contacts who expect your WhatsApp message.</p>
                    </div>
                </div>
            )}
            <Dialog />
        </div>
    );
};

const RecipientTable = ({ recipients, title, detail, empty = 'No recipients stored for this campaign.' }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between gap-4">
                    <div>
                <h3 className="text-xl font-black text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500 font-medium mt-1">{detail}</p>
                    </div>
                    <Send className="text-emerald-600" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-widest text-gray-500">
                            <tr>
                                <th className="p-4">Recipient</th>
                                <th className="p-4">Phone</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Failure</th>
                                <th className="p-4">Sent at</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recipients.map(row => (
                                <tr key={row.id}>
                                    <td className="p-4 font-black text-gray-900">{row.name || 'Unnamed'}</td>
                                    <td className="p-4 font-bold text-gray-600">+{row.phone}</td>
                                    <td className="p-4"><span className="px-3 py-1 rounded-lg bg-gray-100 text-xs font-black uppercase">{row.status}</span></td>
                                    <td className="p-4 text-sm text-gray-500">{row.failure_code || row.error_message || '-'}</td>
                                    <td className="p-4 text-sm text-gray-500">{row.sent_at ? new Date(row.sent_at).toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                {recipients.length === 0 && (
                    <tr><td colSpan="5" className="p-10 text-center font-bold text-gray-500">{empty}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
);

export default CampaignDetail;
