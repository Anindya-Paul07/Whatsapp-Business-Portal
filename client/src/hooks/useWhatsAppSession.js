import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../utils/api';

/**
 * useWhatsAppSession
 * ─────────────────────────────────────────────────────────────
 * Custom hook to manage real-time WhatsApp session lifecycle.
 * Handles socket connectivity, QR code delivery, and status updates.
 */
export const useWhatsAppSession = (user) => {
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('loading'); // 'loading' | 'qr' | 'ready' | 'disconnected'
    const socketRef = useRef(null);

    const isScanning = status === 'qr';

    const connectSocket = useCallback(() => {
        if (!user) return;

        const token = localStorage.getItem('token');

        // Initialize socket only once
        if (!socketRef.current) {
            socketRef.current = io('/', {
                auth: { token },
                transports: ['websocket', 'polling']
            });
        }

        const socket = socketRef.current;

        // --- Event Listeners ---

        socket.on('connect', () => {
            console.log('[useWhatsAppSession] Socket connected');
            // Check initial status from API
            api.get('/sessions/status').then(res => {
                if (res.data.success) {
                    setStatus(res.data.status === 'ready' ? 'ready' : 'disconnected');
                }
            }).catch(() => setStatus('disconnected'));
        });

        socket.on('qr_code', (data) => {
            console.log('[useWhatsAppSession] QR Received');
            setQrCode(data.qr);
            setStatus('qr');
        });

        socket.on('session_status', (data) => {
            console.log('[useWhatsAppSession] Status Change:', data.status);
            if (data.status === 'ready') {
                setQrCode(null);
                setStatus('ready');
                toast.success(data.message || 'WhatsApp Connected!');
            } else if (data.status === 'disconnected') {
                setQrCode(null);
                setStatus('disconnected');
                toast.error(data.message || 'WhatsApp Disconnected');
            }
        });

        socket.on('session_error', (data) => {
            toast.error(data.error || 'Connection error');
            setStatus('disconnected');
        });

        socket.on('message_received', (data) => {
            // Optional: Notify on new inbound messages if not on chat page
            if (data.direction === 'in' && window.location.pathname !== '/chat') {
                toast(`New message from ${data.contactPhone}`, {
                    icon: '💬',
                    duration: 3000
                });
            }
        });

        return () => {
            console.log('[useWhatsAppSession] Cleaning up listeners');
            socket.off('connect');
            socket.off('qr_code');
            socket.off('session_status');
            socket.off('session_error');
            socket.off('message_received');
        };
    }, [user]);

    useEffect(() => {
        const cleanup = connectSocket();

        return () => {
            if (cleanup) cleanup();
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [connectSocket]);

    /**
     * Reconnect / Initialize session
     */
    const reconnect = async () => {
        setStatus('loading');
        try {
            const { data } = await api.post('/sessions/init');
            if (data.status === 'ready') {
                setStatus('ready');
            }
            // Otherwise wait for QR event
        } catch (err) {
            toast.error('Failed to initialize session');
            setStatus('disconnected');
        }
    };

    /**
     * Manual message sender assistant
     */
    const sendMessage = async (phone, message) => {
        try {
            const { data } = await api.post(`/chats/${phone}/send`, { message });
            return data;
        } catch (err) {
            throw err;
        }
    };

    return {
        qrCode,
        status,
        isScanning,
        sendMessage,
        reconnect,
        socket: socketRef.current
    };
};

export default useWhatsAppSession;
