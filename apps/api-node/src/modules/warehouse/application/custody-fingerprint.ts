export function custodyFingerprint(input: { postId?: string | null; claimId?: string | null; roomId?: string | null; reason?: string | null; handoverPointId?: string | null; }) {
  return JSON.stringify([input.postId ?? null, input.claimId ?? null, input.roomId ?? null, input.reason?.trim() || null, input.handoverPointId ?? null]);
}
