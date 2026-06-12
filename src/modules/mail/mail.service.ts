import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup as dnsLookup } from 'dns';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Resend } from 'resend';

const SMTP_TIMEOUT_MS = 15_000;

type SmtpError = Error & {
  code?: string;
  responseCode?: number;
};

type OtpEmailContent = {
  from: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getResend(): Resend | null {
    const apiKey = this.configService.get<string>('resend.apiKey');
    if (!apiKey) return null;
    if (!this.resend) {
      this.resend = new Resend(apiKey);
    }
    return this.resend;
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.configService.get<string>('smtp.host');
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');
    if (!host || !user || !pass) {
      return null;
    }

    const smtpOptions = {
      host,
      port: this.configService.get<number>('smtp.port'),
      secure: this.configService.get<boolean>('smtp.secure'),
      auth: { user, pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      lookup: (
        hostname: string,
        _options: unknown,
        callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ) => {
        dnsLookup(hostname, { family: 4 }, callback);
      },
    } as SMTPTransport.Options;
    this.transporter = nodemailer.createTransport(smtpOptions);
    return this.transporter;
  }

  private getAppName(): string {
    return this.configService.get<string>('smtp.appName') ?? 'StationHub';
  }

  private getFromAddress(): string {
    return (
      this.configService.get<string>('resend.from') ||
      this.configService.get<string>('smtp.from') ||
      this.configService.get<string>('smtp.user') ||
      'noreply@stationhub.local'
    );
  }

  private buildRegisterOtpContent(otp: string): OtpEmailContent {
    const appName = this.getAppName();
    const from = this.getFromAddress();
    const ttlMinutes = Math.ceil(
      (this.configService.get<number>('otp.registerTtlSeconds') ?? 600) / 60,
    );
    const subject = `Mã xác thực đăng ký ${appName}`;
    const text = [
      `Xin chào,`,
      ``,
      `Bạn vừa yêu cầu đăng ký tài khoản ${appName}.`,
      `Mã xác thực (OTP): ${otp}`,
      ``,
      `Mã có hiệu lực trong ${ttlMinutes} phút.`,
      `Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.`,
      ``,
      `— ${appName}`,
    ].join('\n');
    const html = `
<!DOCTYPE html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px">
      <p style="margin:0 0 16px;font-size:15px">Xin chào,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
        Bạn vừa yêu cầu đăng ký tài khoản <strong>${appName}</strong>.
        Dùng mã bên dưới để hoàn tất đăng ký:
      </p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;font-family:Consolas,Monaco,monospace">${otp}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563">
        Mã có hiệu lực trong <strong>${ttlMinutes} phút</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">
        Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.
      </p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
      <p style="margin:0;font-size:12px;color:#9ca3af">${appName}</p>
    </div>
  </body>
</html>`;

    return { from, subject, text, html };
  }

  private smtpErrorMessage(err: SmtpError): string {
    const code = err.code ?? '';
    if (code === 'EAUTH' || err.responseCode === 535) {
      return 'Không xác thực được máy chủ email (kiểm tra SMTP_USER / SMTP_PASS).';
    }
    if (
      code === 'ETIMEDOUT' ||
      code === 'ESOCKET' ||
      code === 'ENETUNREACH' ||
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      err.message.includes('ENETUNREACH')
    ) {
      return 'Không kết nối được máy chủ email. Vui lòng thử lại sau.';
    }
    return 'Không gửi được email xác thực. Vui lòng thử lại sau.';
  }

  private async sendViaResend(
    to: string,
    content: OtpEmailContent,
  ): Promise<void> {
    const resend = this.getResend();
    if (!resend) return;

    const replyTo = this.configService.get<string>('resend.replyTo');

    let data: { id: string } | null = null;
    let error: { message: string; name: string } | null = null;

    try {
      const result = await resend.emails.send({
        from: content.from,
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
        replyTo: replyTo || undefined,
        tags: [{ name: 'category', value: 'register_otp' }],
      });
      data = result.data;
      error = result.error;
    } catch (err) {
      const networkErr = err as Error;
      this.logger.error(
        `Resend OTP lỗi mạng to=${to} message=${networkErr.message}`,
        networkErr.stack,
      );
      throw new ServiceUnavailableException(
        'Không gửi được email xác thực. Vui lòng thử lại sau.',
      );
    }

    if (error) {
      this.logger.error(
        `Resend OTP thất bại to=${to} name=${error.name} message=${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Không gửi được email xác thực. Vui lòng thử lại sau.',
      );
    }

    this.logger.log(`Resend OTP đã gửi to=${to} id=${data?.id ?? 'n/a'}`);
  }

  private async sendViaSmtp(
    to: string,
    content: OtpEmailContent,
  ): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      const nodeEnv = this.configService.get<string>('nodeEnv');
      if (nodeEnv !== 'production') {
        return;
      }
      throw new ServiceUnavailableException(
        'Dịch vụ email chưa được cấu hình. Vui lòng thử lại sau.',
      );
    }

    const smtpUser = this.configService.get<string>('smtp.user');
    try {
      await transporter.sendMail({
        from: content.from,
        to,
        replyTo: smtpUser || content.from,
        subject: content.subject,
        text: content.text,
        html: content.html,
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
        },
      });
    } catch (err) {
      const smtpErr = err as SmtpError;
      this.logger.error(
        `SMTP OTP thất bại to=${to} code=${smtpErr.code ?? 'unknown'} responseCode=${smtpErr.responseCode ?? 'n/a'} message=${smtpErr.message}`,
        smtpErr.stack,
      );
      throw new ServiceUnavailableException(this.smtpErrorMessage(smtpErr));
    }
  }

  async sendRegisterOtp(to: string, otp: string): Promise<void> {
    const content = this.buildRegisterOtpContent(otp);

    if (this.getResend()) {
      await this.sendViaResend(to, content);
      return;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      const nodeEnv = this.configService.get<string>('nodeEnv');
      if (nodeEnv !== 'production') {
        this.logger.warn(
          `Email chưa cấu hình — OTP đăng ký cho ${to}: ${otp}`,
        );
        return;
      }
      throw new ServiceUnavailableException(
        'Dịch vụ email chưa được cấu hình. Vui lòng thử lại sau.',
      );
    }

    await this.sendViaSmtp(to, content);
  }
}
