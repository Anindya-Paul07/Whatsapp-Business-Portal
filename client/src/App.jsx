import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useApp } from './AppContext';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Connect from './pages/Connect';
import Contacts from './pages/Contacts';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import MessageBot from './pages/MessageBot';
import Templates from './pages/Templates';
import Chat from './pages/Chat';
import FlowBuilder from './pages/FlowBuilder';

const ProtectedRoute = ({ children }) => {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="connect" element={<Connect />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="message-bot" element={<MessageBot />} />
        <Route path="templates" element={<Templates />} />
        <Route path="chat" element={<Chat />} />
        <Route path="flows" element={<FlowBuilder />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" />
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
