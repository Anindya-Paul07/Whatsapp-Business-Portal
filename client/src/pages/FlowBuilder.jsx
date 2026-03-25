import React, { useState, useEffect } from 'react';
import {
    Plus, Search, MoreVertical, Trash2, Edit2, Play, Pause,
    Bot, MessageSquare, Clock, Zap, Target, Loader2, ArrowRight, X
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const FlowBuilder = () => {
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNodeModal, setShowNodeModal] = useState(false);

    // New Node State
    const [nodeType, setNodeType] = useState('keyword');
    const [nodeName, setNodeName] = useState('');
    const [keywords, setKeywords] = useState('');
    const [messageText, setMessageText] = useState('');
    const [delayMs, setDelayMs] = useState(1000);

    const fetchFlows = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/flows/nodes');
            setNodes(data.nodes || []);
        } catch (err) {
            console.error('Failed to load flows');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlows();
    }, []);

    const handleCreateNode = async (e) => {
        e.preventDefault();

        let content = {};
        if (nodeType === 'keyword') content = { keywords: keywords.split(',').map(k => k.trim()) };
        else if (nodeType === 'message') content = { text: messageText };
        else if (nodeType === 'delay') content = { ms: delayMs };

        try {
            await api.post('/flows/nodes', {
                name: nodeName,
                type: nodeType,
                content
            });
            toast.success('Automation node created');
            setShowNodeModal(false);
            resetForm();
            fetchFlows();
        } catch (err) {
            toast.error('Failed to create node');
        }
    };

    const resetForm = () => {
        setNodeName('');
        setKeywords('');
        setMessageText('');
        setDelayMs(1000);
    };

    return (
        <div className="space-y-8 pb-20 max-w-[1600px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Flow <span className="text-purple-600">Builder</span></h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Design automated response trees and intelligent bots</p>
                </div>

                <button
                    onClick={() => setShowNodeModal(true)}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-purple-500/20 hover:scale-[1.02] transition-all"
                >
                    <Plus size={20} /> Create New Node
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin inline-block text-purple-500" size={40} /></div>
                ) : nodes.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 flex flex-col items-center">
                        <div className="w-20 h-20 bg-purple-50 text-purple-500 rounded-3xl flex items-center justify-center mb-4"><Zap size={40} /></div>
                        <h3 className="text-xl font-black text-gray-900">No Automation Nodes</h3>
                        <p className="text-gray-400 font-medium">Start by creating a keyword trigger or a message response.</p>
                    </div>
                ) : nodes.map(node => (
                    <div key={node.id} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                        {/* (Rendering Logic unchanged from previous FlowBuilder.jsx snippet) */}
                        <div className="flex justify-between items-start mb-6">
                            <div className={`p-3 rounded-2xl shadow-sm border ${
                                node.type === 'keyword' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                node.type === 'message' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                'bg-purple-50 border-purple-100 text-purple-600'
                            }`}>
                                {node.type === 'keyword' ? <Target size={20} /> :
                                 node.type === 'message' ? <MessageSquare size={20} /> : <Clock size={20} />}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-500 transition-all"><Edit2 size={16} /></button>
                                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        <h4 className="font-black text-gray-900 text-lg mb-2 truncate">{node.name}</h4>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{node.type}</span>
                            <div className="flex-1 h-px bg-gray-50"></div>
                        </div>

                        <p className="text-sm text-gray-500 font-medium line-clamp-2 min-h-[40px]">
                            {node.type === 'keyword' ? `Triggers on: ${node.content?.keywords?.join(', ')}` : node.content?.text || 'No content defined'}
                        </p>

                        <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                            <button className="flex items-center gap-2 text-xs font-black text-purple-600 hover:gap-3 transition-all">
                                View Connections <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showNodeModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative">
                        <button onClick={() => setShowNodeModal(false)} className="absolute top-8 right-8 text-gray-400 hover:text-gray-900 transition-colors"><X size={24} /></button>
                        <h3 className="text-2xl font-black text-gray-900 mb-8">Architect Automation</h3>

                        <form onSubmit={handleCreateNode} className="space-y-6">
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                {['keyword', 'message', 'delay'].map(type => (
                                    <button
                                        key={type} type="button" onClick={() => setNodeType(type)}
                                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${nodeType === type ? 'bg-purple-600 text-white border-purple-600 shadow-lg' : 'bg-white text-gray-500 border-gray-100 hover:border-purple-300'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Internal Name</label>
                                <input
                                    type="text" required value={nodeName} onChange={e => setNodeName(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500"
                                    placeholder="e.g. Greeting Step"
                                />
                            </div>

                            {nodeType === 'keyword' && (
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Trigger Keywords (comma separated)</label>
                                    <input
                                        type="text" required value={keywords} onChange={e => setKeywords(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500"
                                        placeholder="e.g. hello, hi, start"
                                    />
                                </div>
                            )}

                            {nodeType === 'message' && (
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Response Content</label>
                                    <textarea
                                        required value={messageText} onChange={e => setMessageText(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 font-bold outline-none h-32 resize-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500"
                                        placeholder="Your automated message..."
                                    />
                                </div>
                            )}

                            {nodeType === 'delay' && (
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Delay Duration (milliseconds)</label>
                                    <input
                                        type="number" required value={delayMs} onChange={e => setDelayMs(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500"
                                        placeholder="e.g. 2000"
                                    />
                                </div>
                            )}

                            <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-5 rounded-2xl text-lg font-black shadow-xl shadow-purple-500/30 hover:shadow-2xl transition-all">Save Node</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlowBuilder;
