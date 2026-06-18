import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';
import { Sidebar, TopBar } from './components/Navigation';
import { EditorErrorBoundary } from './components/EditorErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserOnlyRoute } from './components/UserOnlyRoute';
import { AuthProvider } from './context/AuthContext';
import { NavLayoutProvider } from './context/NavLayoutContext';
import { WsProvider } from './context/WsProvider';
import Dashboard from './views/Dashboard';
import Agents from './views/Agents';
import AgentFilesBrowser from './views/AgentFilesBrowser';
import Workflows from './views/Workflows';
import WorkflowEditorPage from './views/WorkflowEditorPage';
import Automations from './views/Automations';
import Tasks from './views/Tasks';
import ChromeScripts from './views/ChromeScripts';
import ChromeScriptEditor from './views/ChromeScriptEditor';
import DesktopRecordings from './views/DesktopRecordings';
import DesktopRecordingEditor from './views/DesktopRecordingEditor';
import TaskTemplateEditor from './views/TaskTemplateEditor';
import Documentation from './views/Documentation';
import NOC from './views/NOC';
import Login from './views/Login';
import Register from './views/Register';
import GoogleAuthCallback from './views/GoogleAuthCallback';
import Billing from './views/Billing';
import Bots from './views/Bots';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { AdminAppRoutes } from './views/admin/AdminAppRoutes';

