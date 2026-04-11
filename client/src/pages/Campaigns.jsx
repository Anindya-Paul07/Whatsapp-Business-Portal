import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle, Calendar, CheckCircle2, ChevronLeft, ChevronRight,
    Database, Download, FileSpreadsheet, Loader2, RefreshCw,
    Search, Send, ShieldAlert, Trash2, Upload, Users, X
} from 'lucide-react';
import api from '../utils/api';
import { useApp } from '../AppContext';
import toast from 'react-hot-toast';
import { useAppDialog } from '../components/AppDialog';

const steps = ['Audience', 'Message', 'Timing', 'Review'];
const DRAFT_KEY = 'campaign_draft_v1';

const stepMeta = [
    {
        title: 'Choose who receives it',
        detail: 'Start empty, then deliberately choose contacts, labels, CSV rows, or all saved contacts.',
        helper: 'Most businesses should start with a label or exact selected contacts.'
    },
    {
        title: 'Prepare the WhatsApp message',
        detail: 'Pick a saved template or write one message for this campaign. The preview uses real recipient data.',
        helper: 'Media from a selected template wins over a one-time upload.'
    },
    {
        title: 'Set timing and safety',
        detail: 'Choose now or schedule, then keep the first run small enough to review.',
        helper: 'Default safety: 50 contacts, 20-45 seconds per send, deep pauses after every 15.'
    },
    {
        title: 'Review and confirm',
        detail: 'Check recipients, opt-outs, media, runtime, and connection before anything sends.',
        helper: 'The final button always shows exactly how many contacts will receive the campaign.'
    }
];

const audienceOptions = [
    {
        mode: 'selected_contacts',
        label: 'Select contacts',
        icon: Users,
        detail: 'Best for a small exact list.',
        badge: 'Safest'
    },
    {
        mode: 'label_filter',
        label: 'Use labels',
        icon: Database,
        detail: 'Send to VIP, leads, reminders, or custom groups.',
        badge: 'Recommended'
    },
    {
        mode: 'csv_upload',
        label: 'Upload CSV',
        icon: FileSpreadsheet,
        detail: 'Use a temporary list without saving everyone first.',
        badge: 'Import'
    },
    {
        mode: 'all_contacts',
        label: 'All contacts',
        icon: CheckCircle2,
        detail: 'Only when every saved contact should receive it.',
        badge: 'Careful'
    },
];

const estimateRuntime = (count) => {
    if (!count) return '0 minutes';
    const normalSeconds = count * 33;
    const pauseSeconds = Math.floor(count / 15) * 450;
    const total = normalSeconds + pauseSeconds;
    if (total < 60) return `${Math.ceil(total)} seconds`;
    if (total < 3600) return `${Math.ceil(total / 60)} minutes`;
    return `${Math.ceil(total / 3600)} hours`;
};

