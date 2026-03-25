import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Upload, Search, UserPlus, X, FileSpreadsheet,
    CheckCircle, AlertCircle, Loader2, Edit2, Trash2, Users, Database
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Create/Edit Modal State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('880');
    const [labels, setLabels] = useState('');
    const [editContact, setEditContact] = useState(null);

    // Import State
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const fileInputRef = useRef(null);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/contacts');
            setContacts(data.contacts || []);
        } catch (err) {
            toast.error('Failed to load contacts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    const handleOpenAdd = () => {
        setEditContact(null);
        setName(''); setPhone(''); setLabels(''); setCountryCode('880');
        setShowAddModal(true);
    };

    const handleOpenEdit = (contact) => {
        setEditContact(contact);
        setName(contact.name);
        setLabels(contact.labels || '');

        let p = contact.phone;
        const codes = ['880', '91', '1', '44', '971', '966', '60', '65'];
        let detectedCode = '880';
        for (const code of codes) {
            if (p.startsWith(code)) {
                detectedCode = code;
                p = p.substring(code.length);
                break;
            }
        }
        setCountryCode(detectedCode);
        setPhone(p);
        setShowAddModal(true);
    };

    const handleAddContact = async (e) => {
        e.preventDefault();
        try {
            let cleanedPhone = phone.replace(/\D/g, '');
            if (cleanedPhone.startsWith('0')) {
                cleanedPhone = cleanedPhone.substring(1);
            }
            const fullPhone = countryCode + cleanedPhone;

            if (editContact) {
                await api.put(`/contacts/${editContact.id}`, { name, phone: fullPhone, labels });
                toast.success('Contact updated');
            } else {
                await api.post('/contacts', { name, phone: fullPhone, labels });
                toast.success('Contact added successfully');
            }

            setShowAddModal(false);
            setName(''); setPhone(''); setLabels('');
            setEditContact(null);
            fetchContacts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed');
        }
    };

    const handleDeleteContact = async (id) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
        try {
            await api.delete(`/contacts/${id}`);
            toast.success('Contact deleted');
            fetchContacts();
        } catch (err) {
            toast.error('Failed to delete contact');
        }
    };

    const handleImportCSV = async () => {
        if (!file) return;
        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await api.post('/contacts/csv', formData);
            setImportResult(data);
            toast.success('Import completed');
            fetchContacts();
        } catch (err) {
            toast.error('Import failed');
        } finally {
            setImporting(false);
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
    );

    return (
        <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Audience <span className="text-blue-600">Hub</span></h2>
                    <p className="text-gray-500 font-medium text-lg mt-1">Manage segments and powerful contact lists</p>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setShowImportModal(true)} className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:border-blue-500 hover:text-blue-600 hover:shadow-md transition-all flex items-center gap-2 group">
                        <Upload size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                        <span>Mass Import</span>
                    </button>
                    <button onClick={handleOpenAdd} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 transform hover:-translate-y-1">
                        <Plus size={20} />
                        <span>New Contact</span>
                    </button>
                </div>
            </div>

            {/* Main Data Card */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

                <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-3 w-full md:w-96 relative">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium placeholder-gray-400 shadow-sm"
                            placeholder="Search by name or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-100">
                        <Database size={18} className="text-indigo-500" />
                        <p className="text-sm font-bold text-gray-600">
                            Total Size: <span className="text-indigo-600 text-lg ml-1">{filteredContacts.length}</span>
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
                                <th className="px-8 py-5">Profile</th>
                                <th className="px-6 py-5">Phone Number</th>
                                <th className="px-6 py-5">Segments & Labels</th>
                                <th className="px-6 py-5">Origin</th>
                                <th className="px-8 py-5 text-right">Settings</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-24 text-center">
                                        <Loader2 className="animate-spin inline-block text-blue-500" size={40} />
                                    </td>
                                </tr>
                            ) : filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-24 text-center">
                                        <div className="inline-block bg-gray-50 p-8 rounded-3xl border-2 border-dashed border-gray-200">
                                            <Users size={48} className="text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-600 font-black text-xl mb-1">Database Empty</p>
                                            <p className="text-gray-400 text-sm font-medium">Add a contact or import a CSV to get started</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredContacts.map(contact => (
                                <tr key={contact.id} className="hover:bg-blue-50/30 border-b border-gray-50 last:border-0 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 flex items-center justify-center font-black text-lg border border-indigo-200/50 shadow-sm group-hover:scale-105 transition-transform">
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-black text-gray-900 text-base">{contact.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="font-bold text-gray-600 tracking-wide">{contact.phone}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-wrap gap-2">
                                            {contact.labels ? contact.labels.split(',').map(l => (
                                                <span key={l} className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-xs font-black uppercase tracking-wider">{l.trim()}</span>
                                            )) : <span className="text-gray-300 font-bold">-</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${contact.source === 'csv' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                            {contact.source === 'csv' ? 'CSV Import' : 'Manual Entry'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenEdit(contact)} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:shadow-md transition-all">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => handleDeleteContact(contact.id)} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-red-500 hover:text-red-600 hover:shadow-md transition-all">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Contact Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden transform transition-all scale-100 opacity-100 relative">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500"></div>

                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                        {editContact ? <Edit2 size={24} /> : <UserPlus size={24} />}
                                    </div>
                                    {editContact ? 'Edit Profile' : 'New Profile'}
                                </h3>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddContact} className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Display Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-bold text-lg placeholder-gray-400"
                                    placeholder="e.g. John Doe" required
                                    value={name} onChange={e => setName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">WhatsApp Connection</label>
                                <div className="flex gap-3">
                                    <select
                                        className="w-32 bg-gray-50 border border-gray-200 text-gray-700 rounded-2xl px-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-bold text-sm cursor-pointer"
                                        value={countryCode}
                                        onChange={e => setCountryCode(e.target.value)}
                                    >
                                        <option value="880">BD (+880)</option>
                                        <option value="91">IN (+91)</option>
                                        <option value="1">US (+1)</option>
                                        <option value="44">UK (+44)</option>
                                        <option value="971">UAE (+971)</option>
                                        <option value="966">KSA (+966)</option>
                                        <option value="60">MY (+60)</option>
                                        <option value="65">SG (+65)</option>
                                    </select>
                                    <input
                                        type="text"
                                        className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-bold text-lg placeholder-gray-400"
                                        placeholder="Mobile Number" required
                                        value={phone} onChange={e => setPhone(e.target.value)}
                                    />
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 w-max px-3 py-1.5 rounded-lg">
                                    <CheckCircle size={14} /> Full Dial: +{countryCode}{phone || 'XXXXXX'}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">Segmentation Labels</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-bold placeholder-gray-400"
                                    placeholder="VIP, Summer Sale, Returning"
                                    value={labels} onChange={e => setLabels(e.target.value)}
                                />
                                <p className="text-[11px] font-bold text-gray-400 mt-2 uppercase tracking-wide">Separate with commas</p>
                            </div>

                            <div className="pt-6 mt-2 border-t border-gray-100 flex gap-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-4 bg-white border-2 border-gray-200 text-gray-600 font-black rounded-2xl hover:bg-gray-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1">
                                    {editContact ? 'Save Changes' : 'Create Profile'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import CSV Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden transform transition-all relative">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>

                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl shadow-sm border border-purple-200/50">
                                    <Database size={24} />
                                </div>
                                Database Import
                            </h3>
                            <button onClick={() => setShowImportModal(false)} className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8">
                            {importResult ? (
                                <div className="space-y-8 animate-fade-in-up">
                                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center">
                                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-sm border-4 border-white">
                                            <CheckCircle className="text-emerald-500" size={40} />
                                        </div>
                                        <h4 className="text-2xl font-black text-emerald-900 mb-2">Import Successful!</h4>
                                        <p className="font-bold text-emerald-600">Processed <span className="text-xl bg-white px-2 py-0.5 rounded-lg border border-emerald-100">{importResult.inserted + importResult.skipped}</span> total leads from your file.</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                                            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Clean Imports</p>
                                            <p className="text-5xl font-black text-gray-900">{importResult.inserted}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                                            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Failed/Skipped</p>
                                            <p className="text-5xl font-black text-gray-900">{importResult.skipped}</p>
                                        </div>
                                    </div>

                                    <button onClick={() => { setShowImportModal(false); setImportResult(null); setFile(null); }} className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl text-lg hover:bg-gray-800 transition-colors shadow-xl shadow-gray-900/20">
                                        Close & Return to Library
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div
                                        className={`border-4 border-dashed rounded-[2rem] p-12 text-center transition-all cursor-pointer group relative overflow-hidden ${file ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-300'}`}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            type="file" accept=".csv" className="hidden" ref={fileInputRef}
                                            onChange={e => setFile(e.target.files[0])}
                                        />

                                        <div className={`w-24 h-24 mx-auto mb-6 rounded-[2rem] flex items-center justify-center transition-transform duration-500 ${file ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 scale-110' : 'bg-white text-gray-400 shadow-sm group-hover:scale-110 group-hover:text-indigo-500'}`}>
                                            <FileSpreadsheet size={48} />
                                        </div>

                                        {file ? (
                                            <div className="animate-fade-in-up">
                                                <p className="text-2xl font-black text-indigo-900 mb-2">{file.name}</p>
                                                <p className="text-sm font-bold text-indigo-500 bg-indigo-100 w-max mx-auto px-4 py-1.5 rounded-full">Ready to process sequence</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-2xl font-black text-gray-700 mb-2">Upload Data Source</p>
                                                <p className="text-sm font-medium text-gray-500">Tap to browse or drop your .CSV file here</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-amber-50 border-2 border-amber-100 p-5 rounded-3xl flex gap-4 items-start">
                                        <div className="p-2 bg-amber-100 rounded-xl shrink-0">
                                            <AlertCircle className="text-amber-600" size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-amber-900 mb-1">Formatting Requirement</p>
                                            <p className="text-sm text-amber-700 font-medium leading-relaxed">
                                                The CSV must contain headers for <b>name</b> and <b>phone</b>. Numbers need the country code without a leading "+".
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-2">
                                        <button onClick={() => setShowImportModal(false)} className="flex-1 px-6 py-5 bg-white border-2 border-gray-200 text-gray-600 font-black rounded-2xl hover:bg-gray-50 transition-colors text-lg">
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleImportCSV} disabled={!file || importing}
                                            className="flex-[2] bg-gray-900 text-white font-black py-5 rounded-2xl text-lg hover:bg-gray-800 transition-all shadow-xl shadow-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                        >
                                            {importing ? (
                                                <><Loader2 className="animate-spin" size={24} /> Processing Data...</>
                                            ) : (
                                                <><Upload size={24} /> Initialize Import Sequence</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
