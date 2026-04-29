import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AdminOnlyRoute } from '@/routes/AdminOnlyRoute';
import { AdminLayout } from '@/layouts/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { AgentsPage } from '@/pages/AgentsPage';
import { TasksPage } from '@/pages/TasksPage';
import { WorkflowsPage } from '@/pages/WorkflowsPage';
import { AuditPage } from '@/pages/AuditPage';
import { RemoteControlPage } from '@/pages/RemoteControlPage';

export default function App() {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}
    >
      <AntApp>
        <QueryProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AdminLayout />}>
                    <Route
                      index
                      element={<Navigate to="/dashboard" replace />}
                    />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/agents" element={<AgentsPage />} />
                    <Route path="/remote/:agentId" element={<RemoteControlPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="/workflows" element={<WorkflowsPage />} />
                    <Route element={<AdminOnlyRoute />}>
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/audit" element={<AuditPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </QueryProvider>
      </AntApp>
    </ConfigProvider>
  );
}
