import React, { useState, useEffect } from 'react';
import {
    Send, History, Database, FileSpreadsheet,
    Loader2, Trash2, Edit2, RotateCcw, Upload,
    Check, Layout, FileText, User, Clock, Activity, Zap,
    Calendar, ShieldCheck, Play
} from 'lucide-react';
import api from '../utils/api';
import { useApp } from '../AppContext';
import toast from 'react-hot-toast';
import CampaignProgressBar from '../components/CampaignProgressBar';

const Campaigns = () => {
    const { whatsappStatus, socket } = useApp();
    const [campaigns, setCampaigns] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Campaign State
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTemplateName, setSelectedTemplateName] = useState('');
    const [templateButtons, setTemplateButtons] = useState([]);
    const [scheduledAt, setScheduledAt] = useState('');

    const [source, setSource] = useState('database');
    const [csvFile, setCsvFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [testing, setTesting] = useState(false);
    const [editCampaign, setEditCampaign] = useState(null);

    const [activeRunning, setActiveRunning] = useState(null);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [campRes, tempRes] = await Promise.all([
                api.get('/campaigns'),
                api.get('/templates')
            ]);

            setCampaigns(campRes.data.campaigns || []);
            setTemplates(tempRes.data.templates || []);

            const processing = (campRes.data.campaigns || []).find(c => c.status === 'processing');
            if (processing) {
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
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSelectTemplate = (template) => {
        setMessage(template.message);
        setSelectedTemplateId(template.id);
        setSelectedTemplateName(template.name);
        try {
            const btns = JSON.parse(template.buttons || '[]');
            setTemplateButtons(btns || []);
        } catch (e) {
            setTemplateButtons([]);
        }
        setShowTemplatePicker(false);
        toast.success(`Template "${template.name}" applied`);
    };

    const handleSendTest = async () => {
        const phone = window.prompt("Enter phone number for test (with country code):");
        if (!phone) return;

        setTesting(true);
        try {
            await api.post('/chats/test-template', {
                phone,
                templateId: selectedTemplateId,
                message: message // Fallback if no template selected
            });
            toast.success('Test message sent!');
        } catch (err) {
            toast.error('Test failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (whatsappStatus !== 'ready') {
            return toast.error('WhatsApp not connected');
        }

        if (source === 'csv' && !editCampaign && !csvFile) {
            return toast.error('Please select a CSV file');
        }

        if (!selectedTemplateId && !editCampaign) {
            return toast.error('Please select a template');
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('template_id', selectedTemplateId);
            if (scheduledAt) formData.append('scheduled_at', scheduledAt);

            if (editCampaign) {
                await api.put(`/campaigns/${editCampaign.id}`, { name, template_id: selectedTemplateId, scheduled_at: scheduledAt });
                toast.success('Campaign updated');
                setEditCampaign(null);
            } else {
                const { data } = await api.post('/campaigns', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (data.success) {
                    if (!scheduledAt) {
                        if (source === 'csv' && csvFile) {
                            const runData = new FormData();
                            runData.append('fromSource', 'csv');
                            runData.append('file', csvFile);
                            await api.post(`/campaigns/${data.campaignId}/run`, runData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                        } else {
                            await api.post(`/campaigns/${data.campaignId}/run`, { fromSource: 'database' });
                        }
                        toast.success('Campaign launched!');
                    } else {
                        toast.success('Campaign scheduled for ' + new Date(scheduledAt).toLocaleString());
                    }
                }
            }
            resetForm();
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setName(''); setMessage(''); setCsvFile(null); setSelectedTemplateId('');
        setSelectedTemplateName(''); setTemplateButtons([]); setScheduledAt('');
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

    const sanitizeHTML = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    const previewMessage = sanitizeHTML(message)
        .replace(/\{\{name\}\}/gi, '<span class="text-blue-500 font-bold">John Doe</span>')
        .replace(/\{([^{}]+)\}/g, (match, options) => '<span class="text-purple-500 font-bold">[' + options.split('|')[0] + ']</span>')
        .replace(/\n/g, '<br/>');

    const estTime = Math.ceil(message.length * 0.05 + 25);
    const totalSent = campaigns.reduce((acc, curr) => acc + (curr.sent_count || 0), 0);
    const totalFailed = campaigns.reduce((acc, curr) => acc + (curr.fail_count || 0), 0);
    const successRate = totalSent + totalFailed === 0 ? 0 : Math.round((totalSent / (totalSent + totalFailed)) * 100);

    return (
        <div className="space-y-8 pb-20 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Campaign <span className="text-blue-600">Architect</span></h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Professional Broadcast & Automation Suite</p>
                </div>

                <div className="flex bg-white/60 backdrop-blur-xl border border-gray-100 rounded-3xl p-2 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-purple-50/50 -z-10"></div>
                    {activeRunning ? (
                        <div className="flex items-center gap-3 px-6 py-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 animate-pulse">
                            <Activity size={18} />
                            <span className="text-sm font-black uppercase tracking-widest">Active Broadcast</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                            <ShieldCheck size={18} />
                            <span className="text-sm font-black uppercase tracking-widest">Ban-Guard Active</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                <div className="xl:col-span-8 space-y-8">
                    {/* BUILDER CARD */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                            <h3 className="font-black text-xl text-gray-800 flex items-center gap-3">
                                <Zap className="text-blue-500" /> New Campaign
                            </h3>
                            <button
                                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                                className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <FileText size={16} /> {showTemplatePicker ? 'Close Library' : 'Browse Templates'}
                            </button>
                        </div>

                        {showTemplatePicker && (
                            <div className="p-6 bg-gray-50/50 border-b border-gray-100 animate-fade-in">
                                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                    {templates.map(t => (
                                        <button
                                            key={t.id} onClick={() => handleSelectTemplate(t)}
                                            className="min-w-[260px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-lg transition-all text-left group"
                                        >
                                            <p className="font-black text-gray-800 mb-1 group-hover:text-blue-600 truncate">{t.name}</p>
                                            <p className="text-xs text-gray-500 line-clamp-2">{t.message}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Campaign Identity</label>
                                        <input
                                            type="text" required value={name} onChange={e => setName(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold"
                                            placeholder="Internal Reference Name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Scheduling (Optional)</label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500" size={20} />
                                            <input
                                                type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl pl-12 pr-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Audience Configuration</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button" onClick={() => setSource('database')}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${source === 'database' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}
                                        >
                                            <Database size={24} /> <span className="font-bold text-sm">CRM Data</span>
                                        </button>
                                        <button
                                            type="button" onClick={() => setSource('csv')}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${source === 'csv' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}
                                        >
                                            <FileSpreadsheet size={24} /> <span className="font-bold text-sm">CSV Import</span>
                                        </button>
                                    </div>

                                    {source === 'csv' && (
                                        <div className="mt-4 p-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 flex items-center gap-4">
                                            <Upload className="text-gray-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{csvFile ? csvFile.name : 'Select Contact List'}</p>
                                                <p className="text-[10px] text-gray-400 uppercase font-black">Columns: name, phone</p>
                                            </div>
                                            <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} className="hidden" id="csv-upload" />
                                            <label htmlFor="csv-upload" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black cursor-pointer hover:bg-gray-50 transition-colors">Choose</label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit" disabled={submitting || !name || !selectedTemplateId}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-5 rounded-2xl text-lg font-black shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="animate-spin" /> : <><Play size={20} /> {scheduledAt ? 'Schedule Sequence' : 'Launch Immediate'}</>}
                                </button>
                                <button
                                    type="button" onClick={handleSendTest} disabled={testing || !selectedTemplateId}
                                    className="px-8 bg-white border-2 border-gray-200 text-gray-600 hover:border-blue-500 hover:text-blue-600 rounded-2xl font-black transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {testing ? <Loader2 className="animate-spin" /> : 'Send Test'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* HISTORY TABLE */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-gray-100">
                            <h3 className="font-black text-xl text-gray-800 flex items-center gap-3">
                                <History className="text-indigo-500" /> Broadcast Logs
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                                        <th className="px-8 py-4">Campaign</th>
                                        <th className="px-8 py-4">Status</th>
                                        <th className="px-8 py-4">Metrics</th>
                                        <th className="px-8 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.map(c => (
                                        <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <p className="font-black text-gray-900">{c.name}</p>
                                                <p className="text-xs text-gray-400 mt-1 font-bold">{new Date(c.created_at).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                                    c.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    c.status === 'processing' ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' :
                                                    'bg-gray-50 text-gray-500 border-gray-100'
                                                }`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 font-black text-sm">
                                                <span className="text-emerald-500">{c.sent_count}</span>
                                                <span className="mx-2 text-gray-200">/</span>
                                                <span className="text-red-400">{c.fail_count}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* PREVIEW COLUMN */}
                <div className="xl:col-span-4 space-y-8 sticky top-8">
                    {activeRunning && (
                        <div className="bg-white p-6 rounded-[2.5rem] border border-blue-100 shadow-xl shadow-blue-100/20">
                            <CampaignProgressBar campaign={activeRunning} socket={socket} onFinished={fetchData} />
                        </div>
                    )}

                    <div className="bg-[#e5ddd5] rounded-[3rem] shadow-2xl overflow-hidden min-h-[600px] flex flex-col border-[12px] border-white relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-white rounded-b-2xl z-20"></div>

                        <div className="bg-[#075e54] pt-12 pb-4 px-6 text-white flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                                <User size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg leading-tight">Brand Outreach</h4>
                                <p className="text-[10px] uppercase font-black tracking-widest text-emerald-200 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div> Live Preview
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 p-6 relative flex flex-col justify-end">
                            <div className="relative w-full max-w-[90%] self-end">
                                <div className="bg-white rounded-3xl rounded-tr-sm p-4 shadow-sm border border-gray-100 relative">
                                    <div
                                        className="text-[14px] leading-relaxed text-gray-800 font-medium"
                                        dangerouslySetInnerHTML={{ __html: previewMessage || '<span class="text-gray-300 italic">Select a template to preview...</span>' }}
                                    />
                                    <div className="flex justify-end items-center gap-1 mt-2">
                                        <span className="text-[10px] text-gray-400 font-bold">12:45 PM</span>
                                        <div className="flex">
                                            <Check size={14} className="text-blue-500 -mr-1.5" />
                                            <Check size={14} className="text-blue-500" />
                                        </div>
                                    </div>
                                    <div className="absolute top-0 -right-2 w-4 h-4 bg-white transform -skew-x-[30deg]"></div>
                                </div>

                                {templateButtons.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {templateButtons.map((btn, i) => (
                                            <div key={i} className="bg-white py-2.5 rounded-xl text-center text-[#00a884] font-black text-xs uppercase tracking-widest border border-gray-100 shadow-sm">
                                                {btn.text}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Clock size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Time</p>
                                <p className="font-black text-gray-800">~{estTime}s / contact</p>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-2xl text-[11px] font-bold text-blue-700 leading-relaxed">
                            Pro-tip: Scheduling messages for off-peak hours can significantly improve open rates and reduce ban risk.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Campaigns;
