export type SyncSqliteLocalId = string | number;

export interface SyncSqliteBackendResult {
  localId: SyncSqliteLocalId;
  status: string;
  synced: boolean;
  message?: string;
}

export interface SyncSqliteBackendResponse {
  success: boolean;
  fechaSincronizacion?: string;
  results: SyncSqliteBackendResult[];
}

//Configura las opciones de sincronizacion de registros de sqllite
export interface SyncSqliteOptions {
  batchSize?: number;
  maxRecords?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  endpointUrl?: string;
  onProgress?: (processed: number, total: number) => void;
}

export interface SyncSqliteRecordDetail<T> {
  item: T;
  localId: SyncSqliteLocalId;
  synced: boolean;
  result?: SyncSqliteBackendResult;
  error?: string;
}

export interface SyncSqliteConfirmedRecord<T> {
  item: T;
  localId: SyncSqliteLocalId;
  result: SyncSqliteBackendResult;
}

//interfaz para declarar el tipo de records o registros que va almacenar)
export interface SyncSqliteSummary<T> {
  total: number;
  confirmed: number;
  rejected: number;
  details: SyncSqliteRecordDetail<T>[];
}

export interface SyncSqlitePayloadContext {
  deviceId: string;
}

export interface SyncSqliteRecordsConfig<T, TPayload> {
  items: T[];
  endpointUrl: string;
  getLocalId: (item: T) => SyncSqliteLocalId;
  buildPayload: (item: T, context: SyncSqlitePayloadContext) => TPayload;
  markAsSynced: (item: T, result: SyncSqliteBackendResult, syncDate?: string) => Promise<void>;
  markBatchAsSynced?: (confirmedRecords: SyncSqliteConfirmedRecord<T>[], syncDate?: string) => Promise<void>;
  options?: SyncSqliteOptions;
}
