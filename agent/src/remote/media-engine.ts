export type MediaEngineMode = 'wrtc' | 'ndc';

export interface MediaEngineStats {
  rttMs?: number;
  bytesSent?: number;
  restartCount?: number;
  pipeline?: 'software' | 'ffmpeg' | 'ndc-h264';
}
