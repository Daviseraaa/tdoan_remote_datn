import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type SepayWebhookPayload = {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount?: string;
  code: string | null;
  content: string;
  transferType: 'in' | 'out';
  description?: string;
  transferAmount: number;
  accumulated?: number;
  referenceCode?: string;
};

@Injectable()
export class SepayService {
  private readonly logger = new Logger(SepayService.name);

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('sepay.accountNumber') &&
        this.config.get<string>('sepay.accountHolder'),
    );
  }

  webhookUrl(): string {
    const base = this.config
      .get<string>('sepay.webhookBaseUrl', 'http://localhost:3000/api')
      .replace(/\/$/, '');
    return `${base}/billing/sepay/webhook`;
  }

  paymentPrefix(): string {
    return this.config.get<string>('sepay.paymentPrefix', 'DATN');
  }

  generateOrderCode(): number {
    const base = Date.now();
    const suffix = Math.floor(Math.random() * 900) + 100;
    return Number(`${base}${suffix}`.slice(0, 15));
  }

  generatePaymentCode(): string {
    const prefix = this.paymentPrefix();
    const suffix = Date.now().toString(36).toUpperCase().slice(-8);
    return `${prefix}${suffix}`;
  }

  transferContent(paymentCode: string): string {
    return paymentCode;
  }

  /** VietQR image URL — https://qr.sepay.vn/img */
  buildQrImageUrl(paymentCode: string, amountVnd: number): string {
    const bank = this.config.get<string>('sepay.bankName', '').trim();
    const acc = this.config.get<string>('sepay.accountNumber', '').trim();
    const template = this.config.get<string>('sepay.qrTemplate', 'qronly');

    const params = new URLSearchParams({
      bank,
      acc,
      template,
      amount: String(amountVnd),
      des: this.transferContent(paymentCode),
    });

    return `https://qr.sepay.vn/img?${params.toString()}`;
  }

  getBankInstructions(paymentCode: string, amountVnd: number) {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'SePay chưa cấu hình (SEPAY_BANK_NAME, SEPAY_ACCOUNT_NUMBER, SEPAY_ACCOUNT_HOLDER)',
      );
    }
    return {
      bankName: this.config.get<string>('sepay.bankName', ''),
      accountNumber: this.config.get<string>('sepay.accountNumber', ''),
      accountHolder: this.config.get<string>('sepay.accountHolder', ''),
      amountVnd,
      paymentCode,
      transferContent: this.transferContent(paymentCode),
      qrUrl: this.buildQrImageUrl(paymentCode, amountVnd),
    };
  }

  verifyWebhookAuth(
    authorization: string | undefined,
    rawBody: string,
    signature: string | undefined,
    timestamp: string | undefined,
  ): void {
    const apiKey = this.config.get<string>('sepay.webhookApiKey', '');
    const hmacSecret = this.config.get<string>('sepay.webhookSecret', '');

    if (hmacSecret && signature && timestamp) {
      this.verifyHmac(rawBody, signature, timestamp, hmacSecret);
      return;
    }

    if (apiKey) {
      const expected = `Apikey ${apiKey}`;
      if (authorization !== expected) {
        throw new UnauthorizedException('Invalid SePay API Key');
      }
      return;
    }

    if (this.config.get<string>('nodeEnv') === 'production') {
      throw new UnauthorizedException(
        'SePay webhook auth chưa cấu hình (SEPAY_WEBHOOK_API_KEY hoặc SEPAY_WEBHOOK_SECRET)',
      );
    }

    this.logger.warn('SePay webhook: không xác thực (chỉ dev)');
  }

  private verifyHmac(
    rawBody: string,
    signatureHeader: string,
    timestampHeader: string,
    secret: string,
  ): void {
    const ts = parseInt(timestampHeader, 10);
    if (!Number.isFinite(ts)) {
      throw new UnauthorizedException('Invalid SePay timestamp');
    }
    const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (ageSec > 300) {
      throw new UnauthorizedException('SePay timestamp expired');
    }

    const expectedSig = signatureHeader.replace(/^sha256=/i, '');
    const payload = `${timestampHeader}.${rawBody}`;
    const computed = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid SePay HMAC signature');
    }
  }

  matchesPaymentCode(payload: SepayWebhookPayload, paymentCode: string): boolean {
    if (payload.code && payload.code.toUpperCase() === paymentCode.toUpperCase()) {
      return true;
    }
    const content = (payload.content ?? '').toUpperCase();
    return content.includes(paymentCode.toUpperCase());
  }

  isIncomingTransfer(payload: SepayWebhookPayload): boolean {
    return payload.transferType === 'in';
  }

  validateAccountNumber(payload: SepayWebhookPayload): boolean {
    const expected = this.config.get<string>('sepay.accountNumber', '').trim();
    if (!expected) return true;
    return payload.accountNumber?.trim() === expected;
  }
}
