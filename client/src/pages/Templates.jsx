import React, { useState, useEffect } from 'react';
import {
    FileText, Plus, Trash2, Search, Loader2, ImageIcon,
    Tag, X, Layout, MessageSquare, Upload, Send, Zap, BookOpen
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Templates = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [category, setCategory] = useState('marketing');
    const [mediaFile, setMediaFile] = useState(null);
    const [buttons, setButtons] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/templates');
            setTemplates(data.templates || []);
        } catch (err) {
            toast.error('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData();
        formData.append('name', name);
        formData.append('message', message);
        formData.append('category', category);
        formData.append('buttons', JSON.stringify(buttons));
        if (mediaFile) formData.append('media', mediaFile);

        try {
            await api.post('/templates', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Template saved successfully');
            setShowModal(false);
            setName(''); setMessage(''); setMediaFile(null); setButtons([]);
            fetchTemplates();
        } catch (err) {
            toast.error('Failed to save template');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteTemplate = async (id) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await api.delete(`/templates/${id}`);
            setTemplates(templates.filter(t => t.id !== id));
            toast.success('Template removed');
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.message.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Template <span className="text-blue-600">Vault</span></h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Design and manage your reusable message sequences</p>
                </div>

                <div className="flex gap-4 w-full xl:w-auto">
                    <div className="relative flex-1 xl:w-80">
                        <input
                            type="text"
                            placeholder="Find templates..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium placeholder-gray-400 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    <button onClick={() => setShowModal(true)} className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 transform hover:-translate-y-1 whitespace-nowrap">
                        <Plus size={20} />
                        <span>Create New</span>
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                {loading ? (
                    <div className="col-span-full py-24 text-center">
                        <Loader2 className="animate-spin inline-block text-blue-500" size={48} />
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-16 text-center shadow-sm">
                        <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <BookOpen size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Your Vault is Empty</h3>
                        <p className="text-gray-500 font-medium max-w-md mx-auto mb-8">Create highly converting WhatsApp templates to use across bulk campaigns and auto-replies.</p>
                        <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl shadow-gray-900/20 hover:bg-gray-800 transition-colors inline-flex items-center gap-2">
                            <Plus size={20} /> Create First Template
                        </button>
                    </div>
                ) : filteredTemplates.map(template => (
                    <div key={template.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col h-full relative overflow-hidden group">
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${template.category === 'marketing' ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`}></div>

                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-6">
                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${template.category === 'marketing' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                    {template.category === 'marketing' ? <Tag size={12} /> : <Layout size={12} />}
                                    {template.category}
                                </span>
                                <button onClick={() => deleteTemplate(template.id)} className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 shadow-sm">
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <h4 className="text-xl font-black text-gray-900 mb-4 line-clamp-1">{template.name}</h4>

                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex-1 relative overflow-hidden group-hover:bg-blue-50/30 transition-colors">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <FileText size={100} />
                                </div>
                                <div className="relative z-10 flex flex-col h-full">
                                    {template.media_url && (
                                        <div className="flex items-center gap-2 mb-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm w-max">
                                            <ImageIcon size={14} className="text-blue-500" />
                                            <span className="text-xs font-bold text-gray-600">Media Attached</span>
                                        </div>
                                    )}
                                    <div className="text-sm font-medium text-gray-600 line-clamp-6 leading-relaxed flex-1">
                                        {template.message}
                                    </div>
                                    {template.buttons && template.buttons.length > 0 && (
                                        <div className="mt-4 flex flex-col gap-2">
                                            {template.buttons.map((btn, idx) => (
                                                <div key={idx} className="w-full text-center text-blue-600 bg-blue-50/50 py-2 rounded-xl text-sm font-bold border border-blue-100 shadow-sm">
                                                    {btn.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center group-hover:bg-white transition-colors">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
                                <MessageSquare size={14} /> Blueprint
                            </div>
                            <button className="flex items-center gap-1.5 text-blue-600 font-black text-[11px] uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                Ready <Send size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Template Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden transform transition-all relative flex flex-col max-h-[90vh]">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 sm:p-10 text-white relative flex-shrink-0">
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute right-6 top-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all border border-white/20"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                                    <Zap size={32} className="text-blue-100" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black tracking-tight drop-shadow-sm">Template Architect</h3>
                                    <p className="text-blue-100 font-medium text-lg mt-1">Design formatting for broadcasts & bots</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-8 sm:p-10 p-0">
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Blueprint Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-bold text-lg placeholder-gray-400"
                                            placeholder="e.g. Black Friday Promo" required
                                            value={name} onChange={e => setName(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Category</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setCategory('marketing')}
                                                className={`py-4 rounded-2xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all border-2 ${category === 'marketing'
                                                    ? 'bg-orange-50 border-orange-400 text-orange-600 shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-500'
                                                    }`}
                                            >
                                                <Tag size={18} /> Marketing
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCategory('utility')}
                                                className={`py-4 rounded-2xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all border-2 ${category === 'utility'
                                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-600 shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-500'
                                                    }`}
                                            >
                                                <Layout size={18} /> Utility
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Creative Asset (Optional)</label>
                                        <div className={`border-2 border-dashed rounded-[2rem] p-8 transition-all relative overflow-hidden text-center cursor-pointer ${mediaFile ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                onChange={(e) => setMediaFile(e.target.files[0])}
                                            />
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                {mediaFile ? (
                                                    <div className="animate-fade-in-up">
                                                        <div className="w-16 h-16 bg-white rounded-2xl text-blue-500 flex items-center justify-center shadow-md mx-auto mb-3">
                                                            <ImageIcon size={32} />
                                                        </div>
                                                        <p className="text-sm font-bold text-blue-700 truncate max-w-[200px]">{mediaFile.name}</p>
                                                        <span className="text-[10px] text-gray-400 font-black uppercase mt-1">Ready for upload</span>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="w-16 h-16 bg-white rounded-2xl text-gray-300 flex items-center justify-center shadow-sm border border-gray-100 mx-auto mb-3 transition-colors group-hover:text-blue-500">
                                                            <Upload size={28} />
                                                        </div>
                                                        <span className="block text-sm font-black text-gray-700 mb-1">Upload Media</span>
                                                        <span className="block text-xs font-medium text-gray-400">Images, Videos, or Documents</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {mediaFile && (
                                            <div className="text-right mt-2">
                                                <button type="button" onClick={() => setMediaFile(null)} className="text-xs text-red-500 font-black uppercase tracking-widest hover:underline">Remove Selected</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col h-full space-y-4">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Message Body</label>
                                        <div className="relative flex-1 h-[280px]">
                                            <div className="absolute inset-0 bg-gray-50 rounded-[2rem] border-2 border-gray-100 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all p-1">
                                                <textarea
                                                    className="w-full h-full bg-transparent border-none focus:ring-0 text-gray-700 font-medium resize-none p-5 leading-relaxed placeholder-gray-400"
                                                    placeholder="Drive engagement! E.g. Hello {{name}}, your premium access ends in 2 days..."
                                                    required
                                                    value={message} onChange={e => setMessage(e.target.value)}
                                                ></textarea>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                            <span>Interactive Buttons</span>
                                            <span className="text-xs text-gray-400 font-medium normal-case">{buttons.length}/3 max</span>
                                        </label>
                                        <div className="space-y-3">
                                            {buttons.map((btn, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={btn.text}
                                                        onChange={(e) => {
                                                            const newBtns = [...buttons];
                                                            newBtns[index].text = e.target.value;
                                                            setButtons(newBtns);
                                                        }}
                                                        placeholder="Button Text (e.g. Yes, I'm interested)"
                                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm"
                                                        maxLength={20}
                                                    />
                                                    <button type="button" onClick={() => setButtons(buttons.filter((_, i) => i !== index))} className="w-12 h-[46px] rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            {buttons.length < 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setButtons([...buttons, { id: Date.now().toString(), text: '' }])}
                                                    className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 font-bold text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Plus size={16} /> Add Quick Reply Button
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex gap-3 items-start">
                                        <div className="p-1.5 bg-indigo-100 rounded-lg shrink-0">
                                            <Zap size={16} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase text-indigo-900 mb-0.5 tracking-wide">Personalization Tags</p>
                                            <p className="text-xs font-medium text-indigo-700">Use <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-bold mx-1">{'{'}{'{'}name{'}'}{'}'}</code> to automatically inject your contact's name into the message.</p>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button type="submit" disabled={submitting} className="w-full bg-gray-900 text-white font-black py-5 rounded-[1.5rem] text-lg hover:bg-gray-800 transition-all shadow-xl shadow-gray-900/20 disabled:opacity-50 flex items-center justify-center gap-3">
                                            {submitting ? <><Loader2 className="animate-spin" size={24} /> Saving Blueprint...</> : (
                                                <><Plus size={24} /> Finalize Template</>
                                            )}
                                        </button>
                                        <button type="button" onClick={() => setShowModal(false)} className="w-full mt-3 py-3 text-sm font-black text-gray-500 uppercase tracking-widest hover:text-gray-800 transition-colors">
                                            Cancel Draft
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Templates;
