import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class SyncFilesService {

 
 
  async syncFiles<T>(
  registros: T[],
  readFileFn: (item: T) => Promise<string | Blob>,
  uploadFn: (item: T, data: string | Blob) => Promise<boolean>,
  onSuccessFn: (item: T) => Promise<void>,
  onErrorFn: (item: T, error: any) => Promise<void>,
  registrosBache: number = 10,
  onProgress?: (procesados: number, total: number) => void,
  maxIntentos: number = 2,
  tiempoEspera: number = 1500
): Promise<PromiseSettledResult<void>[]> {

  const results: PromiseSettledResult<void>[] = [];
  let processed = 0;

  const delay = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < registros.length; i += registrosBache) {

    const batch = registros.slice(i, i + registrosBache);

    const batchPromises = batch.map(async (item) => {

      try {

        const data = await readFileFn(item);

        let attempt = 0;
        let uploaded = false;

        while (attempt <= maxIntentos && !uploaded) {

          try {

            uploaded = await uploadFn(item, data);

            if (!uploaded) {
              throw new Error("Upload rejected");
            }

          } catch (err) {

            attempt++;

            if (attempt > maxIntentos) {
              throw err;
            }

            await delay(tiempoEspera * attempt);

          }

        }

        await onSuccessFn(item);

      } catch (err) {

        await onErrorFn(item, err);
        throw err;

      }

    });

    const batchResults = await Promise.allSettled(batchPromises);

    results.push(...batchResults);

    for (const _ of batchResults) {
      processed++;
      onProgress?.(processed, registros.length);
    }

  }

  return results;

}
}