function AppContent() {
  const location = useLocation();
  const isNOC = location.pathname === '/noc';
  const isWorkflowEditor = /^\/workflows\/[^/]+\/edit$/.test(location.pathname);
  const isTaskTemplateEditor = /^\/tasks\/templates\//.test(location.pathname);
  const isChromeScriptEditor = /^\/chrome-scripts\/[^/]+\/edit$/.test(location.pathname);
  const isDesktopRecordingEditor = /^\/desktop-recordings\/[^/]+\/edit$/.test(
    location.pathname,
  );
  const isImmersiveEditor =
    isWorkflowEditor || isChromeScriptEditor || isDesktopRecordingEditor;
  const isFullHeightPage =
    isWorkflowEditor || isTaskTemplateEditor || isChromeScriptEditor || isDesktopRecordingEditor;

  const isLgUp = useMediaQuery('(min-width: 1024px)');
  /** Chỉ khóa viewport trên desktop — mobile dùng scroll document (tránh flex co về 0 / trang trắng) */
  const lockViewport = isLgUp && (isImmersiveEditor || isFullHeightPage);
  /** Mọi trang trên mobile: scroll document, không fade route */
  const useDocumentScroll = !isLgUp;
  const isMobileRecordingEditor =
    !isLgUp && (isChromeScriptEditor || isDesktopRecordingEditor);
  const isMobileWorkflowEditor = !isLgUp && isWorkflowEditor;
  const isMobileTaskTemplateEditor = !isLgUp && isTaskTemplateEditor;

  if (isNOC) {
    return <NOC />;
  }

  if (isMobileWorkflowEditor) {
    return (
      <NavLayoutProvider>
        <div className="fixed inset-0 z-30 flex flex-col bg-surface overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex-1 min-h-0 h-full w-full">
            <Routes location={location}>
              <Route
                path="/workflows/:id/edit"
                element={
                  <EditorErrorBoundary>
                    <div className="h-full min-h-0">
                      <WorkflowEditorPage />
                    </div>
                  </EditorErrorBoundary>
                }
              />
            </Routes>
          </div>
        </div>
      </NavLayoutProvider>
    );
  }

  if (isMobileTaskTemplateEditor) {
    return (
      <NavLayoutProvider>
        <div className="fixed inset-0 z-30 flex flex-col bg-surface overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex-1 min-h-0 h-full w-full">
            <Routes location={location}>
              <Route
                path="/tasks/templates/new"
                element={
                  <EditorErrorBoundary>
                    <div className="h-full min-h-0">
                      <TaskTemplateEditor />
                    </div>
                  </EditorErrorBoundary>
                }
              />
              <Route
                path="/tasks/templates/:id/edit"
                element={
                  <EditorErrorBoundary>
                    <div className="h-full min-h-0">
                      <TaskTemplateEditor />
                    </div>
                  </EditorErrorBoundary>
                }
              />
            </Routes>
          </div>
        </div>
      </NavLayoutProvider>
    );
  }

  if (isMobileRecordingEditor) {
    return (
      <NavLayoutProvider>
        <div className="fixed inset-0 z-30 flex flex-col bg-surface overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex-1 min-h-0 h-full w-full">
            <Routes location={location}>
              <Route
                path="/chrome-scripts/:id/edit"
                element={
                  <EditorErrorBoundary>
                    <div className="h-full min-h-0">
                      <ChromeScriptEditor />
                    </div>
                  </EditorErrorBoundary>
                }
              />
              <Route
                path="/desktop-recordings/:id/edit"
                element={
                  <EditorErrorBoundary>
                    <div className="h-full min-h-0">
                      <DesktopRecordingEditor />
                    </div>
                  </EditorErrorBoundary>
                }
              />
            </Routes>
          </div>
        </div>
      </NavLayoutProvider>
    );
  }

  return (
    <NavLayoutProvider>
      <div
        className={cn(
          'flex w-full bg-surface selection:bg-primary/30 selection:text-white',
          lockViewport ? 'min-h-dvh h-dvh overflow-hidden' : 'min-h-dvh',
          'lg:min-h-dvh lg:h-dvh lg:overflow-hidden',
        )}
      >
        {!isImmersiveEditor ? <Sidebar /> : null}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 w-full',
            lockViewport && 'min-h-0 h-full overflow-hidden',
            'lg:min-h-0 lg:h-full lg:overflow-hidden',
            !isImmersiveEditor && 'lg:ml-[300px]',
          )}
        >
          {!isImmersiveEditor ? <TopBar /> : null}
          {!isImmersiveEditor ? <SubscriptionBanner /> : null}
          <main
            className={cn(
              'min-w-0 w-full',
              useDocumentScroll ? 'block' : 'flex flex-col',
              lockViewport ? 'flex-1 min-h-0' : useDocumentScroll ? undefined : 'flex-none',
              lockViewport
                ? isImmersiveEditor
                  ? 'h-full overflow-hidden'
                  : 'overflow-hidden px-4 py-4 lg:px-8 lg:pb-4'
                : isImmersiveEditor
                  ? 'px-0 py-0'
                  : 'px-4 py-4 lg:px-8 lg:pb-8',
              'lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:custom-scrollbar',
              'pb-[env(safe-area-inset-bottom,0px)]',
            )}
          >
          <AnimatePresence mode={useDocumentScroll ? 'sync' : 'wait'}>
            <motion.div
              key={location.pathname}
              initial={
                useDocumentScroll ? false : { opacity: 0, y: isImmersiveEditor ? 0 : 10 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={useDocumentScroll ? undefined : { opacity: 0, y: isImmersiveEditor ? 0 : -10 }}
              transition={{ duration: useDocumentScroll ? 0 : 0.3, ease: 'easeOut' }}
              className={cn(
                'w-full',
                !useDocumentScroll && 'shrink-0',
                isFullHeightPage &&
                  (lockViewport
                    ? 'h-full flex flex-col min-h-0 flex-1'
                    : 'w-full min-h-[70dvh] flex flex-col'),
                !isFullHeightPage && 'max-w-[1600px] mx-auto',
                isImmersiveEditor &&
                  (lockViewport
                    ? 'h-full min-h-0 flex-1'
                    : 'w-full min-h-dvh flex flex-col'),
              )}
            >
              <Routes location={location}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/agents/:id/files" element={<AgentFilesBrowser />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/chrome-scripts" element={<ChromeScripts />} />
                <Route
                  path="/chrome-scripts/:id/edit"
                  element={
                    <EditorErrorBoundary>
                      <ChromeScriptEditor />
                    </EditorErrorBoundary>
                  }
                />
                <Route path="/desktop-recordings" element={<DesktopRecordings />} />
                <Route
                  path="/desktop-recordings/:id/edit"
                  element={
                    <EditorErrorBoundary>
                      <DesktopRecordingEditor />
                    </EditorErrorBoundary>
                  }
                />
                <Route path="/tasks/templates/new" element={<TaskTemplateEditor />} />
                <Route path="/tasks/templates/:id/edit" element={<TaskTemplateEditor />} />
                <Route path="/workflows" element={<Workflows />} />
                <Route
                  path="/workflows/:id/edit"
                  element={
                    <EditorErrorBoundary>
                      <WorkflowEditorPage />
                    </EditorErrorBoundary>
                  }
                />
                <Route path="/automations" element={<Automations />} />
                <Route path="/bots" element={<Bots />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/docs" element={<Documentation />} />
                <Route path="/settings" element={<Navigate to="/admin/users" replace />} />
                <Route path="/audit-log" element={<Navigate to="/admin/audit" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
          </main>
        </div>
      </div>
    </NavLayoutProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WsProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <AdminAppRoutes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <UserOnlyRoute>
                    <AppContent />
                  </UserOnlyRoute>
                </ProtectedRoute>
              }
            />
          </Routes>
        </WsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
