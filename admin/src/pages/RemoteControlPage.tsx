import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  App,
  Alert,
  Button,
  Card,
  Space,
  Tag,
  Typography,
  Grid,
  Select,
  Statistic,
  Row,
  Col,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { useMutation } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/lib/api';
import { agentDetailPath } from '@/lib/apiScope';
import { useAuth } from '@/providers/AuthProvider';
import type { Agent, AgentStatus } from '@/types/api';
import { AGENT_STATUS_COLOR } from '@/components/status';
import {
  TILE_PATCH_CHANNEL_LABEL,
  applyTilePatchToCanvas,
  decodeTilePatchMessage,
} from '@/pages/remote/tilePatch';

const EV = {
  REMOTE_READY: 'remote:ready',
  REMOTE_OFFER: 'remote:offer',
  REMOTE_ANSWER: 'remote:answer',
  REMOTE_ICE: 'remote:ice',
  REMOTE_HEARTBEAT: 'remote:heartbeat',
  REMOTE_END: 'remote:end',
  REMOTE_TELEMETRY: 'remote:telemetry',
} as const;

type IceServer = { urls: string[]; username?: string; credential?: string };

type CreateRemoteSessionResponse = {
  session: {
    id: string;
    status: string;
    agentId: string;
    operatorId: string;
    controlMode: string;
    startedAt: string | null;
    endedAt: string | null;
    lastHeartbeatAt: string | null;
    createdAt: string;
  };
  operatorSignalingToken: string;
  iceServers: IceServer[];
  qualityProfile?: 'low-latency' | 'balanced' | 'high-quality';
  preferredRegion?: string;
  mediaEngine?: 'wrtc' | 'ndc';
};

type RemoteTelemetry = {
  rttMs?: number;
  effectiveFps?: number;
  captureMsAvg?: number;
  convertMsAvg?: number;
  effectiveBitrateKbps?: number;
  dirtyRatio?: number;
  patchBytes?: number;
  patchTiles?: number;
  patchDropCount?: number;
  mediaEngine?: 'wrtc' | 'ndc';
  pipeline?: string;
  /** Agent có pipeline capture màn hình (tile-diff / dirty) — false với NDC. */
  screenMetricsAvailable?: boolean;
  /** Agent có gửi tile-patch qua DataChannel (chỉ wrtc + software). */
  tilePatchDcAvailable?: boolean;
};

function preferredMediaEngine(): 'wrtc' | 'ndc' | undefined {
  const raw = (import.meta.env.VITE_REMOTE_MEDIA_ENGINE as string | undefined)?.trim();
  if (raw === 'wrtc' || raw === 'ndc') return raw;
  return undefined;
}

function defaultQualityProfile(): 'low-latency' | 'balanced' | 'high-quality' {
  const raw = (import.meta.env.VITE_REMOTE_DEFAULT_QUALITY_PROFILE as string | undefined)?.trim();
  if (raw === 'low-latency' || raw === 'balanced' || raw === 'high-quality') return raw;
  return 'balanced';
}

function defaultRegion(): string {
  return ((import.meta.env.VITE_REMOTE_DEFAULT_REGION as string | undefined)?.trim() || 'sg').toLowerCase();
}

function viteTilePatchEnabled(): boolean {
  const r = (import.meta.env.VITE_REMOTE_TILE_PATCH_ENABLED as string | undefined)?.trim().toLowerCase();
  if (r === '0' || r === 'false' || r === 'off') return false;
  return true;
}

function showDirtyRatio(t: RemoteTelemetry | null): string | number {
  if (!t) return 0;
  if (t.mediaEngine === 'ndc') return '—';
  return t.dirtyRatio ?? 0;
}

function showPatchBytes(t: RemoteTelemetry | null): string | number {
  if (!t) return 0;
  if (t.tilePatchDcAvailable === false) return '—';
  return t.patchBytes ?? 0;
}

function showPatchOverlayLabel(
  t: RemoteTelemetry | null,
  overlayOn: boolean,
  vitePatch: boolean,
): string {
  if (!t) return vitePatch ? 'off' : 'tắt (build)';
  if (t.tilePatchDcAvailable === false) {
    return t.mediaEngine === 'ndc' ? 'n/a (NDC)' : t.pipeline === 'ffmpeg' ? 'n/a (ffmpeg)' : 'n/a';
  }
  if (!vitePatch) return 'tắt (build)';
  return overlayOn ? 'on' : 'off';
}

