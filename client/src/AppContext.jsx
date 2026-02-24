import React, { createContext, useContext, useState, useEffect } from 'react';
import api from './utils/api';
import useWhatsAppSession from './hooks/useWhatsAppSession';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
    const [whatsappStatus, setWhatsappStatus] = useState('not_connected');

    const {
        qrCode,
        status,
        socket,
        reconnect,
        sendMessage
    } = useWhatsAppSession(user);

    // Sync the status to whatsappStatus for backward compatibility with existing components
    useEffect(() => {
        if (status === 'ready') {
            setWhatsappStatus('ready');
        } else {
            setWhatsappStatus('not_connected');
        }
    }, [status]);

    const login = (userData, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setWhatsappStatus('not_connected');
        if (socket) socket.close();
    };

    return (
        <AppContext.Provider value={{
            user,
            login,
            logout,
            whatsappStatus,
            setWhatsappStatus,
            socket,
            qrCode,
            status,
            reconnect,
            sendMessage
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
