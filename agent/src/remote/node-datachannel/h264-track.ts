import {
  H264RtpPacketizer,
  NalUnitSeparator,
  PacingHandler,
  RtcpNackResponder,
  RtcpReceivingSession,
  RtcpSrReporter,
  RtpPacketizationConfig,
  Track,
} from 'node-datachannel';
import { logger } from '../../logger';

export class H264TrackFeeder {
  private readonly packetizer: H264RtpPacketizer;
  private readonly rtcpRecv: RtcpReceivingSession;
  private readonly rtcpReporter: RtcpSrReporter;
  private readonly rtcpNack: RtcpNackResponder;
  private readonly pacing: PacingHandler;
  private carry: any = Buffer.alloc(0);

  constructor(
    private readonly track: Track,
    ssrc: number,
    payloadType = 102,
    clockRate = 90_000,
  ) {
    const rtpConfig = new RtpPacketizationConfig(ssrc, `cname-${ssrc}`, payloadType, clockRate);
    this.packetizer = new H264RtpPacketizer(
      'StartSequence' as NalUnitSeparator,
      rtpConfig,
      1200,
    );
    this.rtcpRecv = new RtcpReceivingSession();
    this.rtcpReporter = new RtcpSrReporter(rtpConfig);
    this.rtcpNack = new RtcpNackResponder(1024);
    this.pacing = new PacingHandler(8_000_000, 5);

    this.track.setMediaHandler(this.packetizer);
    this.packetizer.addToChain(this.rtcpRecv);
    this.packetizer.addToChain(this.rtcpReporter);
    this.packetizer.addToChain(this.rtcpNack);
    this.packetizer.addToChain(this.pacing);
  }

  pushChunk(chunk: Buffer): boolean {
    if (!chunk.length) return true;
    const merged = new Uint8Array(this.carry.length + chunk.length);
    merged.set(this.carry, 0);
    merged.set(chunk, this.carry.length);
    this.carry = Buffer.from(merged);
    const nalus = splitAnnexB(this.carry as Uint8Array);
    if (!nalus.complete.length) return true;
    this.carry = nalus.remainder;
    for (const nalu of nalus.complete) {
      if (nalu.length > 0) {
        try {
          this.track.sendMessageBinary(Buffer.from(nalu));
        } catch (err) {
          const msg = String((err as Error)?.message || err);
          if (msg.includes('Track is not open')) {
            // Track có thể chưa open tạm thời; drop chunk hiện tại, không kill feeder.
            this.carry = Buffer.alloc(0);
            logger.warn('ndc video track is not open; dropping current chunks');
            return false;
          }
          throw err;
        }
      }
    }
    return true;
  }
}

function splitAnnexB(buf: Uint8Array): { complete: Uint8Array[]; remainder: Uint8Array } {
  const starts: number[] = [];
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0 && buf[i + 1] === 0) {
      if (buf[i + 2] === 1) starts.push(i);
      if (i < buf.length - 4 && buf[i + 2] === 0 && buf[i + 3] === 1) starts.push(i);
    }
  }
  if (starts.length < 2) return { complete: [], remainder: buf };

  const complete: Uint8Array[] = [];
  for (let idx = 0; idx < starts.length - 1; idx++) {
    const from = starts[idx]!;
    const to = starts[idx + 1]!;
    const nalu = trimStartCode(buf.subarray(from, to));
    if (nalu.length) complete.push(nalu);
  }
  const remainder = buf.subarray(starts[starts.length - 1]!);
  return { complete, remainder };
}

function trimStartCode(buf: Uint8Array): Uint8Array {
  if (buf.length >= 4 && buf[0] === 0 && buf[1] === 0 && buf[2] === 0 && buf[3] === 1) {
    return buf.subarray(4);
  }
  if (buf.length >= 3 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1) {
    return buf.subarray(3);
  }
  return buf;
}
