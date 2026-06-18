import {
  parseTelegramIdListText,
  normalizeTelegramIdList,
  isTelegramSenderAllowed,
} from './telegram-bot-access';

describe('telegram-bot-access', () => {
  it('parses comma-separated ids', () => {
    expect(parseTelegramIdListText(' 1, 2 ,2, 3 ')).toEqual(['1', '2', '3']);
  });

  it('allows all when lists empty', () => {
    expect(isTelegramSenderAllowed('99', '42', null, [])).toBe(true);
  });

  it('restricts by chat id', () => {
    expect(isTelegramSenderAllowed('99', '42', ['99'], [])).toBe(true);
    expect(isTelegramSenderAllowed('100', '42', ['99'], [])).toBe(false);
  });

  it('restricts by user id', () => {
    expect(isTelegramSenderAllowed('99', '42', [], ['42'])).toBe(true);
    expect(isTelegramSenderAllowed('99', '43', [], ['42'])).toBe(false);
  });

  it('requires both when both configured', () => {
    expect(isTelegramSenderAllowed('99', '42', ['99'], ['42'])).toBe(true);
    expect(isTelegramSenderAllowed('100', '42', ['99'], ['42'])).toBe(false);
    expect(isTelegramSenderAllowed('99', '43', ['99'], ['42'])).toBe(false);
  });

  it('normalizes json arrays', () => {
    expect(normalizeTelegramIdList(['1', 2, '2', ''])).toEqual(['1', '2']);
  });
});
