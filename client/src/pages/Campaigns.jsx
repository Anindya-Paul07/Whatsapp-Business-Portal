import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle, Calendar, CheckCircle2, ChevronLeft, Loader2,
    Search, Send, ShieldAlert, Upload, X
} from 'lucide-react';
import api from '../utils/api';
import { useApp } from '../AppContext';
import toast from 'react-hot-toast';

const DRAFT_KEY = 'campaign_draft_v1';
const steps = ['Campaign', 'Audience', 'Message', 'Review'];

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

const estimateRuntime = (count) => {
    if (!count) return '0 minutes';
    const normalSeconds = count * 33;
    const pauseSeconds = Math.floor(count / 15) * 450;
    const total = normalSeconds + pauseSeconds;
    if (total < 60) return `${Math.ceil(total)} seconds`;
    if (total < 3600) return `${Math.ceil(total / 60)} minutes`;
    return `${Math.ceil(total / 3600)} hours`;
};

const Campaigns = () => {
    const navigate = useNavigate();
    const { whatsappStatus } = useApp();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(0);

    const [templates, setTemplates] = useState([]);
    const [contacts, setContacts] = useState([]);

    const [name, setName] = useState('');
    const [sendMode, setSendMode] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');

    const [audienceMode, setAudienceMode] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedLabels, setSelectedLabels] = useState([]);
    const [excludedIds, setExcludedIds] = useState([]);
    const [csvPreview, setCsvPreview] = useState(null);
    const [csvFile, setCsvFile] = useState(null);
    const [previewingCsv, setPreviewingCsv] = useState(false);

    const [templateSearch, setTemplateSearch] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [oneTimeMessage, setOneTimeMessage] = useState('');
    const [campaignMedia, setCampaignMedia] = useState(null);
    const [previewContactId, setPreviewContactId] = useState('');

    const [audiencePicker, setAudiencePicker] = useState('');
    const [contactSearch, setContactSearch] = useState('');
    const lastAdvancedConfigRef = useRef('');
    const lastAdvancedMessageRef = useRef('');
    const currentConfigToken = `${name}|${sendMode}|${scheduledAt}`;
    const currentMessageToken = `${selectedTemplateId}|${oneTimeMessage}`;

    const fetchData = async () => {
        setLoading(true);
        try {
            const [templateRes, contactRes] = await Promise.all([
                api.get('/templates'),
                api.get('/contacts?limit=1000')
            ]);
            const loadedTemplates = templateRes.data.templates || [];
            const loadedContacts = contactRes.data.contacts || [];
            setTemplates(loadedTemplates);
            setContacts(loadedContacts);

            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (draft) {
                setStep(draft.step || 0);
                setName(draft.name || '');
                setSendMode(draft.sendMode || '');
                setScheduledAt(draft.scheduledAt || '');
                setAudienceMode(draft.audienceMode || '');
                setSelectedIds(Array.isArray(draft.selectedIds) ? draft.selectedIds.filter(id => loadedContacts.some(c => c.id === id)) : []);
                setSelectedLabels(Array.isArray(draft.selectedLabels) ? draft.selectedLabels : []);
                setExcludedIds(Array.isArray(draft.excludedIds) ? draft.excludedIds : []);
                setCsvPreview(draft.csvPreview || null);
                setSelectedTemplateId(draft.selectedTemplateId || '');
                setOneTimeMessage(draft.oneTimeMessage || '');
                setTemplateSearch(draft.templateSearch || '');
                setPreviewContactId(draft.previewContactId || '');
            }

            const storedIds = JSON.parse(localStorage.getItem('campaign_selected_contact_ids') || '[]');
            if (storedIds.length > 0) {
                setAudienceMode('selected_contacts');
                setSelectedIds(storedIds.filter(id => loadedContacts.some(contact => contact.id === id)));
                setStep(2);
                localStorage.removeItem('campaign_selected_contact_ids');
            }
            const storedTemplateId = localStorage.getItem('campaign_selected_template_id');
            if (storedTemplateId) {
                setSelectedTemplateId(storedTemplateId);
                setOneTimeMessage('');
                localStorage.removeItem('campaign_selected_template_id');
            }
        } catch (_) {
            toast.error('Failed to load campaign data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (loading) return;
        const hasContent = name || sendMode || scheduledAt || audienceMode || selectedIds.length || selectedLabels.length || oneTimeMessage || selectedTemplateId || csvPreview || campaignMedia;
        if (!hasContent) {
            localStorage.removeItem(DRAFT_KEY);
            return;
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            step,
            name,
            sendMode,
            scheduledAt,
            audienceMode,
            selectedIds,
            selectedLabels,
            excludedIds,
            csvPreview,
            selectedTemplateId,
            oneTimeMessage,
            templateSearch,
            previewContactId,
            campaignMediaName: campaignMedia?.name || ''
        }));
    }, [
        audienceMode, campaignMedia, csvPreview, excludedIds, loading, name, oneTimeMessage, previewContactId, scheduledAt,
        selectedIds, selectedLabels, selectedTemplateId, sendMode, step, templateSearch
    ]);

    const allLabels = useMemo(() => labelsFromContacts(contacts), [contacts]);
    const filteredContacts = useMemo(() => {
        const term = contactSearch.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(term) ||
            contact.phone.includes(contactSearch) ||
            String(contact.labels || '').toLowerCase().includes(term)
        );
    }, [contactSearch, contacts]);

    const selectedTemplate = templates.find(t => String(t.id) === String(selectedTemplateId));
    const selectedContacts = contacts.filter(c => selectedIds.includes(c.id));
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
    const sendableCount = Math.max(resolvedRecipients.length - optedOutCount, 0);
    const selectedPreviewContact = resolvedRecipients.find(c => String(c.id || c.phone) === String(previewContactId)) || resolvedRecipients[0];
    const messageText = selectedTemplate?.message || oneTimeMessage;
    const mediaInfo = getMediaInfo(selectedTemplate, selectedTemplate ? null : campaignMedia);
    const templateButtons = useMemo(() => {
        try { return JSON.parse(selectedTemplate?.buttons || '[]') || []; } catch (_) { return []; }
    }, [selectedTemplate]);

    const templateOptions = useMemo(() => {
        const term = templateSearch.toLowerCase().trim();
        if (!term) return templates;
        return templates.filter(template =>
            String(template.name || '').toLowerCase().includes(term) ||
            String(template.message || '').toLowerCase().includes(term)
        );
    }, [templateSearch, templates]);

    const buildAudience = () => {
        if (audienceMode === 'selected_contacts') return { type: audienceMode, contactIds: selectedIds, excludeContactIds: excludedIds };
        if (audienceMode === 'label_filter') return { type: audienceMode, labels: selectedLabels, excludeContactIds: excludedIds };
        if (audienceMode === 'all_contacts') return { type: audienceMode, excludeContactIds: excludedIds };
        return { type: audienceMode, contacts: csvContacts };
    };

    useEffect(() => {
        if (step !== 0) return;
        const configToken = `${name}|${sendMode}|${scheduledAt}`;
        const valid = name.trim() && (sendMode === 'now' || (sendMode === 'schedule' && scheduledAt));
        if (valid && configToken !== lastAdvancedConfigRef.current) {
            const timer = setTimeout(() => setStep(1), 180);
            lastAdvancedConfigRef.current = configToken;
            return () => clearTimeout(timer);
        }
    }, [name, scheduledAt, sendMode, step]);

    useEffect(() => {
        if (step !== 2) return;
        const messageToken = `${selectedTemplateId}|${oneTimeMessage}`;
        if (messageText.trim() && messageToken !== lastAdvancedMessageRef.current) {
            const timer = setTimeout(() => setStep(3), 180);
            lastAdvancedMessageRef.current = messageToken;
            return () => clearTimeout(timer);
        }
    }, [messageText, oneTimeMessage, selectedTemplateId, step]);

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
            toast.success(`CSV preview ready: ${data.validRows.length} valid rows`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'CSV preview failed');
        } finally {
            setPreviewingCsv(false);
        }
    };

    const resetBuilder = () => {
        setStep(0);
        setName('');
        setSendMode('');
        setScheduledAt('');
        setAudienceMode('');
        setSelectedIds([]);
        setSelectedLabels([]);
        setExcludedIds([]);
        setCsvPreview(null);
        setCsvFile(null);
        setSelectedTemplateId('');
        setOneTimeMessage('');
        setCampaignMedia(null);
        setTemplateSearch('');
        setPreviewContactId('');
        lastAdvancedConfigRef.current = '';
        lastAdvancedMessageRef.current = '';
        localStorage.removeItem(DRAFT_KEY);
    };

    const handleSubmit = async () => {
        if (whatsappStatus !== 'ready' && sendMode === 'now') {
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
            if (sendMode === 'schedule') formData.append('scheduled_at', scheduledAt);
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

            if (sendMode === 'now') {
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

    const openAudiencePicker = (mode) => {
        if (!mode) return;
        if (mode === 'all_contacts') {
            setAudienceMode('all_contacts');
            setStep(2);
            return;
        }
        setAudiencePicker(mode);
    };

    const saveAudienceFromModal = () => {
        if (audiencePicker === 'selected_contacts' && selectedIds.length === 0) return toast.error('Select at least one contact');
        if (audiencePicker === 'label_filter' && selectedLabels.length === 0) return toast.error('Select at least one label');
        if (audiencePicker === 'csv_upload' && (csvPreview?.validRows?.length || 0) === 0) return toast.error('Preview and confirm a CSV first');
        setAudienceMode(audiencePicker);
        setAudiencePicker('');
        setStep(2);
    };

    const navigateToStep = (targetStep) => {
        if (targetStep > step) return;
        if (targetStep === 0) {
            lastAdvancedConfigRef.current = currentConfigToken;
        }
        if (targetStep === 2) {
            lastAdvancedMessageRef.current = currentMessageToken;
        }
        setStep(targetStep);
    };

    if (loading) {
        return (
            <div className="max-w-[1400px] mx-auto py-20 text-center">
                <Loader2 className="animate-spin inline-block text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 max-w-[1600px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2">Guided send</p>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Send Campaign</h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">A cleaner step flow: campaign setup, audience, message, then review.</p>
                </div>
                <div className={`px-5 py-3 rounded-lg border font-black text-sm ${whatsappStatus === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    WhatsApp: {whatsappStatus === 'ready' ? 'Connected' : 'Disconnected'}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {steps.map((label, index) => (
                        <button
                            key={label}
                            onClick={() => navigateToStep(index)}
                            className={`p-4 rounded-xl border text-left transition-all ${step === index ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : index < step ? 'border-emerald-100 bg-white text-gray-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${step === index ? 'bg-emerald-600 text-white' : index < step ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-400'}`}>
                                    {index < step ? <CheckCircle2 size={17} /> : index + 1}
                                </span>
                                <p className="font-black">{label}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2">Step {step + 1} of 4</p>
                        <h3 className="text-2xl font-black text-gray-900">{steps[step]}</h3>
                    </div>

                    <div className="p-6 space-y-6">
                        {step === 0 && (
                            <>
                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2">Campaign name</label>
                                    <input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold"
                                        placeholder="April follow-up campaign"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setSendMode('now')}
                                        className={`p-4 rounded-lg border text-left font-black ${sendMode === 'now' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-700'}`}
                                    >
                                        Send now
                                    </button>
                                    <button
                                        onClick={() => setSendMode('schedule')}
                                        className={`p-4 rounded-lg border text-left font-black ${sendMode === 'schedule' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-700'}`}
                                    >
                                        Schedule
                                    </button>
                                </div>
                                {sendMode === 'schedule' && (
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2">Schedule time</label>
                                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold" />
                                    </div>
                                )}
                                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 text-sm font-bold text-blue-800">
                                    This step moves automatically once campaign name and send mode are complete.
                                </div>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2">Audience type</label>
                                    <select
                                        value={audienceMode}
                                        onChange={e => openAudiencePicker(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold"
                                    >
                                        <option value="">Select audience method</option>
                                        <option value="selected_contacts">Select individual contacts</option>
                                        <option value="label_filter">Use labels</option>
                                        <option value="csv_upload">Upload CSV list</option>
                                        <option value="all_contacts">All saved contacts</option>
                                    </select>
                                </div>
                                {!audienceMode && (
                                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 text-sm font-bold text-blue-800">
                                        Select an audience method. If a modal opens, confirm there and this step will move automatically.
                                    </div>
                                )}
                                {audienceMode && (
                                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 text-sm font-bold text-emerald-800">
                                        Audience ready: {audienceMode.replace('_', ' ')}. Recipients selected: {resolvedRecipients.length}, sendable: {sendableCount}, opted out: {optedOutCount}.
                                    </div>
                                )}
                            </>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2">Find template</label>
                                        <input
                                            value={templateSearch}
                                            onChange={e => setTemplateSearch(e.target.value)}
                                            placeholder="Search templates"
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2">Template</label>
                                        <select
                                            value={selectedTemplateId}
                                            onChange={e => { setSelectedTemplateId(e.target.value); if (e.target.value) setOneTimeMessage(''); }}
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-bold"
                                        >
                                            <option value="">No template (one-time message)</option>
                                            {templateOptions.map(template => (
                                                <option key={template.id} value={template.id}>{template.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2">One-time message (optional if template selected)</label>
                                    <textarea
                                        value={oneTimeMessage}
                                        onChange={e => { setOneTimeMessage(e.target.value); if (e.target.value.trim()) setSelectedTemplateId(''); }}
                                        className="w-full min-h-[220px] rounded-lg border border-gray-200 bg-gray-50 p-4 font-medium"
                                        placeholder="Hello {{name}}, ..."
                                    />
                                </div>
                                <div className="border border-dashed border-gray-200 rounded-lg p-4 flex items-center gap-3">
                                    <Upload className="text-gray-400" size={20} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-gray-900 truncate">{campaignMedia ? campaignMedia.name : 'Attach media to this campaign'}</p>
                                        <p className="text-xs text-gray-500 font-medium">Template media is used when a template is selected.</p>
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
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-xs font-black uppercase text-gray-400">Recipients</p>
                                        <p className="text-3xl font-black text-gray-900">{sendableCount}</p>
                                        {optedOutCount > 0 && <p className="text-xs text-red-500 font-bold">{optedOutCount} opted out will be skipped</p>}
                                    </div>
                                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-xs font-black uppercase text-gray-400">Timing</p>
                                        <p className="font-black text-gray-900">{sendMode === 'schedule' ? new Date(scheduledAt).toLocaleString() : 'Send now'}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-xs font-black uppercase text-gray-400">Estimate</p>
                                        <p className="font-black text-gray-900">{estimateRuntime(sendableCount)}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-900 mb-3">Message and media</h4>
                                    <div className="p-4 rounded-xl border border-gray-100 text-sm font-medium text-gray-600 mb-5 space-y-2">
                                        <p><span className="font-black text-gray-900">Message:</span> {selectedTemplate ? `Template: ${selectedTemplate.name}` : 'One-time message'}</p>
                                        <p><span className="font-black text-gray-900">Media:</span> {mediaInfo ? `${mediaInfo.source}: ${mediaInfo.name}` : 'No media attached'}</p>
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
                                <div className="p-5 rounded-lg bg-amber-50 border border-amber-100 flex gap-3">
                                    <ShieldAlert className="text-amber-600 shrink-0" />
                                    <div>
                                        <p className="font-black text-amber-900">Estimated runtime: {estimateRuntime(sendableCount)}</p>
                                        <p className="text-sm font-medium text-amber-800">Runner waits 20-45 seconds per contact and pauses after every 15 messages.</p>
                                    </div>
                                </div>
                                <div className="p-5 rounded-lg bg-red-50 border border-red-100 flex gap-3">
                                    <AlertTriangle className="text-red-500 shrink-0" />
                                    <p className="text-sm font-medium text-red-700">This uses whatsapp-web.js, an unofficial automation path. Send only to expected recipients and keep runs controlled.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-100 flex justify-between">
                        <button
                            disabled={step === 0}
                            onClick={() => {
                                if (step === 1) lastAdvancedConfigRef.current = currentConfigToken;
                                if (step === 3) lastAdvancedMessageRef.current = currentMessageToken;
                                setStep(prev => Math.max(prev - 1, 0));
                            }}
                            className="px-5 py-3 rounded-lg border border-gray-200 font-black disabled:opacity-40 flex items-center gap-2"
                        >
                            <ChevronLeft size={18} /> Back
                        </button>
                        {step === 3 ? (
                            <button disabled={submitting || !sendableCount || !messageText.trim()} onClick={handleSubmit} className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-black disabled:opacity-40 flex items-center gap-2">
                                {submitting ? <Loader2 className="animate-spin" /> : sendMode === 'schedule' ? <Calendar size={18} /> : <Send size={18} />}
                                {sendMode === 'schedule' ? 'Schedule campaign' : `Send to ${sendableCount} contacts`}
                            </button>
                        ) : (
                            <p className="text-sm font-bold text-gray-500 self-center">Steps 1 to 3 move automatically after required fields are complete.</p>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6 sticky top-24">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-black text-gray-900">Live summary</h4>
                            <Link to="/campaign-history" className="text-xs font-black text-emerald-700">Open history</Link>
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
                                <p className="text-gray-400 font-black uppercase text-[10px]">Opted out</p>
                                <p className="font-black text-gray-900">{optedOutCount}</p>
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

            {audiencePicker && (
                <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">
                                    {audiencePicker === 'selected_contacts' && 'Select contacts'}
                                    {audiencePicker === 'label_filter' && 'Select labels'}
                                    {audiencePicker === 'csv_upload' && 'Upload and preview CSV'}
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">
                                    {audiencePicker === 'selected_contacts' && 'Pick exact recipients for this campaign.'}
                                    {audiencePicker === 'label_filter' && 'Choose one or more labels to target.'}
                                    {audiencePicker === 'csv_upload' && 'Preview contacts before using this temporary audience.'}
                                </p>
                            </div>
                            <button onClick={() => setAudiencePicker('')} className="p-2 rounded-lg bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-5 max-h-[70vh] overflow-auto">
                            {audiencePicker === 'selected_contacts' && (
                                <>
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-medium"
                                                placeholder="Search name, phone, or label"
                                                value={contactSearch}
                                                onChange={e => setContactSearch(e.target.value)}
                                            />
                                        </div>
                                        <button className="px-4 py-3 rounded-lg border border-gray-200 font-black" onClick={() => setSelectedIds(filteredContacts.map(c => c.id))}>Select filtered</button>
                                        <button className="px-4 py-3 rounded-lg border border-gray-200 font-black" onClick={() => setSelectedIds([])}>Clear</button>
                                    </div>
                                    <div className="max-h-[420px] overflow-auto border border-gray-100 rounded-lg">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                                                <tr>
                                                    <th className="p-4">Use</th>
                                                    <th className="p-4">Contact</th>
                                                    <th className="p-4">Exclude</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredContacts.map(contact => (
                                                    <tr key={contact.id} className="border-t border-gray-100">
                                                        <td className="p-4"><input type="checkbox" checked={selectedIds.includes(contact.id)} onChange={() => setSelectedIds(prev => prev.includes(contact.id) ? prev.filter(v => v !== contact.id) : [...prev, contact.id])} /></td>
                                                        <td className="p-4">
                                                            <p className="font-black text-gray-900">{contact.name}</p>
                                                            <p className="text-sm text-gray-500">+{contact.phone}</p>
                                                        </td>
                                                        <td className="p-4">
                                                            <button
                                                                className={`px-3 py-2 rounded-lg text-xs font-black ${excludedIds.includes(contact.id) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}
                                                                onClick={() => setExcludedIds(prev => prev.includes(contact.id) ? prev.filter(v => v !== contact.id) : [...prev, contact.id])}
                                                            >
                                                                {excludedIds.includes(contact.id) ? 'Will skip' : 'Skip'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {audiencePicker === 'label_filter' && (
                                <div className="flex flex-wrap gap-2">
                                    {allLabels.map(label => (
                                        <button
                                            key={label}
                                            onClick={() => setSelectedLabels(prev => prev.includes(label) ? prev.filter(v => v !== label) : [...prev, label])}
                                            className={`px-3 py-2 rounded-lg border font-bold ${selectedLabels.includes(label) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200 text-gray-600'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {audiencePicker === 'csv_upload' && (
                                <>
                                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col md:flex-row gap-4 items-center bg-gray-50">
                                        <Upload className="text-gray-400" />
                                        <div className="flex-1">
                                            <p className="font-black text-gray-900">{csvFile ? csvFile.name : 'Choose a CSV file'}</p>
                                            <p className="text-sm text-gray-500">Required columns: name and phone. Optional: labels, consent, source, source_detail.</p>
                                        </div>
                                        <input id="campaign-csv-dialog" type="file" accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files[0])} />
                                        <label htmlFor="campaign-csv-dialog" className="px-4 py-3 rounded-lg border border-gray-200 font-black cursor-pointer">Choose</label>
                                        <button onClick={handleCsvPreview} disabled={!csvFile || previewingCsv} className="px-4 py-3 rounded-lg bg-gray-900 text-white font-black disabled:opacity-50">
                                            {previewingCsv ? 'Previewing...' : 'Preview CSV'}
                                        </button>
                                    </div>
                                    {csvPreview && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100"><p className="text-xs font-black text-emerald-700 uppercase">Valid</p><p className="text-3xl font-black">{csvPreview.validRows.length}</p></div>
                                            <div className="p-4 rounded-lg bg-amber-50 border border-amber-100"><p className="text-xs font-black text-amber-700 uppercase">Duplicates</p><p className="text-3xl font-black">{csvPreview.duplicateRows.length}</p></div>
                                            <div className="p-4 rounded-lg bg-red-50 border border-red-100"><p className="text-xs font-black text-red-700 uppercase">Invalid</p><p className="text-3xl font-black">{csvPreview.invalidRows.length}</p></div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setAudiencePicker('')} className="px-5 py-3 rounded-lg border border-gray-200 font-black">Cancel</button>
                            <button onClick={saveAudienceFromModal} className="px-5 py-3 rounded-lg bg-emerald-600 text-white font-black">Confirm and continue</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Campaigns;