function showPatchApplyMs(
  t: RemoteTelemetry | null,
  overlayOn: boolean,
  ms: number,
  vitePatch: boolean,
): string | number {
  if (!t) return 0;
  if (t.tilePatchDcAvailable === false || !vitePatch) return '—';
  return overlayOn ? ms : 0;
}

function apiOrigin(): string {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000/api';
  return new URL(base).origin;
}

export function RemoteControlPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { isAdmin } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const patchCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const controlDcRef = useRef<RTCDataChannel | null>(null);
  const hbRef = useRef<number | null>(null);
  const restHbRef = useRef<number | null>(null);
  const rttRef = useRef<number | null>(null);
  const negotiatedRef = useRef(false);
  const tilePatchPendingRef = useRef<ArrayBuffer | null>(null);
  const tilePatchRafRef = useRef<number | null>(null);
  const tilePatchLastFrameIdRef = useRef(0);
  const tilePatchChRef = useRef<RTCDataChannel | null>(null);
  /** Tính bitrate/FPS phía browser (inbound-rtp) khi agent không gửi telemetry. */
  const recvVideoStatRef = useRef<{ bytes: number; frames: number; at: number } | null>(null);
  const dragRef = useRef<{ active: boolean; points: { x: number; y: number }[] }>({
    active: false,
    points: [],
  });

  const [agent, setAgent] = useState<Agent | null>(null);
  const [session, setSession] = useState<CreateRemoteSessionResponse['session'] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live' | 'ended' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [qualityProfile, setQualityProfile] = useState<'low-latency' | 'balanced' | 'high-quality'>(defaultQualityProfile);
  const [preferredRegion, setPreferredRegion] = useState<string>(defaultRegion);
  const [telemetry, setTelemetry] = useState<RemoteTelemetry | null>(null);
  const [patchOverlayActive, setPatchOverlayActive] = useState(false);
  const [patchApplyMs, setPatchApplyMs] = useState(0);

  const clearPatchCanvas = useCallback(() => {
    const c = patchCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width || 0, c.height || 0);
  }, []);

  const syncPatchCanvasSize = useCallback(() => {
    const v = videoRef.current;
    const c = patchCanvasRef.current;
    if (!v || !c) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  }, []);

  const cleanup = useCallback(() => {
    negotiatedRef.current = false;
    if (hbRef.current) {
      window.clearInterval(hbRef.current);
      hbRef.current = null;
    }
    if (restHbRef.current) {
      window.clearInterval(restHbRef.current);
      restHbRef.current = null;
    }
    if (rttRef.current) {
      window.clearInterval(rttRef.current);
      rttRef.current = null;
    }
    if (tilePatchRafRef.current !== null) {
      window.cancelAnimationFrame(tilePatchRafRef.current);
      tilePatchRafRef.current = null;
    }
    tilePatchPendingRef.current = null;
    tilePatchLastFrameIdRef.current = 0;
    recvVideoStatRef.current = null;
    try {
      tilePatchChRef.current?.close();
    } catch {
      /* ignore */
    }
    tilePatchChRef.current = null;
    setPatchOverlayActive(false);
    try {
      socketRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    socketRef.current = null;
    try {
      controlDcRef.current?.close();
    } catch {
      /* ignore */
    }
    controlDcRef.current = null;
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    clearPatchCanvas();
  }, [clearPatchCanvas]);

  const sendControl = useCallback((body: Record<string, unknown>) => {
    const dc = controlDcRef.current;
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify(body));
        return;
      } catch {
        // fallback to socket below
      }
    }
    socketRef.current?.emit('remote:control', body);
  }, []);

  const refSize = useCallback(() => {
    const v = videoRef.current;
    const w = v?.videoWidth || v?.clientWidth || 1920;
    const h = v?.videoHeight || v?.clientHeight || 1080;
    return { w, h };
  }, []);

  const clientToNorm = useCallback(
    (clientX: number, clientY: number) => {
      const el = overlayRef.current;
      if (!el) return { x: 0, y: 0, rw: 1, rh: 1 };
      const r = el.getBoundingClientRect();
      const { w, h } = refSize();
      const x = ((clientX - r.left) / r.width) * w;
      const y = ((clientY - r.top) / r.height) * h;
      return { x, y, rw: w, rh: h };
    },
    [refSize],
  );

  const startRemote = useCallback(
    async (res: CreateRemoteSessionResponse) => {
      cleanup();
      setSession(res.session);
      negotiatedRef.current = false;
      setPhase('connecting');
      setError(null);

      const pc = new RTCPeerConnection({ iceServers: res.iceServers });
      pcRef.current = pc;

      if (viteTilePatchEnabled()) {
        pc.ondatachannel = (ev) => {
          if (ev.channel.label !== TILE_PATCH_CHANNEL_LABEL) return;
          const ch = ev.channel;
          tilePatchChRef.current = ch;
          ch.binaryType = 'arraybuffer';
          ch.onopen = () => {
            setPatchOverlayActive(true);
            syncPatchCanvasSize();
          };
          ch.onclose = () => {
            setPatchOverlayActive(false);
            clearPatchCanvas();
            tilePatchChRef.current = null;
          };
          ch.onerror = () => {
            setPatchOverlayActive(false);
            clearPatchCanvas();
            tilePatchChRef.current = null;
          };
          ch.onmessage = (e: MessageEvent<ArrayBuffer>) => {
            const data = e.data;
            if (!data) return;
            tilePatchPendingRef.current = data.slice(0);
            if (tilePatchRafRef.current === null) {
              tilePatchRafRef.current = window.requestAnimationFrame(() => {
                tilePatchRafRef.current = null;
                const raw = tilePatchPendingRef.current;
                tilePatchPendingRef.current = null;
                if (!raw) return;
                const decoded = decodeTilePatchMessage(raw);
                if (!decoded) return;
                if (decoded.frameId < tilePatchLastFrameIdRef.current) return;
                tilePatchLastFrameIdRef.current = decoded.frameId;
                syncPatchCanvasSize();
                const c = patchCanvasRef.current;
                if (!c) return;
                const ctx = c.getContext('2d');
                if (!ctx) return;
                const ms = applyTilePatchToCanvas(ctx, decoded, c.width, c.height);
                setPatchApplyMs(ms);
              });
            }
          };
        };
      }

      const controlDc = pc.createDataChannel('control', {
        ordered: true,
      });
      controlDcRef.current = controlDc;
      controlDc.onopen = () => {
        message.success('Control channel đã kết nối');
      };
      controlDc.onclose = () => {
        message.warning('Control channel đóng, đang fallback socket');
      };
      controlDc.onerror = () => {
        message.warning('Control channel lỗi, đang fallback socket');
      };

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
        }
        setPhase('live');
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socketRef.current?.emit(EV.REMOTE_ICE, {
            payload: ev.candidate.toJSON(),
          });
        }
      };

      pc.addTransceiver('video', { direction: 'recvonly' });

      const origin = apiOrigin();
      const sock = io(`${origin}/ws/remote`, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token: res.operatorSignalingToken },
      });
      socketRef.current = sock;

      sock.on('connect', () => {
        if (hbRef.current) window.clearInterval(hbRef.current);
        hbRef.current = window.setInterval(() => {
          sock.emit(EV.REMOTE_HEARTBEAT, {});
        }, 20_000);
        if (rttRef.current) window.clearInterval(rttRef.current);
        rttRef.current = window.setInterval(async () => {
          try {
            const stats = await pc.getStats();
            let rttMs: number | undefined;
            stats.forEach((st) => {
              if ((st as RTCStats).type === 'candidate-pair') {
                const cp = st as RTCStats & { currentRoundTripTime?: number; nominated?: boolean };
                if (cp.nominated && typeof cp.currentRoundTripTime === 'number') {
                  rttMs = Math.round(cp.currentRoundTripTime * 1000);
                }
              }
            });
            if (Number.isFinite(rttMs)) {
              sock.emit('remote:rtt:report', { region: preferredRegion, rttMs });
            }
          } catch {
            /* ignore */
          }
        }, 8000);
      });

      sock.on(EV.REMOTE_READY, async () => {
        if (negotiatedRef.current || !pcRef.current) return;
        negotiatedRef.current = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sock.emit(EV.REMOTE_OFFER, { payload: pc.localDescription });
        } catch (e) {
          setError(apiErrorMessage(e));
          setPhase('error');
        }
      });

      sock.on(EV.REMOTE_ANSWER, async ({ payload }: { payload?: RTCSessionDescriptionInit }) => {
        if (!payload || !pcRef.current) return;
        try {
          if (pcRef.current.signalingState !== 'have-local-offer') {
            return;
          }
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
        } catch (e) {
          setError(apiErrorMessage(e));
        }
      });

      sock.on(EV.REMOTE_ICE, async ({ payload }: { payload?: RTCIceCandidateInit }) => {
        if (!payload || !pcRef.current) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        } catch {
          /* ignore */
        }
      });

      sock.on(EV.REMOTE_END, () => {
        message.info('Phiên remote đã kết thúc');
        setPhase('ended');
        cleanup();
        setSession(null);
      });
      sock.on(EV.REMOTE_TELEMETRY, (data: unknown) => {
        const raw = data as Record<string, unknown> | null | undefined;
        const p =
          raw &&
          typeof raw === 'object' &&
          'payload' in raw &&
          raw.payload != null &&
          typeof raw.payload === 'object'
            ? (raw.payload as RemoteTelemetry)
            : (raw as RemoteTelemetry | null);
        if (!p || typeof p !== 'object') return;
        setTelemetry((prev) => ({ ...prev, ...p }));
      });

      sock.on('disconnect', () => {
        setPhase((p) => (p === 'ended' ? p : 'ended'));
      });

      if (restHbRef.current) window.clearInterval(restHbRef.current);
      restHbRef.current = window.setInterval(() => {
        void api.post(`/remote/sessions/${res.session.id}/heartbeat`).catch(() => {});
      }, 25_000);
    },
    [cleanup, message, preferredRegion, clearPatchCanvas, syncPatchCanvasSize],
  );

  const createMut = useMutation({
    mutationFn: async (id: string) =>
      unwrap<CreateRemoteSessionResponse>(
        await api.post('/remote/sessions', {
          agentId: id,
          controlMode: 'full',
          // Luôn gửi string: axios bỏ field undefined → server từng mặc định 'wrtc' và ghi đè env agent (ndc).
          mediaEngine: preferredMediaEngine() ?? 'wrtc',
          qualityProfile,
          preferredRegion,
        }),
      ),
    onSuccess: async (data) => {
      message.success('Đã tạo phiên remote');
      await startRemote(data);
    },
    onError: (e) => {
      setError(apiErrorMessage(e));
      setPhase('error');
      message.error(apiErrorMessage(e));
    },
  });

  const stopMut = useMutation({
    mutationFn: async (id: string) => api.post(`/remote/sessions/${id}/stop`),
    onSuccess: () => {
      message.success('Đã dừng phiên');
      cleanup();
      setPhase('ended');
      setSession(null);
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const panicMut = useMutation({
    mutationFn: async (id: string) => api.post(`/remote/sessions/${id}/panic`),
    onSuccess: () => {
      message.warning('Đã panic-stop phiên');
      cleanup();
      setPhase('ended');
      setSession(null);
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    (async () => {
      try {
        const a = unwrap<Agent>(
          await api.get(agentDetailPath(isAdmin, agentId)),
        );
        if (!cancelled) setAgent(a);
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, isAdmin]);

  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup],
  );

  useEffect(() => {
    if (phase !== 'live') return;
    sendControl({ type: 'SET_QUALITY_PROFILE', profile: qualityProfile });
  }, [phase, qualityProfile, sendControl]);

  const onOverlayPointerDown = (e: React.PointerEvent) => {
    if (phase !== 'live') return;
    e.preventDefault();
    overlayRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    dragRef.current = { active: true, points: [{ x, y }] };
  };

  const onOverlayPointerMove = (e: React.PointerEvent) => {
    if (phase !== 'live' || !dragRef.current.active) return;
    const { x, y, rw, rh } = clientToNorm(e.clientX, e.clientY);
    const last = dragRef.current.points[dragRef.current.points.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 2) return;
    dragRef.current.points.push({ x, y });
    sendControl({
      type: 'MOUSE_MOVE',
      x,
      y,
      screenWidth: rw,
      screenHeight: rh,
    });
  };

  const onOverlayPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const { rw, rh } = clientToNorm(e.clientX, e.clientY);
    const pts = dragRef.current.points;
    dragRef.current.points = [];
    try {
      overlayRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (pts.length === 0) return;
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const btn = e.button === 2 ? 'right' : 'left';
    if (dist < 6) {
      sendControl({
        type: 'MOUSE_CLICK',
        button: btn,
        x: end.x,
        y: end.y,
        screenWidth: rw,
        screenHeight: rh,
      });
    } else {
      sendControl({
        type: 'MOUSE_DRAG',
        path: pts,
        screenWidth: rw,
        screenHeight: rh,
      });
    }
  };

  /** Wheel: React onWheel là passive → preventDefault lỗi. Dùng native listener { passive: false }. */
  useEffect(() => {
    if (phase !== 'live') return;
    const el = overlayRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      sendControl({ type: 'MOUSE_WHEEL', deltaX: e.deltaX, deltaY: e.deltaY });
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [phase, sendControl]);

  /** Bổ sung RTT/FPS/bitrate từ getStats() (phía nhận) khi payload agent thiếu hoặc = 0. */
  useEffect(() => {
    if (phase !== 'live') return;
    const tick = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rttMs: number | undefined;
        let fps: number | undefined;
        let bytesIn: number | undefined;
        let framesIn: number | undefined;
        stats.forEach((st) => {
          const t = (st as RTCStats).type;
          if (t === 'candidate-pair') {
            const cp = st as RTCStats & { nominated?: boolean; currentRoundTripTime?: number };
            if (cp.nominated && typeof cp.currentRoundTripTime === 'number') {
              rttMs = Math.round(cp.currentRoundTripTime * 1000);
            }
          }
          if (t === 'inbound-rtp') {
            const r = st as RTCStats & { kind?: string; framesPerSecond?: number };
            if (r.kind !== 'video') return;
            if (typeof r.framesPerSecond === 'number' && Number.isFinite(r.framesPerSecond)) {
              fps = r.framesPerSecond;
            }
            const br = st as RTCStats & { bytesReceived?: number; framesReceived?: number };
            if (typeof br.bytesReceived === 'number') bytesIn = br.bytesReceived;
            if (typeof br.framesReceived === 'number') framesIn = br.framesReceived;
          }
        });
        const now = Date.now();
        let kbps: number | undefined;
        const prev = recvVideoStatRef.current;
        if (bytesIn != null && prev && framesIn != null) {
          const dt = (now - prev.at) / 1000;
          if (dt > 0.2) {
            const dBytes = bytesIn - prev.bytes;
            kbps = Math.round((dBytes * 8) / 1000 / dt);
            if ((fps == null || !Number.isFinite(fps)) && dt > 0) {
              fps = (framesIn - prev.frames) / dt;
            }
          }
        }
        if (bytesIn != null && framesIn != null) {
          recvVideoStatRef.current = { bytes: bytesIn, frames: framesIn, at: now };
        }
        setTelemetry((prev) => {
          const base = prev ?? {};
          return {
            ...base,
            rttMs: rttMs ?? base.rttMs,
            effectiveFps:
              base.effectiveFps != null && base.effectiveFps > 0
                ? base.effectiveFps
                : (fps ?? base.effectiveFps),
            effectiveBitrateKbps:
              base.effectiveBitrateKbps != null && base.effectiveBitrateKbps > 0
                ? base.effectiveBitrateKbps
                : (kbps ?? base.effectiveBitrateKbps),
          };
        });
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      window.clearInterval(id);
      recvVideoStatRef.current = null;
    };
  }, [phase]);

  if (!agentId) {
    return <Alert type="error" message="Thiếu agentId" />;
  }

  const status = agent?.status as AgentStatus | undefined;

  const vitePatchClient = viteTilePatchEnabled();
  const dirtyMetricValue = showDirtyRatio(telemetry);
  const patchBytesMetricValue = showPatchBytes(telemetry);
  const patchOverlayMetricValue = showPatchOverlayLabel(
    telemetry,
    patchOverlayActive,
    vitePatchClient,
  );
  const patchApplyMetricValue = showPatchApplyMs(
    telemetry,
    patchOverlayActive,
    patchApplyMs,
    vitePatchClient,
  );

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/agents')}>
          Quay lại
        </Button>
        <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          Remote — {agent?.name || agentId}
        </Typography.Title>
        {status && <Tag color={AGENT_STATUS_COLOR[status]}>{status}</Tag>}
      </Space>

      {error && (
        <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Button
            type="primary"
            loading={createMut.isPending}
            disabled={status !== 'ONLINE' || phase === 'live' || phase === 'connecting'}
            onClick={() => createMut.mutate(agentId)}
          >
            Bắt đầu phiên
          </Button>
          <Select
            value={qualityProfile}
            style={{ width: 160 }}
            onChange={(v) => setQualityProfile(v)}
            options={[
              { value: 'low-latency', label: 'Low Latency' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'high-quality', label: 'High Quality' },
            ]}
          />
          <Select
            value={preferredRegion}
            style={{ width: 100 }}
            onChange={(v) => setPreferredRegion(v)}
            options={[
              { value: 'sg', label: 'SG' },
              { value: 'jp', label: 'JP' },
              { value: 'us', label: 'US' },
            ]}
          />
          <Button
            danger
            disabled={!session}
            loading={stopMut.isPending}
            onClick={() => session && stopMut.mutate(session.id)}
          >
            Dừng phiên
          </Button>
          {isAdmin && (
            <Button
              danger
              type="primary"
              ghost
              disabled={!session}
              loading={panicMut.isPending}
              onClick={() => session && panicMut.mutate(session.id)}
            >
              Panic (admin)
            </Button>
          )}
        </Space>
      </Card>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1280,
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            syncPatchCanvasSize();
          }}
          style={{ width: '100%', display: 'block', minHeight: isMobile ? 220 : 360 }}
        />
        <canvas
          ref={patchCanvasRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: patchOverlayActive ? 'block' : 'none',
          }}
        />
        <div
          ref={overlayRef}
          onPointerDown={onOverlayPointerDown}
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
          onPointerCancel={onOverlayPointerUp}
          onContextMenu={(ev) => ev.preventDefault()}
          style={{
            position: 'absolute',
            inset: 0,
            cursor: 'crosshair',
            touchAction: 'none',
          }}
        />
      </div>

      <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
        Kéo = drag; click nhẹ = click. Scroll bằng bánh xe. Enter để gửi text.
      </Typography.Paragraph>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12}>
          <Col span={6}>
            <Statistic title="RTT (ms)" value={telemetry?.rttMs ?? 0} precision={0} />
          </Col>
          <Col span={6}>
            <Statistic title="FPS" value={telemetry?.effectiveFps ?? 0} precision={1} />
          </Col>
          <Col span={6}>
            <Statistic
              title="Bitrate (kbps)"
              value={telemetry?.effectiveBitrateKbps ?? 0}
              precision={0}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Dirty Ratio"
              value={dirtyMetricValue}
              precision={typeof dirtyMetricValue === 'number' ? 2 : undefined}
            />
          </Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 8 }}>
          <Col span={8}>
            <Statistic
              title="Patch overlay"
              value={patchOverlayMetricValue}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Patch apply (ms)"
              value={patchApplyMetricValue}
              precision={typeof patchApplyMetricValue === 'number' ? 2 : undefined}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Patch bytes (window)"
              value={patchBytesMetricValue}
              precision={typeof patchBytesMetricValue === 'number' ? 0 : undefined}
            />
          </Col>
        </Row>
      </Card>
      <input
        type="text"
        placeholder="Gõ text rồi Enter…"
        style={{ width: '100%', maxWidth: isMobile ? '100%' : 480, padding: 8 }}
        disabled={phase !== 'live'}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const t = (e.target as HTMLInputElement).value;
            if (t) sendControl({ type: 'TEXT', text: t });
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />
    </div>
  );
}
