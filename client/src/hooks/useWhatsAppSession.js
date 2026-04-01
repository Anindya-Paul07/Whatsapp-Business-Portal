import { useState, useEffect, useRef } from 'react';
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
    // Track socket in STATE so consumers re-render when it becomes available
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);

    const isScanning = status === 'qr';

    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem('token');

        // Create socket once, save to ref AND state so React consumers re-render
        const sock = io('http://localhost:5000', {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        socketRef.current = sock;
        setSocket(sock);

        sock.on('connect', () => {
            console.log('[useWhatsAppSession] Socket connected');
            // Poll the REST API to get the current status immediately on connect
            api.get('/sessions/status').then(res => {
                if (res.data.success) {
                    setStatus(res.data.status === 'ready' ? 'ready' : 'disconnected');
                } else {
                    setStatus('disconnected');
                }
            }).catch(() => setStatus('disconnected'));
        });

        sock.on('disconnect', () => {
            console.log('[useWhatsAppSession] Socket disconnected');
            setStatus('disconnected');
        });

        sock.on('qr_code', (data) => {
            console.log('[useWhatsAppSession] QR Received');
            setQrCode(data.qr);
            setStatus('qr');
        });

        sock.on('session_status', (data) => {
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

        sock.on('session_error', (data) => {
            toast.error(data.error || 'Connection error');
            setStatus('disconnected');
        });

        sock.on('message_received', (data) => {
            if (data.direction === 'in' && window.location.pathname !== '/chat') {
                toast(`New message from ${data.contactPhone}`, {
                    icon: '💬',
                    duration: 3000
                });
            }
        });

        // Cleanup: disconnect and null out refs on unmount
        return () => {
            console.log('[useWhatsAppSession] Cleaning up socket');
            sock.disconnect();
            socketRef.current = null;
            setSocket(null);
        };
    }, [user]); // Only re-run if user changes (login/logout)

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
        socket  // from state, not ref — so consumers re-render when socket is ready
    };
};

export default useWhatsAppSession;
