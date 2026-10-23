import { describe, expect, it } from 'vitest';
import { env } from './env';

describe('env', () => {
  it('has a database path default', () => {
    expect(env.databasePath.length).toBeGreaterThan(0);
  });
});
