import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar, TopBar } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminOnlyRoute } from './components/AdminOnlyRoute';
import { AuthProvider } from './context/AuthContext';
import { WsProvider } from './context/WsProvider';
import Dashboard from './views/Dashboard';
import Agents from './views/Agents';
import Workflows from './views/Workflows';
import Automations from './views/Automations';
import Tasks from './views/Tasks';
import AuditLog from './views/AuditLog';
import Settings from './views/Settings';
import NOC from './views/NOC';
import Login from './views/Login';

function AppContent() {
  const location = useLocation();
  const isNOC = location.pathname === '/noc';

  if (isNOC) {
    return <NOC />;
  }

  return (
    <div className="min-h-screen bg-surface flex selection:bg-primary/30 selection:text-white">
      <Sidebar />
      <div className="flex-1 ml-[300px] flex flex-col">
        <TopBar />
        <main className="mt-20 px-8 py-8 h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="max-w-[1600px] mx-auto w-full"
            >
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/workflows" element={<Workflows />} />
                <Route path="/automations" element={<Automations />} />
                <Route
                  path="/audit-log"
                  element={
                    <AdminOnlyRoute>
                      <AuditLog />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <AdminOnlyRoute>
                      <Settings />
                    </AdminOnlyRoute>
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WsProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppContent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </WsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
