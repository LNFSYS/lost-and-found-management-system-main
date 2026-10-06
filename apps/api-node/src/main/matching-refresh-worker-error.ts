export type MatchingRefreshPhase = "SCHEMA_CHECK" | "REFRESH";

export function matchingRefreshWorkerError(error: unknown, phase: MatchingRefreshPhase) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const closedConnection = error instanceof Error && /connection is in closed state|connection lost|closed state/i.test(error.message);
  return {
    errorCode: "MATCH_REFRESH_TICK_FAILED",
    causeCode: typeof value.code === "string" && /^[A-Za-z0-9_]{1,64}$/.test(value.code)
      ? value.code : closedConnection ? "DB_CONNECTION_CLOSED" : undefined,
    causeType: error instanceof TypeError ? "TypeError" : error instanceof RangeError ? "RangeError" : "Error",
    syscall: typeof value.syscall === "string" && ["connect", "read", "write", "getaddrinfo"].includes(value.syscall) ? value.syscall : undefined,
    errno: typeof value.errno === "number" && Number.isInteger(value.errno) ? value.errno : undefined,
    sqlState: typeof value.sqlState === "string" && /^[A-Z0-9]{5}$/.test(value.sqlState) ? value.sqlState : undefined,
    phase
  };
}
