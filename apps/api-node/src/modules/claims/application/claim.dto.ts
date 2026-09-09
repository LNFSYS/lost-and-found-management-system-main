export type CreateClaimInput = { lostPostId: string; foundPostId: string; description?: string | undefined; approximateLostAt?: Date | undefined; approximateLocation?: string | undefined; requestKey?: string | undefined; };

export type ClaimDecisionInput = { decision: "ACCEPT" | "DECLINE" | "REQUEST_MORE_INFO"; note?: string | undefined; };

export type CreateMessageInput = { content: string; clientMessageId?: string | undefined; };

export type ListMessagesQuery = { limit: number; before?: Date | undefined; beforeId?: string | undefined; };

export type UploadEvidenceInput = { description?: string | undefined; };

export type ListClaimsQuery = { page: number; pageSize: number; };
