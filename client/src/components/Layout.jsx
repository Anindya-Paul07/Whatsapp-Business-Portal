import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Link2, Users, FileText, Send, Bot,
    MessageSquare, LogOut, User as UserIcon, Zap, AlertTriangle,
    CheckCircle2, Clock
} from 'lucide-react';
import { useApp } from '../AppContext';
import api from '../utils/api';

const Sidebar = () => {
    const { logout, user, whatsappStatus } = useApp();
    const navigate = useNavigate();

    const navGroups = [
        {
            title: 'Daily Work',
            items: [
                { name: 'Home', icon: <LayoutDashboard size={19} />, path: '/' },
                { name: 'Send Campaign', icon: <Send size={19} />, path: '/campaigns' },
                { name: 'Inbox', icon: <MessageSquare size={19} />, path: '/chat' },
            ]
        },
        {
            title: 'Customers',
            items: [
                { name: 'Contacts', icon: <Users size={19} />, path: '/contacts' },
                { name: 'Connect WhatsApp', icon: <Link2 size={19} />, path: '/connect' },
            ]
        },
        {
            title: 'Library',
            items: [
                { name: 'Message Templates', icon: <FileText size={19} />, path: '/templates' },
                { name: 'Auto Replies', icon: <Bot size={19} />, path: '/message-bot' },
            ]
        },
        {
            title: 'Advanced',
            items: [
                { name: 'Flow Builder', icon: <Zap size={19} />, path: '/flows' },
            ]
        }
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-[280px] h-[calc(100vh-32px)] m-4 bg-white border border-gray-100 rounded-2xl flex flex-col fixed left-0 top-0 z-40 shadow-sm overflow-hidden">
            {/* Logo Area */}
            <div className="p-6 border-b border-gray-100">
                <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                        <Zap size={20} fill="currentColor" />
                    </div>
                    <span>WA<span className="text-emerald-500">Auto</span></span>
                </h1>
                <p className="text-xs font-bold text-gray-400 mt-2">Guided WhatsApp workspace</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar">
                {navGroups.map(group => (
                    <div key={group.title}>
                        <p className="px-3 text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">{group.title}</p>
                        <div className="space-y-1">
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer text-[14px] font-bold transition-all ${isActive
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <span className={`${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                {item.icon}
                                            </span>
                                            <span>{item.name}</span>
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User Area */}
            <div className="p-4 mt-auto">
                <div className="border border-gray-100 bg-gray-50 rounded-lg p-4 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-emerald-600 border border-gray-100 shrink-0">
                            <UserIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate">{user?.email || 'User'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${whatsappStatus === 'ready' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-red-400'}`}></span>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${whatsappStatus === 'ready' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {whatsappStatus === 'ready' ? 'Connected' : 'Disconnected'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 group"
                >
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Log out</span>
                </button>
            </div>
        </aside>
    );
};

const WorkbenchStatus = () => {
    const { whatsappStatus } = useApp();
    const [campaigns, setCampaigns] = useState([]);
    const [hasDraft, setHasDraft] = useState(false);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const { data } = await api.get('/campaigns');
                if (!mounted) return;
                setCampaigns(data.campaigns || []);
                setHasDraft(!!localStorage.getItem('campaign_draft_v1'));
            } catch (_) {
                if (mounted) setHasDraft(!!localStorage.getItem('campaign_draft_v1'));
            }
        };
        load();
        const interval = setInterval(load, 10000);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    const activeCampaign = campaigns.find(c => c.status === 'processing');
    const failedCount = campaigns.filter(c => c.status === 'failed' || (c.fail_count || c.failCount || 0) > 0).length;

    const nextAction = useMemo(() => {
        if (whatsappStatus !== 'ready') {
            return { label: 'Connect WhatsApp', to: '/connect', tone: 'red', detail: 'Scan QR before sending.' };
        }
        if (activeCampaign) {
            return { label: 'View live progress', to: `/campaigns/${activeCampaign.id}`, tone: 'emerald', detail: `${activeCampaign.name} is running.` };
        }
        if (hasDraft) {
            return { label: 'Continue draft', to: '/campaigns', tone: 'blue', detail: 'Your campaign setup is saved.' };
        }
        if (failedCount > 0) {
            return { label: 'Review failures', to: '/', tone: 'amber', detail: `${failedCount} campaign${failedCount === 1 ? '' : 's'} need review.` };
        }
        return { label: 'Send a campaign', to: '/campaigns', tone: 'emerald', detail: 'Everything is ready.' };
    }, [activeCampaign, failedCount, hasDraft, whatsappStatus]);

    const toneClasses = {
        red: 'bg-red-50 text-red-700 border-red-100',
        amber: 'bg-amber-50 text-amber-800 border-amber-100',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    };

    return (
        <div className="sticky top-0 z-30 mb-6 bg-gray-50/95 backdrop-blur border-b border-gray-100 -mx-8 px-8 py-4">
            <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-black ${whatsappStatus === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {whatsappStatus === 'ready' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                        WhatsApp {whatsappStatus === 'ready' ? 'connected' : 'disconnected'}
                    </span>
                    {activeCampaign && (
                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-100 bg-white text-emerald-700 text-xs font-black">
                            <Clock size={15} /> Campaign running
                        </span>
                    )}
                    {hasDraft && !activeCampaign && (
                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-100 bg-white text-blue-700 text-xs font-black">
                            Draft saved
                        </span>
                    )}
                    {failedCount > 0 && (
                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 bg-white text-red-700 text-xs font-black">
                            {failedCount} need review
                        </span>
                    )}
                </div>
                <div className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg border ${toneClasses[nextAction.tone]}`}>
                    <span className="text-sm font-bold">{nextAction.detail}</span>
                    <Link to={nextAction.to} className="px-4 py-2 rounded-lg bg-white border border-current/10 text-sm font-black shadow-sm">
                        {nextAction.label}
                    </Link>
                </div>
            </div>
        </div>
    );
};

const MainLayout = () => {
    return (
        <div className="flex min-h-screen bg-gray-50 relative font-sans">
            <Sidebar />

            <main className="flex-1 ml-[312px] p-8 pt-0 relative z-0">
                <WorkbenchStatus />
                <div className="animate-fade-in w-full h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
