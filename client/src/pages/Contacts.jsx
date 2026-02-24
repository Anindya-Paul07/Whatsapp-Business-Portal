import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    Upload,
    Search,
    MoreHorizontal,
    UserPlus,
    X,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    Loader2
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Create Modal State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [labels, setLabels] = useState('');

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

    const handleAddContact = async (e) => {
        e.preventDefault();
        try {
            await api.post('/contacts', { name, phone, labels });
            toast.success('Contact added successfully');
            setShowAddModal(false);
            setName(''); setPhone(''); setLabels('');
            fetchContacts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add contact');
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Contacts Library</h2>
                    <p className="text-[#667781]">Manage your segments and contact lists</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowImportModal(true)} className="btn-ghost border bg-white">
                        <Upload size={18} />
                        <span>Import CSV</span>
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="btn-primary">
                        <Plus size={18} />
                        <span>Add Contact</span>
                    </button>
                </div>
            </div>

            <div className="card !p-0 overflow-hidden">
                <div className="p-4 border-b flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            className="input pl-10 bg-gray-50 border-0"
                            placeholder="Search by name or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#667781] px-2 font-medium">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold">{filteredContacts.length}</span>
                        <span>results</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="table-th w-10">
                                    <input type="checkbox" className="rounded" />
                                </th>
                                <th className="table-th text-xs">Name</th>
                                <th className="table-th text-xs">Phone</th>
                                <th className="table-th text-xs">Labels</th>
                                <th className="table-th text-xs">Source</th>
                                <th className="table-th text-xs">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <Loader2 className="animate-spin inline-block text-[#00a884]" size={40} />
                                    </td>
                                </tr>
                            ) : filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center text-[#667781]">
                                        No contacts found
                                    </td>
                                </tr>
                            ) : filteredContacts.map(contact => (
                                <tr key={contact.id} className="hover:bg-gray-50">
                                    <td className="table-td text-center">
                                        <input type="checkbox" className="rounded" />
                                    </td>
                                    <td className="table-td">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                                {contact.name.charAt(0)}
                                            </div>
                                            <span className="font-semibold">{contact.name}</span>
                                        </div>
                                    </td>
                                    <td className="table-td font-medium text-gray-600">{contact.phone}</td>
                                    <td className="table-td">
                                        {contact.labels ? contact.labels.split(',').map(l => (
                                            <span key={l} className="badge badge-gray mr-1">{l}</span>
                                        )) : '-'}
                                    </td>
                                    <td className="table-td">
                                        <span className={`badge ${contact.source === 'csv' ? 'badge-yellow' : 'badge-green'}`}>
                                            {contact.source === 'csv' ? 'CSV Import' : 'Manual'}
                                        </span>
                                    </td>
                                    <td className="table-td text-right">
                                        <button className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
                                            <MoreHorizontal size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Contact Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="card w-full max-w-md animate-fade-in p-0 overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold flex items-center gap-2">
                                <UserPlus size={18} className="text-[#00a884]" />
                                <span>New Contact</span>
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-red-500">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddContact} className="p-6 space-y-4">
                            <div>
                                <label className="label">Display Name</label>
                                <input
                                    type="text" className="input" placeholder="e.g. John Doe" required
                                    value={name} onChange={e => setName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">WhatsApp Number</label>
                                <input
                                    type="text" className="input" placeholder="e.g. 919876543210" required
                                    value={phone} onChange={e => setPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Labels (Comma separated)</label>
                                <input
                                    type="text" className="input" placeholder="Retail, New, WhatsApp"
                                    value={labels} onChange={e => setLabels(e.target.value)}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost flex-1 border">Cancel</button>
                                <button type="submit" className="btn-primary flex-1 justify-center">Add Contact</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import CSV Modal */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="card w-full max-w-xl animate-fade-in p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Import Bulk Contacts</h3>
                            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-red-500">
                                <X size={20} />
                            </button>
                        </div>

                        {importResult ? (
                            <div className="space-y-6">
                                <div className="card bg-[#e7f8f3] border-[#00a884] flex gap-4">
                                    <CheckCircle className="text-[#00a884]" size={24} />
                                    <div>
                                        <h4 className="font-bold">Import Completed</h4>
                                        <p className="text-sm">Processed {importResult.inserted + importResult.skipped} contacts from CSV.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border border-green-100 bg-green-50">
                                        <p className="text-xs font-bold uppercase text-green-700 mb-1">Success</p>
                                        <p className="text-2xl font-bold text-green-800">{importResult.inserted}</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-yellow-100 bg-yellow-50">
                                        <p className="text-xs font-bold uppercase text-yellow-700 mb-1">Skipped/Errors</p>
                                        <p className="text-2xl font-bold text-yellow-800">{importResult.skipped}</p>
                                    </div>
                                </div>

                                <button onClick={() => { setShowImportModal(false); setImportResult(null); setFile(null); }} className="btn-primary w-full justify-center py-3">
                                    Done, View Contacts
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div
                                    className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer group ${file ? 'border-[#00a884] bg-[#e7f8f3]' : 'border-[#e9edef] hover:border-[#00a884]'}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file" accept=".csv" className="hidden" ref={fileInputRef}
                                        onChange={e => setFile(e.target.files[0])}
                                    />
                                    <div className="w-16 h-16 bg-gray-50 group-hover:bg-white rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                                        <FileSpreadsheet className={file ? 'text-[#00a884]' : 'text-gray-400'} size={32} />
                                    </div>
                                    {file ? (
                                        <div>
                                            <p className="font-bold text-[#111b21]">{file.name}</p>
                                            <p className="text-sm text-[#00a884]">File selected successfully</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="font-bold text-[#111b21]">Upload CSV File</p>
                                            <p className="text-sm text-[#667781]">Drag and drop or click to browse</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex gap-3">
                                    <AlertCircle className="text-gray-400 shrink-0" size={18} />
                                    <p className="text-xs text-[#667781] leading-relaxed">
                                        <b>CSV Format:</b> Make sure your file has headers as <b>name</b> and <b>phone</b>. Phone numbers should include country code without '+'.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setShowImportModal(false)} className="btn-ghost flex-1 border">Cancel</button>
                                    <button
                                        onClick={handleImportCSV} disabled={!file || importing}
                                        className="btn-primary flex-1 justify-center disabled:opacity-50"
                                    >
                                        {importing ? <Loader2 className="animate-spin" size={20} /> : <span>Start Import</span>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
