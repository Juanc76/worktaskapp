export type SyncFilesProgressCallback = (processed: number, total: number) => void;

export interface SyncFilesSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: PromiseSettledResult<void>[];
}
