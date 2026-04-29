import { useState } from 'react';
import {
  App,
  Table, Button, Space, Tag, Modal, Form, Input, Select,
  Popconfirm, Typography, Grid,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/lib/api';
import type { PaginatedResponse, Role, User } from '@/types/api';
import { formatDateTime } from '@/lib/format';

export function UsersPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['users', page, limit],
    queryFn: async () =>
      unwrap<PaginatedResponse<User>>(
        await api.get('/users', { params: { page, limit } }),
      ),
  });

  const createMut = useMutation({
    mutationFn: async (values: {
      email: string; password: string; name: string; role: Role;
    }) =>
      unwrap<User>(await api.post('/admin/users', values)),
    onSuccess: () => {
      message.success('Đã tạo người dùng');
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpen(false); form.resetFields();
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const updateMut = useMutation({
    mutationFn: async (params: { id: string; values: Partial<User> }) =>
      unwrap<User>(
        await api.patch(`/admin/users/${params.id}`, params.values),
      ),
    onSuccess: () => {
      message.success('Đã cập nhật');
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpen(false); setEditing(null); form.resetFields();
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const toggleMut = useMutation({
    mutationFn: async (id: string) =>
      unwrap<User>(await api.patch(`/users/${id}/toggle-active`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      message.success('Đã xóa');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: 'USER' });
    setOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    form.setFieldsValue({
      email: user.email, name: user.name, role: user.role,
    });
    setOpen(true);
  }

  async function onSubmit() {
    const values = await form.validateFields();
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        values: { name: values.name, role: values.role },
      });
    } else {
      createMut.mutate(values);
    }
  }

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Người dùng
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm người dùng
        </Button>
      </div>

      <Table<User>
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
          { title: 'Email', dataIndex: 'email' },
          { title: 'Tên', dataIndex: 'name', responsive: ['sm'] },
          {
            title: 'Role', dataIndex: 'role',
            width: 100,
            render: (v: Role) => (
              <Tag color={v === 'ADMIN' ? 'purple' : 'default'}>{v}</Tag>
            ),
          },
          {
            title: 'Trạng thái', dataIndex: 'isActive', width: 120,
            render: (v: boolean) => (
              <Tag color={v ? 'success' : 'default'}>
                {v ? 'Active' : 'Inactive'}
              </Tag>
            ),
          },
          {
            title: 'Tạo lúc', dataIndex: 'createdAt', width: 180,
            render: formatDateTime,
            responsive: ['md'],
          },
          {
            title: 'Actions', key: 'a', width: 280,
            render: (_, r) => (
              <Space wrap>
                <Button size="small" onClick={() => openEdit(r)}>Sửa</Button>
                <Button
                  size="small"
                  onClick={() => toggleMut.mutate(r.id)}
                >
                  {r.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Popconfirm
                  title="Xóa người dùng?"
                  onConfirm={() => deleteMut.mutate(r.id)}
                >
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title={editing ? 'Sửa người dùng' : 'Thêm người dùng'}
        width={isMobile ? 'calc(100vw - 24px)' : 520}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="email" label="Email"
            rules={[
              { required: true, type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, min: 8 }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ADMIN', label: 'Admin' },
                { value: 'USER', label: 'User' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
