import React, { useState, useEffect, useRef } from 'react';
import {
    Search, Send, MoreVertical, Phone, Info, Smile, Paperclip,
    Check, CheckCheck, Clock, User, ArrowLeft, Loader2, MessageSquare, Plus, Zap
} from 'lucide-react';
import api from '../utils/api';
import { useApp } from '../AppContext';
import toast from 'react-hot-toast';

const Chat = () => {
    const { whatsappStatus, socket, user } = useApp();
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loadingConv, setLoadingConv] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState(false);
    const scrollRef = useRef(null);

    const fetchConversations = async () => {
        try {
            const { data } = await api.get('/chats');
            setConversations(data.conversations || []);
        } catch (err) {
            console.error('Failed to load chats');
        } finally {
            setLoadingConv(false);
        }
    };

    const fetchMessages = async (phone) => {
        setLoadingMsg(true);
        try {
            const { data } = await api.get(`/chats/${encodeURIComponent(phone)}`);
            setMessages(data.messages || []);
            scrollToBottom();
        } catch (err) {
            toast.error('Failed to load history');
        } finally {
            setLoadingMsg(false);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        fetchConversations();

        if (socket) {
            socket.on('message_received', (data) => {
                if (selectedChat && data.contactPhone === selectedChat.contact_phone) {
                    setMessages(prev => [...prev, data]);
                    scrollToBottom();
                }
                fetchConversations();
            });
        }

        return () => {
            if (socket) socket.off('message_received');
        };
    }, [socket, selectedChat]);

    const handleSelectChat = (chat) => {
        setSelectedChat(chat);
        fetchMessages(chat.contact_phone);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedChat) return;

        if (whatsappStatus !== 'ready') {
            return toast.error('WhatsApp instance not connected');
        }

        const msgBody = input;
        setInput('');

        const tempMsg = {
            body: msgBody,
            direction: 'out',
            created_at: new Date().toISOString(),
            optimistic: true
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        try {
            await api.post(`/chats/${encodeURIComponent(selectedChat.contact_phone)}/send`, { message: msgBody });
        } catch (err) {
            toast.error('Failed to send');
            setMessages(prev => prev.filter(m => m !== tempMsg));
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] max-w-[1600px] mx-auto flex bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-100 animate-fade-in relative z-0">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50 rounded-full blur-[100px] -z-10 opacity-60"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full blur-[100px] -z-10 opacity-60"></div>

            {/* Left Pane: Chat List */}
            <div className={`w-full md:w-[380px] flex flex-col border-r border-gray-100 bg-white/60 backdrop-blur-xl shrink-0 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {/* Header */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100/60 bg-white/40">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Messages</h3>
                    <div className="flex gap-2 text-gray-400">
                        <button className="w-10 h-10 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 rounded-2xl transition-all shadow-sm"><MoreVertical size={20} /></button>
                    </div>
                </div>

                {/* Search */}
                <div className="p-4 bg-white/40 border-b border-gray-100/60">
                    <div className="relative group">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            className="w-full bg-gray-50/80 border border-transparent text-gray-900 focus:bg-white focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10 pl-12 pr-4 py-3.5 rounded-2xl transition-all font-medium placeholder-gray-400 shadow-sm"
                            placeholder="Search inbox..."
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    {loadingConv ? (
                        <div className="p-10 text-center"><Loader2 size={32} className="animate-spin inline-block text-emerald-500" /></div>
                    ) : conversations.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                                <MessageSquare size={24} />
                            </div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Inbox Zero</p>
                        </div>
                    ) : conversations.map(chat => (
                        <div
                            key={chat.contact_phone}
                            onClick={() => handleSelectChat(chat)}
                            className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${selectedChat?.contact_phone === chat.contact_phone
                                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-100 shadow-sm transform scale-[1.02]'
                                    : 'bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-100'
                                }`}
                        >
                            <div className="relative">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 font-bold shadow-md transition-colors ${chat.contact_phone.includes('@g.us') ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : 'bg-gradient-to-br from-emerald-400 to-teal-600'
                                    }`}>
                                    <User size={24} />
                                </div>
                                {chat.message_count > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm animate-pulse-badge">
                                        {chat.message_count}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`font-black text-[15px] truncate ${selectedChat?.contact_phone === chat.contact_phone ? 'text-emerald-900' : 'text-gray-900'}`}>
                                        {chat.contact_phone.includes('@g.us') ? 'Group Chat' : `+${chat.contact_phone.split('@')[0]}`}
                                    </h4>
                                    <span className={`text-[11px] font-bold ${chat.message_count > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                        {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <p className={`text-[13px] truncate ${chat.message_count > 0 ? 'text-gray-900 font-bold' : 'text-gray-500 font-medium'}`}>
                                        {chat.contact_phone.includes('@g.us') ? 'Tap to view group activity' : 'Tap to open conversation'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Pane: Message Window */}
            <div className={`flex-1 flex flex-col bg-gray-50/50 backdrop-blur-2xl relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {!selectedChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 animate-fade-in">
                        <div className="relative mb-8">
                            <div className="w-32 h-32 bg-emerald-100 rounded-full blur-2xl absolute inset-0 opacity-50 animate-pulse"></div>
                            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl border border-emerald-50 relative z-10">
                                <Zap size={48} className="text-emerald-500" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Workspace Inbox</h3>
                        <p className="max-w-md text-base text-gray-500 font-medium leading-relaxed">
                            Select a thread from the left to read messages, manage contacts, and reply with templates automatically.
                        </p>
                        <div className="mt-10 flex items-center gap-3 text-xs text-emerald-700 py-2.5 px-6 bg-emerald-50 border border-emerald-100 rounded-full font-black uppercase tracking-widest shadow-sm">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse"></span>
                            Secure Direct Connection
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="px-6 py-4 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSelectedChat(null)} className="md:hidden w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-gray-500 hover:text-gray-800 transition-colors">
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shrink-0 font-bold shadow-md">
                                        <User size={24} />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div>
                                    <h4 className="font-black text-lg text-gray-900 tracking-tight">
                                        {selectedChat.contact_phone.includes('@g.us') ? 'Group Operations' : `+${selectedChat.contact_phone.split('@')[0]}`}
                                    </h4>
                                    <p className="text-[11px] text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1 mt-0.5">
                                        System Online
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 text-gray-400">
                                <button className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-xl transition-colors text-gray-500 hover:text-emerald-600"><Phone size={20} /></button>
                                <button className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-xl transition-colors text-gray-500 hover:text-emerald-600"><Info size={20} /></button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar relative z-0">
                            {loadingMsg ? (
                                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-20">
                                    <div className="inline-flex py-2 px-4 bg-gray-100 rounded-full text-xs font-black text-gray-400 uppercase tracking-widest">Start of conversation</div>
                                </div>
                            ) : messages.map((m, i) => (
                                <div key={i} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`relative max-w-[75%] sm:max-w-[65%] animate-fade-in shadow-sm ${m.direction === 'out'
                                            ? 'bg-emerald-600 text-white rounded-[1.5rem] rounded-tr-sm p-4 mr-2'
                                            : 'bg-white text-gray-800 rounded-[1.5rem] rounded-tl-sm p-4 border border-gray-100 ml-2'
                                        }`}>
                                        <p className="whitespace-pre-wrap leading-relaxed font-medium text-[15px]">{m.body}</p>
                                        <div className={`flex justify-end items-center gap-1.5 mt-2 text-[10px] font-bold ${m.direction === 'out' ? 'text-emerald-200' : 'text-gray-400'}`}>
                                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {m.direction === 'out' && (
                                                m.optimistic ? <Clock size={12} /> : <CheckCheck size={14} className={m.direction === 'out' ? "text-emerald-300" : "text-blue-500"} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={scrollRef}></div>
                        </div>

                        {/* Input Bar */}
                        <div className="px-6 py-5 bg-white/80 backdrop-blur-md border-t border-gray-100 z-10 shadow-sm relative flex items-center gap-3">
                            <form onSubmit={handleSend} className="flex-1 flex items-center gap-3">
                                <div className="flex gap-1 shrink-0 bg-gray-50 p-1.5 rounded-[1.25rem] border border-gray-100">
                                    <button type="button" className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"><Smile size={22} /></button>
                                    <button type="button" className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all -rotate-45"><Paperclip size={20} /></button>
                                </div>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        className="w-full h-14 pl-5 pr-14 rounded-[1.25rem] bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10 transition-all text-[15px] font-medium placeholder-gray-400 shadow-sm"
                                        placeholder="Type your message..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-0 shadow-md transform hover:-translate-y-0.5"
                                    >
                                        <Send size={18} fill="currentColor" className="ml-0.5" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Chat;
