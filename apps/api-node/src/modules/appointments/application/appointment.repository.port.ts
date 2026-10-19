import type { TransactionContext } from "../../../shared/application/transaction.js";

export type AppointmentStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED";
export type HandoverResponse = "PENDING" | "CONFIRMED" | "DISPUTED";
export interface Appointment {
  id: string; claimId: string; postId: string; title: string; proposerId: string;
  finderId: string; ownerId: string; status: AppointmentStatus; proposedAt: string;
  handoverPointId: string | null; location: string | null; version: number;
  itemImageUrl: string | null;
  finderResponse: HandoverResponse; ownerResponse: HandoverResponse;
  noShowUserId: string | null; custodyAuthorized: boolean; completedAt: string | null;
  events: Array<{ id: string; action: string; actorId: string | null; createdAt: string; note?: string | null }>;
}
export interface AppointmentContext {
  claimId: string; postId: string; finderId: string; ownerId: string;
  eligible: boolean; blocked: boolean;
}
export interface AppointmentRepository {
  schemaReady(): Promise<boolean>;
  context(claimId: string, tx: TransactionContext): Promise<AppointmentContext | null>;
  assertSafe(context: AppointmentContext, tx: TransactionContext): Promise<boolean>;
  find(id: string, tx?: TransactionContext): Promise<Appointment | null>;
  list(userId: string, page: number, claimId?: string): Promise<{ results: Appointment[]; total: number }>;
  replay(actorId: string, key: string, tx: TransactionContext): Promise<{ appointmentId: string; hash: string } | null>;
  create(input: { id: string; claimId: string; postId: string; proposerId: string; proposedAt: Date; handoverPointId: string | null; customLocation: string | null }, tx: TransactionContext): Promise<void>;
  active(claimId: string, tx: TransactionContext): Promise<boolean>;
  pointExists(id: string, tx: TransactionContext): Promise<boolean>;
  update(appointment: Appointment, now: Date, tx: TransactionContext): Promise<void>;
  event(input: { id: string; appointmentId: string; actorId: string | null; action: string; key?: string; hash?: string; note?: string }, tx: TransactionContext): Promise<void>;
  dueReminders(now: Date, leadMinutes: number): Promise<string[]>;
  markReminded(id: string, now: Date, tx: TransactionContext): Promise<boolean>;
}
