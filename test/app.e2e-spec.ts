import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AdminController } from '../src/modules/admin/admin.controller';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuditService } from '../src/modules/admin/audit.service';

describe('Admin API smoke (e2e)', () => {
  let app: INestApplication<App>;

  const adminServiceMock = {
    getStats: jest.fn().mockResolvedValue({
      users: 10,
      agents: { total: 5, online: 3, offline: 2 },
      tasks: { pending: 1, running: 1, completed: 7, failed: 1 },
      workflows: 4,
    }),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    listAgents: jest.fn(),
    deleteAgent: jest.fn(),
    regenerateAgentKey: jest.fn(),
    validateFilters: jest.fn(),
    listTasks: jest.fn(),
    getTask: jest.fn(),
    cancelTask: jest.fn(),
    listWorkflows: jest.fn(),
  };
  const auditServiceMock = {
    record: jest.fn(),
    list: jest.fn().mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: adminServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('returns dashboard stats', () => {
    return request(app.getHttpServer())
      .get('/api/admin/stats')
      .expect(200)
      .expect((res) => {
        expect(res.body.users).toBe(10);
      });
  });

  it('returns audit log list', () => {
    return request(app.getHttpServer())
      .get('/api/admin/audit-logs?page=1&limit=20')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
