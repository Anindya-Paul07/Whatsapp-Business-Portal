import React, { useState, useEffect } from 'react';
import {
    Bot, Search, Plus, Trash2, MessageCircle,
    Code, Tag, Loader2, ToggleLeft, ToggleRight, X, AlertCircle, Zap
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const MessageBot = () => {
    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [name, setName] = useState(''); // Visual only
    const [keyword, setKeyword] = useState('');
    const [replyText, setReplyText] = useState('');
    const [replyType, setReplyType] = useState('contains'); // 'exact' | 'contains'
    const [submitting, setSubmitting] = useState(false);

    const fetchBots = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/message-bots');
            setBots(data.bots || []);
        } catch (err) {
            toast.error('Failed to load bots');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBots();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/message-bots', {
                keyword,
                reply_text: replyText,
                reply_type: replyType
            });
            toast.success('Auto-reply bot activated');
            setShowModal(false);
            setKeyword(''); setReplyText('');
            fetchBots();
        } catch (err) {
            toast.error('Failed to activate bot');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleBot = async (bot) => {
        try {
            await api.put(`/message-bots/${bot.id}`, {
                ...bot,
                is_active: !bot.is_active,
                reply_text: bot.reply_text // backend expectation
            });
            fetchBots();
        } catch (err) {
            toast.error('Failed to update bot');
        }
    };

    const deleteBot = async (id) => {
        if (!window.confirm('Delete this message bot?')) return;
        try {
            await api.delete(`/message-bots/${id}`);
            setBots(bots.filter(b => b.id !== id));
            toast.success('Bot removed');
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Auto <span className="text-emerald-500">Bots</span></h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Configure keyword logic and 24/7 intelligent responses</p>
                </div>

                <button onClick={() => setShowModal(true)} className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black rounded-2xl hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2 transform hover:-translate-y-1">
                    <Plus size={20} />
                    <span>Create Auto-Responder</span>
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-24 text-center">
                        <Loader2 className="animate-spin inline-block text-emerald-500" size={48} />
                    </div>
                ) : bots.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-16 text-center shadow-sm">
                        <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Bot size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">No active message bots</h3>
                        <p className="text-gray-500 font-medium max-w-md mx-auto mb-8">Deploy your first automated responder to capture leads and answer inquiries while you sleep.</p>
                        <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl shadow-gray-900/20 hover:bg-gray-800 transition-colors inline-flex items-center gap-2">
                            <Plus size={20} /> Initialize Autopilot
                        </button>
                    </div>
                ) : bots.map(bot => (
                    <div key={bot.id} className={`bg-white rounded-[2rem] border ${bot.is_active ? 'border-emerald-100 shadow-xl shadow-emerald-100/50' : 'border-gray-200 shadow-sm opacity-80'} hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative overflow-hidden group`}>
                        {bot.is_active && <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"></div>}

                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-6 w-full">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${bot.is_active ? 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <Bot size={28} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleBot(bot)}
                                        className={`transition-all hover:scale-105 ${bot.is_active ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-400'}`}
                                    >
                                        {bot.is_active ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                                    </button>
                                    <button onClick={() => deleteBot(bot.id)} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm flex-shrink-0">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border ${bot.reply_type === 'exact' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                    <Code size={12} /> {bot.reply_type} Match
                                </span>
                                {bot.is_active && (
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                )}
                            </div>

                            <h4 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-gray-400 font-bold text-lg">"</span>{bot.keyword}<span className="text-gray-400 font-bold text-lg">"</span>
                            </h4>

                            <div className={`p-4 rounded-xl border flex-1 relative overflow-hidden transition-colors ${bot.is_active ? 'bg-emerald-50/30 border-emerald-50' : 'bg-gray-50 border-gray-100'}`}>
                                <Zap size={100} className="absolute right-0 bottom-0 text-gray-900 opacity-[0.02] transform translate-x-4 translate-y-4" />
                                <div className="relative z-10 text-sm font-medium text-gray-600 line-clamp-4 italic leading-relaxed">
                                    "{bot.reply_text}"
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-[11px] font-black tracking-widest uppercase text-gray-400">
                                <MessageCircle size={14} /> Pipeline
                            </div>
                            <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-500 uppercase">SYS_BOT_{bot.id}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden transform transition-all relative">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 text-white relative">
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute right-6 top-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all border border-white/20"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                                    <Bot size={32} className="text-emerald-100" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black tracking-tight drop-shadow-sm">Deploy Auto-Bot</h3>
                                    <p className="text-emerald-100 font-medium mt-1">Setup listening logic and exact response</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-3 flex-col sm:flex-row items-start sm:items-center">
                                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                                    <Search size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-emerald-900">Listener Configuration</p>
                                    <p className="text-xs text-emerald-700 font-medium">This determines exactly what incoming message triggers the bot.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Trigger Keyword</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl pl-12 pr-5 py-4 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-bold text-lg placeholder-gray-400"
                                            placeholder="e.g. Price" required
                                            value={keyword} onChange={e => setKeyword(e.target.value)}
                                        />
                                        <Tag size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Match Logic</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all font-bold text-sm cursor-pointer appearance-none"
                                        value={replyType} onChange={e => setReplyType(e.target.value)}
                                    >
                                        <option value="contains">Contains Word (Loose Match)</option>
                                        <option value="exact">Exact Phrase (Strict Mode)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Automated Response Payload</label>
                                <div className="bg-gray-50 rounded-[2rem] border-2 border-gray-100 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all p-1">
                                    <textarea
                                        className="w-full min-h-[140px] bg-transparent border-none focus:ring-0 text-gray-700 font-medium resize-none p-5 leading-relaxed placeholder-gray-400"
                                        placeholder="Hello there! Our pricing currently starts at..."
                                        required
                                        value={replyText} onChange={e => setReplyText(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-4 bg-white border-2 border-gray-200 text-gray-600 font-black rounded-2xl hover:bg-gray-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="flex-[2] px-6 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 shadow-xl shadow-gray-900/20 transition-all transform hover:-translate-y-1 disabled:opacity-50 flex items-center justify-center gap-3">
                                    {submitting ? <><Loader2 className="animate-spin" size={24} /> Linking System...</> : <><Bot size={24} /> Initialize Auto-Responder</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageBot;
