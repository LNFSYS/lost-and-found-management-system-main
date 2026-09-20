declare const transactionContext: unique symbol;

export interface TransactionContext {
  readonly [transactionContext]: true;
}

export type TransactionRunner = <T>(work: (context: TransactionContext) => Promise<T>) => Promise<T>;
