function parseOrigins(value: string | undefined, fallback: string): string[] {
  const raw = value ?? fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default () => ({
  port: parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10),
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

  subscription: {
    /** @deprecated Dùng subscription_plans.durationDays của gói isTrial=true */
    trialDays: parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || '7', 10),
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || process.env.SMTP_FROM || '',
    replyTo: process.env.RESEND_REPLY_TO || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    appName: process.env.SMTP_APP_NAME || 'StationHub',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  frontend: {
    url:
      process.env.FRONTEND_URL?.trim() ||
      parseOrigins(process.env.CORS_ORIGINS, 'http://localhost:5173')[0] ||
      'http://localhost:5173',
  },

  otp: {
    registerTtlSeconds: parseInt(process.env.REGISTER_OTP_TTL_SECONDS || '600', 10),
    registerCooldownSeconds: parseInt(
      process.env.REGISTER_OTP_COOLDOWN_SECONDS || '60',
      10,
    ),
    registerMaxAttempts: parseInt(process.env.REGISTER_OTP_MAX_ATTEMPTS || '5', 10),
  },

  sepay: {
    bankName: process.env.SEPAY_BANK_NAME || '',
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '',
    accountHolder: process.env.SEPAY_ACCOUNT_HOLDER || '',
    paymentPrefix: process.env.SEPAY_PAYMENT_PREFIX || 'STNH',
    qrTemplate: process.env.SEPAY_QR_TEMPLATE || 'qronly',
    webhookApiKey: process.env.SEPAY_WEBHOOK_API_KEY || '',
    webhookSecret: process.env.SEPAY_WEBHOOK_SECRET || '',
    webhookBaseUrl:
      process.env.PUBLIC_WEBHOOK_BASE_URL ||
      process.env.PUBLIC_API_BASE_URL ||
      'http://localhost:3000/api',
  },
});
