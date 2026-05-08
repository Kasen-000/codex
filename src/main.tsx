import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HostView } from './views/HostView';
import { MobileJoinView } from './views/MobileJoinView';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/host/:roomCode" element={<HostView />} />
        <Route path="/join/:roomCode" element={<MobileJoinView />} />
        <Route path="*" element={<Navigate to="/host/DEMO" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
