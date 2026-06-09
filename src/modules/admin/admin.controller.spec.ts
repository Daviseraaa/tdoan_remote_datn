import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { TasksService } from '../tasks/tasks.service';

describe('AdminController', () => {
  let controller: AdminController;
  const adminService = {
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteAgent: jest.fn(),
    regenerateAgentKey: jest.fn(),
    cancelTask: jest.fn(),
    getStats: jest.fn(),
    listAgents: jest.fn(),
    validateFilters: jest.fn(),
    listTasks: jest.fn(),
    getTask: jest.fn(),
    listWorkflows: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
    list: jest.fn(),
  };
  const tasksService = {
    retry: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: AuditService, useValue: auditService },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();

    controller = module.get(AdminController);
  });

  it('records audit log after creating user', async () => {
    adminService.createUser.mockResolvedValue({
      id: 'u2',
      email: 'new@stationhub.com',
      role: 'USER',
    });

    await controller.createUser(
      { sub: 'admin-id', email: 'admin@stationhub.com', role: 'ADMIN' },
      { email: 'new@stationhub.com', name: 'New User', password: 'secret123' },
      '127.0.0.1',
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.create',
        resource: 'user',
        actorEmail: 'admin@stationhub.com',
      }),
    );
  });

  it('records audit log after task cancellation', async () => {
    adminService.cancelTask.mockResolvedValue({ message: 'Task cancelled' });

    await controller.cancelTask(
      { sub: 'admin-id', email: 'admin@stationhub.com', role: 'ADMIN' },
      'task-1',
      '127.0.0.1',
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'task.cancel',
        resourceId: 'task-1',
      }),
    );
  });
});
