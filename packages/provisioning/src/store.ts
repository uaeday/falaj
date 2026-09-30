import type { LaunchState } from './launch.ts';

/** Persistence port for launch runs (Postgres table `launch_runs` in @falaj/db). */
export interface LaunchStore {
  save(state: LaunchState): Promise<void>;
  get(runId: string): Promise<LaunchState | undefined>;
}

export class InMemoryLaunchStore implements LaunchStore {
  private readonly runs = new Map<string, LaunchState>();
  async save(state: LaunchState) {
    this.runs.set(state.runId, structuredClone(state));
  }
  async get(runId: string) {
    const s = this.runs.get(runId);
    return s ? structuredClone(s) : undefined;
  }
}
