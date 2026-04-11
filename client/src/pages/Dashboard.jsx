import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText,
    PauseCircle, Send, Users, Wifi
} from 'lucide-react';
import api from '../utils/api';
import { useApp } from '../AppContext';
import CampaignProgressBar from '../components/CampaignProgressBar';

const Dashboard = () => {
    const { whatsappStatus, socket } = useApp();
    const [contacts, setContacts] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [hasDraft, setHasDraft] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchData = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const [contactsRes, templatesRes, campaignsRes] = await Promise.all([
                api.get('/contacts?limit=1000'),
                api.get('/templates'),
                api.get('/campaigns')
            ]);
            setContacts(contactsRes.data.contacts || []);
            setTemplates(templatesRes.data.templates || []);
            setCampaigns(campaignsRes.data.campaigns || []);
            setHasDraft(!!localStorage.getItem('campaign_draft_v1'));
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => fetchData(false), 5000);
        return () => clearInterval(interval);
    }, []);

    const usableContacts = contacts.filter(c => !c.do_not_message).length;
    const unknownConsent = contacts.filter(c => !c.do_not_message && (c.consent_status || 'unknown') === 'unknown').length;
    const activeCampaign = campaigns.find(c => c.status === 'processing');
    const pausedCampaigns = campaigns.filter(c => c.status === 'paused');
    const failedCampaigns = campaigns.filter(c => c.status === 'failed' || (c.fail_count || c.failCount || 0) > 0);
    const scheduledCampaigns = campaigns.filter(c => c.status === 'pending' && c.scheduled_at);
    const lastCampaign = campaigns[0];
    const sentTotal = campaigns.reduce((sum, c) => sum + (c.sent_count || c.sentCount || 0), 0);
    const failedTotal = campaigns.reduce((sum, c) => sum + (c.fail_count || c.failCount || 0), 0);

    const nextAction = useMemo(() => {
        if (whatsappStatus !== 'ready') {
            return {
                title: 'Connect WhatsApp first',
                detail: 'Generate a QR code and scan it from WhatsApp Linked Devices. Campaigns can only send while this connection is ready.',
                to: '/connect',
                label: 'Connect WhatsApp',
                icon: Wifi,
                tone: 'red'
            };
        }
        if (activeCampaign) {
            return {
                title: 'Watch the campaign that is running',
                detail: `${activeCampaign.name} is sending now. Keep the backend and browser session running until it finishes.`,
                to: `/campaigns/${activeCampaign.id}`,
                label: 'View live progress',
                icon: Send,
                tone: 'emerald'
            };
        }
        if (hasDraft) {
            return {
                title: 'Continue your saved campaign draft',
                detail: 'The 4-step setup is saved in this browser. Continue it before starting another send.',
                to: '/campaigns',
                label: 'Continue draft',
                icon: FileText,
                tone: 'blue'
            };
        }
        if (failedCampaigns.length > 0) {
            return {
                title: 'Review failed recipients',
                detail: 'Open the campaign details, read failure reasons, then retry only failed contacts when ready.',
                to: `/campaigns/${failedCampaigns[0].id}`,
                label: 'Review failures',
                icon: AlertTriangle,
                tone: 'amber'
            };
        }
        if (usableContacts === 0) {
            return {
                title: 'Add people you can message',
                detail: 'Import a CSV or add contacts manually. Mark opt-outs before sending any campaign.',
                to: '/contacts',
                label: 'Add contacts',
                icon: Users,
                tone: 'blue'
            };
        }
        return {
            title: 'Ready to send a campaign',
            detail: 'Choose exact recipients, preview the message, check safety, then confirm the send.',
            to: '/campaigns',
            label: 'Send a campaign',
            icon: Send,
            tone: 'emerald'
        };
    }, [activeCampaign, failedCampaigns, hasDraft, usableContacts, whatsappStatus]);

    const checklist = [
        {
            label: 'WhatsApp connection',
            done: whatsappStatus === 'ready',
            detail: whatsappStatus === 'ready' ? 'Connected and ready.' : 'Scan a QR code before sending.',
            to: '/connect'
        },
        {
            label: 'Contacts',
            done: usableContacts > 0,
            detail: `${usableContacts} can receive messages${unknownConsent ? `, ${unknownConsent} have unknown consent` : ''}.`,
            to: '/contacts'
        },
        {
            label: 'Message library',
            done: templates.length > 0,
            detail: templates.length ? `${templates.length} reusable templates saved.` : 'Create a reusable template or write a one-time message later.',
            to: '/templates'
        },
        {
            label: 'Safe sending',
            done: !activeCampaign && failedCampaigns.length === 0,
            detail: activeCampaign ? 'One campaign is running.' : failedCampaigns.length ? 'Failures need review.' : 'No blockers right now.',
            to: activeCampaign ? `/campaigns/${activeCampaign.id}` : '/campaigns'
        }
    ];

    const alerts = [
        whatsappStatus !== 'ready' && {
            title: 'WhatsApp disconnected',
            detail: 'Campaigns cannot send until a QR session is connected.',
            to: '/connect',
            label: 'Connect'
        },
        hasDraft && !activeCampaign && {
            title: 'Draft campaign saved',
            detail: 'Continue the draft before creating another campaign.',
            to: '/campaigns',
            label: 'Continue'
        },
        pausedCampaigns.length > 0 && {
            title: `${pausedCampaigns.length} paused campaign${pausedCampaigns.length === 1 ? '' : 's'}`,
            detail: 'Review pending recipients and resume only when ready.',
            to: `/campaigns/${pausedCampaigns[0].id}`,
            label: 'Review'
        },
        failedCampaigns.length > 0 && {
            title: `${failedCampaigns.length} campaign${failedCampaigns.length === 1 ? '' : 's'} need review`,
            detail: 'Open recipient results to see exact failure reasons.',
            to: `/campaigns/${failedCampaigns[0].id}`,
            label: 'Open'
        },
        scheduledCampaigns.length > 0 && {
            title: `${scheduledCampaigns.length} scheduled campaign${scheduledCampaigns.length === 1 ? '' : 's'}`,
            detail: 'They will run when the time and send window allow it.',
            to: `/campaigns/${scheduledCampaigns[0].id}`,
            label: 'View'
        }
    ].filter(Boolean);

    const tone = {
        red: 'border-red-100 bg-red-50 text-red-700',
        amber: 'border-amber-100 bg-amber-50 text-amber-800',
        blue: 'border-blue-100 bg-blue-50 text-blue-700',
        emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700'
    };

    const NextIcon = nextAction.icon;

    return (
        <div className="space-y-8 pb-10 max-w-[1500px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-6 xl:items-end justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2">Command center</p>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Home</h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Start with the next useful action. Everything else can wait.</p>
                </div>
                <Link to="/campaigns" className="px-6 py-3 bg-emerald-600 text-white font-black rounded-lg shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-2">
                    <Send size={19} /> Send a campaign
                </Link>
            </div>

            <section className={`border rounded-2xl p-6 lg:p-8 ${tone[nextAction.tone]}`}>
                <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
                    <div className="flex gap-4">
                        <div className="w-14 h-14 rounded-xl bg-white/80 border border-white flex items-center justify-center shrink-0">
                            <NextIcon size={28} />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Next step</p>
                            <h3 className="text-2xl font-black text-gray-900">{nextAction.title}</h3>
                            <p className="text-sm font-bold mt-2 max-w-3xl">{nextAction.detail}</p>
                        </div>
                    </div>
                    <Link to={nextAction.to} className="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-lg bg-white text-gray-900 font-black shadow-sm border border-white/80">
                        {nextAction.label} <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {activeCampaign && (
                <section>
                    <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-end justify-between">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900">Live campaign progress</h3>
                            <p className="text-sm font-medium text-gray-500 mt-1">Clients can safely return here after submitting a campaign.</p>
                        </div>
                        <Link to={`/campaigns/${activeCampaign.id}`} className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-black text-gray-700">
                            Open report
                        </Link>
                    </div>
                    <CampaignProgressBar
                        campaign={{
                            ...activeCampaign,
                            progress: activeCampaign.progress ?? 0,
                            sentCount: activeCampaign.sentCount ?? activeCampaign.sent_count,
                            failCount: activeCampaign.failCount ?? activeCampaign.fail_count,
                            skippedCount: activeCampaign.skippedCount ?? activeCampaign.skipped_count,
                            total: activeCampaign.total || activeCampaign.recipient_count || 100
                        }}
                        socket={socket}
                        onFinished={() => fetchData(false)}
                    />
                </section>
            )}

            {alerts.length > 0 && (
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {alerts.map(item => (
                        <Link key={item.title} to={item.to} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:border-emerald-200 transition-colors flex gap-4 items-start">
                            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={22} />
                            <div className="flex-1">
                                <p className="font-black text-gray-900">{item.title}</p>
                                <p className="text-sm font-medium text-gray-500 mt-1">{item.detail}</p>
                            </div>
                            <span className="text-xs font-black text-emerald-700">{item.label}</span>
                        </Link>
                    ))}
                </section>
            )}

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-xl font-black text-gray-900">First-time path</h3>
                        <p className="text-sm text-gray-500 font-medium mt-1">Four steps clients can understand without training.</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {checklist.map((item, index) => (
                            <Link key={item.label} to={item.to} className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${item.done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'}`}>
                                    {item.done ? <CheckCircle2 size={20} /> : index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-gray-900">{item.label}</p>
                                    <p className="text-sm font-medium text-gray-500 leading-relaxed mt-1">{item.detail}</p>
                                </div>
                                <ArrowRight className="text-gray-300" size={18} />
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-xl font-black text-gray-900">Today at a glance</h3>
                        <div className="grid grid-cols-2 gap-3 mt-5">
                            <div className="p-4 rounded-lg bg-gray-50">
                                <Users className="text-blue-600" size={20} />
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mt-3">Can message</p>
                                <p className="text-2xl font-black text-gray-900">{loading ? '...' : usableContacts}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-gray-50">
                                <FileText className="text-indigo-600" size={20} />
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mt-3">Templates</p>
                                <p className="text-2xl font-black text-gray-900">{loading ? '...' : templates.length}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-emerald-50">
                                <Send className="text-emerald-600" size={20} />
                                <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mt-3">Delivered</p>
                                <p className="text-2xl font-black text-gray-900">{sentTotal}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-red-50">
                                <AlertTriangle className="text-red-600" size={20} />
                                <p className="text-xs font-black uppercase tracking-widest text-red-700 mt-3">Failed</p>
                                <p className="text-2xl font-black text-gray-900">{failedTotal}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-xl font-black text-gray-900">Recent activity</h3>
                        <div className="mt-4 space-y-3">
                            {activeCampaign && (
                                <Link to={`/campaigns/${activeCampaign.id}`} className="flex gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                                    <Send className="text-emerald-600 shrink-0" size={18} />
                                    <div>
                                        <p className="font-black text-gray-900">Campaign started</p>
                                        <p className="text-xs font-bold text-gray-500">{activeCampaign.name}</p>
                                    </div>
                                </Link>
                            )}
                            {lastCampaign ? (
                                <Link to={`/campaigns/${lastCampaign.id}`} className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                    <Clock className="text-gray-500 shrink-0" size={18} />
                                    <div>
                                        <p className="font-black text-gray-900">{lastCampaign.name}</p>
                                        <p className="text-xs font-bold text-gray-500">Status: {lastCampaign.status}</p>
                                    </div>
                                </Link>
                            ) : (
                                <div className="p-4 rounded-lg border border-dashed border-gray-200 text-gray-500 text-sm font-medium">
                                    No campaigns yet.
                                </div>
                            )}
                            {unknownConsent > 0 && (
                                <Link to="/contacts" className="flex gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                                    <Users className="text-amber-600 shrink-0" size={18} />
                                    <div>
                                        <p className="font-black text-gray-900">Consent needs review</p>
                                        <p className="text-xs font-bold text-gray-500">{unknownConsent} contacts have unknown consent.</p>
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 flex gap-3">
                        <PauseCircle className="text-amber-600 shrink-0" size={22} />
                        <p className="text-sm font-medium text-amber-800">
                            Send slowly and only to expected recipients. This project uses whatsapp-web.js, not the official sending API.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
