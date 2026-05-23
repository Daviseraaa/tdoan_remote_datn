import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
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
import TaskTemplateEditor from './views/TaskTemplateEditor';
import AuditLog from './views/AuditLog';
import Settings from './views/Settings';
import NOC from './views/NOC';
import Login from './views/Login';

function AppContent() {
  const location = useLocation();
  const isNOC = location.pathname === '/noc';
  const isWorkflows = location.pathname === '/workflows';

  if (isNOC) {
    return <NOC />;
  }

  return (
    <div className="min-h-screen bg-surface flex selection:bg-primary/30 selection:text-white">
      <Sidebar />
      <div className="flex-1 ml-[300px] flex flex-col min-h-0 h-screen overflow-hidden">
        <TopBar />
        <main
          className={cn(
            'mt-20 min-h-0 flex flex-col',
            isWorkflows
              ? 'h-[calc(100vh-5rem)] overflow-hidden'
              : 'h-[calc(100vh-5rem)] overflow-y-auto custom-scrollbar px-8 py-8',
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: isWorkflows ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: isWorkflows ? 0 : -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn(
                'w-full min-h-0',
                isWorkflows ? 'h-full flex flex-col' : 'max-w-[1600px] mx-auto',
              )}
            >
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/tasks/templates/new" element={<TaskTemplateEditor />} />
                <Route path="/tasks/templates/:id/edit" element={<TaskTemplateEditor />} />
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
