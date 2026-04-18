export type AiReminderFrequency = 'daily' | 'weekly' | 'monthly';

export interface AiReminderSettings {
  enabled: boolean;
  frequency: AiReminderFrequency;
  lastReminderAt?: string;
}

export const AI_REMINDER_STORAGE_KEY = 'ai_analysis_reminder_settings';

export const getNextReminderAt = (
  frequency: AiReminderFrequency,
  fromIso: string,
): string => {
  const date = new Date(fromIso);
  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date.toISOString();
};

export const shouldTriggerAiReminder = (params: {
  enabled: boolean;
  frequency: AiReminderFrequency;
  lastReminderAt?: string;
  now: string;
}) => {
  const { enabled, frequency, lastReminderAt, now } = params;
  if (!enabled) return false;
  if (!lastReminderAt) return true;
  return new Date(now).getTime() >= new Date(getNextReminderAt(frequency, lastReminderAt)).getTime();
};

export const readAiReminderSettings = (): AiReminderSettings => {
  if (typeof window === 'undefined') {
    return { enabled: false, frequency: 'weekly' };
  }

  try {
    const raw = window.localStorage.getItem(AI_REMINDER_STORAGE_KEY);
    if (!raw) return { enabled: false, frequency: 'weekly' };
    const parsed = JSON.parse(raw) as Partial<AiReminderSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      frequency:
        parsed.frequency === 'daily' || parsed.frequency === 'weekly' || parsed.frequency === 'monthly'
          ? parsed.frequency
          : 'weekly',
      lastReminderAt: typeof parsed.lastReminderAt === 'string' ? parsed.lastReminderAt : undefined,
    };
  } catch {
    return { enabled: false, frequency: 'weekly' };
  }
};

export const writeAiReminderSettings = (settings: AiReminderSettings) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AI_REMINDER_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore localStorage failures
  }
};

export const notifyAiReminder = async (title: string, body: string) => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  if (Notification.permission !== 'granted') return false;
  new Notification(title, { body });
  return true;
};
