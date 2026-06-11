import { apiFetch, getApiBaseUrl } from '@/src/lib/api';
import { getAccessToken } from '@/src/lib/auth';
import {
  agentDeletePath,
  agentDetailPath,
  agentFilesDownloadPath,
  agentFilesListPath,
  agentFilesWritePath,
  agentRegenerateKeyPath,
  agentRemoteAccessPath,
  agentRemoteStartPath,
  agentRemoteStopPath,
  agentWakePath,
  agentsListPath,
} from '@/src/lib/apiScope';
import { normalizePaginated } from '@/src/lib/normalize';
import type {
  Agent,
  AgentChromeProfile,
  AgentFileListResponse,
  AgentFileWriteResponse,
  AgentStatus,
  CreateAgentDto,
  PaginatedResponse,
  StartAgentRemoteResponse,
  UpdateRemoteAccessDto,
  WakeAgentDto,
} from '@/src/types/api';

export interface ListAgentsParams {
  page?: number;
  limit?: number;
  status?: AgentStatus;
}

export async function listAgents(
  admin: boolean,
  params: ListAgentsParams = {},
): Promise<PaginatedResponse<Agent>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  const query = q.toString();
  const path = agentsListPath(admin);
  const raw = await apiFetch<unknown>(`${path}${query ? `?${query}` : ''}`);
  return normalizePaginated<Agent>(raw);
}

export async function createAgent(dto: CreateAgentDto): Promise<Agent> {
  return apiFetch<Agent>('/agents', { method: 'POST', body: dto });
}

export async function getAgent(admin: boolean, id: string): Promise<Agent> {
  return apiFetch<Agent>(agentDetailPath(admin, id));
}

export async function deleteAgent(admin: boolean, id: string): Promise<void> {
  return apiFetch<void>(agentDeletePath(admin, id), { method: 'DELETE' });
}

export async function regenerateAgentKey(
  admin: boolean,
  id: string,
): Promise<Agent> {
  return apiFetch<Agent>(agentRegenerateKeyPath(admin, id), { method: 'POST' });
}

export async function syncAgentChromeProfiles(
  agentId: string,
): Promise<{ profiles: AgentChromeProfile[]; count: number }> {
  return apiFetch<{ profiles: AgentChromeProfile[]; count: number }>(
    `/agents/${agentId}/chrome-profiles/sync`,
    { method: 'POST' },
  );
}

export async function wakeAgent(
  admin: boolean,
  id: string,
  dto: WakeAgentDto = {},
): Promise<{
  ok: boolean;
  agentId: string;
  macAddress: string;
  broadcast: string;
  port: number;
  message: string;
}> {
  return apiFetch(agentWakePath(admin, id), { method: 'POST', body: dto });
}

export async function updateAgentRemoteAccess(
  admin: boolean,
  id: string,
  dto: UpdateRemoteAccessDto,
): Promise<Agent> {
  return apiFetch<Agent>(agentRemoteAccessPath(admin, id), {
    method: 'PATCH',
    body: dto,
  });
}

export async function startAgentRemote(
  admin: boolean,
  id: string,
): Promise<StartAgentRemoteResponse> {
  return apiFetch<StartAgentRemoteResponse>(agentRemoteStartPath(admin, id), {
    method: 'POST',
    body: {},
  });
}

export async function stopAgentRemote(
  admin: boolean,
  id: string,
): Promise<StartAgentRemoteResponse> {
  return apiFetch<StartAgentRemoteResponse>(agentRemoteStopPath(admin, id), {
    method: 'POST',
    body: {},
  });
}

export async function listAgentFiles(
  admin: boolean,
  id: string,
  path = '',
): Promise<AgentFileListResponse> {
  return apiFetch<AgentFileListResponse>(agentFilesListPath(admin, id, path || undefined));
}

export async function downloadAgentFile(
  admin: boolean,
  id: string,
  path: string,
): Promise<void> {
  const token = getAccessToken();
  const url = `${getApiBaseUrl()}${agentFilesDownloadPath(admin, id, path)}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(
      typeof (json as { message?: string }).message === 'string'
        ? (json as { message: string }).message
        : `Tải file thất bại (${res.status})`,
    );
  }
  const blob = await res.blob();
  const name = path.split('/').pop() || 'download';
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = name;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

const FILE_CHUNK_BYTES = 768 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const slice = 0x8000;
  for (let i = 0; i < bytes.length; i += slice) {
    binary += String.fromCharCode(...bytes.subarray(i, i + slice));
  }
  return btoa(binary);
}

export async function uploadAgentFile(
  admin: boolean,
  id: string,
  path: string,
  file: File,
): Promise<AgentFileWriteResponse> {
  const relPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relPath || relPath.endsWith('/')) {
    throw new Error('Đường dẫn file không hợp lệ');
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length <= FILE_CHUNK_BYTES) {
    const isText =
      file.type.startsWith('text/') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.env') ||
      file.name.endsWith('.ps1') ||
      file.name.endsWith('.txt');
    return apiFetch<AgentFileWriteResponse>(agentFilesWritePath(admin, id), {
      method: 'POST',
      body: {
        path: relPath,
        content: isText
          ? new TextDecoder().decode(buf)
          : bytesToBase64(buf),
        encoding: isText ? 'utf-8' : 'base64',
      },
    });
  }

  const uploadId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `up-${Date.now()}`;
  const totalChunks = Math.ceil(buf.length / FILE_CHUNK_BYTES);
  let last: AgentFileWriteResponse | null = null;

  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * FILE_CHUNK_BYTES;
    const chunk = buf.subarray(start, start + FILE_CHUNK_BYTES);
    last = await apiFetch<AgentFileWriteResponse>(agentFilesWritePath(admin, id), {
      method: 'POST',
      body: {
        path: relPath,
        content: bytesToBase64(chunk),
        encoding: 'base64',
        uploadId,
        chunkIndex: i,
        totalChunks,
      },
    });
  }

  if (!last?.written) {
    throw new Error('Upload chưa hoàn tất');
  }
  return last;
}
