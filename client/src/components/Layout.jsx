import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Link2, Users, FileText, Send, Bot,
    MessageSquare, LogOut, User as UserIcon, Zap, ShieldCheck
} from 'lucide-react';
import { useApp } from '../AppContext';

const Sidebar = () => {
    const { logout, user, whatsappStatus } = useApp();
    const navigate = useNavigate();

    const menuItems = [
        { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
        { name: 'Connect', icon: <Link2 size={20} />, path: '/connect' },
        { name: 'Contacts', icon: <Users size={20} />, path: '/contacts' },
        { name: 'Campaigns', icon: <Send size={20} />, path: '/campaigns' },
        { name: 'Templates', icon: <FileText size={20} />, path: '/templates' },
        { name: 'Message Bot', icon: <Bot size={20} />, path: '/message-bot' },
        { name: 'Chat', icon: <MessageSquare size={20} />, path: '/chat' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-[280px] h-[calc(100vh-32px)] m-4 bg-white/80 backdrop-blur-2xl border border-white rounded-[2rem] flex flex-col fixed left-0 top-0 z-40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            {/* Logo Area */}
            <div className="p-8 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-full blur-[50px] -z-10 opacity-60 transform translate-x-1/2 -translate-y-1/2"></div>
                <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                        <Zap size={20} fill="currentColor" />
                    </div>
                    <span>WA<span className="text-emerald-500">Auto</span></span>
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
                <p className="px-4 text-xs font-black text-gray-400 uppercase tracking-widest mb-4 mt-2">Main Menu</p>
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer text-[15px] font-bold transition-all duration-300 ${isActive
                                ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 text-emerald-700 shadow-sm border border-emerald-100/50 transform scale-[1.02]'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 transparent border border-transparent'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <span className={`${isActive ? 'text-emerald-500' : 'text-gray-400'}`}>
                                    {item.icon}
                                </span>
                                <span>{item.name}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User Area */}
            <div className="p-4 mt-auto">
                <div className="border border-gray-100 bg-white/50 rounded-[1.5rem] p-4 shadow-sm mb-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 border border-emerald-200/50 shrink-0">
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 group"
                >
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Secure Logout</span>
                </button>
            </div>
        </aside>
    );
};

const MainLayout = () => {
    return (
        <div className="flex min-h-screen bg-gray-50/50 relative overflow-hidden font-sans">
            {/* Global Background Elements */}
            <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-50 rounded-full blur-[150px] -z-10 opacity-70"></div>
            <div className="fixed bottom-[-20%] left-[10%] w-[50%] h-[50%] bg-blue-50/80 rounded-full blur-[150px] -z-10 opacity-70"></div>

            <Sidebar />

            <main className="flex-1 ml-[312px] p-8 relative z-0">
                <div className="animate-fade-in w-full h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
