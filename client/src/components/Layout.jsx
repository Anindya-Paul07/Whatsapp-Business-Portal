import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Link2,
    Users,
    FileText,
    Send,
    Bot,
    MessageSquare,
    LogOut,
    User as UserIcon
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
        { name: 'Template Bot', icon: <Bot size={20} />, path: '/bots' },
        { name: 'Chat', icon: <MessageSquare size={20} />, path: '/chat' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-64 h-screen bg-white border-r border-[#e9edef] flex flex-col fixed left-0 top-0 z-40">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-[#00a884] flex items-center gap-2">
                    <MessageSquare fill="currentColor" />
                    <span>WAPlatform</span>
                </h1>
            </div>

            <nav className="flex-1 overflow-y-auto pt-4">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `sidebar-item ${isActive ? 'active' : ''}`
                        }
                    >
                        {item.icon}
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-[#e9edef]">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faf9] mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white">
                        <UserIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{user?.email}</p>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${whatsappStatus === 'ready' ? 'bg-[#00a884]' : 'bg-gray-400'}`}></span>
                            <p className="text-[10px] text-[#667781] uppercase font-bold tracking-wider">
                                {whatsappStatus === 'ready' ? 'Connected' : 'Disconnected'}
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

const MainLayout = () => {
    return (
        <div className="flex min-h-screen bg-[#f0f2f5]">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <div className="max-w-6xl mx-auto animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
