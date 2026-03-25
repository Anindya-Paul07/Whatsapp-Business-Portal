import React, { useState, useEffect } from 'react';
import {
    Send, History, Database, FileSpreadsheet,
    Loader2, Trash2, Edit2, RotateCcw, Upload,
    Image as ImageIcon, Paperclip, Check, Layout,
    FileText, User, Clock, Activity, Users, Zap, TrendingUp
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
    const [message, setMessage] = useState(''); // Keep for preview
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTemplateName, setSelectedTemplateName] = useState('');
    const [templateButtons, setTemplateButtons] = useState([]);

    const [source, setSource] = useState('database'); // 'database' | 'csv'
    const [csvFile, setCsvFile] = useState(null);
    const [mediaFile, setMediaFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [editCampaign, setEditCampaign] = useState(null);

    // Active Running Campaign
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
            if (editCampaign) {
                await api.put(`/campaigns/${editCampaign.id}`, { name, template_id: selectedTemplateId });
                toast.success('Campaign updated');
                setEditCampaign(null);
            } else {
                const formData = new FormData();
                formData.append('name', name);
                formData.append('template_id', selectedTemplateId);

                const { data } = await api.post('/campaigns', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (data.success) {
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
                }
            }
            setName(''); setMessage(''); setCsvFile(null); setSelectedTemplateId(''); setSelectedTemplateName(''); setTemplateButtons([]);
            fetchData();
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

    const handleCancelEdit = () => {
        setEditCampaign(null);
        setName('');
        setMessage('');
    };

    const handleOpenEdit = (c) => {
        setEditCampaign(c);
        setName(c.name);
        setMessage(c.message);
    };

    const previewMessage = message
        .replace(/\{\{name\}\}/gi, '<span class="text-blue-500 font-bold">John Doe</span>')
        .replace(/\n/g, '<br/>');

    const estTime = Math.ceil(message.length * 0.05 + 25);

    // Calculate Stats
    const totalSent = campaigns.reduce((acc, curr) => acc + (curr.sent_count || 0), 0);
    const totalFailed = campaigns.reduce((acc, curr) => acc + (curr.fail_count || 0), 0);
    const successRate = totalSent + totalFailed === 0 ? 0 : Math.round((totalSent / (totalSent + totalFailed)) * 100);

    return (
        <div className="space-y-8 pb-20 max-w-[1600px] mx-auto">
            {/* Header & Stats Dashboard */}
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">WA Auto<span className="text-blue-600">Pro</span></h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Marketing Automation Dashboard</p>
                </div>

                <div className="flex bg-white/60 backdrop-blur-xl border border-gray-100 rounded-3xl p-2 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-purple-50/50 -z-10"></div>
                    {activeRunning ? (
                        <div className="flex items-center gap-3 px-6 py-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 animate-pulse">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                            <span className="text-sm font-black uppercase tracking-widest">Active Broadcast</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                            <Check size={18} />
                            <span className="text-sm font-black uppercase tracking-widest">System Ready</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Delivered', value: totalSent.toLocaleString(), icon: <Send size={20} />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
                    { label: 'Delivery Rate', value: `${successRate}%`, icon: <Activity size={20} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                    { label: 'Active Campaigns', value: campaigns.filter(c => c.status === 'processing').length, icon: <Zap size={20} />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
                    { label: 'Total Campaigns', value: campaigns.length, icon: <Layout size={20} />, color: 'bg-purple-50 text-purple-600 border-purple-100' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border mb-4 ${stat.color} group-hover:scale-110 transition-transform`}>
                            {stat.icon}
                        </div>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                        <h3 className="text-3xl font-black text-gray-800">{stat.value}</h3>
                        <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:scale-150 transition-transform duration-500 pointer-events-none">
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* BUILDER COLUMN */}
                <div className="xl:col-span-8 space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="font-black text-xl text-gray-800 flex items-center gap-3">
                                    <Layout className="text-blue-500" />
                                    Campaign Architect
                                </h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Design and deploy powerful messaging sequences.</p>
                            </div>
                            <button
                                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                                className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <FileText size={16} /> {showTemplatePicker ? 'Hide Library' : 'Template Library'}
                            </button>
                        </div>

                        {showTemplatePicker && (
                            <div className="p-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
                                <p className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4 ml-2">Available Templates</p>
                                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-2">
                                    {templates.length === 0 ? (
                                        <div className="w-full text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                            <p className="text-gray-400 font-medium">No templates found. Head to the Templates tab to create them.</p>
                                        </div>
                                    ) : templates.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleSelectTemplate(t)}
                                            className="min-w-[240px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all text-left group"
                                        >
                                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded mb-3 inline-block">{t.category}</span>
                                            <p className="font-black text-gray-800 mb-2 truncate group-hover:text-blue-600 transition-colors text-lg">{t.name}</p>
                                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{t.message}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Campaign Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-medium text-lg placeholder-gray-400"
                                            placeholder="e.g. Summer Mega Sale 2026"
                                            required
                                            value={name} onChange={e => setName(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Target Audience</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button" onClick={() => setSource('database')}
                                                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all font-bold ${source === 'database' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                <Database size={18} /> CRM Database
                                            </button>
                                            <button
                                                type="button" onClick={() => setSource('csv')}
                                                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all font-bold ${source === 'csv' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                <FileSpreadsheet size={18} /> CSV Upload
                                            </button>
                                        </div>
                                        {source === 'csv' && (
                                            <div className="mt-4 p-6 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-3 relative group overflow-hidden">
                                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                    <Upload size={20} className="text-blue-500" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-gray-800">{csvFile ? csvFile.name : 'Click or drag CSV here'}</p>
                                                    <p className="text-xs text-gray-500 font-medium mt-1">Columns needed: name, phone</p>
                                                </div>
                                                <input
                                                    type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    onChange={e => setCsvFile(e.target.files[0])}
                                                />
                                            </div>
                                        )}
                                    </div>

                                </div>

                                <div className="space-y-4 flex flex-col h-full bg-gray-50 p-8 rounded-3xl border border-gray-100 flex items-center justify-center text-center">
                                    {selectedTemplateId ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                                                <Check size={32} />
                                            </div>
                                            <h3 className="text-xl font-black text-gray-800 mb-2">Template Locked In</h3>
                                            <p className="text-gray-500 font-bold">{selectedTemplateName}</p>
                                            <button type="button" onClick={() => setShowTemplatePicker(true)} className="mt-8 px-6 py-2 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-blue-500 hover:text-blue-500 transition-colors">
                                                Change Template
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 animate-bounce">
                                                <FileText size={32} />
                                            </div>
                                            <h3 className="text-xl font-black text-gray-800 mb-2">No Template Selected</h3>
                                            <p className="text-gray-500 font-medium max-w-[200px] mb-8">You must select a message template from the library.</p>
                                            <button type="button" onClick={() => setShowTemplatePicker(true)} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 font-black rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2">
                                                <Layout size={20} /> Browse Library
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-10 pt-8 border-t border-gray-100 flex gap-4">
                                <button
                                    type="submit"
                                    disabled={submitting || whatsappStatus !== 'ready' || !name || !selectedTemplateId}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-5 rounded-2xl text-lg font-black shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 group"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={24} /> : (
                                        <>
                                            <Send size={24} className="group-hover:translate-x-1 transition-transform" />
                                            <span>{editCampaign ? 'Update & Relaunch Sequence' : 'Deploy Campaign Sequence'}</span>
                                        </>
                                    )}
                                </button>
                                {editCampaign && (
                                    <button
                                        type="button" onClick={handleCancelEdit}
                                        className="px-8 bg-white border-2 border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500 font-black rounded-2xl transition-all flex items-center gap-2"
                                    >
                                        <RotateCcw size={20} /> Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* HISTORY SECTION */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
                        <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-black text-xl text-gray-800 flex items-center gap-3">
                                <History className="text-indigo-500" />
                                Broadcast History
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
                                        <th className="px-8 py-5">Campaign Info</th>
                                        <th className="px-6 py-5">Status</th>
                                        <th className="px-6 py-5">Performance</th>
                                        <th className="px-6 py-5">Date</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="5" className="py-24 text-center"><Loader2 className="animate-spin inline-block text-blue-500" size={32} /></td></tr>
                                    ) : campaigns.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-24 text-center">
                                                <div className="inline-block bg-gray-50 p-6 rounded-3xl">
                                                    <Layout size={40} className="text-gray-300 mx-auto mb-3" />
                                                    <p className="text-gray-500 font-bold text-lg">No active campaigns</p>
                                                    <p className="text-gray-400 text-sm">Deploy your first sequence above</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : campaigns.map(c => (
                                        <tr key={c.id} className="hover:bg-blue-50/30 border-b border-gray-50 last:border-0 transition-colors group">
                                            <td className="px-8 py-6">
                                                <p className="font-black text-gray-900 text-base mb-1 group-hover:text-blue-600 transition-colors">{c.name}</p>
                                                <p className="text-sm font-medium text-gray-500 truncate max-w-[250px]">{c.message}</p>
                                            </td>
                                            <td className="px-6 py-6">
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest ${c.status === 'completed' ? 'bg-emerald-100/50 text-emerald-700 border border-emerald-200' :
                                                    c.status === 'processing' ? 'bg-amber-100/50 text-amber-700 border border-amber-200 animate-pulse' :
                                                        'bg-gray-100 text-gray-600 border border-gray-200'
                                                    }`}>
                                                    {c.status === 'processing' && <div className="w-1.5 h-1.5 bg-amber-600 rounded-full mr-2"></div>}
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-6">
                                                    <div>
                                                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Delivered</p>
                                                        <p className="font-black text-gray-900">{c.sent_count}</p>
                                                    </div>
                                                    <div className="w-px h-8 bg-gray-200"></div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-red-500 uppercase mb-1">Failed</p>
                                                        <p className="font-black text-gray-900">{c.fail_count}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-sm font-bold text-gray-500">
                                                {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleOpenEdit(c)} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:shadow-md transition-all">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(c.id)} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-red-500 hover:text-red-600 hover:shadow-md transition-all">
                                                        <Trash2 size={18} />
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

                {/* PREVIEW COLUMN */}
                <div className="xl:col-span-4 space-y-8 lg:sticky lg:top-8">
                    {activeRunning && (
                        <div className="bg-white p-6 rounded-[2.5rem] border border-red-100 shadow-xl shadow-red-100/50">
                            <CampaignProgressBar
                                campaign={activeRunning}
                                socket={socket}
                                onFinished={() => {
                                    setActiveRunning(null);
                                    fetchData();
                                }}
                            />
                        </div>
                    )}

                    <div className="bg-[#e5ddd5] rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[700px] flex flex-col border-[8px] border-white relative ring-1 ring-gray-100">
                        {/* Device Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-white rounded-b-xl z-20"></div>

                        <div className="bg-[#075e54] pt-12 pb-4 px-6 text-white flex items-center gap-4 relative z-10 shadow-md">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20">
                                <User size={24} className="text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg leading-tight tracking-wide">Brand Outreach</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                                    <p className="text-xs uppercase font-medium tracking-widest text-emerald-100">Live Preview</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-6 relative flex flex-col justify-end">
                            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://previews.123rf.com/images/vectorpocket/vectorpocket1808/vectorpocket180800539/106965643-whatsapp-pattern-editorial-vector-illustration.jpg')] bg-repeat mix-blend-multiply filter blur-[1px]"></div>

                            <div className="relative w-full max-w-[90%] self-end animate-fade-in-up transition-all duration-500">
                                <div className="bg-white rounded-3xl rounded-tr-md p-4 shadow-sm border border-gray-100 relative">
                                    {mediaFile && (
                                        <div className="mb-4 rounded-xl overflow-hidden bg-gray-100 aspect-video flex items-center justify-center border border-gray-200 shadow-inner group relative">
                                            {mediaFile.type.startsWith('image/') ? (
                                                <img
                                                    src={URL.createObjectURL(mediaFile)}
                                                    alt="preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-3 p-6 text-center">
                                                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                                                        <FileText size={32} className="text-blue-500" />
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-700 truncate w-full px-4">{mediaFile.name}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-gray-800 text-[15px] font-medium leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: previewMessage || '<span class="text-gray-400 italic">Your message will appear here...</span>' }}
                                    ></p>

                                    {templateButtons && templateButtons.length > 0 && (
                                        <div className="mt-4 flex flex-col gap-2">
                                            {templateButtons.map((btn, idx) => (
                                                <div key={idx} className="w-full text-center text-[#00a884] bg-white border border-[#00a884] py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                                                    {btn.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-end items-center gap-1.5 mt-3 pr-1">
                                        <span className="text-[10px] text-gray-400 font-bold">12:45 PM</span>
                                        <div className="flex">
                                            <Check size={14} className="text-blue-500 -mr-1.5" />
                                            <Check size={14} className="text-blue-500" />
                                        </div>
                                    </div>
                                    {/* Tail */}
                                    <div className="absolute top-0 -right-2 w-4 h-4 bg-white transform -skew-x-[30deg] -translate-y-px"></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 relative z-10 border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-3xl border border-orange-100/50 flex items-center gap-5">
                                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-500">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">Time to Deliver</p>
                                    <p className="text-xl font-black text-orange-600">~{message.length > 0 ? estTime : 0}s <span className="text-sm font-bold text-orange-400">/ contact</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Campaigns;

