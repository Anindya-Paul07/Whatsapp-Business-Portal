import React, { useState } from 'react';
import {
    QrCode,
    CheckCircle2,
    Power,
    Loader2,
    RefreshCw,
    Smartphone
} from 'lucide-react';
import { useApp } from '../AppContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Connect = () => {
    const { whatsappStatus, setWhatsappStatus, qrCode, status, reconnect } = useApp();
    const [loading, setLoading] = useState(false);

    const initSession = async () => {
        setLoading(true);
        try {
            await reconnect();
        } catch (err) {
            toast.error('Failed to initialize session');
        } finally {
            setLoading(false);
        }
    };

    const logoutSession = async () => {
        try {
            await api.delete('/sessions/destroy');
            setWhatsappStatus('not_connected');
            toast.success('Session disconnected');
        } catch (err) {
            toast.error('Failed to disconnect session');
        }
    };

    const isLoading = loading || status === 'loading';

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold">WhatsApp Instance</h2>
                <p className="text-[#667781]">Connect your device to start sending messages</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Left: Status Card */}
                <div className="card h-full">
                    <div className="mb-8">
                        <h3 className="text-lg font-bold mb-1">Connection Status</h3>
                        <p className="text-sm text-[#667781]">Current instance health and state</p>
                    </div>

                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        {whatsappStatus === 'ready' ? (
                            <>
                                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-[#00a884] mb-6 animate-pulse">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h4 className="text-xl font-bold text-[#111b21]">Account Active</h4>
                                <p className="text-[#667781] max-w-[200px] mt-2">
                                    Device is successfully connected and ready to send messages.
                                </p>
                                <button
                                    onClick={logoutSession}
                                    className="btn-danger mt-8 w-full justify-center"
                                >
                                    <Power size={18} />
                                    <span>Disconnect Account</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-6 font-bold">
                                    <Smartphone size={40} />
                                </div>
                                <h4 className="text-xl font-bold text-[#111b21]">Disconnected</h4>
                                <p className="text-[#667781] max-w-[200px] mt-2">
                                    No active session found. Connect your device below.
                                </p>
                                <button
                                    onClick={initSession}
                                    disabled={isLoading}
                                    className="btn-primary mt-8 w-full justify-center"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                    <span>{isLoading ? 'Starting Instance...' : 'Initialize Instance'}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Right: QR Card */}
                <div className="card h-full flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold mb-1">Link via QR Code</h3>
                        <p className="text-sm text-[#667781]">Scan this with WhatsApp on your phone</p>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#e9edef] rounded-xl">
                        {qrCode ? (
                            <div className="bg-white p-4 rounded-xl shadow-inner border">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`}
                                    alt="WhatsApp QR Code"
                                    className="w-[200px] h-[200px]"
                                />
                            </div>
                        ) : whatsappStatus === 'ready' ? (
                            <div className="text-center">
                                <div className="bg-[#e7f8f3] text-[#00a884] px-4 py-2 rounded-lg font-bold text-sm">
                                    ✓ Device Connected
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                {isLoading ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-12 h-12 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-sm font-medium text-[#667781]">Waiting for QR Code...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-gray-400">
                                        <QrCode size={48} className="opacity-20" />
                                        <p className="text-sm font-medium">Initialize session to generate QR</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-8 space-y-4">
                            <div className="flex gap-3 text-xs text-[#667781]">
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">1</div>
                                <p>Open WhatsApp on your phone</p>
                            </div>
                            <div className="flex gap-3 text-xs text-[#667781]">
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">2</div>
                                <p>Tap <b>Menu</b> or <b>Settings</b> and select <b>Linked Devices</b></p>
                            </div>
                            <div className="flex gap-3 text-xs text-[#667781]">
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">3</div>
                                <p>Tap on <b>Link a Device</b> and point your phone to this screen</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Connect;
