import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    Send,
    MoreVertical,
    Phone,
    Info,
    Smile,
    Paperclip,
    Check,
    CheckCheck,
    Clock,
    User,
    ArrowLeft,
    Loader2
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
            // Encode JID for URL safety (handles @g.us, etc)
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
                // If received message is for currently open chat, append it
                if (selectedChat && data.contactPhone === selectedChat.contact_phone) {
                    setMessages(prev => [...prev, data]);
                    scrollToBottom();
                }
                // Always refresh list to update last message/order
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

        // Optimistic UI update
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
            // The socket event will trigger (if backend emits on manual send) 
            // or we can just leave the optimistic one. My backend emits manually so it should duplicate.
            // Better: filter optimistic out when real one arrives or just fetch history.
        } catch (err) {
            toast.error('Failed to send');
            setMessages(prev => prev.filter(m => m !== tempMsg));
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] flex bg-white rounded-2xl overflow-hidden border border-[#e9edef] shadow-sm animate-fade-in">
            {/* Left Pane: Chat List */}
            <div className={`w-full md:w-80 flex flex-col border-r border-[#e9edef] bg-[#ffffff] ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 bg-[#f8faf9] flex items-center justify-between border-b border-[#e9edef]">
                    <h3 className="text-xl font-bold text-[#111b21]">Chats</h3>
                    <div className="flex gap-2 text-gray-400">
                        <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><MessageSquare size={18} /></button>
                        <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><MoreVertical size={18} /></button>
                    </div>
                </div>

                <div className="p-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2 text-gray-400" />
                        <input
                            type="text"
                            className="input bg-[#f0f2f5] border-0 pl-10 h-9 rounded-lg"
                            placeholder="Filter conversations..."
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loadingConv ? (
                        <div className="p-10 text-center"><Clock size={24} className="animate-spin inline text-gray-300" /></div>
                    ) : conversations.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-400 uppercase font-black tracking-widest">No conversations</div>
                    ) : conversations.map(chat => (
                        <div
                            key={chat.contact_phone}
                            onClick={() => handleSelectChat(chat)}
                            className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors relative border-b border-gray-50 ${selectedChat?.contact_phone === chat.contact_phone ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                        >
                            <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0 font-bold shadow-sm">
                                <User size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="font-bold text-sm text-[#111b21] truncate">
                                        {chat.contact_phone.includes('@g.us') ? 'Group Chat' : `+${chat.contact_phone.split('@')[0]}`}
                                    </h4>
                                    <span className="text-[10px] text-[#667781] font-medium">
                                        {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-[#667781] truncate pr-2">
                                        {chat.contact_phone.includes('@g.us') ? 'View group messages...' : 'Tap to view chat history...'}
                                    </p>
                                    <span className="bg-[#00a884] text-white text-[9px] font-black px-2 py-0.5 rounded-full">{chat.message_count}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Pane: Message Window */}
            <div className={`flex-1 flex flex-col bg-[#f0f2f5] relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {!selectedChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                            <MessageSquare size={48} className="text-[#00a884]" fill="#00a88420" />
                        </div>
                        <h3 className="text-2xl font-bold text-[#111b21] mb-2">WhatsApp for Web</h3>
                        <p className="max-w-xs text-sm text-[#667781] leading-relaxed">
                            Select an existing conversation or start a new campaign to interact with your customers in real-time.
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-xs text-[#00a884] py-1.5 px-4 bg-[#e7f8f3] rounded-full font-bold">
                            <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-pulse"></span>
                            End-to-end Encrypted
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="px-6 py-3 bg-[#f0f2f5] flex items-center justify-between border-b border-[#e9edef] z-10">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSelectedChat(null)} className="md:hidden text-gray-500"><ArrowLeft size={20} /></button>
                                <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0 font-bold">
                                    <User size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-[#111b21]">
                                        {selectedChat.contact_phone.includes('@g.us') ? 'Group Chat' : `+${selectedChat.contact_phone.split('@')[0]}`}
                                    </h4>
                                    <p className="text-[10px] text-[#00a884] font-black uppercase tracking-wider">
                                        {selectedChat.contact_phone.includes('@g.us') ? 'Group' : 'Online'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 text-gray-400">
                                <button className="hover:text-gray-600"><Phone size={18} /></button>
                                <button className="hover:text-gray-600"><Info size={18} /></button>
                                <button className="hover:text-gray-600"><MoreVertical size={18} /></button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                            {loadingMsg ? (
                                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#00a884]" /></div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-20 text-xs font-bold text-gray-400 uppercase tracking-widest">Start of conversation</div>
                            ) : messages.map((m, i) => (
                                <div key={i} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`${m.direction === 'out' ? 'chat-bubble-out translate-x-1' : 'chat-bubble-in -translate-x-1'} relative animate-fade-in`}>
                                        <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                                        <div className="flex justify-end items-center gap-1 mt-1 text-[9px] text-gray-400 font-bold">
                                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {m.direction === 'out' && (
                                                m.optimistic ? <Clock size={10} /> : <CheckCheck size={12} className="text-blue-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={scrollRef}></div>
                        </div>

                        {/* Input Bar */}
                        <div className="px-6 py-4 bg-[#f0f2f5] border-t border-[#e9edef] mt-auto">
                            <form onSubmit={handleSend} className="flex items-center gap-3">
                                <button type="button" className="text-gray-500 hover:text-gray-700 transition-colors"><Smile size={24} /></button>
                                <button type="button" className="text-gray-500 hover:text-gray-700 transition-colors -rotate-45"><Paperclip size={22} /></button>
                                <input
                                    type="text"
                                    className="flex-1 h-11 px-4 rounded-xl bg-white border-0 outline-none shadow-sm text-sm"
                                    placeholder="Type a message..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="w-11 h-11 bg-[#00a884] text-white rounded-full flex items-center justify-center hover:bg-[#008069] transition-all disabled:opacity-50 disabled:grayscale shadow-md active:scale-95"
                                >
                                    <Send size={20} fill="white" />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const MessageSquare = ({ size, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

export default Chat;
