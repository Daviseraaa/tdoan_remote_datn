import { useEffect } from 'react';
import {
  Row, Col, Card, Statistic, Table, Tag, Spin, Alert, Typography, Grid,
} from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, apiErrorMessage, unwrap } from '@/lib/api';
import { getClientSocket } from '@/lib/socket';
import { useAuth } from '@/providers/AuthProvider';
import type { AdminStats, Agent, PaginatedResponse, Task, Workflow } from '@/types/api';
import { TASK_STATUS_COLOR } from '@/components/status';
import { formatRelative } from '@/lib/format';

function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => unwrap<AdminStats>(await api.get('/admin/stats')),
    refetchInterval: 15_000,
  });
}

function useAdminRecentTasks() {
  return useQuery({
    queryKey: ['admin', 'tasks', 'recent'],
    queryFn: async () =>
      unwrap<{ data: Task[] }>(
        await api.get('/admin/tasks', { params: { limit: 8, page: 1 } }),
      ).data,
    refetchInterval: 10_000,
  });
}

function useUserDashboardCounts() {
  return useQuery({
    queryKey: ['user', 'dashboard', 'counts'],
    queryFn: async () => {
      const [a, t, w] = await Promise.all([
        unwrap<PaginatedResponse<Agent>>(
          await api.get('/agents', { params: { page: 1, limit: 1 } }),
        ),
        unwrap<PaginatedResponse<Task>>(
          await api.get('/tasks', { params: { page: 1, limit: 1 } }),
        ),
        unwrap<PaginatedResponse<Workflow>>(
          await api.get('/workflows', { params: { page: 1, limit: 1 } }),
        ),
      ]);
      return {
        agents: a.meta.total,
        tasks: t.meta.total,
        workflows: w.meta.total,
      };
    },
    refetchInterval: 15_000,
  });
}

function useUserRecentTasks() {
  return useQuery({
    queryKey: ['user', 'tasks', 'recent'],
    queryFn: async () =>
      unwrap<{ data: Task[] }>(
        await api.get('/tasks', { params: { limit: 8, page: 1 } }),
      ).data,
    refetchInterval: 10_000,
  });
}

function AdminDashboard() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const stats = useAdminStats();
  const tasks = useAdminRecentTasks();
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getClientSocket();
    const onTask = () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
    };
    socket.on('task:completed', onTask);
    socket.on('task:failed', onTask);
    return () => {
      socket.off('task:completed', onTask);
      socket.off('task:failed', onTask);
    };
  }, [qc]);

  if (stats.isLoading) return <Spin />;
  if (stats.error) {
    return <Alert type="error" message={apiErrorMessage(stats.error)} />;
  }
  const s = stats.data;
  if (!s) return null;

  return (
    <div>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Tổng người dùng" value={s.users.total} />
            <Typography.Text type="secondary">
              {s.users.admins} admin · {s.users.active} active
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Agent online"
              value={s.agents.online}
              valueStyle={{ color: '#52c41a' }}
            />
            <Typography.Text type="secondary">
              {s.agents.total} tổng · {s.agents.offline} offline
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Task đang chạy"
              value={s.tasks.running + s.tasks.pending}
              valueStyle={{ color: '#1677ff' }}
            />
            <Typography.Text type="secondary">
              {s.tasks.pending} pending · {s.tasks.running} running
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Task thất bại"
              value={s.tasks.failed}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <Typography.Text type="secondary">
              {s.tasks.completed} completed · {s.tasks.cancelled} cancelled
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="Xu hướng task 7 ngày gần nhất">
        <div style={{ width: '100%', height: isMobile ? 220 : 280 }}>
          <ResponsiveContainer>
            <LineChart data={s.taskTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="#52c41a"
              />
              <Line
                type="monotone"
                dataKey="failed"
                name="Failed"
                stroke="#ff4d4f"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }} title="Task gần đây (toàn hệ thống)">
        <Table<Task>
          rowKey="id"
          size={isMobile ? 'small' : 'middle'}
          pagination={false}
          scroll={{ x: 720 }}
          loading={tasks.isLoading}
          dataSource={tasks.data || []}
          columns={[
            {
              title: 'Task',
              dataIndex: 'command',
              render: (v: string | null, r) => v || r.type,
              ellipsis: true,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 120,
              render: (v: string) => (
                <Tag color={TASK_STATUS_COLOR[v as keyof typeof TASK_STATUS_COLOR]}>
                  {v}
                </Tag>
              ),
            },
            {
              title: 'Agent',
              dataIndex: ['agent', 'name'],
              width: 160,
              responsive: ['md'],
            },
            {
              title: 'Thời điểm',
              dataIndex: 'createdAt',
              width: 180,
              render: formatRelative,
              responsive: ['sm'],
            },
          ]}
        />
      </Card>
    </div>
  );
}

function UserDashboard() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const stats = useUserDashboardCounts();
  const tasks = useUserRecentTasks();
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getClientSocket();
    const onTask = () => {
      qc.invalidateQueries({ queryKey: ['user'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
    };
    socket.on('task:completed', onTask);
    socket.on('task:failed', onTask);
    return () => {
      socket.off('task:completed', onTask);
      socket.off('task:failed', onTask);
    };
  }, [qc]);

  if (stats.isLoading) return <Spin />;
  if (stats.error) {
    return <Alert type="error" message={apiErrorMessage(stats.error)} />;
  }
  const c = stats.data;
  if (!c) return null;

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Thống kê theo tài khoản của bạn (agent, task, workflow).
      </Typography.Paragraph>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Agent của bạn" value={c.agents} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Task của bạn" value={c.tasks} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Workflow của bạn" value={c.workflows} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="Task gần đây">
        <Table<Task>
          rowKey="id"
          size={isMobile ? 'small' : 'middle'}
          pagination={false}
          scroll={{ x: 720 }}
          loading={tasks.isLoading}
          dataSource={tasks.data || []}
          columns={[
            {
              title: 'Task',
              dataIndex: 'command',
              render: (v: string | null, r) => v || r.type,
              ellipsis: true,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 120,
              render: (v: string) => (
                <Tag color={TASK_STATUS_COLOR[v as keyof typeof TASK_STATUS_COLOR]}>
                  {v}
                </Tag>
              ),
            },
            {
              title: 'Agent',
              dataIndex: ['agent', 'name'],
              width: 160,
              responsive: ['md'],
            },
            {
              title: 'Thời điểm',
              dataIndex: 'createdAt',
              width: 180,
              render: formatRelative,
              responsive: ['sm'],
            },
          ]}
        />
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}
