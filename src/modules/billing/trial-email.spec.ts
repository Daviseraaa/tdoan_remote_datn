import { normalizeTrialEmail } from './trial-email';

describe('normalizeTrialEmail', () => {
  it('lowercases and strips gmail dots and plus tags', () => {
    expect(normalizeTrialEmail('User.Name+tag@gmail.com')).toBe(
      'username@gmail.com',
    );
  });

  it('strips plus tag on non-gmail domains', () => {
    expect(normalizeTrialEmail('Team+Alias@Company.COM')).toBe(
      'team@company.com',
    );
  });
});
