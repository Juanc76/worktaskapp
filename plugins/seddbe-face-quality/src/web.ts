import { WebPlugin } from '@capacitor/core';

import type { FaceQualityCheckOptions, FaceQualityCheckResult, FaceQualityPlugin } from './definitions';

export class FaceQualityWeb extends WebPlugin implements FaceQualityPlugin {
  async check(_options: FaceQualityCheckOptions): Promise<FaceQualityCheckResult> {
    return {
      valid: false,
      faces: 0,
      eyesOpen: false,
      message: 'FaceQuality no está disponible en Web.',
    };
  }
}
