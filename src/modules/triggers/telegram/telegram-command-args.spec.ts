import { extractTelegramCommandArgs } from './telegram-command-args';
import {
  applyTelegramVariableBindings,
  resolveTemplateString,
} from '../../automation/workflow-variables';

describe('telegram-command-args', () => {
  it('splits args after command', () => {
    expect(extractTelegramCommandArgs('/run foo bar', '/run')).toEqual({
      args: ['foo', 'bar'],
      argsText: 'foo bar',
    });
  });

  it('strips bot suffix from command', () => {
    expect(extractTelegramCommandArgs('/start@MyBot hello', '/start')).toEqual({
      args: ['hello'],
      argsText: 'hello',
    });
  });

  it('returns empty when only command', () => {
    expect(extractTelegramCommandArgs('/run', '/run')).toEqual({
      args: [],
      argsText: '',
    });
  });
});

describe('applyTelegramVariableBindings', () => {
  it('maps telegram args to workflow vars without removing defaults', () => {
    const merged = applyTelegramVariableBindings(
      { sku: 'DEFAULT', qty: 1, telegram: { args: ['ABC', '5'] } },
      ['sku', 'qty'],
      { args: ['ABC', '5'] },
    );
    expect(merged.sku).toBe('ABC');
    expect(merged.qty).toBe(5);
  });

  it('keeps configured value when arg missing', () => {
    const merged = applyTelegramVariableBindings(
      { sku: 'DEFAULT' },
      ['sku', 'qty'],
      { args: ['ONLY'] },
    );
    expect(merged.sku).toBe('ONLY');
    expect(merged.qty).toBeUndefined();
  });
});

describe('telegram template scope', () => {
  it('resolves telegram.* in templates', () => {
    const scope = {
      workflow: {},
      steps: {},
      telegram: { chatId: '123', args: ['a', 'b'], argsText: 'a b' },
    };
    expect(resolveTemplateString('{{telegram.chatId}}', scope)).toBe('123');
    expect(resolveTemplateString('{{telegram.args.0}}', scope)).toBe('a');
    expect(resolveTemplateString('{{telegram.argsText}}', scope)).toBe('a b');
  });
});
