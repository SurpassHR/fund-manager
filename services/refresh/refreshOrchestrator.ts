import { REFRESH_PRIORITIES, type RefreshRequestOptions, type RefreshTaskHandler } from './types';
import { RefreshStateStore } from './refreshStateStore';

type Deferred = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type QueueItem<TTask extends string> = {
  task: TTask;
  force: boolean;
  priority: number;
  sequence: number;
  reason?: string;
  waiters: Deferred[];
};

type RunningItem<TTask extends string> = {
  task: TTask;
  force: boolean;
  waiters: Deferred[];
};

const createDeferred = (): { promise: Promise<void>; deferred: Deferred } => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, deferred: { resolve, reject } };
};

const normalizePriority = (priority?: RefreshRequestOptions['priority']) => {
  const normalized = priority ?? 'normal';
  return REFRESH_PRIORITIES[normalized];
};

export class RefreshOrchestrator<TTask extends string = string> {
  private readonly handlers: Record<TTask, RefreshTaskHandler>;
  private readonly stateStore: RefreshStateStore<TTask>;

  private queue: Array<QueueItem<TTask>> = [];
  private queuedByTask = new Map<TTask, QueueItem<TTask>>();
  private runningByTask = new Map<TTask, RunningItem<TTask>>();
  private sequence = 0;
  private drainPromise: Promise<void> | null = null;

  constructor(params: {
    handlers: Record<TTask, RefreshTaskHandler>;
    stateStore?: RefreshStateStore<TTask>;
  }) {
    this.handlers = params.handlers;
    this.stateStore = params.stateStore ?? new RefreshStateStore<TTask>();
  }

  request(task: TTask, options?: RefreshRequestOptions): Promise<void> {
    const normalized = {
      force: options?.force ?? false,
      priority: normalizePriority(options?.priority),
      reason: options?.reason,
    };
    const { promise, deferred } = createDeferred();

    const runningItem = this.runningByTask.get(task);
    if (runningItem) {
      if (normalized.force && !runningItem.force) {
        this.stateStore.markTaskStale(task, true);
        const queued = this.getOrCreateQueueItem(task, normalized);
        queued.waiters.push(deferred);
        this.ensureDrain();
        return promise;
      }

      runningItem.waiters.push(deferred);
      return promise;
    }

    const queued = this.getOrCreateQueueItem(task, normalized);
    queued.waiters.push(deferred);
    this.ensureDrain();
    return promise;
  }

  getStateStore(): RefreshStateStore<TTask> {
    return this.stateStore;
  }

  private getOrCreateQueueItem(
    task: TTask,
    normalizedOptions: { force: boolean; priority: number; reason?: string },
  ): QueueItem<TTask> {
    const existing = this.queuedByTask.get(task);
    if (existing) {
      existing.force = existing.force || normalizedOptions.force;
      existing.priority = Math.max(existing.priority, normalizedOptions.priority);
      if (normalizedOptions.reason) {
        existing.reason = normalizedOptions.reason;
      }
      return existing;
    }

    const created: QueueItem<TTask> = {
      task,
      force: normalizedOptions.force,
      priority: normalizedOptions.priority,
      sequence: this.sequence++,
      reason: normalizedOptions.reason,
      waiters: [],
    };
    this.queue.push(created);
    this.queuedByTask.set(task, created);
    return created;
  }

  private ensureDrain(): void {
    if (this.drainPromise) {
      return;
    }

    this.drainPromise = Promise.resolve()
      .then(async () => this.drain())
      .finally(() => {
      this.drainPromise = null;
      if (this.queue.length > 0) {
        this.ensureDrain();
      }
      });
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const next = this.pickNext();
      if (!next) {
        break;
      }

      this.queuedByTask.delete(next.task);
      const runningItem: RunningItem<TTask> = {
        task: next.task,
        force: next.force,
        waiters: next.waiters,
      };
      this.runningByTask.set(next.task, runningItem);
      this.stateStore.markTaskStart(next.task, { force: next.force });

      const handler = this.handlers[next.task];

      try {
        await handler({ force: next.force, reason: next.reason });
        runningItem.waiters.forEach((deferred) => deferred.resolve());
        this.stateStore.markTaskSuccess(next.task);
      } catch (error) {
        runningItem.waiters.forEach((deferred) => deferred.reject(error));
        this.stateStore.markTaskFailure(next.task, error);
      } finally {
        this.runningByTask.delete(next.task);
      }
    }
  }

  private pickNext(): QueueItem<TTask> | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    let pickedIndex = 0;
    for (let i = 1; i < this.queue.length; i += 1) {
      const current = this.queue[i];
      const picked = this.queue[pickedIndex];
      if (current.priority > picked.priority) {
        pickedIndex = i;
      } else if (current.priority === picked.priority && current.sequence < picked.sequence) {
        pickedIndex = i;
      }
    }

    const [picked] = this.queue.splice(pickedIndex, 1);
    return picked;
  }
}
