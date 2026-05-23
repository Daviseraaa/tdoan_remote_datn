function parseOrigins(value: string | undefined, fallback: string): string[] {
  const raw = value ?? fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

  telegram: {
    webhookBaseUrl:
      process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
  },
});
