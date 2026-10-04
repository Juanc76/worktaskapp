import { registerPlugin } from '@capacitor/core';

import type { FaceQualityPlugin } from './definitions';

const FaceQuality = registerPlugin<FaceQualityPlugin>('FaceQuality', {
  web: () => import('./web').then((m) => new m.FaceQualityWeb()),
});

export * from './definitions';
export { FaceQuality };
