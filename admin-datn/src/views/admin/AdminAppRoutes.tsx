import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdminLayout } from '@/src/components/admin/AdminLayout';
import { AdminOnlyRoute } from '@/src/components/AdminOnlyRoute';
import AdminDashboard from '@/src/views/admin/AdminDashboard';
import AdminUsers from '@/src/views/admin/AdminUsers';
import AdminPlans from '@/src/views/admin/AdminPlans';
import AdminAgents from '@/src/views/admin/AdminAgents';
import AdminFlowActivity from '@/src/views/admin/AdminFlowActivity';
import AuditLog from '@/src/views/AuditLog';

export function AdminAppRoutes() {
  const location = useLocation();

  return (
    <AdminOnlyRoute>
      <AdminLayout>
        <Routes location={location}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="agents" element={<AdminAgents />} />
          <Route path="flows" element={<AdminFlowActivity />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminLayout>
    </AdminOnlyRoute>
  );
}
