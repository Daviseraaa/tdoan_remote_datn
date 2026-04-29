import { useState } from 'react';
import {
  App,
  Table, Tag, Button, Space, Popconfirm, Drawer, Descriptions, Form,
  Select, Input, Modal, Typography, Timeline, InputNumber, Grid,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/lib/api';
import {
  agentsListPath,
  tasksListPath,
  taskDetailPath,
  taskCancelPath,
} from '@/lib/apiScope';
import { useAuth } from '@/providers/AuthProvider';
import type {
  Agent, PaginatedResponse, Task, TaskStatus, TaskType,
} from '@/types/api';
import { TASK_STATUS_COLOR } from '@/components/status';
import { formatDateTime, formatDuration, formatRelative } from '@/lib/format';

const STATUS_OPTIONS: TaskStatus[] = [
  'PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED',
];
const TYPE_OPTIONS: TaskType[] = [
  'COMMAND', 'SCRIPT', 'FILE_OPERATION', 'SYSTEM_INFO',
];

function dedupeTaskLogs(logs: Task['logs'] | undefined) {
  if (!logs?.length) return [];
  const seen = new Set<string>();
  return logs.filter((log) => {
    const key = `${log.createdAt}|${log.level}|${log.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function TasksPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState<TaskStatus | undefined>();
  const [type, setType] = useState<TaskType | undefined>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const tasksPath = tasksListPath(isAdmin);
  const agentsPath = agentsListPath(isAdmin);

  const list = useQuery({
    queryKey: ['tasks', isAdmin, page, limit, status, type],
    queryFn: async () =>
      unwrap<PaginatedResponse<Task>>(
        await api.get(tasksPath, {
          params: { page, limit, status, type },
        }),
      ),
    refetchInterval: 5_000,
  });

  const detail = useQuery({
    queryKey: ['task', isAdmin, detailId],
    queryFn: async () =>
      unwrap<Task>(await api.get(taskDetailPath(isAdmin, detailId!))),
    enabled: !!detailId,
    refetchInterval: detailId ? 3_000 : false,
  });

  const agents = useQuery({
    queryKey: ['agents', 'picker', isAdmin],
    queryFn: async () =>
      unwrap<PaginatedResponse<Agent>>(
        await api.get(agentsPath, { params: { page: 1, limit: 100 } }),
      ).data,
  });

  const createMut = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      unwrap<Task>(await api.post('/tasks', values)),
    onSuccess: () => {
      message.success('Đã tạo task');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setCreateOpen(false); form.resetFields();
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) =>
      api.delete(taskCancelPath(isAdmin, id)),
    onSuccess: () => {
      message.success('Đã hủy');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>Task</Typography.Title>
        <Space className="mobile-stack">
          <Select
            allowClear
            placeholder="Filter status"
            style={{ width: isMobile ? '100%' : 160 }}
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <Select
            allowClear
            placeholder="Filter type"
            style={{ width: isMobile ? '100%' : 160 }}
            value={type}
            onChange={setType}
            options={TYPE_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Tạo task
          </Button>
        </Space>
      </div>

      <Table<Task>
        rowKey="id"
        size={isMobile ? 'small' : 'middle'}
        scroll={{ x: 920 }}
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
          { title: 'Type', dataIndex: 'type', width: 120 },
          { title: 'Command', dataIndex: 'command', ellipsis: true },
          {
            title: 'Status', dataIndex: 'status', width: 120,
            render: (v: TaskStatus) => (
              <Tag color={TASK_STATUS_COLOR[v]}>{v}</Tag>
            ),
          },
          { title: 'Agent', dataIndex: ['agent', 'name'], width: 160, responsive: ['md'] },
          {
            title: 'Thời điểm', dataIndex: 'createdAt', width: 160,
            render: formatRelative,
            responsive: ['sm'],
          },
          {
            title: 'Actions', key: 'a', width: 180,
            render: (_, r) => (
              <Space wrap>
                <Button size="small" onClick={() => setDetailId(r.id)}>
                  Chi tiết
                </Button>
                {!['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(
                  r.status,
                ) && (
                  <Popconfirm
                    title="Hủy task?"
                    onConfirm={() => cancelMut.mutate(r.id)}
                  >
                    <Button size="small" danger>Hủy</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        open={!!detailId}
        title={`Task ${detailId?.slice(0, 8)}`}
        width={isMobile ? '100%' : 720}
        onClose={() => setDetailId(null)}
      >
        {detail.data && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">{detail.data.id}</Descriptions.Item>
              <Descriptions.Item label="Type">
                {detail.data.type}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={TASK_STATUS_COLOR[detail.data.status]}>
                  {detail.data.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Command">
                <Typography.Text code copyable>
                  {detail.data.command}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Exit code">
                {detail.data.exitCode ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Agent">
                {detail.data.agent?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Timeout">
                {formatDuration(detail.data.timeout)}
              </Descriptions.Item>
              <Descriptions.Item label="Started">
                {formatDateTime(detail.data.startedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Completed">
                {formatDateTime(detail.data.completedAt)}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Kết quả
            </Typography.Title>
            <pre
              style={{
                background: '#0b0f14',
                color: '#d4d4d4',
                padding: 12,
                borderRadius: 4,
                maxHeight: 320,
                overflow: 'auto',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {detail.data.result || '(trống)'}
            </pre>

            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Nhật ký
            </Typography.Title>
            <Timeline
              items={dedupeTaskLogs(detail.data.logs).map((log) => ({
                color:
                  log.level === 'ERROR'
                    ? 'red'
                    : log.level === 'WARN'
                    ? 'orange'
                    : 'blue',
                children: (
                  <>
                    <Typography.Text type="secondary">
                      {formatDateTime(log.createdAt)} [{log.level}]
                    </Typography.Text>
                    <div>{log.message}</div>
                  </>
                ),
              }))}
            />
          </>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        title="Tạo task mới"
        width={isMobile ? 'calc(100vw - 24px)' : 520}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          createMut.mutate(values);
        }}
        confirmLoading={createMut.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'COMMAND', timeout: 60000 }}
        >
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select
              options={TYPE_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
          </Form.Item>
          <Form.Item
            name="agentId" label="Agent" rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={(agents.data || []).map((a) => ({
                value: a.id,
                label: `${a.name} (${a.status})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="command"
            label="Command"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} placeholder="ipconfig /all" />
          </Form.Item>
          <Form.Item name="timeout" label="Timeout (ms)">
            <InputNumber min={5000} step={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
