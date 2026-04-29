import { useState } from 'react';
import {
  App,
  Table, Tag, Button, Space, Popconfirm, Modal, Form, Input,
  InputNumber, Select, Typography, Switch, Grid,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/lib/api';
import { workflowsListPath } from '@/lib/apiScope';
import { useAuth } from '@/providers/AuthProvider';
import type {
  OnFailure, PaginatedResponse, StepType, Workflow,
} from '@/types/api';
import { formatDateTime } from '@/lib/format';

const STEP_TYPES: StepType[] = ['COMMAND', 'SCRIPT', 'DELAY', 'CONDITION'];
const ON_FAILURE: OnFailure[] = ['STOP', 'SKIP', 'RETRY'];

export function WorkflowsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const listPath = workflowsListPath(isAdmin);

  const list = useQuery({
    queryKey: ['workflows', isAdmin, page, limit],
    queryFn: async () =>
      unwrap<PaginatedResponse<Workflow>>(
        await api.get(listPath, { params: { page, limit } }),
      ),
  });

  const saveMut = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (editing) {
        return unwrap<Workflow>(
          await api.patch(`/workflows/${editing.id}`, values),
        );
      }
      return unwrap<Workflow>(await api.post('/workflows', values));
    },
    onSuccess: () => {
      message.success(editing ? 'Đã cập nhật' : 'Đã tạo workflow');
      qc.invalidateQueries({ queryKey: ['workflows'] });
      setOpen(false); setEditing(null); form.resetFields();
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => {
      message.success('Đã xóa');
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const executeMut = useMutation({
    mutationFn: async (id: string) => api.post(`/workflows/${id}/execute`),
    onSuccess: () => message.success('Đã khởi chạy workflow'),
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      steps: [{ order: 1, type: 'COMMAND', config: '{}', onFailure: 'STOP' }],
    });
    setOpen(true);
  }

  function openEdit(w: Workflow) {
    setEditing(w);
    form.setFieldsValue({
      name: w.name,
      description: w.description,
      cronExpression: w.cronExpression,
      isActive: w.isActive,
      steps: w.steps.map((s) => ({
        order: s.order,
        type: s.type,
        config: JSON.stringify(s.config, null, 2),
        onFailure: s.onFailure,
      })),
    });
    setOpen(true);
  }

  async function onSubmit() {
    const values = await form.validateFields();
    interface StepForm {
      order: number;
      type: StepType;
      config: string;
      onFailure: OnFailure;
    }
    const steps = (values.steps as StepForm[]).map((s) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(s.config || '{}');
      } catch {
        throw new Error(`Step ${s.order}: config không phải JSON hợp lệ`);
      }
      return {
        order: s.order,
        type: s.type,
        config: parsed,
        onFailure: s.onFailure,
      };
    });
    saveMut.mutate({ ...values, steps });
  }

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Workflow
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tạo workflow
        </Button>
      </div>

      <Table<Workflow>
        rowKey="id"
        size={isMobile ? 'small' : 'middle'}
        scroll={{ x: 900 }}
        loading={list.isLoading}
        dataSource={list.data?.data || []}
        pagination={{
          current: page,
          pageSize: limit,
          total: list.data?.meta.total || 0,
          onChange: (p, l) => { setPage(p); setLimit(l); },
        }}
        columns={[
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Steps', render: (_, r) => r.steps?.length ?? 0, width: 80 },
          { title: 'Cron', dataIndex: 'cronExpression', width: 140, responsive: ['md'] },
          {
            title: 'Active', dataIndex: 'isActive', width: 100,
            render: (v: boolean) => (
              <Tag color={v ? 'success' : 'default'}>
                {v ? 'Active' : 'Inactive'}
              </Tag>
            ),
          },
          {
            title: 'Tạo lúc', dataIndex: 'createdAt', width: 160,
            render: formatDateTime,
            responsive: ['sm'],
          },
          {
            title: 'Actions', key: 'a', width: 280,
            render: (_, r) => (
              <Space wrap>
                <Button size="small" onClick={() => openEdit(r)}>Sửa</Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => executeMut.mutate(r.id)}
                >
                  Run
                </Button>
                <Popconfirm
                  title="Xóa workflow?"
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
        title={editing ? 'Sửa workflow' : 'Tạo workflow'}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        confirmLoading={saveMut.isPending}
        width={isMobile ? 'calc(100vw - 24px)' : 720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="cronExpression" label="Cron expression">
            <Input placeholder="0 8 * * *" />
          </Form.Item>
          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Typography.Title level={5}>Steps</Typography.Title>
          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <div
                    key={key}
                    style={{
                      border: '1px solid #f0f0f0',
                      padding: 12,
                      marginBottom: 12,
                      borderRadius: 4,
                    }}
                  >
                    <Space align="start" wrap style={{ width: '100%' }}>
                      <Form.Item
                        name={[name, 'order']}
                        label="Order"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} style={{ width: isMobile ? '100%' : 90 }} />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'type']}
                        label="Type"
                        rules={[{ required: true }]}
                      >
                        <Select
                          style={{ width: isMobile ? '100%' : 140 }}
                          options={STEP_TYPES.map((s) => ({
                            value: s, label: s,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'onFailure']}
                        label="On failure"
                      >
                        <Select
                          style={{ width: isMobile ? '100%' : 120 }}
                          options={ON_FAILURE.map((s) => ({
                            value: s, label: s,
                          }))}
                        />
                      </Form.Item>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Space>
                    <Form.Item
                      name={[name, 'config']}
                      label="Config (JSON)"
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder='{"command":"ipconfig","agentId":"..."}'
                      />
                    </Form.Item>
                  </div>
                ))}
                <Button
                  block
                  type="dashed"
                  onClick={() =>
                    add({
                      order: fields.length + 1,
                      type: 'COMMAND',
                      config: '{}',
                      onFailure: 'STOP',
                    })
                  }
                >
                  Thêm step
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
