import { useState } from 'react';
import { Table, Tag, Typography, Input, Select, Space, Grid } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { AuditLog, PaginatedResponse } from '@/types/api';
import { formatDateTime } from '@/lib/format';

const ACTIONS = [
  'user.create', 'user.update', 'user.delete', 'user.toggle',
  'agent.delete', 'agent.regenerate_key',
  'task.create', 'task.cancel',
  'workflow.create', 'workflow.update', 'workflow.delete', 'workflow.execute',
];

export function AuditPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState<string | undefined>();

  const list = useQuery({
    queryKey: ['audit', page, limit, actor, action],
    queryFn: async () =>
      unwrap<PaginatedResponse<AuditLog>>(
        await api.get('/admin/audit-logs', {
          params: { page, limit, actor, action },
        }),
      ),
  });

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>Audit log</Typography.Title>
      <Space className="mobile-stack" style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo email"
          style={{ width: isMobile ? '100%' : 240 }}
          onSearch={setActor}
          allowClear
        />
        <Select
          allowClear
          placeholder="Action"
          style={{ width: isMobile ? '100%' : 200 }}
          value={action}
          onChange={setAction}
          options={ACTIONS.map((a) => ({ value: a, label: a }))}
        />
      </Space>

      <Table<AuditLog>
        rowKey="id"
        size={isMobile ? 'small' : 'middle'}
        scroll={{ x: 1200 }}
        loading={list.isLoading}
        dataSource={list.data?.data || []}
        pagination={{
          current: page,
          pageSize: limit,
          total: list.data?.meta.total || 0,
          onChange: (p, l) => { setPage(p); setLimit(l); },
        }}
        columns={[
          {
            title: 'Thời điểm', dataIndex: 'createdAt', width: 180,
            render: formatDateTime,
          },
          { title: 'Actor', dataIndex: 'actorEmail', width: 220, responsive: ['sm'] },
          {
            title: 'Action', dataIndex: 'action', width: 180,
            render: (v: string) => <Tag>{v}</Tag>,
          },
          { title: 'Resource', dataIndex: 'resource', width: 140, responsive: ['md'] },
          { title: 'Resource ID', dataIndex: 'resourceId', width: 240, responsive: ['lg'] },
          { title: 'IP', dataIndex: 'ip', width: 140, responsive: ['lg'] },
          {
            title: 'Metadata', dataIndex: 'metadata',
            render: (v: unknown) => v ? (
              <Typography.Text code style={{ fontSize: 11 }}>
                {JSON.stringify(v)}
              </Typography.Text>
            ) : '-',
          },
        ]}
      />
    </div>
  );
}
