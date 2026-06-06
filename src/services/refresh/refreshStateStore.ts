export type RefreshTaskStateSnapshot<TTask extends string = string> = {
  running: Partial<Record<TTask, boolean>>;
  partialFailed: Partial<Record<TTask, boolean>>;
  stale: Partial<Record<TTask, boolean>>;
  lastSuccessAt: Partial<Record<TTask, number>>;
};

export type RefreshTaskStartMeta = {
  force: boolean;
};

type Listener<TTask extends string> = (snapshot: RefreshTaskStateSnapshot<TTask>) => void;

const cloneSnapshot = <TTask extends string>(
  snapshot: RefreshTaskStateSnapshot<TTask>,
): RefreshTaskStateSnapshot<TTask> => ({
  running: { ...snapshot.running },
  partialFailed: { ...snapshot.partialFailed },
  stale: { ...snapshot.stale },
  lastSuccessAt: { ...snapshot.lastSuccessAt },
});

export class RefreshStateStore<TTask extends string = string> {
  private snapshot: RefreshTaskStateSnapshot<TTask> = {
    running: {},
    partialFailed: {},
    stale: {},
    lastSuccessAt: {},
  };

  private listeners = new Set<Listener<TTask>>();

  getSnapshot(): RefreshTaskStateSnapshot<TTask> {
    return cloneSnapshot(this.snapshot);
  }

  subscribe(listener: Listener<TTask>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  markTaskStart(task: TTask, _meta: RefreshTaskStartMeta): void {
    this.snapshot.running[task] = true;
    this.publish();
  }

  markTaskSuccess(task: TTask): void {
    this.snapshot.running[task] = false;
    this.snapshot.partialFailed[task] = false;
    this.snapshot.stale[task] = false;
    this.snapshot.lastSuccessAt[task] = Date.now();
    this.publish();
  }

  markTaskFailure(task: TTask, _error: unknown): void {
    this.snapshot.running[task] = false;
    this.snapshot.partialFailed[task] = true;
    this.publish();
  }

  markTaskStale(task: TTask, stale = true): void {
    this.snapshot.stale[task] = stale;
    this.publish();
  }

  private publish(): void {
    const next = this.getSnapshot();
    this.listeners.forEach((listener) => listener(next));
  }
}
