import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.configService.get<string>('smtp.host');
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');
    if (!host || !user || !pass) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('smtp.port'),
      secure: this.configService.get<boolean>('smtp.secure'),
      auth: { user, pass },
    });
    return this.transporter;
  }

  async sendRegisterOtp(to: string, otp: string): Promise<void> {
    const transporter = this.getTransporter();
    const from =
      this.configService.get<string>('smtp.from') ??
      this.configService.get<string>('smtp.user') ??
      'noreply@stationhub.local';
    const appName =
      this.configService.get<string>('smtp.appName') ?? 'StationHub';
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

    if (!transporter) {
      const nodeEnv = this.configService.get<string>('nodeEnv');
      if (nodeEnv !== 'production') {
        this.logger.warn(
          `SMTP chưa cấu hình — OTP đăng ký cho ${to}: ${otp}`,
        );
        return;
      }
      throw new ServiceUnavailableException(
        'Dịch vụ email chưa được cấu hình. Vui lòng thử lại sau.',
      );
    }

    const smtpUser = this.configService.get<string>('smtp.user');
    await transporter.sendMail({
      from,
      to,
      replyTo: smtpUser || from,
      subject,
      text,
      html,
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
    });
  }
}
