import React, { useState, useEffect } from 'react';
import {
    Users,
    Send,
    MessageSquare,
    FileText,
    ArrowUpRight,
    TrendingUp,
    Layout,
    Activity,
    Bot
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import api from '../utils/api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const Dashboard = () => {
    const [stats, setStats] = useState({
        contacts: 0,
        messages: 0,
        campaigns: 0,
        bots: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch summary stats concurrently
        const fetchData = async () => {
            setLoading(true);
            try {
                const [contactsRes, campaignsRes, botsRes, chatsRes] = await Promise.all([
                    api.get('/contacts'),
                    api.get('/campaigns'),
                    api.get('/bots'),
                    api.get('/chats')
                ]).catch(() => [{}, {}, {}, {}]); // Fallback in case of err

                setStats({
                    contacts: contactsRes.data?.contacts?.length || 0,
                    campaigns: campaignsRes.data?.campaigns?.length || 0,
                    bots: botsRes.data?.bots?.length || 0,
                    messages: chatsRes.data?.conversations?.reduce((acc, curr) => acc + (curr.message_count || 0), 0) || 0
                });
            } catch (err) {
                console.error('Error fetching dashboard stats', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const chartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Messages Sent',
                data: [65, 59, 80, 81, 56, 95, 120],
                borderColor: '#4f46e5', // Indigo-600
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 350);
                    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.2)');
                    gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
                    return gradient;
                },
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderWidth: 3,
                pointBorderColor: '#4f46e5',
                pointRadius: 6,
                pointHoverRadius: 8,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1f2937',
                titleFont: { size: 13, weight: 'bold' },
                bodyColor: '#4f46e5',
                bodyFont: { size: 14, weight: 'bold' },
                borderWidth: 1,
                borderColor: '#f3f4f6',
                padding: 16,
                displayColors: false,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                cornerRadius: 12,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#f3f4f6', strokeDash: [5, 5] },
                border: { display: false },
                ticks: { color: '#9ca3af', font: { size: 11, weight: '600' } }
            },
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: { color: '#6b7280', font: { size: 12, weight: 'bold' } }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index',
        },
    };

    const cards = [
        { name: 'Total Messages', value: stats.messages, icon: <MessageSquare size={24} className="text-blue-500" />, trend: '+12.5%', color: 'from-blue-500/10 to-transparent', border: 'border-blue-100' },
        { name: 'Active Contacts', value: stats.contacts, icon: <Users size={24} className="text-orange-500" />, trend: '+5.2%', color: 'from-orange-500/10 to-transparent', border: 'border-orange-100' },
        { name: 'Total Campaigns', value: stats.campaigns, icon: <Send size={24} className="text-indigo-500" />, trend: '+3.1%', color: 'from-indigo-500/10 to-transparent', border: 'border-indigo-100' },
        { name: 'Active Bots', value: stats.bots, icon: <Bot size={24} className="text-emerald-500" />, trend: '+8.4%', color: 'from-emerald-500/10 to-transparent', border: 'border-emerald-100' },
    ];

    return (
        <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Platform <span className="text-indigo-600">Overview</span></h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Real-time metrics and system performance</p>
                </div>

                <div className="flex bg-white/60 backdrop-blur-xl border border-gray-100 rounded-3xl p-2 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 -z-10"></div>
                    <div className="flex items-center gap-3 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                        <Activity size={18} className="animate-pulse" />
                        <span className="text-sm font-black uppercase tracking-widest">Live Sync</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, idx) => (
                    <div key={idx} className={`bg-white rounded-3xl p-6 border ${card.border} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group`}>
                        <div className={`absolute inset-0 bg-gradient-to-b ${card.color} opacity-50`}></div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    {card.icon}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                    <TrendingUp size={12} />
                                    {card.trend}
                                </div>
                            </div>

                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{card.name}</p>
                            <div className="flex items-end justify-between">
                                <h3 className="text-4xl font-black text-gray-900 tracking-tight">
                                    {loading ? <span className="text-gray-200">...</span> : card.value.toLocaleString()}
                                </h3>
                                <ArrowUpRight className="text-gray-200 group-hover:text-indigo-500 transition-colors duration-300 transform group-hover:translate-x-1 group-hover:-translate-y-1" size={28} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <Layout className="text-indigo-500" /> Message Volume
                        </h3>
                        <p className="text-sm text-gray-500 font-medium mt-1">Daily performance of automated and broadcast messages</p>
                    </div>
                    <select className="bg-gray-50 border border-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors appearance-none pr-8 cursor-pointer shadow-sm relative z-10">
                        <option>This Week</option>
                        <option>Last Month</option>
                        <option>This Year</option>
                    </select>
                </div>

                <div className="h-[400px] w-full bg-gradient-to-b from-gray-50/50 to-white rounded-2xl p-4 border border-gray-100/50">
                    <Line data={chartData} options={chartOptions} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
