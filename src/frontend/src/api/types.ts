export interface CreatePasteRequest {
  readonly ciphertext: string;
  readonly expiresInSeconds: number;
  readonly maxViews: number | null;
}

export interface CreatePasteResponse {
  readonly id: string;
  readonly deleteToken: string;
  readonly expiresAt: string;
}

export interface PeekResponse {
  readonly expiresAt: string;
  readonly remainingViews: number | null;
  readonly sizeBytes: number;
}

export interface ClaimResponse {
  readonly ciphertext: string;
  readonly remainingViews: number | null;
  readonly expiresAt: string;
}
