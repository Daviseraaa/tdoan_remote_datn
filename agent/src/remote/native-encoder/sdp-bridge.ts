export interface SdpBridgeConfig {
  preferredCodec: 'H264';
  packetizationMode: 1;
}

// Placeholder bridge: wrtc in current agent path still feeds frames via RTCVideoSource.
// This object keeps one place to move to encoded RTP bridge later without changing callers.
export function createSdpBridgeConfig(): SdpBridgeConfig {
  return {
    preferredCodec: 'H264',
    packetizationMode: 1,
  };
}
