import { DesktopRecordingsService } from './desktop-recordings.service';
import type { AgentDesktopRecordingEntry } from '../../common/desktop-recordings-registry';

describe('DesktopRecordingsService.syncFromAgent', () => {
  const prisma = {
    agent: { findFirst: jest.fn() },
    desktopRecording: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const service = new DesktopRecordingsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.agent.findFirst.mockResolvedValue({ id: 'agent-1', userId: 'user-1' });
    prisma.desktopRecording.findFirst.mockResolvedValue(null);
    prisma.desktopRecording.create.mockResolvedValue({ id: 'db-1' });
  });

  it('inserts valid recordings and skips invalid', async () => {
    const recordings: AgentDesktopRecordingEntry[] = [
      {
        id: 'local-1',
        name: 'Test',
        steps: [{ action: 'click', x: 1, y: 2, button: 'left' }],
      },
      { id: '', name: 'Bad', steps: [{ action: 'delay', ms: 1 }] },
      { id: 'local-2', name: 'Empty', steps: [] },
    ];

    const summary = await service.syncFromAgent('user-1', 'agent-1', recordings);

    expect(summary.inserted).toBe(1);
    expect(summary.skipped).toBe(2);
    expect(summary.total).toBe(3);
    expect(prisma.desktopRecording.create).toHaveBeenCalledTimes(1);
  });
});
