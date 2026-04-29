function parseOrigins(value: string | undefined, fallback: string): string[] {
  const raw = value ?? fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default () => ({
  port: parseInt(process.env.APP_PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  cors: {
    origins: parseOrigins(
      process.env.CORS_ORIGINS,
      'http://localhost:3001,http://localhost:5173',
    ),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  webrtc: {
    stunUrls: (process.env.WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    turnUrls: (process.env.WEBRTC_TURN_URLS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    turnUsername: process.env.WEBRTC_TURN_USER || '',
    turnCredential: process.env.WEBRTC_TURN_CREDENTIAL || '',
    turnPoolsByRegion: parseJson<Record<string, string[]>>(
      process.env.WEBRTC_TURN_POOLS_BY_REGION,
      {},
    ),
  },

  remote: {
    signalingExpiresIn: process.env.REMOTE_SIGNALING_EXPIRES_IN || '15m',
    sessionHeartbeatSec: parseInt(process.env.REMOTE_SESSION_HEARTBEAT_SEC || '45', 10),
    controlMaxPerSec: parseInt(process.env.REMOTE_CONTROL_MAX_PER_SEC || '60', 10),
    rttHintTtlSec: parseInt(process.env.REMOTE_RTT_HINT_TTL_SEC || '120', 10),
  },
});
