export type Role = "USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN";
export type AudienceRole = "STUDENT" | "LECTURER";

export interface User {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  phoneNumber: string | null;
  avatar: {
    hasAvatar: boolean;
    updatedAt: string | null;
  };
  status: "ACTIVE" | "DISABLED";
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivitySummary {
  ownerId: string;
  counts: {
    posts: number;
    openPosts: number;
    claims: number;
    completedReturns: number;
    receivedFeedback: number;
  };
  reputation: {
    totalPoints: number;
    level: "NEW" | "TRUSTED" | "RELIABLE" | "EXCELLENT";
    updatedAt: string | null;
  };
  recentEvents: Array<{
    type: "POST_CREATED" | "CLAIM_CREATED" | "RETURN_COMPLETED" | "FEEDBACK_RECEIVED" | "REPUTATION_CHANGED";
    label: string;
    occurredAt: string;
    pointsDelta?: number;
  }>;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: Role[];
  sessionVersion: number;
}
