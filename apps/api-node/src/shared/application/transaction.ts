declare const transactionContext: unique symbol;

export interface TransactionContext {
  readonly [transactionContext]: true;
}

export type TransactionRunner = <T>(work: (context: TransactionContext) => Promise<T>) => Promise<T>;

const outcomes = new WeakMap<object, "ROLLED_BACK" | "UNKNOWN">();

export function recordTransactionOutcome(error: unknown, outcome: "ROLLED_BACK" | "UNKNOWN") {
  if (typeof error === "object" && error !== null) outcomes.set(error, outcome);
}

export function transactionWasRolledBack(error: unknown) {
  return typeof error === "object" && error !== null && outcomes.get(error) === "ROLLED_BACK";
}
