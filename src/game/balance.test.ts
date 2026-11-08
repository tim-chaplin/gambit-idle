import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { simulateFirstArea } from './balance';

describe('balance: Slime Fields', () => {
  it('a sensible player beats the King Slime in a reasonable time', () => {
    const results = [1, 2, 3, 4, 5].map((seed) => simulateFirstArea(seed));
    // SIM_REPORT=path writes the full simulation logs for tuning.
    if (process.env.SIM_REPORT) writeFileSync(process.env.SIM_REPORT, JSON.stringify(results, null, 1));
    for (const r of results) {
      expect(r.bossBeaten).toBe(true);
      expect(r.minutes).toBeGreaterThan(15);
      expect(r.minutes).toBeLessThan(90);
    }
  });
});
