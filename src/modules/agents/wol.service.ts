import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createSocket } from 'dgram';

const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

@Injectable()
export class WolService {
  private readonly logger = new Logger(WolService.name);

  normalizeMac(mac: string): string {
    const trimmed = mac.trim();
    if (!MAC_RE.test(trimmed)) {
      throw new BadRequestException(
        `MAC không hợp lệ: "${mac}". Dùng định dạng AA:BB:CC:DD:EE:FF`,
      );
    }
    return trimmed.replace(/-/g, ':').toUpperCase();
  }

  buildMagicPacket(mac: string): Buffer {
    const hex = mac.replace(/[^0-9A-Fa-f]/g, '');
    if (hex.length !== 12) {
      throw new BadRequestException('MAC phải có 6 byte (12 ký tự hex)');
    }
    const macBytes = Buffer.from(hex, 'hex');
    const packet = Buffer.alloc(6 + 16 * 6);
    packet.fill(0xff, 0, 6);
    for (let i = 0; i < 16; i += 1) {
      macBytes.copy(packet, 6 + i * 6);
    }
    return packet;
  }

  async sendMagicPacket(
    mac: string,
    options?: { broadcast?: string; port?: number },
  ): Promise<{ macAddress: string; broadcast: string; port: number }> {
    const macAddress = this.normalizeMac(mac);
    const broadcast =
      options?.broadcast?.trim() ||
      process.env.WOL_DEFAULT_BROADCAST?.trim() ||
      '255.255.255.255';
    const port = options?.port ?? Number(process.env.WOL_DEFAULT_PORT ?? 9);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new BadRequestException('Port WoL không hợp lệ');
    }

    const packet = this.buildMagicPacket(macAddress);

    await new Promise<void>((resolve, reject) => {
      const socket = createSocket('udp4');
      socket.once('error', (err) => {
        socket.close();
        reject(err);
      });
      socket.bind(() => {
        try {
          socket.setBroadcast(true);
        } catch (e) {
          socket.close();
          reject(e);
          return;
        }
        socket.send(packet, port, broadcast, (err) => {
          socket.close();
          if (err) reject(err);
          else resolve();
        });
      });
    });

    this.logger.log(`WoL sent mac=${macAddress} broadcast=${broadcast}:${port}`);
    return { macAddress, broadcast, port };
  }
}
