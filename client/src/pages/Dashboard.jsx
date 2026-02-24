import React, { useState, useEffect } from 'react';
import {
    Users,
    Send,
    MessageSquare,
    FileText,
    ArrowUpRight,
    TrendingUp
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

    useEffect(() => {
        // Fetch summary stats concurrently
        const fetchData = async () => {
            try {
                const [contactsRes, campaignsRes, botsRes, chatsRes] = await Promise.all([
                    api.get('/contacts'),
                    api.get('/campaigns'),
                    api.get('/bots'),
                    api.get('/chats')
                ]);

                setStats({
                    contacts: contactsRes.data.contacts?.length || 0,
                    campaigns: campaignsRes.data.campaigns?.length || 0,
                    bots: botsRes.data.bots?.length || 0,
                    messages: chatsRes.data.conversations?.reduce((acc, curr) => acc + curr.message_count, 0) || 0
                });
            } catch (err) {
                console.error('Error fetching dashboard stats', err);
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
                borderColor: '#00a884',
                backgroundColor: 'rgba(0, 168, 132, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#00a884',
                pointBorderWidth: 2,
                pointBorderColor: '#fff',
                pointRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#fff',
                titleColor: '#111b21',
                bodyColor: '#667781',
                borderWidth: 1,
                borderColor: '#e9edef',
                padding: 12,
                displayColors: false,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#f0f2f5' },
                border: { display: false }
            },
            x: {
                grid: { display: false },
                border: { display: false }
            }
        }
    };

    const cards = [
        { name: 'Total Messages', value: stats.messages, icon: <MessageSquare className="text-blue-500" />, trend: '+12.5%' },
        { name: 'Active Contacts', value: stats.contacts, icon: <Users className="text-orange-500" />, trend: '+5.2%' },
        { name: 'Total Campaigns', value: stats.campaigns, icon: <Send className="text-purple-500" />, trend: '+3.1%' },
        { name: 'Active Bots', value: stats.bots, icon: <FileText className="text-green-500" />, trend: '+8.4%' },
    ];

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h2 className="text-2xl font-bold">Dashboard Summary</h2>
                <p className="text-[#667781]">Quick overview of your platform performance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, idx) => (
                    <div key={idx} className="card group hover:scale-[1.02] transition-all cursor-default">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2.5 rounded-xl bg-gray-50 flex items-center justify-center">
                                {card.icon}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">
                                <TrendingUp size={12} />
                                {card.trend}
                            </div>
                        </div>
                        <p className="text-sm font-medium text-[#667781] mb-1">{card.name}</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-3xl font-bold">{card.value}</h3>
                            <ArrowUpRight className="text-[#e9edef] group-hover:text-[#00a884] transition-colors" size={24} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-lg font-bold">Message Statistics</h3>
                        <p className="text-sm text-[#667781]">Weekly performance of sent messages</p>
                    </div>
                    <select className="input w-32 bg-gray-50 border-0 text-xs font-bold uppercase">
                        <option>This Week</option>
                        <option>Last Month</option>
                    </select>
                </div>
                <div className="h-[350px]">
                    <Line data={chartData} options={chartOptions} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
