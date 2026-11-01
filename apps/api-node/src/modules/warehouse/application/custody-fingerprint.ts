export function custodyFingerprint(input: { postId?: string | null; claimId?: string | null; roomId?: string | null; reason?: string | null; handoverPointId?: string | null; requestedIntakeAt?: Date | string | null; }) {
  const value: Array<string | null> = [input.postId ?? null, input.claimId ?? null, input.roomId ?? null, input.reason?.trim() || null, input.handoverPointId ?? null];
  if (input.requestedIntakeAt !== undefined) value.push(input.requestedIntakeAt instanceof Date ? input.requestedIntakeAt.toISOString() : input.requestedIntakeAt);
  return JSON.stringify(value);
}
