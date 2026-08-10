export type Role = "USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN";
export type AudienceRole = "STUDENT" | "LECTURER";

export interface User {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  phoneNumber: string | null;
  status: "ACTIVE" | "DISABLED";
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: Role[];
  sessionVersion: number;
}
