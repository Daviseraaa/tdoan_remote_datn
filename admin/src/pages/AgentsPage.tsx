import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  App,
  Table, Tag, Button, Space, Popconfirm, Drawer, Descriptions,
  Typography, Modal, Form, Input, Grid,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/lib/api';
import {
  agentsListPath,
  agentDeletePath,
  agentRegeneratePath,
} from '@/lib/apiScope';
import { useAuth } from '@/providers/AuthProvider';
import type { Agent, AgentStatus, PaginatedResponse } from '@/types/api';
import { AGENT_STATUS_COLOR } from '@/components/status';
import { formatDateTime, formatRelative } from '@/lib/format';

export function AgentsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [detail, setDetail] = useState<Agent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const listPath = agentsListPath(isAdmin);

  const list = useQuery({
    queryKey: ['agents', isAdmin, page, limit],
    queryFn: async () =>
      unwrap<PaginatedResponse<Agent>>(
        await api.get(listPath, { params: { page, limit } }),
      ),
    refetchInterval: 10_000,
  });

  const createMut = useMutation({
    mutationFn: async (values: { name: string; os?: string; hostname?: string }) =>
      unwrap<Agent>(await api.post('/agents', values)),
    onSuccess: (agent) => {
      message.success('Đã tạo agent');
      qc.invalidateQueries({ queryKey: ['agents'] });
      setCreateOpen(false);
      form.resetFields();
      setDetail(agent);
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) =>
      api.delete(agentDeletePath(isAdmin, id)),
    onSuccess: () => {
      message.success('Đã xóa agent');
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const regenMut = useMutation({
    mutationFn: async (id: string) =>
      unwrap<Agent>(
        await api.post(agentRegeneratePath(isAdmin, id)),
      ),
    onSuccess: (data) => {
      message.success('Đã tạo lại agent key');
      setDetail(data);
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Agent
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setCreateOpen(true);
          }}
        >
          Đăng ký agent
        </Button>
      </div>

      <Table<Agent>
        rowKey="id"
        size={isMobile ? 'small' : 'middle'}
        scroll={{ x: 980 }}
        loading={list.isLoading}
        dataSource={list.data?.data || []}
        pagination={{
          current: page,
          pageSize: limit,
          total: list.data?.meta.total || 0,
          onChange: (p, l) => { setPage(p); setLimit(l); },
          showSizeChanger: true,
        }}
        columns={[
          { title: 'Tên', dataIndex: 'name' },
          {
            title: 'Trạng thái', dataIndex: 'status', width: 120,
            render: (v: AgentStatus) => (
              <Tag color={AGENT_STATUS_COLOR[v]}>{v}</Tag>
            ),
          },
          { title: 'Hostname', dataIndex: 'hostname', width: 180, responsive: ['md'] },
          { title: 'OS', dataIndex: 'os', width: 180, responsive: ['lg'] },
          { title: 'IP', dataIndex: 'ip', width: 140, responsive: ['lg'] },
          {
            title: 'Last seen', dataIndex: 'lastSeenAt', width: 160,
            render: formatRelative,
            responsive: ['md'],
          },
          {
            title: 'Actions', key: 'a', width: 280,
            render: (_, r) => (
              <Space wrap>
                <Link to={`/remote/${r.id}`}>
                  <Button size="small" type="link" disabled={r.status !== 'ONLINE'}>
                    Remote
                  </Button>
                </Link>
                <Button size="small" onClick={() => setDetail(r)}>
                  Xem key
                </Button>
                <Popconfirm
                  title="Tạo lại agent key?"
                  description="Agent hiện tại sẽ không kết nối được nữa."
                  onConfirm={() => regenMut.mutate(r.id)}
                >
                  <Button size="small">Regenerate</Button>
                </Popconfirm>
                <Popconfirm
                  title="Xóa agent?"
                  onConfirm={() => deleteMut.mutate(r.id)}
                >
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        open={!!detail}
        title={detail?.name}
        width={isMobile ? '100%' : 520}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="Agent Key">
              <Typography.Text code copyable>
                {detail.agentKey}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={AGENT_STATUS_COLOR[detail.status]}>
                {detail.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Hostname">
              {detail.hostname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="OS">{detail.os || '-'}</Descriptions.Item>
            <Descriptions.Item label="IP">{detail.ip || '-'}</Descriptions.Item>
            <Descriptions.Item label="Last seen">
              {formatDateTime(detail.lastSeenAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {formatDateTime(detail.createdAt)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        title="Đăng ký agent mới"
        width={isMobile ? 'calc(100vw - 24px)' : 520}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          createMut.mutate(values);
        }}
        confirmLoading={createMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
            <Input placeholder="Máy làm việc" />
          </Form.Item>
          <Form.Item name="os" label="OS (tuỳ chọn)">
            <Input placeholder="Windows 11" />
          </Form.Item>
          <Form.Item name="hostname" label="Hostname (tuỳ chọn)">
            <Input placeholder="DESKTOP-ABC" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
