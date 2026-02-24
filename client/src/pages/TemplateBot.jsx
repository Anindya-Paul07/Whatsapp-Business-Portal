import React, { useState, useEffect } from 'react';
import {
    Bot,
    Search,
    Plus,
    Trash2,
    MessageCircle,
    Code,
    Tag,
    Loader2,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const TemplateBot = () => {
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
            const { data } = await api.get('/bots');
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
            await api.post('/bots', {
                keyword,
                reply_text: replyText,
                reply_type: replyType
            });
            toast.success('Auto-reply bot created');
            setShowModal(false);
            setKeyword(''); setReplyText('');
            fetchBots();
        } catch (err) {
            toast.error('Failed to create bot');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleBot = async (bot) => {
        try {
            await api.put(`/bots/${bot.id}`, {
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
        if (!window.confirm('Delete this bot?')) return;
        try {
            await api.delete(`/bots/${id}`);
            setBots(bots.filter(b => b.id !== id));
            toast.success('Bot removed');
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Auto-Response Bots</h2>
                    <p className="text-[#667781]">Keyword-based automatic replies for constant support</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary">
                    <Plus size={18} />
                    <span>New Auto-Reply</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin inline text-[#00a884]" size={40} /></div>
                ) : bots.length === 0 ? (
                    <div className="card col-span-full py-20 text-center flex flex-col items-center gap-4 border-dashed bg-transparent">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-gray-300">
                            <Bot size={32} />
                        </div>
                        <p className="text-[#667781] font-medium">No active bots. Create one to automate your store.</p>
                    </div>
                ) : bots.map(bot => (
                    <div key={bot.id} className="card flex flex-col h-full hover:shadow-lg transition-all relative overflow-hidden group">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-gray-50 rounded-xl text-[#00a884]">
                                <Bot size={24} />
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleBot(bot)}
                                    className={`transition-colors ${bot.is_active ? 'text-[#00a884]' : 'text-gray-300'}`}
                                >
                                    {bot.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                </button>
                                <button onClick={() => deleteBot(bot.id)} className="p-2 text-gray-300 hover:text-red-500 transition-opacity">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="badge badge-green uppercase text-[9px] font-black tracking-widest">
                                    {bot.reply_type} Match
                                </div>
                            </div>
                            <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                                <Tag size={14} className="text-gray-400" />
                                <span>"{bot.keyword}"</span>
                            </h4>
                            <div className="bg-[#f8faf9] p-4 rounded-xl text-sm border border-[#e9edef] text-[#667781] italic line-clamp-4 min-h-[100px]">
                                "{bot.reply_text}"
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 pt-4 border-t border-[#e9edef] flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
                            <div className="flex items-center gap-1.5">
                                <MessageCircle size={12} />
                                <span>Auto-Reply Active</span>
                            </div>
                            <span>ID: #{bot.id}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="card w-full max-w-lg p-0 animate-fade-in overflow-hidden shadow-2xl">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-[#00a884]">
                                <Bot size={18} />
                                <span>Configure Auto-Reply Bot</span>
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="label">Trigger Keyword</label>
                                    <div className="relative">
                                        <input
                                            type="text" className="input pr-10" placeholder="e.g. Price" required
                                            value={keyword} onChange={e => setKeyword(e.target.value)}
                                        />
                                        <Tag size={16} className="absolute right-3 top-2.5 text-gray-300" />
                                    </div>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="label">Match Strategy</label>
                                    <select
                                        className="input appearance-none bg-gray-50 font-bold"
                                        value={replyType} onChange={e => setReplyType(e.target.value)}
                                    >
                                        <option value="contains">Contains Word</option>
                                        <option value="exact">Exact Match</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="label">Reply Automata Message</label>
                                <textarea
                                    className="input min-h-[120px] resize-none"
                                    placeholder="Hey there! Our current pricing starts from $10/mo..."
                                    required
                                    value={replyText} onChange={e => setReplyText(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 border">Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <span>Activate Bot</span>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const X = ({ size, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export default TemplateBot;
