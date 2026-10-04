export interface FaceQualityCheckOptions {
  /**
   * Imagen en base64. En la app se envía `result.value` desde CameraPreview.
   */
  image: string;
  /**
   * True cuando se valida en tiempo real (overlay). Permite respuestas rápidas.
   */
  isLivePreview?: boolean;
}

export interface FaceQualityCheckResult {
  valid: boolean;
  faces: number;
  eyesOpen?: boolean;
  message?: string;
}

export interface FaceQualityPlugin {
  check(options: FaceQualityCheckOptions): Promise<FaceQualityCheckResult>;
}
