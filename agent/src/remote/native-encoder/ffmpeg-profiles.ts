export type H264EncoderName = 'h264_nvenc' | 'h264_amf' | 'h264_qsv' | 'libx264';

export interface FfmpegProfile {
  encoder: H264EncoderName;
  args: string[];
}

export function profileFor(
  encoder: H264EncoderName,
  bitrateKbps: number,
  keyint: number,
  preset: string,
): FfmpegProfile {
  const b = `${Math.max(300, Math.floor(bitrateKbps))}k`;
  const common = ['-g', String(Math.max(10, keyint)), '-b:v', b, '-maxrate', b, '-bufsize', `${Math.floor(bitrateKbps * 2)}k`];

  switch (encoder) {
    case 'h264_nvenc':
      return { encoder, args: ['-c:v', 'h264_nvenc', '-preset', preset || 'p4', ...common] };
    case 'h264_amf':
      return { encoder, args: ['-c:v', 'h264_amf', '-quality', 'balanced', ...common] };
    case 'h264_qsv':
      return { encoder, args: ['-c:v', 'h264_qsv', '-preset', preset || 'medium', ...common] };
    default:
      return { encoder: 'libx264', args: ['-c:v', 'libx264', '-preset', preset || 'veryfast', '-tune', 'zerolatency', ...common] };
  }
}
