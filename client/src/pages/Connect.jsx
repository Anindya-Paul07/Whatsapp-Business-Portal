import React, { useState, useEffect } from 'react';
import {
    QrCode, CheckCircle2, Power, Loader2, RefreshCw, Smartphone, ShieldCheck, Zap
} from 'lucide-react';
import { useApp } from '../AppContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Connect = () => {
    const { whatsappStatus, setWhatsappStatus, socket } = useApp();
    const [qr, setQr] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (socket) {
            socket.on('qr_code', (data) => {
                setQr(data.qr);
                setLoading(false);
            });

            socket.on('session_status', (data) => {
                if (data.status === 'ready') {
                    setQr(null);
                    setLoading(false);
                    setWhatsappStatus('ready');
                } else if (data.status === 'disconnected') {
                    setLoading(false);
                    setQr(null);
                    setWhatsappStatus('not_connected');
                }
            });

            socket.on('session_error', (data) => {
                toast.error(data.error || 'Connection failed');
                setLoading(false);
            });
        }
    }, [socket, setWhatsappStatus]);

    const initSession = async () => {
        setLoading(true);
        try {
            const { data } = await api.post('/sessions/init');
            if (data.status === 'ready') {
                setWhatsappStatus('ready');
                setLoading(false);
            }
        } catch (err) {
            toast.error('Failed to initialize session');
            setLoading(false);
        }
    };

    const logoutSession = async () => {
        try {
            await api.delete('/sessions/destroy');
            setWhatsappStatus('not_connected');
            setQr(null);
            toast.success('Session disconnected');
        } catch (err) {
            toast.error('Failed to disconnect session');
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-10">
            {/* Header */}
            <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    Instance <span className="text-emerald-500">Gateway</span>
                </h2>
                <p className="text-gray-500 font-medium text-lg mt-1">Bind your device to enable automation and messaging</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left: Status Node */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100 flex-1 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
                            <ShieldCheck size={180} />
                        </div>

                        <div className="mb-10 relative z-10">
                            <h3 className="text-2xl font-black text-gray-900">Connection Link</h3>
                            <p className="text-gray-500 font-medium mt-1">Current system integration health</p>
                        </div>

                        <div className="flex flex-col items-center justify-center py-6 text-center relative z-10 min-h-[250px]">
                            {whatsappStatus === 'ready' ? (
                                <div className="w-full animate-fade-in-up">
                                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white mb-6 shadow-xl shadow-emerald-500/30 relative">
                                        <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-20"></div>
                                        <CheckCircle2 size={48} />
                                    </div>
                                    <h4 className="text-3xl font-black text-gray-900 tracking-tight">System Active</h4>
                                    <p className="text-gray-500 font-medium max-w-xs mx-auto mt-3">
                                        Secure channel established. Protocol is ready for outbound operations.
                                    </p>
                                    <button
                                        onClick={logoutSession}
                                        className="mt-10 w-full py-4 px-6 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 group"
                                    >
                                        <Power size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                                        <span className="uppercase tracking-widest text-sm">Terminate Connection</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full animate-fade-in">
                                    <div className="w-24 h-24 mx-auto bg-gray-50 border-4 border-white rounded-full flex items-center justify-center text-gray-300 mb-6 shadow-sm">
                                        <Smartphone size={40} />
                                    </div>
                                    <h4 className="text-3xl font-black text-gray-900 tracking-tight">Offline</h4>
                                    <p className="text-gray-500 font-medium max-w-xs mx-auto mt-3">
                                        Link your device to authenticate and open the communication port.
                                    </p>
                                    <button
                                        onClick={initSession}
                                        disabled={loading}
                                        className="mt-10 w-full py-4 px-6 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition-all shadow-xl shadow-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} className="text-amber-400" />}
                                        <span className="uppercase tracking-wider">{loading ? 'Requesting QR...' : 'Initialize Binding'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: QR Canvas */}
                <div className="lg:col-span-7 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full min-h-[500px]">
                    <div className="bg-gray-50/50 p-8 sm:p-10 border-b border-gray-100 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900">Authentication Canvas</h3>
                            <p className="text-gray-500 font-medium mt-1">Scan to authorize machine</p>
                        </div>
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 shadow-sm">
                            <QrCode size={24} />
                        </div>
                    </div>

                    <div className="flex-1 p-8 sm:p-12 flex flex-col xl:flex-row items-center justify-center gap-10 xl:gap-16">
                        {/* the QR box */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 blur-2xl opacity-10 rounded-[3rem]"></div>
                            <div className="bg-white p-8 rounded-[3rem] shadow-2xl border flex items-center justify-center relative w-[320px] h-[320px] sm:w-[360px] sm:h-[360px]">
                                {qr ? (
                                    <div className="animate-fade-in w-full h-full flex flex-col items-center justify-center fade-in bg-white">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qr)}`}
                                            alt="Auth QR Code"
                                            className="w-full h-full object-contain rounded-xl"
                                        />
                                    </div>
                                ) : whatsappStatus === 'ready' ? (
                                    <div className="text-center animate-fade-in-up flex flex-col items-center gap-4">
                                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                                            <ShieldCheck size={40} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-gray-900">Device Bound</h4>
                                            <p className="text-sm font-medium text-emerald-600 mt-1 uppercase tracking-widest">Authentication Verified</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center w-full h-full flex flex-col items-center justify-center">
                                        {loading ? (
                                            <div className="flex flex-col items-center gap-6">
                                                <div className="relative">
                                                    <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
                                                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                                                </div>
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Generating Target...</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-6 text-gray-300">
                                                <QrCode size={80} className="opacity-40" strokeWidth={1} />
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-wider text-center px-4">Click Initialize to<br />Generate QR</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="flex-1 space-y-6 max-w-sm">
                            <h4 className="text-xl font-black text-gray-900 mb-6 border-b pb-4">Binding Instructions</h4>
                            <div className="flex gap-4 items-start group">
                                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 font-black text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors shadow-sm">1</div>
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">Open Application</p>
                                    <p className="text-sm text-gray-500 font-medium mt-1">Launch WhatsApp on your mobile device.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start group">
                                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 font-black text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors shadow-sm">2</div>
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">System Menu</p>
                                    <p className="text-sm text-gray-500 font-medium mt-1">Tap <b>Settings</b> (<span className="opacity-70">iOS</span>) or the <b>More Options</b> menu (<span className="opacity-70">Android</span>).</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start group">
                                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 font-black text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors shadow-sm">3</div>
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">Scan Canvas</p>
                                    <p className="text-sm text-gray-500 font-medium mt-1">Select <b>Linked Devices</b> and point your camera at the QR code.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Connect;
