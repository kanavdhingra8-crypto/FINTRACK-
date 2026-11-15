import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentDate, currentMonth, formatInr } from './format.js';

describe('display helpers', () => {
  it('formats currency as Indian rupees', () => {
    assert.match(formatInr(1234.5), /1,234\.50/);
    assert.match(formatInr(1234.5), /₹/);
  });

  it('returns date values suitable for HTML month and date inputs', () => {
    assert.match(currentMonth(), /^\d{4}-\d{2}$/);
    assert.match(currentDate(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
