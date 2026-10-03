export function notificationEmailWorkerError(error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    errorCode: "WORKER_TICK_FAILED",
    causeCode: typeof value.code === "string" && /^[A-Z0-9_]{1,64}$/.test(value.code) ? value.code : undefined,
    causeType: error instanceof TypeError ? "TypeError" : error instanceof RangeError ? "RangeError" : "Error",
    syscall: ["connect", "read", "write", "getaddrinfo"].includes(String(value.syscall)) ? value.syscall : undefined,
    errno: typeof value.errno === "number" && Number.isInteger(value.errno) ? value.errno : undefined,
    sqlState: typeof value.sqlState === "string" && /^[A-Z0-9]{5}$/.test(value.sqlState) ? value.sqlState : undefined
  };
}
