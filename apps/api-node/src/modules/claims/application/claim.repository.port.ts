import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { ClaimStatus, ConsentStatus, FinderDecision, ParticipantRole } from "../domain/claim-policy.js";
import type { VerificationPrivacyLevel, VerificationQuestionType } from "../domain/verification-question-templates.js";
export type { ClaimStatus, ConsentStatus, FinderDecision, ParticipantRole } from "../domain/claim-policy.js";

export interface VerificationQuestionRecord {
  id: string;
  claimId: string;
  postId: string;
  prompt: string;
  questionType: VerificationQuestionType;
  sourceSignal: string;
  expectedAnswerHash: string | null;
  options: string[] | null;
  privacyLevel: VerificationPrivacyLevel;
  status: "DRAFT" | "APPROVED" | "DISABLED";
  assignedAt: string;
  answer: {
    answeredBy: string;
    isMatch: boolean | null;
    attemptCount: number;
    lastAttemptAt: string;
    answeredAt: string;
  } | null;
}

export interface ClaimAuditEventRecord {
  id: string;
  claimId: string;
  actorId: string;
  action: string;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface MatchPairRow {
  lost_post_id: string;
  found_post_id: string;
  claimant_id: string;
  finder_id: string;
  total_score: number;
  score_tier: string;
}

export interface ClaimRepository {
  findClaimablePostForUpdate(postId: string, connection: TransactionContext): Promise<{
    id: string;
    ownerId: string;
    type: "LOST" | "FOUND";
  } | null>;
  findMatchPairForUpdate(lostPostId: string, foundPostId: string, suggestionThreshold: number, connection: TransactionContext): Promise<MatchPairRow>;
  findById(claimId: string, queryable?: TransactionContext): Promise<{
    id: string;
    lostPostId: string | null;
    foundPostId: string;
    claimantId: string;
    finderId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    description: string | null;
    approximateLostAt: string | null;
    approximateLocation: string | null;
    rejectionReason: string | null;
    moreInfoRequest: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    claimant: {
      id: string;
      fullName: string;
      email: string;
    };
    finder: {
      id: string;
      fullName: string;
      email: string;
    };
    posts: {
      lost: {
        id: string;
        title: string | null;
      } | null;
      found: {
        id: string;
        title: string;
      };
    };
    roomId: string | null;
  } | null>;
  findByIdForUpdate(claimId: string, queryable: TransactionContext): Promise<{
    id: string;
    lostPostId: string | null;
    foundPostId: string;
    claimantId: string;
    finderId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    description: string | null;
    approximateLostAt: string | null;
    approximateLocation: string | null;
    rejectionReason: string | null;
    moreInfoRequest: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    claimant: {
      id: string;
      fullName: string;
      email: string;
    };
    finder: {
      id: string;
      fullName: string;
      email: string;
    };
    posts: {
      lost: {
        id: string;
        title: string | null;
      } | null;
      found: {
        id: string;
        title: string;
      };
    };
    roomId: string | null;
  } | null>;
  findByRequestKey(userId: string, requestKey: string, queryable?: TransactionContext): Promise<{
    id: string;
    lostPostId: string | null;
    foundPostId: string;
    claimantId: string;
    finderId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    description: string | null;
    approximateLostAt: string | null;
    approximateLocation: string | null;
    rejectionReason: string | null;
    moreInfoRequest: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    claimant: {
      id: string;
      fullName: string;
      email: string;
    };
    finder: {
      id: string;
      fullName: string;
      email: string;
    };
    posts: {
      lost: {
        id: string;
        title: string | null;
      } | null;
      found: {
        id: string;
        title: string;
      };
    };
    roomId: string | null;
  } | null>;
  findByFoundPostForClaimant(foundPostId: string, claimantId: string, queryable?: TransactionContext): Promise<{
    id: string;
    lostPostId: string | null;
    foundPostId: string;
    claimantId: string;
    finderId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    description: string | null;
    approximateLostAt: string | null;
    approximateLocation: string | null;
    rejectionReason: string | null;
    moreInfoRequest: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    claimant: {
      id: string;
      fullName: string;
      email: string;
    };
    finder: {
      id: string;
      fullName: string;
      email: string;
    };
    posts: {
      lost: {
        id: string;
        title: string | null;
      } | null;
      found: {
        id: string;
        title: string;
      };
    };
    roomId: string | null;
  } | null>;
  createClaim(input: {
    id: string;
    lostPostId: string | undefined;
    foundPostId: string;
    claimantId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    requestKey?: string;
    description?: string;
    approximateLostAt?: Date;
    approximateLocation?: string;
  }, queryable: TransactionContext): Promise<void>;
  addParticipant(input: {
    claimId: string;
    userId: string;
    role: ParticipantRole;
    consentStatus: ConsentStatus;
  }, queryable: TransactionContext): Promise<void>;
  updateParticipantConsent(claimId: string, userId: string, consentStatus: ConsentStatus, queryable: TransactionContext): Promise<void>;
  findParticipant(claimId: string, userId: string, queryable?: TransactionContext): Promise<{
    claimId: string;
    userId: string;
    role: ParticipantRole;
    consentStatus: ConsentStatus;
    joinedAt: string | null;
    fullName: string;
  } | null>;
  findVerificationContext(claimId: string, queryable?: TransactionContext): Promise<{
    foundPostId: string;
    categoryName: string;
    parentCategoryName: string | null;
  } | null>;
  findClaimItemContext(claimId: string, queryable?: TransactionContext): Promise<{
    foundPostId: string;
    title: string;
    categoryName: string | null;
    visibilityMode: "PUBLIC" | "PRIVATE_DETAILS";
    areaName: string | null;
    buildingName: string | null;
    roomText: string | null;
    customLocation: string | null;
    handoverPointName: string | null;
    mediaId: string | null;
  } | null>;
  listParticipants(claimId: string, queryable?: TransactionContext): Promise<{
    claimId: string;
    userId: string;
    role: ParticipantRole;
    consentStatus: ConsentStatus;
    joinedAt: string | null;
    fullName: string;
  }[]>;
  listParticipantsForClaims(claimIds: string[]): Promise<Map<string, {
    claimId: string;
    userId: string;
    role: ParticipantRole;
    consentStatus: ConsentStatus;
    joinedAt: string | null;
    fullName: string;
  }[]>>;
  listConversationSummaries(claimIds: string[], userId: string): Promise<Map<string, {
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    custodyEscalated: boolean;
  }>>;
  listForUser(userId: string, query: {
    page: number;
    pageSize: number;
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    items: {
      id: string;
      lostPostId: string | null;
      foundPostId: string;
      claimantId: string;
      finderId: string;
      status: ClaimStatus;
      finderDecision: FinderDecision;
      description: string | null;
      approximateLostAt: string | null;
      approximateLocation: string | null;
      rejectionReason: string | null;
      moreInfoRequest: string | null;
      acceptedAt: string | null;
      rejectedAt: string | null;
      cancelledAt: string | null;
      createdAt: string;
      updatedAt: string;
      claimant: {
        id: string;
        fullName: string;
        email: string;
      };
      finder: {
        id: string;
        fullName: string;
        email: string;
      };
      posts: {
        lost: {
          id: string;
          title: string | null;
        } | null;
        found: {
          id: string;
          title: string;
        };
      };
      roomId: string | null;
    }[];
  }>;
  updateFinderDecision(input: {
    claimId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    note?: string;
    acceptedAt?: boolean;
    rejectedAt?: boolean;
  }, queryable: TransactionContext): Promise<void>;
  updateFinderParticipant(claimId: string, userId: string, status: ConsentStatus, queryable: TransactionContext): Promise<void>;
  findById(claimId: string, queryable?: TransactionContext): Promise<any | null>;
  withdrawClaim(claimId: string, claimantId: string, queryable: TransactionContext): Promise<boolean>;
  findRoomByClaim(claimId: string, queryable?: TransactionContext): Promise<{
    id: string;
    claimId: string;
    escalatedAt: string | null;
    escalatedBy: string | null;
    escalationReason: string | null;
    createdAt: string;
  } | null>;
  createRoom(claimId: string, queryable: TransactionContext): Promise<{
    id: `${string}-${string}-${string}-${string}-${string}`;
    claimId: string;
  }>;
  createVerificationQuestion(input: {
    id: string;
    postId: string;
    prompt: string;
    questionType: VerificationQuestionType;
    sourceSignal: string;
    expectedAnswerHash: string | null;
    privacyLevel: VerificationPrivacyLevel;
    createdBy: string;
  }, queryable: TransactionContext): Promise<void>;
  assignVerificationQuestion(claimId: string, questionId: string, queryable: TransactionContext): Promise<void>;
  listVerificationQuestions(claimId: string, queryable?: TransactionContext): Promise<VerificationQuestionRecord[]>;
  findVerificationQuestion(claimId: string, questionId: string, queryable?: TransactionContext): Promise<VerificationQuestionRecord | null>;
  saveVerificationAnswer(input: {
    id: string;
    claimId: string;
    questionId: string;
    answeredBy: string;
    isMatch: boolean | null;
  }, queryable: TransactionContext): Promise<void>;
  markRoomEscalated(input: {
    claimId: string;
    actorId: string;
    reason: string;
  }, queryable: TransactionContext): Promise<void>;
  clearRoomEscalation(claimId: string, queryable: TransactionContext): Promise<void>;
  hasActiveAppointment(claimId: string, queryable: TransactionContext): Promise<boolean>;
  findAuditByIdempotencyKey(claimId: string, actorId: string, idempotencyKey: string, queryable: TransactionContext): Promise<ClaimAuditEventRecord | null>;
  listVerificationAuditEvents(claimId: string, queryable?: TransactionContext): Promise<ClaimAuditEventRecord[]>;
  listRoomsForUser(userId: string): Promise<{
    id: string;
    lostPostId: string | null;
    foundPostId: string;
    claimantId: string;
    finderId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    description: string | null;
    approximateLostAt: string | null;
    approximateLocation: string | null;
    rejectionReason: string | null;
    moreInfoRequest: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    claimant: {
      id: string;
      fullName: string;
      email: string;
    };
    finder: {
      id: string;
      fullName: string;
      email: string;
    };
    posts: {
      lost: {
        id: string;
        title: string | null;
      } | null;
      found: {
        id: string;
        title: string;
      };
    };
    roomId: string | null;
  }[]>;
  findRoomForParticipant(roomId: string, userId: string, queryable?: TransactionContext): Promise<{
    id: string;
    lostPostId: string | null;
    foundPostId: string;
    claimantId: string;
    finderId: string;
    status: ClaimStatus;
    finderDecision: FinderDecision;
    description: string | null;
    approximateLostAt: string | null;
    approximateLocation: string | null;
    rejectionReason: string | null;
    moreInfoRequest: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    claimant: {
      id: string;
      fullName: string;
      email: string;
    };
    finder: {
      id: string;
      fullName: string;
      email: string;
    };
    posts: {
      lost: {
        id: string;
        title: string | null;
      } | null;
      found: {
        id: string;
        title: string;
      };
    };
    roomId: string | null;
  } | null>;
  createMessage(input: {
    roomId: string;
    senderId: string;
    content: string;
    clientMessageId?: string;
  }, queryable: TransactionContext): Promise<{
    id: string;
    roomId: string;
    sender: {
      id: string;
      fullName: string;
    };
    clientMessageId: string | null;
    content: string | null;
    messageType: "TEXT" | "IMAGE" | "SYSTEM";
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
  } | null>;
  listMessages(roomId: string, query: {
    before?: Date;
    beforeId?: string;
    limit: number;
  }): Promise<{
    items: {
      id: string;
      roomId: string;
      sender: {
        id: string;
        fullName: string;
      };
      clientMessageId: string | null;
      content: string | null;
      messageType: "TEXT" | "IMAGE" | "SYSTEM";
      isRead: boolean;
      readAt: string | null;
      createdAt: string;
    }[];
    hasMore: boolean;
    nextCursor: {
      before: string;
      beforeId: string;
    } | null;
  }>;
  markMessagesRead(roomId: string, readerId: string): Promise<number>;
  listEvidence(claimId: string): Promise<{
    id: string;
    claimId: string;
    uploadedBy: {
      id: string;
      fullName: string;
    };
    mediaFormat: string | null;
    mediaBytes: number | null;
    evidenceType: "OWNERSHIP_PROOF" | "ADDITIONAL_DOC" | "PHOTO";
    description: string | null;
    createdAt: string;
    url: string;
  }[]>;
  createEvidence(input: {
    id: string;
    claimId: string;
    uploadedBy: string;
    secureUrl: string;
    publicId: string;
    mediaFormat: string;
    mediaBytes: number;
    description?: string;
  }, queryable: TransactionContext): Promise<void>;
  findEvidence(claimId: string, evidenceId: string): Promise<{
    secureUrl: string;
    publicId: string;
    mediaFormat: string | null;
    id: string;
    claimId: string;
    uploadedBy: {
      id: string;
      fullName: string;
    };
    mediaBytes: number | null;
    evidenceType: "OWNERSHIP_PROOF" | "ADDITIONAL_DOC" | "PHOTO";
    description: string | null;
    createdAt: string;
    url: string;
  } | null>;
  writeAudit(input: {
    eventId?: string;
    claimId: string;
    actorId: string;
    action: string;
    fromStatus?: ClaimStatus | null;
    toStatus?: ClaimStatus | null;
    metadata?: Record<string, unknown>;
  }, queryable?: TransactionContext): Promise<void>;
}
