export const queryKeys = {
  me: ['auth', 'me'] as const,
  adminStats: ['admin', 'stats'] as const,
  adminTasks: (params: Record<string, unknown>) => ['admin', 'tasks', params] as const,
  userStats: ['user', 'stats'] as const,
  agents: (admin: boolean, params: object) =>
    ['agents', admin, params] as const,
  agent: (admin: boolean, id: string) => ['agents', admin, id] as const,
  tasks: (admin: boolean, params: Record<string, unknown>) =>
    ['tasks', admin, params] as const,
  workflows: (admin: boolean, params: Record<string, unknown>) =>
    ['workflows', admin, params] as const,
  workflow: (id: string) => ['workflow', id] as const,
  users: (params: Record<string, unknown>) => ['users', params] as const,
  audit: (params: Record<string, unknown>) => ['audit', params] as const,
};
