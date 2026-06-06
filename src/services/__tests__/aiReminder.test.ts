import { describe, expect, it } from 'vitest';
import {
  getNextReminderAt,
  shouldTriggerAiReminder,
  type AiReminderFrequency,
} from '../aiReminder';

describe('aiReminder', () => {
  it('按周频率计算下一次提醒时间', () => {
    const next = getNextReminderAt('weekly', '2026-04-18T08:00:00.000Z');

    expect(next).toBe('2026-04-25T08:00:00.000Z');
  });

  it('到达提醒时间后返回 true', () => {
    const enabled = true;
    const frequency: AiReminderFrequency = 'daily';
    const lastReminderAt = '2026-04-17T08:00:00.000Z';
    const now = '2026-04-18T08:30:00.000Z';

    expect(shouldTriggerAiReminder({ enabled, frequency, lastReminderAt, now })).toBe(true);
  });

  it('未开启提醒时始终返回 false', () => {
    expect(
      shouldTriggerAiReminder({
        enabled: false,
        frequency: 'monthly',
        lastReminderAt: '2026-04-01T08:00:00.000Z',
        now: '2026-05-10T08:00:00.000Z',
      }),
    ).toBe(false);
  });
});
