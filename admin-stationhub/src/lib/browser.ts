/** Safari / WebKit (macOS, iOS) — không tính Chrome/Firefox trên iOS. */
export function isSafariWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isWebKit = /AppleWebKit/i.test(ua);
  const isOtherBrowser = /Chrome|CriOS|FxiOS|EdgiOS|OPiOS|SamsungBrowser/i.test(ua);
  return isWebKit && !isOtherBrowser;
}
