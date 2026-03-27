export const REFRESH_PRIORITIES = {
  high: 3,
  normal: 2,
  low: 1,
} as const;

export type RefreshPriority = keyof typeof REFRESH_PRIORITIES;

export type RefreshExecutionContext = {
  force: boolean;
  reason?: string;
};

export type RefreshRequestOptions = {
  force?: boolean;
  priority?: RefreshPriority;
  reason?: string;
};

export type RefreshTaskHandler = (context: RefreshExecutionContext) => Promise<void>;