const labelsFromContacts = (contacts) => {
    const labels = new Set();
    contacts.forEach(contact => {
        String(contact.labels || '').split(',').map(l => l.trim()).filter(Boolean).forEach(l => labels.add(l));
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
};

const renderPreview = (message, contact) => {
    const name = contact?.name || 'John Doe';
    return String(message || '')
        .replace(/\{\{name\}\}/gi, name)
        .replace(/\{([^{}|]+)\}/g, (_, key) => contact?.[key.trim()] || `{${key}}`)
        .replace(/\{([^{}]+)\}/g, (_, options) => options.includes('|') ? options.split('|')[0] : `{${options}}`);
};

const apiOrigin = (api.defaults.baseURL || '').replace(/\/$/, '');

const getMediaInfo = (template, campaignMedia) => {
    if (template?.media_url) {
        const url = template.media_url.startsWith('http') ? template.media_url : `${apiOrigin}/${template.media_url}`;
        return { source: 'Template media', name: template.media_url.split('/').pop(), url };
    }
    if (campaignMedia) {
        return {
            source: 'Campaign upload',
            name: campaignMedia.name,
            url: campaignMedia.type?.startsWith('image/') ? URL.createObjectURL(campaignMedia) : '',
            type: campaignMedia.type
        };
    }
    return null;
};

const Campaigns = () => {
    const navigate = useNavigate();
    const { confirm, Dialog } = useAppDialog();
    const { whatsappStatus } = useApp();
    const [step, setStep] = useState(0);
    const [campaigns, setCampaigns] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [contactSearch, setContactSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [name, setName] = useState('');
    const [audienceMode, setAudienceMode] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [excludedIds, setExcludedIds] = useState([]);
    const [selectedLabels, setSelectedLabels] = useState([]);
    const [csvFile, setCsvFile] = useState(null);
    const [csvPreview, setCsvPreview] = useState(null);
    const [previewingCsv, setPreviewingCsv] = useState(false);

    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [oneTimeMessage, setOneTimeMessage] = useState('');
    const [campaignMedia, setCampaignMedia] = useState(null);
    const [previewContactId, setPreviewContactId] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [batchLimit, setBatchLimit] = useState(50);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [recipients, setRecipients] = useState([]);
    const [loadingRecipients, setLoadingRecipients] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [campRes, tempRes, contactRes] = await Promise.all([
                api.get('/campaigns'),
                api.get('/templates'),
                api.get('/contacts?limit=1000')
            ]);
            const loadedCampaigns = campRes.data.campaigns || [];
            setCampaigns(loadedCampaigns);
            setTemplates(tempRes.data.templates || []);
            const loadedContacts = contactRes.data.contacts || [];
            setContacts(loadedContacts);
            const storedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (storedDraft) {
                setStep(storedDraft.step || 0);
                setName(storedDraft.name || '');
                setAudienceMode(storedDraft.audienceMode || '');
                setSelectedIds(Array.isArray(storedDraft.selectedIds) ? storedDraft.selectedIds.filter(id => loadedContacts.some(contact => contact.id === id)) : []);
                setExcludedIds(Array.isArray(storedDraft.excludedIds) ? storedDraft.excludedIds : []);
                setSelectedLabels(Array.isArray(storedDraft.selectedLabels) ? storedDraft.selectedLabels : []);
                setSelectedTemplateId(storedDraft.selectedTemplateId || '');
                setOneTimeMessage(storedDraft.oneTimeMessage || '');
                setPreviewContactId(storedDraft.previewContactId || '');
                setScheduledAt(storedDraft.scheduledAt || '');
                setBatchLimit(storedDraft.batchLimit || 50);
                if (storedDraft.campaignMediaName) {
                    toast('Draft recovered. Please reselect the uploaded media before sending.', { icon: 'i' });
                }
            }
            const storedIds = JSON.parse(localStorage.getItem('campaign_selected_contact_ids') || '[]');
            if (storedIds.length > 0) {
                setAudienceMode('selected_contacts');
                setSelectedIds(storedIds.filter(id => loadedContacts.some(contact => contact.id === id)));
                localStorage.removeItem('campaign_selected_contact_ids');
            }
            const storedTemplateId = localStorage.getItem('campaign_selected_template_id');
            if (storedTemplateId) {
                setSelectedTemplateId(storedTemplateId);
                setOneTimeMessage('');
                localStorage.removeItem('campaign_selected_template_id');
            }
        } catch (err) {
            toast.error('Failed to load campaign data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (loading) return;
        const hasContent = name.trim() || audienceMode || selectedIds.length || selectedLabels.length || oneTimeMessage.trim() || selectedTemplateId || scheduledAt || campaignMedia;
        if (!hasContent) {
            localStorage.removeItem(DRAFT_KEY);
            return;
        }

        const draft = {
            step,
            name,
            audienceMode,
            selectedIds,
            excludedIds,
            selectedLabels,
            selectedTemplateId,
            oneTimeMessage,
            previewContactId,
            scheduledAt,
            batchLimit,
            campaignMediaName: campaignMedia?.name || ''
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [audienceMode, batchLimit, campaignMedia, excludedIds, loading, name, oneTimeMessage, previewContactId, scheduledAt, selectedIds, selectedLabels, selectedTemplateId, step]);

    const allLabels = useMemo(() => labelsFromContacts(contacts), [contacts]);
    const filteredContacts = useMemo(() => {
        const term = contactSearch.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(term) ||
            contact.phone.includes(contactSearch) ||
            String(contact.labels || '').toLowerCase().includes(term)
        );
    }, [contacts, contactSearch]);

    const selectedTemplate = templates.find(t => String(t.id) === String(selectedTemplateId));
    const selectedContacts = contacts.filter(c => selectedIds.includes(c.id));
    const excludedContacts = contacts.filter(c => excludedIds.includes(c.id));
    const labelContacts = contacts.filter(contact =>
        selectedLabels.length > 0 &&
        selectedLabels.every(label => String(contact.labels || '').toLowerCase().includes(label.toLowerCase()))
    );
    const csvContacts = csvPreview?.validRows || [];

    const resolvedRecipients = useMemo(() => {
        let base = [];
        if (audienceMode === 'selected_contacts') base = selectedContacts;
        if (audienceMode === 'label_filter') base = labelContacts;
        if (audienceMode === 'all_contacts') base = contacts;
        if (audienceMode === 'csv_upload') base = csvContacts;

        const excluded = new Set(excludedIds);
        const seen = new Set();
        return base.filter(contact => {
            if (contact.id && excluded.has(contact.id)) return false;
            if (!contact.phone || seen.has(contact.phone)) return false;
            seen.add(contact.phone);
            return true;
        });
    }, [audienceMode, contacts, csvContacts, excludedIds, labelContacts, selectedContacts]);

    const optedOutCount = resolvedRecipients.filter(c => c.do_not_message).length;
    const sendableCount = resolvedRecipients.length - optedOutCount;
    const selectedPreviewContact = resolvedRecipients.find(c => String(c.id || c.phone) === String(previewContactId)) || resolvedRecipients[0];
    const messageText = selectedTemplate?.message || oneTimeMessage;
    const mediaInfo = getMediaInfo(selectedTemplate, selectedTemplate ? null : campaignMedia);
    const templateButtons = useMemo(() => {
        try { return JSON.parse(selectedTemplate?.buttons || '[]') || []; } catch (_) { return []; }
    }, [selectedTemplate]);

    const canContinue = [
        !!audienceMode && sendableCount > 0,
        !!messageText.trim(),
        true,
        !!name.trim() && !!messageText.trim() && sendableCount > 0
    ];

    const toggleId = (id, setter, values) => {
        setter(values.includes(id) ? values.filter(v => v !== id) : [...values, id]);
    };

    const handleCsvPreview = async () => {
        if (!csvFile) return toast.error('Choose a CSV file first');
        setPreviewingCsv(true);
        const formData = new FormData();
        formData.append('file', csvFile);
        try {
            const { data } = await api.post('/contacts/csv/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCsvPreview(data);
            setAudienceMode('csv_upload');
            toast.success(`CSV preview ready: ${data.validRows.length} valid rows`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'CSV preview failed');
        } finally {
            setPreviewingCsv(false);
        }
    };

    const buildAudience = () => {
        if (audienceMode === 'selected_contacts') {
            return { type: audienceMode, contactIds: selectedIds, excludeContactIds: excludedIds };
        }
        if (audienceMode === 'label_filter') {
            return { type: audienceMode, labels: selectedLabels, excludeContactIds: excludedIds };
        }
        if (audienceMode === 'all_contacts') {
            return { type: audienceMode, excludeContactIds: excludedIds };
        }
        return { type: audienceMode, contacts: csvContacts };
    };

    const resetBuilder = () => {
        setStep(0);
        setName('');
        setAudienceMode('');
        setSelectedIds([]);
        setExcludedIds([]);
        setSelectedLabels([]);
        setCsvFile(null);
        setCsvPreview(null);
        setSelectedTemplateId('');
        setOneTimeMessage('');
        setCampaignMedia(null);
        setPreviewContactId('');
        setScheduledAt('');
        setBatchLimit(50);
        localStorage.removeItem(DRAFT_KEY);
    };

    const handleSubmit = async () => {
        if (whatsappStatus !== 'ready' && !scheduledAt) {
            return toast.error('Connect WhatsApp before sending now');
        }
        if (!name.trim()) return toast.error('Add a campaign name');
        if (!audienceMode || resolvedRecipients.length === 0) return toast.error('Choose recipients');
        if (!messageText.trim()) return toast.error('Choose a template or write a message');

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            if (selectedTemplateId) formData.append('template_id', selectedTemplateId);
            if (!selectedTemplateId) formData.append('message', oneTimeMessage);
            if (scheduledAt) formData.append('scheduled_at', scheduledAt);
            formData.append('batch_limit', batchLimit);
            formData.append('delay_min_seconds', '20');
            formData.append('delay_max_seconds', '45');
            formData.append('deep_pause_every', '15');
            formData.append('deep_pause_min_minutes', '5');
            formData.append('deep_pause_max_minutes', '10');
            formData.append('send_window_start', '10:00:00');
            formData.append('send_window_end', '20:00:00');
            formData.append('failure_pause_threshold', '10');
            formData.append('audience', JSON.stringify(buildAudience()));
            if (campaignMedia) formData.append('media', campaignMedia);

            const { data } = await api.post('/campaigns', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (!scheduledAt) {
                await api.post(`/campaigns/${data.campaignId}/run`);
                toast.success(`Sending to ${sendableCount} contacts`);
            } else {
                toast.success('Campaign scheduled');
            }
            resetBuilder();
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Campaign failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Delete campaign?',
            message: 'This removes the campaign and its recipient delivery history.',
            confirmLabel: 'Delete',
            danger: true
        });
        if (!ok) return;
        try {
            await api.delete(`/campaigns/${id}`);
            fetchData();
            toast.success('Campaign deleted');
        } catch (_) {
            toast.error('Failed to delete campaign');
        }
    };

    const loadRecipients = async (campaign) => {
        setSelectedCampaign(campaign);
        setLoadingRecipients(true);
        try {
            const { data } = await api.get(`/campaigns/${campaign.id}/recipients`);
            setRecipients(data.recipients || []);
        } catch (_) {
            toast.error('Failed to load recipients');
        } finally {
            setLoadingRecipients(false);
        }
    };

    const retryFailed = async (campaign) => {
        try {
            await api.post(`/campaigns/${campaign.id}/retry-failed`);
            toast.success('Retry started');
            fetchData();
            if (selectedCampaign?.id === campaign.id) loadRecipients(campaign);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Retry failed');
        }
    };

    const exportRecipients = () => {
        const header = ['name', 'phone', 'status', 'error_message', 'sent_at'];
        const lines = recipients.map(row => header.map(key => `"${String(row[key] || '').replace(/"/g, '""')}"`).join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedCampaign?.name || 'campaign'}-recipients.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const StepHeader = () => (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {steps.map((label, index) => (
                    <button
                        key={label}
                        onClick={() => index <= step && setStep(index)}
                        className={`p-4 rounded-xl border text-left transition-all ${step === index ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : index < step ? 'border-emerald-100 bg-white text-gray-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${step === index ? 'bg-emerald-600 text-white' : index < step ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-400'}`}>
                                {index < step ? <CheckCircle2 size={18} /> : index + 1}
                            </span>
                            <div>
                                <p className="font-black">{label}</p>
                                <p className="text-xs font-bold opacity-70 mt-0.5 hidden xl:block">{stepMeta[index].title}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-20 max-w-[1600px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2">Guided send</p>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Send Campaign</h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Choose exact recipients, review everything, then send safely.</p>
                </div>
                <div className={`px-5 py-3 rounded-lg border font-black text-sm ${whatsappStatus === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    WhatsApp: {whatsappStatus === 'ready' ? 'Connected' : 'Disconnected'}
                </div>
            </div>

            <StepHeader />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                <div className="xl:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2">Step {step + 1} of 4</p>
                            <h3 className="text-2xl font-black text-gray-900">{stepMeta[step].title}</h3>
                            <p className="text-sm font-medium text-gray-500 mt-1">{stepMeta[step].detail}</p>
                        </div>
                        <div className="max-w-sm p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Helpful note</p>
                            <p className="text-sm font-bold text-gray-700 mt-1">{stepMeta[step].helper}</p>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {step === 0 && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {audienceOptions.map(({ mode, label, icon: Icon, detail, badge }) => (
                                        <button
                                            type="button"
                                            key={mode}
                                            onClick={() => setAudienceMode(mode)}
                                            className={`p-5 rounded-xl border text-left transition-all ${audienceMode === mode ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-emerald-200 hover:bg-white'}`}
                                        >
                                            <div className="flex justify-between gap-4">
                                                <Icon size={23} />
                                                <span className="px-2 py-1 rounded-lg bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest">{badge}</span>
                                            </div>
                                            <p className="font-black mt-4 text-lg">{label}</p>
                                            <p className="text-sm font-medium opacity-75 mt-1">{detail}</p>
                                        </button>
                                    ))}
                                </div>

                                {!audienceMode && (
                                    <div className="p-5 rounded-xl bg-blue-50 border border-blue-100 flex gap-3">
                                        <Users className="text-blue-600 shrink-0" />
                                        <p className="text-sm font-bold text-blue-800">Choose one audience method to continue. Nothing is selected by default, so the portal never sends to everyone by accident.</p>
                                    </div>
                                )}

                                {(audienceMode === 'selected_contacts' || audienceMode === 'all_contacts') && (
                                    <div className="space-y-4">
                                        {audienceMode === 'all_contacts' && (
                                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3">
                                                <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                                                <p className="text-sm font-bold text-amber-800">All saved contacts is powerful. Review opt-outs and exclusions carefully before continuing.</p>
                                            </div>
                                        )}
                                        <div className="flex flex-col lg:flex-row gap-3">
                                            <div className="relative flex-1">
                                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-medium"
                                                    placeholder="Search name, phone, or label"
                                                    value={contactSearch}
                                                    onChange={e => setContactSearch(e.target.value)}
                                                />
                                            </div>
                                            <button
                                                className="px-4 py-3 rounded-lg border border-gray-200 font-black bg-white"
                                                onClick={() => setSelectedIds(filteredContacts.map(c => c.id))}
                                            >
                                                Select filtered
                                            </button>
                                            <button className="px-4 py-3 rounded-lg border border-gray-200 font-black bg-white" onClick={() => setSelectedIds([])}>
                                                Clear
                                            </button>
                                        </div>
                                        <div className="max-h-[420px] overflow-auto border border-gray-100 rounded-xl">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                                                    <tr>
                                                        <th className="p-4">Send</th>
                                                        <th className="p-4">Contact</th>
                                                        <th className="p-4">Labels</th>
                                                        <th className="p-4">Exclude</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredContacts.length === 0 ? (
                                                        <tr><td colSpan="4" className="p-8 text-center text-gray-500 font-bold">No contacts match this search.</td></tr>
                                                    ) : filteredContacts.map(contact => (
                                                        <tr key={contact.id} className="border-t border-gray-100">
                                                            <td className="p-4">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={audienceMode === 'all_contacts' || selectedIds.includes(contact.id)}
                                                                    disabled={audienceMode === 'all_contacts'}
                                                                    onChange={() => toggleId(contact.id, setSelectedIds, selectedIds)}
                                                                />
                                                            </td>
                                                            <td className="p-4">
                                                                <p className="font-black text-gray-900">{contact.name}</p>
                                                                <p className="text-sm text-gray-500">+{contact.phone}</p>
                                                                {contact.do_not_message ? <p className="text-xs text-red-500 font-bold">Do not message</p> : null}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {String(contact.labels || '').split(',').filter(Boolean).map(label => (
                                                                        <button
                                                                            key={label}
                                                                            className="px-2 py-1 rounded bg-gray-100 text-xs font-bold"
                                                                            onClick={() => {
                                                                                setAudienceMode('label_filter');
                                                                                setSelectedLabels([label.trim()]);
                                                                            }}
                                                                        >
                                                                            {label.trim()}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <button
                                                                    className={`px-3 py-2 rounded-lg text-xs font-black ${excludedIds.includes(contact.id) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}
                                                                    onClick={() => toggleId(contact.id, setExcludedIds, excludedIds)}
                                                                >
                                                                    {excludedIds.includes(contact.id) ? 'Will skip' : 'Skip'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {audienceMode === 'label_filter' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <p className="font-black text-emerald-900">Choose one or more labels</p>
                                            <p className="text-sm font-medium text-emerald-700 mt-1">Labels work like WhatsApp Business labels: VIP, new lead, pending payment, support, and follow-up.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {allLabels.map(label => (
                                                <button
                                                    key={label}
                                                    onClick={() => toggleId(label, setSelectedLabels, selectedLabels)}
                                                    className={`px-3 py-2 rounded-lg border font-bold ${selectedLabels.includes(label) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200 text-gray-600'}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-sm font-medium text-gray-500">{labelContacts.length} contacts match selected labels. Opt-outs are counted and skipped later.</p>
                                    </div>
                                )}

                                {audienceMode === 'csv_upload' && (
                                    <div className="space-y-4">
                                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col md:flex-row gap-4 items-center bg-gray-50">
                                            <Upload className="text-gray-400" />
                                            <div className="flex-1">
                                                <p className="font-black text-gray-900">{csvFile ? csvFile.name : 'Choose a CSV file'}</p>
                                                <p className="text-sm text-gray-500">Required columns: name and phone. Labels, consent, source, and source_detail are optional.</p>
                                            </div>
                                            <input id="campaign-csv" type="file" accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files[0])} />
                                            <label htmlFor="campaign-csv" className="px-4 py-3 rounded-lg border border-gray-200 font-black cursor-pointer">Choose</label>
                                            <button onClick={handleCsvPreview} disabled={!csvFile || previewingCsv} className="px-4 py-3 rounded-lg bg-gray-900 text-white font-black disabled:opacity-50">
                                                {previewingCsv ? 'Previewing...' : 'Preview CSV'}
                                            </button>
                                        </div>
                                        {csvPreview && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                                                    <p className="text-xs font-black text-emerald-700 uppercase">Valid</p>
                                                    <p className="text-3xl font-black">{csvPreview.validRows.length}</p>
                                                </div>
                                                <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                                                    <p className="text-xs font-black text-amber-700 uppercase">Duplicates</p>
                                                    <p className="text-3xl font-black">{csvPreview.duplicateRows.length}</p>
                                                </div>
                                                <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                                                    <p className="text-xs font-black text-red-700 uppercase">Invalid</p>
                                                    <p className="text-3xl font-black">{csvPreview.invalidRows.length}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {step === 1 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <h4 className="font-black text-gray-900">Message templates</h4>
                                        <Link to="/templates" className="text-xs font-black text-emerald-700">Manage templates</Link>
                                    </div>
                                    <div className="space-y-3 max-h-[360px] overflow-auto">
                                        {templates.length === 0 ? (
                                            <div className="p-5 rounded-xl border border-dashed border-gray-200 text-center">
                                                <p className="font-black text-gray-900">No templates yet</p>
                                                <p className="text-sm font-medium text-gray-500 mt-1">Write a one-time message here, or create reusable templates from Message Templates.</p>
                                            </div>
                                        ) : templates.map(template => (
                                            <button
                                                key={template.id}
                                                onClick={() => { setSelectedTemplateId(String(template.id)); setOneTimeMessage(''); }}
                                                className={`w-full p-4 rounded-xl border text-left transition-all ${String(selectedTemplateId) === String(template.id) ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-emerald-100'}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="font-black text-gray-900">{template.name}</p>
                                                    {template.media_url && <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-black">Media</span>}
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-2">{template.message}</p>
                                                {template.buttons && template.buttons !== '[]' && <p className="text-xs font-bold text-amber-700 mt-2">Buttons will be attempted through WhatsApp Web support.</p>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-black text-gray-900">One-time message</h4>
                                    <textarea
                                        value={oneTimeMessage}
                                        onChange={e => { setOneTimeMessage(e.target.value); setSelectedTemplateId(''); }}
                                        className="w-full min-h-[220px] rounded-xl border border-gray-200 bg-gray-50 p-4 font-medium focus:bg-white focus:border-emerald-300 outline-none"
                                        placeholder="Hello {{name}}, ..."
                                    />
                                    <div className="border border-dashed border-gray-200 rounded-lg p-4 flex items-center gap-3">
                                        <Upload className="text-gray-400" size={20} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-gray-900 truncate">{campaignMedia ? campaignMedia.name : 'Attach media to this campaign'}</p>
                                            <p className="text-xs text-gray-500 font-medium">Image, video, or document. Template media is used when a template is selected.</p>
                                        </div>
                                        {campaignMedia && (
                                            <button type="button" onClick={() => setCampaignMedia(null)} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-black">Remove</button>
                                        )}
                                        <label className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-black cursor-pointer">
                                            Upload
                                            <input type="file" className="hidden" onChange={e => setCampaignMedia(e.target.files[0])} />
                                        </label>
                                    </div>
                                    <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100 text-sm font-medium text-indigo-800">
                                        Use <code className="bg-white px-1 rounded">{'{{name}}'}</code> to personalize each message.
                                        {selectedTemplate?.media_url && (
                                            <span className="block mt-2 font-bold">Selected template includes media. It will be sent with the campaign.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2">Campaign name</label>
                                    <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold" placeholder="April follow-up campaign" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2">Send now or schedule</label>
                                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold" />
                                        <p className="text-xs text-gray-500 mt-2">Leave empty to send now.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2">Batch limit</label>
                                        <input type="number" min="1" value={batchLimit} onChange={e => setBatchLimit(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold" />
                                        <p className="text-xs text-gray-500 mt-2">Default 50 for safer first runs.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {[
                                        ['Recipients', sendableCount],
                                        ['Opt-outs skipped', optedOutCount],
                                        ['Estimated time', estimateRuntime(sendableCount)]
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                            <p className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</p>
                                            <p className="font-black text-gray-900 mt-1">{value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-5 rounded-lg bg-amber-50 border border-amber-100 flex gap-3">
                                    <ShieldAlert className="text-amber-600 shrink-0" />
                                    <div>
                                        <p className="font-black text-amber-900">Estimated runtime: {estimateRuntime(sendableCount)}</p>
                                        <p className="text-sm font-medium text-amber-800">Runner waits 20-45 seconds per contact and pauses 5-10 minutes after every 15 messages.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <p className="font-black text-emerald-900">Final check before sending</p>
                                    <p className="text-sm font-medium text-emerald-700 mt-1">This is the client-facing receipt. If anything looks wrong, go back before launching.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-xs font-black uppercase text-gray-400">Recipients</p>
                                        <p className="text-3xl font-black text-gray-900">{sendableCount}</p>
                                        {optedOutCount > 0 && <p className="text-xs text-red-500 font-bold">{optedOutCount} opted out will be skipped</p>}
                                        {resolvedRecipients.length > 0 && sendableCount === 0 && <p className="text-xs text-red-500 font-bold">No sendable contacts selected</p>}
                                    </div>
                                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-xs font-black uppercase text-gray-400">Timing</p>
                                        <p className="font-black text-gray-900">{scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Send now'}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-xs font-black uppercase text-gray-400">WhatsApp</p>
                                        <p className={`font-black ${whatsappStatus === 'ready' ? 'text-emerald-600' : 'text-red-500'}`}>{whatsappStatus === 'ready' ? 'Connected' : 'Disconnected'}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-900 mb-3">Message and media</h4>
                                    <div className="p-4 rounded-xl border border-gray-100 text-sm font-medium text-gray-600 mb-5 space-y-2">
                                        <p><span className="font-black text-gray-900">Message:</span> {selectedTemplate ? `Template: ${selectedTemplate.name}` : 'One-time message'}</p>
                                        <p><span className="font-black text-gray-900">Media:</span> {mediaInfo ? `${mediaInfo.source}: ${mediaInfo.name}` : 'No media attached'}</p>
                                        <p><span className="font-black text-gray-900">Batch limit:</span> {batchLimit}</p>
                                    </div>
                                    <h4 className="font-black text-gray-900 mb-3">First 5 recipients</h4>
                                    <div className="space-y-2">
                                        {resolvedRecipients.slice(0, 5).map(contact => (
                                            <div key={contact.id || contact.phone} className="p-3 rounded-lg border border-gray-100 flex justify-between">
                                                <span className="font-bold text-gray-900">{contact.name || 'Unnamed'}</span>
                                                <span className="text-gray-500">+{contact.phone}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-5 rounded-lg bg-red-50 border border-red-100 flex gap-3">
                                    <AlertTriangle className="text-red-500 shrink-0" />
                                    <p className="text-sm font-medium text-red-700">This uses whatsapp-web.js, an unofficial WhatsApp Web automation path. Send only to expected recipients and keep batches small to reduce restriction risk.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-100 flex justify-between">
                        <button disabled={step === 0} onClick={() => setStep(step - 1)} className="px-5 py-3 rounded-lg border border-gray-200 font-black disabled:opacity-40 flex items-center gap-2">
                            <ChevronLeft size={18} /> Back
                        </button>
                        {step < 3 ? (
                            <button disabled={!canContinue[step]} onClick={() => setStep(step + 1)} className="px-5 py-3 rounded-lg bg-emerald-600 text-white font-black disabled:opacity-40 flex items-center gap-2">
                                Next <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button disabled={submitting || !canContinue[3]} onClick={handleSubmit} className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-black disabled:opacity-40 flex items-center gap-2">
                                {submitting ? <Loader2 className="animate-spin" /> : scheduledAt ? <Calendar size={18} /> : <Send size={18} />}
                                {scheduledAt ? 'Schedule campaign' : `Send to ${sendableCount} contacts`}
                            </button>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6 sticky top-24">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-black text-gray-900">Live summary</h4>
                            <span className="px-2 py-1 rounded-lg bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500">Step {step + 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 rounded-lg bg-gray-50">
                                <p className="text-gray-400 font-black uppercase text-[10px]">Selected</p>
                                <p className="font-black text-gray-900">{resolvedRecipients.length}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50">
                                <p className="text-gray-400 font-black uppercase text-[10px]">Can send</p>
                                <p className="font-black text-gray-900">{sendableCount}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50">
                                <p className="text-gray-400 font-black uppercase text-[10px]">Excluded</p>
                                <p className="font-black text-gray-900">{excludedContacts.length}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50">
                                <p className="text-gray-400 font-black uppercase text-[10px]">Estimate</p>
                                <p className="font-black text-gray-900">{estimateRuntime(sendableCount)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#e5ddd5] rounded-2xl border-8 border-white shadow-xl min-h-[420px] flex flex-col overflow-hidden">
                        <div className="bg-[#075e54] text-white p-4">
                            <p className="font-black">Message preview</p>
                            <select value={previewContactId} onChange={e => setPreviewContactId(e.target.value)} className="mt-2 w-full text-gray-900 rounded-lg px-3 py-2 text-sm">
                                {resolvedRecipients.slice(0, 30).map(contact => (
                                    <option key={contact.id || contact.phone} value={contact.id || contact.phone}>{contact.name || contact.phone}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 p-5 flex items-end justify-end">
                            <div className="bg-white rounded-lg p-4 max-w-[90%] shadow-sm whitespace-pre-wrap text-sm font-medium">
                                {mediaInfo && (
                                    <div className="mb-3 rounded-lg border border-gray-100 overflow-hidden bg-gray-50">
                                        {mediaInfo.url && /\.(png|jpe?g|gif|webp)$/i.test(mediaInfo.name || '') ? (
                                            <img src={mediaInfo.url} alt={mediaInfo.name} className="w-full max-h-56 object-cover" />
                                        ) : (
                                            <div className="p-3 text-xs font-black text-gray-600 flex items-center gap-2">
                                                <Upload size={14} /> {mediaInfo.source}: {mediaInfo.name}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {renderPreview(messageText, selectedPreviewContact) || 'Choose a message to preview.'}
                                {templateButtons.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-gray-100 text-emerald-700 font-black text-xs">
                                        Native WhatsApp buttons will be attempted. Delivery depends on WhatsApp Web support for this account.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-gray-900">Campaign history</h3>
                    <button onClick={fetchData} className="px-4 py-2 rounded-lg border border-gray-200 font-black flex items-center gap-2"><RefreshCw size={16} /> Refresh</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                            <tr>
                                <th className="p-4">Campaign</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Recipients</th>
                                <th className="p-4">Results</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map(campaign => (
                                <tr key={campaign.id} className="border-t border-gray-100">
                                    <td className="p-4">
                                        <p className="font-black text-gray-900">{campaign.name}</p>
                                        <p className="text-xs text-gray-500">{campaign.scheduled_at ? `Scheduled ${new Date(campaign.scheduled_at).toLocaleString()}` : new Date(campaign.created_at).toLocaleDateString()}</p>
                                    </td>
                                    <td className="p-4"><span className="px-3 py-1 rounded-lg bg-gray-100 text-xs font-black uppercase">{campaign.status}</span></td>
                                    <td className="p-4 font-black">{campaign.recipient_count || campaign.total || 0}</td>
                                    <td className="p-4 text-sm font-black">
                                        <span className="text-emerald-600">{campaign.sent_count || campaign.sentCount || 0}</span>
                                        <span className="mx-2 text-gray-300">/</span>
                                        <span className="text-red-500">{campaign.fail_count || campaign.failCount || 0}</span>
                                        <span className="mx-2 text-gray-300">/</span>
                                        <span className="text-amber-500">{campaign.skipped_count || campaign.skippedCount || 0}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/campaigns/${campaign.id}`} className="px-3 py-2 rounded-lg border border-gray-200 font-black text-xs">Details</Link>
                                            {(campaign.fail_count || campaign.failCount || 0) > 0 && (
                                                <button onClick={() => retryFailed(campaign)} className="px-3 py-2 rounded-lg border border-gray-200 font-black text-xs">Retry failed</button>
                                            )}
                                            <button onClick={() => handleDelete(campaign.id)} className="p-2 text-red-500"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!loading && campaigns.length === 0 && <div className="p-10 text-center text-gray-500 font-bold">No campaigns yet.</div>}
                </div>
            </div>

            {selectedCampaign && (
                <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">{selectedCampaign.name}</h3>
                                <p className="text-sm text-gray-500">Recipient delivery details</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={exportRecipients} className="px-4 py-2 rounded-lg border border-gray-200 font-black flex items-center gap-2"><Download size={16} /> Export CSV</button>
                                <button onClick={() => setSelectedCampaign(null)} className="p-2 rounded-lg bg-gray-100"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="overflow-auto">
                            {loadingRecipients ? (
                                <div className="p-10 text-center"><Loader2 className="animate-spin inline-block text-emerald-600" /></div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                                        <tr>
                                            <th className="p-4">Name</th>
                                            <th className="p-4">Phone</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Error</th>
                                            <th className="p-4">Sent at</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recipients.map(row => (
                                            <tr key={row.id} className="border-t border-gray-100">
                                                <td className="p-4 font-bold">{row.name || '-'}</td>
                                                <td className="p-4">+{row.phone}</td>
                                                <td className="p-4"><span className="px-2 py-1 rounded bg-gray-100 text-xs font-black uppercase">{row.status}</span></td>
                                                <td className="p-4 text-sm text-red-500">{row.error_message || '-'}</td>
                                                <td className="p-4 text-sm text-gray-500">{row.sent_at ? new Date(row.sent_at).toLocaleString() : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <Dialog />
        </div>
    );
};

export default Campaigns;
