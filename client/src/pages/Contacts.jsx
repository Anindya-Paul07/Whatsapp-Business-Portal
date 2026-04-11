import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle, CheckCircle, Database, Download, Edit2, FileSpreadsheet,
    Loader2, Plus, Search, Trash2, Upload, UserPlus, Users, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAppDialog } from '../components/AppDialog';

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').replace(/^0+/, '');

const Contacts = () => {
    const navigate = useNavigate();
    const { confirm, prompt, Dialog } = useAppDialog();
    const [contacts, setContacts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [labelFilter, setLabelFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editContact, setEditContact] = useState(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('880');
    const [labels, setLabels] = useState('');
    const [doNotMessage, setDoNotMessage] = useState(false);
    const [consentStatus, setConsentStatus] = useState('unknown');
    const [sourceDetail, setSourceDetail] = useState('');

    const [showImportModal, setShowImportModal] = useState(false);
    const [file, setFile] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [csvPreview, setCsvPreview] = useState(null);
    const fileInputRef = useRef(null);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '1000' });
            if (search) params.set('search', search);
            if (labelFilter) params.set('labels', labelFilter);
            if (statusFilter) params.set('status', statusFilter);
            const { data } = await api.get(`/contacts?${params.toString()}`);
            setContacts(data.contacts || []);
            setTotal(data.total || 0);
        } catch (err) {
            toast.error('Failed to load contacts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchContacts(); }, [search, labelFilter, statusFilter]);

    const allLabels = useMemo(() => {
        const labels = new Set();
        contacts.forEach(contact => {
            String(contact.labels || '').split(',').map(l => l.trim()).filter(Boolean).forEach(l => labels.add(l));
        });
        return Array.from(labels).sort((a, b) => a.localeCompare(b));
    }, [contacts]);

    const selectedContacts = contacts.filter(contact => selectedIds.includes(contact.id));
    const canMessageCount = contacts.filter(contact => !contact.do_not_message).length;

    const resetForm = () => {
        setEditContact(null);
        setName('');
        setPhone('');
        setLabels('');
        setCountryCode('880');
        setDoNotMessage(false);
        setConsentStatus('unknown');
        setSourceDetail('');
    };

    const openAdd = () => {
        resetForm();
        setShowAddModal(true);
    };

    const openEdit = (contact) => {
        setEditContact(contact);
        setName(contact.name);
        setLabels(contact.labels || '');
        setDoNotMessage(!!contact.do_not_message);
        setConsentStatus(contact.consent_status || (contact.do_not_message ? 'do_not_message' : 'unknown'));
        setSourceDetail(contact.source_detail || '');

        let localPhone = contact.phone;
        const codes = ['880', '91', '1', '44', '971', '966', '60', '65'];
        const code = codes.find(c => localPhone.startsWith(c)) || '880';
        setCountryCode(code);
        setPhone(localPhone.startsWith(code) ? localPhone.slice(code.length) : localPhone);
        setShowAddModal(true);
    };

    const saveContact = async (e) => {
        e.preventDefault();
        const cleanedPhone = normalizePhone(phone);
        const fullPhone = `${countryCode}${cleanedPhone}`;
        if (cleanedPhone.length < 6) return toast.error('Phone number looks too short');

        const duplicate = contacts.find(contact => contact.phone === fullPhone && contact.id !== editContact?.id);
        if (duplicate) {
            const ok = await confirm({
                title: 'Duplicate phone number',
                message: `+${fullPhone} is already saved as ${duplicate.name}. Save this contact anyway?`,
                confirmLabel: 'Save anyway'
            });
            if (!ok) return;
        }

        try {
            const payload = {
                name,
                phone: fullPhone,
                labels,
                do_not_message: doNotMessage || consentStatus === 'do_not_message',
                consent_status: doNotMessage ? 'do_not_message' : consentStatus,
                source: editContact?.source || 'manual',
                source_detail: sourceDetail
            };
            if (editContact) {
                await api.put(`/contacts/${editContact.id}`, payload);
                toast.success('Contact updated');
            } else {
                await api.post('/contacts', payload);
                toast.success('Contact added');
            }
            setShowAddModal(false);
            resetForm();
            fetchContacts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save contact');
        }
    };

    const deleteContact = async (id) => {
        const ok = await confirm({
            title: 'Delete contact?',
            message: 'This contact will be removed from your saved contacts.',
            confirmLabel: 'Delete',
            danger: true
        });
        if (!ok) return;
        try {
            await api.delete(`/contacts/${id}`);
            toast.success('Contact deleted');
            fetchContacts();
        } catch (_) {
            toast.error('Failed to delete contact');
        }
    };

    const bulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const ok = await confirm({
            title: `Delete ${selectedIds.length} contacts?`,
            message: 'Selected contacts will be removed from your saved contacts.',
            confirmLabel: 'Delete selected',
            danger: true
        });
        if (!ok) return;
        try {
            await api.post('/contacts/bulk-delete', { contactIds: selectedIds });
            setSelectedIds([]);
            toast.success('Selected contacts deleted');
            fetchContacts();
        } catch (_) {
            toast.error('Bulk delete failed');
        }
    };

    const bulkLabel = async (action) => {
        if (selectedIds.length === 0) return toast.error('Select contacts first');
        const value = await prompt({
            title: action === 'add' ? 'Add labels' : 'Remove labels',
            message: `${selectedIds.length} selected contacts will be updated. Use commas for multiple labels.`,
            placeholder: 'VIP, Follow-up',
            confirmLabel: action === 'add' ? 'Add labels' : 'Remove labels'
        });
        if (!value) return;
        try {
            await api.post('/contacts/bulk-label', { contactIds: selectedIds, labels: value, action });
            toast.success('Labels updated');
            fetchContacts();
        } catch (_) {
            toast.error('Label update failed');
        }
    };

    const bulkConsent = async (consent_status) => {
        if (selectedIds.length === 0) return toast.error('Select contacts first');
        try {
            await api.post('/contacts/bulk-consent', { contactIds: selectedIds, consent_status });
            toast.success(consent_status === 'do_not_message' ? 'Selected contacts opted out' : 'Selected contacts marked can message');
            fetchContacts();
        } catch (_) {
            toast.error('Consent update failed');
        }
    };

    const startCampaignWithSelected = () => {
        localStorage.setItem('campaign_selected_contact_ids', JSON.stringify(selectedIds));
        navigate('/campaigns');
    };

    const previewCsv = async () => {
        if (!file) return toast.error('Choose a CSV file first');
        setPreviewing(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await api.post('/contacts/csv/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCsvPreview(data);
            toast.success('CSV preview ready');
        } catch (err) {
            toast.error(err.response?.data?.message || 'CSV preview failed');
        } finally {
            setPreviewing(false);
        }
    };

    const importCsv = async () => {
        if (!csvPreview?.validRows?.length) return toast.error('No valid rows to import');
        setImporting(true);
        try {
            const { data } = await api.post('/contacts/csv/import', { contacts: csvPreview.validRows });
            toast.success(`Imported ${data.inserted} contacts`);
            setShowImportModal(false);
            setFile(null);
            setCsvPreview(null);
            fetchContacts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    const exportFailedRows = () => {
        const failed = [...(csvPreview?.duplicateRows || []), ...(csvPreview?.invalidRows || [])];
        const header = ['row', 'name', 'phone', 'labels', 'reason'];
        const lines = failed.map(row => header.map(key => `"${String(row[key] || '').replace(/"/g, '""')}"`).join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'contact-import-failed-rows.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const toggleSelected = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    return (
        <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">Customers</p>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Contacts</h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Manage recipients, labels, and opt-outs.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowImportModal(true)} className="px-5 py-3 bg-white border border-gray-200 text-gray-700 font-black rounded-lg hover:border-blue-500 flex items-center gap-2">
                        <Upload size={18} /> Import CSV
                    </button>
                    <button onClick={openAdd} className="px-5 py-3 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <Plus size={20} /> New Contact
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[
                    ['Organize with labels', 'Use labels like VIP, new lead, pending payment, reminder, and support.'],
                    ['Respect consent', 'Unknown consent and do-not-message contacts are visible before every campaign.'],
                    ['Start smaller', 'Select a few contacts or one label before sending to a larger audience.']
                ].map(([title, detail]) => (
                    <div key={title} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <p className="font-black text-gray-900">{title}</p>
                        <p className="text-sm font-medium text-gray-500 mt-1">{detail}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 rounded-lg p-5">
                    <Database className="text-blue-600" />
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-black mt-3">Total contacts</p>
                    <p className="text-3xl font-black text-gray-900">{total}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-5">
                    <CheckCircle className="text-emerald-600" />
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-black mt-3">Can message</p>
                    <p className="text-3xl font-black text-gray-900">{canMessageCount}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-5">
                    <Users className="text-indigo-600" />
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-black mt-3">Selected</p>
                    <p className="text-3xl font-black text-gray-900">{selectedIds.length}</p>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {[
                            ['', 'All'],
                            ['can_message', 'Can message'],
                            ['unknown_consent', 'Unknown consent'],
                            ['do_not_message', 'Do not message']
                        ].map(([value, label]) => (
                            <button
                                key={label}
                                onClick={() => setStatusFilter(value)}
                                className={`px-4 py-2 rounded-lg text-xs font-black border ${statusFilter === value ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-600'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col xl:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-medium" placeholder="Search by name, phone, or label" />
                        </div>
                        <button onClick={() => setSelectedIds(contacts.map(c => c.id))} className="px-4 py-3 rounded-lg border border-gray-200 font-black">Select filtered</button>
                        <button onClick={() => setSelectedIds([])} className="px-4 py-3 rounded-lg border border-gray-200 font-black">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {allLabels.map(label => (
                            <button key={label} onClick={() => setLabelFilter(labelFilter === label ? '' : label)} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${labelFilter === label ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {selectedIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <button onClick={startCampaignWithSelected} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-black">Start campaign with selected</button>
                            <button onClick={() => bulkLabel('add')} className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-xs font-black">Add label</button>
                            <button onClick={() => bulkLabel('remove')} className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-xs font-black">Remove label</button>
                            <button onClick={() => bulkConsent('can_message')} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-black">Bulk opt-in</button>
                            <button onClick={() => bulkConsent('do_not_message')} className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-black">Bulk opt-out</button>
                            <button onClick={bulkDelete} className="px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-black">Delete selected</button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-widest text-gray-400">
                            <tr>
                                <th className="px-5 py-4"><input type="checkbox" checked={contacts.length > 0 && selectedIds.length === contacts.length} onChange={e => setSelectedIds(e.target.checked ? contacts.map(c => c.id) : [])} /></th>
                                <th className="px-5 py-4">Contact</th>
                                <th className="px-5 py-4">Labels</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4">Source</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="py-20 text-center"><Loader2 className="animate-spin inline-block text-blue-500" /></td></tr>
                            ) : contacts.length === 0 ? (
                                <tr><td colSpan="6" className="py-20 text-center text-gray-500 font-bold">No contacts found.</td></tr>
                            ) : contacts.map(contact => (
                                <tr key={contact.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(contact.id)} onChange={() => toggleSelected(contact.id)} /></td>
                                    <td className="px-5 py-4">
                                        <p className="font-black text-gray-900">{contact.name}</p>
                                        <p className="text-sm text-gray-500">+{contact.phone}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-wrap gap-2">
                                            {String(contact.labels || '').split(',').filter(Boolean).map(label => (
                                                <button key={label} onClick={() => setLabelFilter(label.trim())} className="px-2 py-1 rounded bg-gray-100 text-xs font-bold text-gray-600">{label.trim()}</button>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-black ${contact.do_not_message ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {contact.do_not_message ? 'Do not message' : (contact.consent_status === 'can_message' ? 'Can message' : 'Unknown consent')}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-sm font-bold text-gray-500">
                                        <p>{String(contact.source || 'manual').replace('_', ' ')}</p>
                                        {contact.source_detail && <p className="text-xs text-gray-400">{contact.source_detail}</p>}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEdit(contact)} className="p-2 rounded-lg border border-gray-200 text-gray-600"><Edit2 size={16} /></button>
                                            <button onClick={() => deleteContact(contact.id)} className="p-2 rounded-lg border border-gray-200 text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">{editContact ? <Edit2 /> : <UserPlus />} {editContact ? 'Edit contact' : 'New contact'}</h3>
                            <button onClick={() => setShowAddModal(false)}><X /></button>
                        </div>
                        <form onSubmit={saveContact} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-black mb-2">Name</label>
                                <input value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-bold" />
                            </div>
                            <div>
                                <label className="block text-sm font-black mb-2">WhatsApp number</label>
                                <div className="flex gap-2">
                                    <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="w-32 px-3 py-3 rounded-lg border border-gray-200 bg-gray-50 font-bold">
                                        <option value="880">BD +880</option>
                                        <option value="91">IN +91</option>
                                        <option value="1">US +1</option>
                                        <option value="44">UK +44</option>
                                        <option value="971">UAE +971</option>
                                        <option value="966">KSA +966</option>
                                        <option value="60">MY +60</option>
                                        <option value="65">SG +65</option>
                                    </select>
                                    <input value={phone} onChange={e => setPhone(e.target.value)} required className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-bold" />
                                </div>
                                <p className="text-xs text-emerald-700 font-bold mt-2">Normalized number: +{countryCode}{normalizePhone(phone) || '...'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-black mb-2">Labels</label>
                                <input value={labels} onChange={e => setLabels(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-bold" placeholder="VIP, Follow-up" />
                            </div>
                            <div>
                                <label className="block text-sm font-black mb-2">Consent status</label>
                                <select value={consentStatus} onChange={e => { setConsentStatus(e.target.value); setDoNotMessage(e.target.value === 'do_not_message'); }} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-bold">
                                    <option value="unknown">Unknown consent</option>
                                    <option value="can_message">Can message</option>
                                    <option value="do_not_message">Do not message</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-black mb-2">Source detail</label>
                                <input value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 font-bold" placeholder="Website lead, showroom visit, support chat" />
                            </div>
                            <label className="flex gap-3 items-center p-4 rounded-lg bg-red-50 border border-red-100 text-red-700 font-bold">
                                <input type="checkbox" checked={doNotMessage} onChange={e => { setDoNotMessage(e.target.checked); if (e.target.checked) setConsentStatus('do_not_message'); }} />
                                Do not message this contact
                            </label>
                            <div className="flex gap-3 pt-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-5 py-3 rounded-lg border border-gray-200 font-black">Cancel</button>
                                <button type="submit" className="flex-1 px-5 py-3 rounded-lg bg-blue-600 text-white font-black">{editContact ? 'Save changes' : 'Create contact'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showImportModal && (
                <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2"><FileSpreadsheet /> Import CSV</h3>
                            <button onClick={() => setShowImportModal(false)}><X /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer bg-gray-50">
                                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => { setFile(e.target.files[0]); setCsvPreview(null); }} />
                                <FileSpreadsheet className="mx-auto text-gray-400 mb-3" size={42} />
                                <p className="font-black text-gray-900">{file ? file.name : 'Choose a CSV file'}</p>
                                <p className="text-sm text-gray-500 mt-1">Headers: name, phone, labels, consent, source, source_detail. The preview flags duplicates and invalid numbers before import.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={previewCsv} disabled={!file || previewing} className="px-5 py-3 rounded-lg bg-gray-900 text-white font-black disabled:opacity-50">{previewing ? 'Previewing...' : 'Preview CSV'}</button>
                                {csvPreview && <button onClick={importCsv} disabled={importing || csvPreview.validRows.length === 0} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-black disabled:opacity-50">{importing ? 'Importing...' : `Import ${csvPreview.validRows.length} valid rows`}</button>}
                            </div>
                            {csvPreview && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100"><p className="text-xs font-black text-emerald-700 uppercase">Valid</p><p className="text-3xl font-black">{csvPreview.validRows.length}</p></div>
                                        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100"><p className="text-xs font-black text-amber-700 uppercase">Duplicates</p><p className="text-3xl font-black">{csvPreview.duplicateRows.length}</p></div>
                                        <div className="p-4 rounded-lg bg-red-50 border border-red-100"><p className="text-xs font-black text-red-700 uppercase">Invalid</p><p className="text-3xl font-black">{csvPreview.invalidRows.length}</p></div>
                                    </div>
                                    {(csvPreview.duplicateRows.length > 0 || csvPreview.invalidRows.length > 0) && (
                                        <button onClick={exportFailedRows} className="px-4 py-2 rounded-lg border border-gray-200 font-black flex items-center gap-2"><Download size={16} /> Download failed rows</button>
                                    )}
                                    <div className="max-h-52 overflow-auto border border-gray-100 rounded-lg">
                                        {[...(csvPreview.duplicateRows || []), ...(csvPreview.invalidRows || [])].slice(0, 20).map(row => (
                                            <div key={`${row.row}-${row.phone}`} className="p-3 border-b border-gray-100 flex gap-3 text-sm">
                                                <AlertCircle className="text-red-500 shrink-0" size={18} />
                                                <span className="font-bold">Row {row.row}</span>
                                                <span>{row.name}</span>
                                                <span>+{row.phone}</span>
                                                <span className="text-red-500">{row.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <Dialog />
        </div>
    );
};

export default Contacts;
