import axios, { AxiosHeaders, create, isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "lnfs.access-token";
const CACHED_USER_KEY = "lnfs.cached-user";
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const apiBaseUrl = configuredBaseUrl || (__DEV__ ? "http://localhost:3001/api" : "");

if (!apiBaseUrl) {
  throw new Error("EXPO_PUBLIC_API_URL must be set to the deployed API URL for preview and production builds.");
}

if (!__DEV__) {
  const hostname = new URL(apiBaseUrl).hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "10.0.2.2"].includes(hostname)) {
    throw new Error("EXPO_PUBLIC_API_URL must use the deployed API host in preview and production builds.");
  }
}

export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, "");

export interface MobileUser {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  phoneNumber: string | null;
  avatar: { hasAvatar: boolean; updatedAt: string | null };
  status: "ACTIVE" | "DISABLED";
  roles: ("USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN")[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionResponse {
  accessToken: string;
  accessTokenExpiresIn: string;
  user: MobileUser;
}

export type MatchTier = "WEAK" | "SUGGESTION" | "NOTIFY" | "HIGH_CONFIDENCE";
export type MatchFeedbackValue = "USEFUL" | "IRRELEVANT" | "INCORRECT";

export interface MatchExplanation {
  tier: MatchTier;
  summary: string;
  reasons: string[];
  matchedTokens: string[];
  matchedImageTags: string[];
  matchedOcrTokens: string[];
  locationReason: string;
  categoryReason: string;
  daysDiff: number | null;
  penalties: string[];
}

export interface MatchFeedback {
  id: string;
  matchId: string;
  userId: string;
  sourcePostId: string;
  value: MatchFeedbackValue;
  note: string | null;
  correlationKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchCandidateResult {
  matchId: string;
  candidate: PostSummary;
  totalScore: number;
  scoreTier: MatchTier;
  scores: { text: number; category: number; location: number; time: number; image: number; ocr: number };
  explanation: MatchExplanation | null;
  matcherVersion: string;
  calculatedAt: string;
  feedback: MatchFeedback | null;
}

export interface PostMatchesResponse {
  source: PostSummary;
  matcherVersion: string;
  calculatedAt: string | null;
  thresholds: Record<string, number>;
  weights: Record<string, number>;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  results: MatchCandidateResult[];
}

export type JourneyImageKind = "POST" | "CLAIM" | "INTAKE" | "RETURN";
export interface JourneyImage { id: string; kind: JourneyImageKind; url: string; createdAt: string }
export interface JourneyEvent {
  id: string;
  source: string;
  action: string;
  targetType: string;
  targetId: string;
  actorId: string | null;
  createdAt: string;
  fromStatus: string | null;
  toStatus: string | null;
  images: JourneyImage[];
  matchingSuggestions?: { postId: string; title: string; type: "LOST" | "FOUND"; status: "OPEN" | "MATCHED"; score: number }[];
  conversationWith?: string | null;
  appointment?: { proposedAt: string };
}

export interface JourneySummary {
  custodian: "FINDER" | "STAFF" | "OWNER" | "UNKNOWN";
  locationClass: "FINDER_HELD" | "WAREHOUSE" | "RETURNED" | "OTHER_DISPOSITION" | "UNKNOWN";
  receivedAt: string | null;
  returnedAt: string | null;
  custodyHours: number | null;
  feedbackEligible: boolean;
}

export interface PostJourneyResponse {
  title: string;
  status: string;
  results: JourneyEvent[];
  total: number;
  summary: JourneySummary;
  asOf: string;
  page: number;
  hasMore: boolean;
}

export interface CompletedReturn {
  id: string;
  postTitle: string;
  completedAt: string;
  rating: number | null;
}

export interface ReturnFeedbackRecord {
  id: string;
  appointmentId: string;
  reviewer: { id: string; fullName: string };
  target: { id: string; fullName: string };
  rating: number;
  comment: string | null;
  isNegative: boolean;
  status: "NEW" | "REVIEWED" | "FLAGGED" | "DISMISSED";
  createdAt: string;
}

export interface ReturnFeedbackEligibility {
  appointmentId: string;
  eligible: boolean;
  reason: string | null;
  returnStatus: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED";
  completedAt: string | null;
  dualConfirmed: boolean;
  custodyAuthorized: boolean;
  currentUserFeedback: ReturnFeedbackRecord | null;
  feedbackCount: number;
  participants: {
    claimant: { id: string; fullName: string };
    finder: { id: string; fullName: string };
  };
}

export type ClaimStatus = "PENDING" | "CONVERSATION_OPEN" | "NEED_MORE_INFO" | "ACCEPTED" | "REJECTED" | "CANCELLED";
export type ClaimRole = "CLAIMANT" | "FINDER";
export type ClaimDecision = "VERIFY_FOR_MEETUP" | "REQUEST_MORE_INFO" | "DECLINE" | "ESCALATE_TO_CUSTODY";

export interface ClaimRecord {
  id: string;
  lostPostId: string | null;
  foundPostId: string;
  claimantId: string;
  finderId: string;
  status: ClaimStatus;
  finderDecision: "PENDING" | "ACCEPTED" | "DECLINED";
  conversationDecision: "PENDING" | "OPEN_CONVERSATION" | "DECLINED";
  appointmentEligible: boolean;
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
  claimant: { id: string; fullName: string };
  finder: { id: string; fullName: string };
  posts: { lost: { id: string; title: string | null } | null; found: { id: string; title: string } };
  roomId: string | null;
  participants?: { claimId: string; userId: string; role: ClaimRole; consentStatus: "PENDING" | "ACCEPTED" | "DECLINED"; joinedAt: string | null; fullName: string }[];
  room?: { id: string } | null;
  canSend?: boolean;
  contactPhoto?: { required: boolean; approved: boolean; postId: string; questions: string[] } | null;
  item?: { postId: string; title: string; categoryName: string | null; locationLabel: string | null; imageUrl: string | null } | null;
  conversation?: { lastMessage: string | null; lastMessageAt: string | null; unreadCount: number; custodyEscalated?: boolean };
}

export interface ClaimListResponse { items: ClaimRecord[]; total: number; page: number; pageSize: number; hasMore: boolean }
export interface ClaimMessage {
  id: string;
  roomId: string;
  sender: { id: string; fullName: string };
  clientMessageId: string | null;
  content: string | null;
  messageType: "TEXT" | "IMAGE" | "SYSTEM";
  mediaUrl?: string | null;
  previewUrl?: string;
  pending?: boolean;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
export interface ClaimMessagesResponse {
  room: { id: string; claimId: string; status: ClaimStatus; participantRole: ClaimRole; createdAt: string };
  items: ClaimMessage[];
  hasMore: boolean;
  nextCursor: { before: string; beforeId: string } | null;
}
export interface ClaimEvidence {
  id: string;
  claimId: string;
  uploadedBy: { id: string; fullName: string };
  mediaFormat: string | null;
  mediaBytes: number | null;
  evidenceType: "OWNERSHIP_PROOF" | "ADDITIONAL_DOC" | "PHOTO";
  description: string | null;
  createdAt: string;
  url: string;
}
export interface VerificationTemplatePrompt {
  key: string;
  prompt: string;
  questionType: "TEXT" | "MASKED_SERIAL" | "MULTIPLE_CHOICE" | "VISUAL_DETAIL";
  privacyLevel: "PRIVATE" | "HIGHLY_PRIVATE";
}
export interface VerificationTemplatesResponse {
  category: string;
  template: { id: string; version: number; minimumAnswers: number; prompts: VerificationTemplatePrompt[]; customFollowUpAllowed: boolean };
}
export interface ClaimVerificationState {
  claimId: string;
  status: ClaimStatus;
  appointmentEligible: boolean;
  participantRole: ClaimRole;
  roomEscalation: { escalatedAt: string; escalatedBy: string | null; reason: string | null } | null;
  policy: { templateId: string; templateVersion: number; minimumAnswers: number; answeredCount: number; matchedCount?: number; readyForDecision: boolean; photoContactEligible?: boolean };
  questions: {
    id: string;
    prompt: string;
    questionType: VerificationTemplatePrompt["questionType"];
    privacyLevel: VerificationTemplatePrompt["privacyLevel"];
    status: "DRAFT" | "APPROVED" | "DISABLED";
    assignedAt: string;
    template: { templateId: string; templateVersion: number; promptKey: string } | null;
    answer: { answered: true; attemptCount: number; answeredAt: string; isMatch?: boolean } | null;
  }[];
  history: { id: string; actorId: string; action: string; fromStatus: ClaimStatus | null; toStatus: ClaimStatus | null; metadata: Record<string, unknown> | null; createdAt: string }[];
}

export type AppointmentStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED";
export type AppointmentAction = "ACCEPT" | "REJECT" | "CANCEL" | "CONFIRM" | "DISPUTE" | "NO_SHOW";
export interface AppointmentRecord {
  id: string;
  claimId: string;
  postId: string;
  title: string;
  proposerId: string;
  finderId: string;
  ownerId: string;
  status: AppointmentStatus;
  proposedAt: string;
  handoverPointId: string | null;
  location: string | null;
  version: number;
  itemImageUrl?: string | null;
  finderResponse: "PENDING" | "CONFIRMED" | "DISPUTED";
  ownerResponse: "PENDING" | "CONFIRMED" | "DISPUTED";
  noShowUserId: string | null;
  custodyAuthorized: boolean;
  completedAt: string | null;
  events: { id: string; action: string; actorId: string | null; createdAt: string; note?: string | null }[];
}
export interface AppointmentListResponse { results: AppointmentRecord[]; total: number }
export interface PublicHandoverPoint { id: string; name: string; address?: string | null; openingHours?: string | null }

export interface MatchSummary {
  candidateCount: number;
  suggestionCount: number;
  topScore: number | null;
  topTier: MatchTier | null;
  lastCalculatedAt: string | null;
}

export interface PostSummary {
  id: string;
  type: "LOST" | "FOUND";
  status: "OPEN" | "MATCHED" | "RESOLVED" | "CLOSED" | "EXPIRED" | "HIDDEN";
  visibilityMode: "PUBLIC" | "PRIVATE_DETAILS";
  title: string;
  description: string | null;
  contactInfo?: string | null;
  category: { id: string; name: string | null; icon: string | null } | null;
  location: {
    area: { id: string; name: string | null } | null;
    building: { id: string; name: string | null } | null;
    roomText: string | null;
    customLocation: string | null;
  };
  handoverPoint: { id: string; name: string | null; address: string | null } | null;
  lostFoundAt: string | null;
  owner: { id: string; fullName: string };
  media: { id: string; url: string; mediaKind: "ITEM" | "EVIDENCE"; isAiGenerated?: boolean }[];
  canEdit: boolean;
  createdAt: string;
  matchSummary?: MatchSummary;
}

export interface PostListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: PostSummary[];
}

export interface PostListFilters {
  q?: string;
  type?: "LOST" | "FOUND";
  status?: PostSummary["status"];
  categoryId?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "incident_newest" | "incident_oldest";
}

export interface PostCatalog {
  categories: { id: string; name: string; parentId: string | null }[];
  areas: { id: string; name: string }[];
  buildings: { id: string; areaId: string; name: string }[];
  handoverPoints: { id: string; name: string; address: string; openingHours: string | null }[];
}

export interface MobileImageFile {
  uri: string;
  name?: string;
  type?: string;
  size?: number;
  id?: string;
}

export interface CreatePostPayload {
  type: "LOST" | "FOUND";
  title: string;
  description: string;
  categoryId: string;
  illustrationId?: string;
  illustrationDraftId?: string;
  areaId?: string | null;
  buildingId?: string | null;
  roomText?: string | null;
  customLocation?: string | null;
  contactInfo: string;
  lostFoundAt: string;
  handoverPointId?: string | null;
  visibilityMode?: "PUBLIC" | "PRIVATE_DETAILS";
  analysisSignals?: {
    visualAttributes: string[];
    visibleText: string[];
    confidence: number;
  };
}

export interface UpdatePostPayload {
  title?: string;
  description?: string;
  categoryId?: string;
  areaId?: string | null;
  buildingId?: string | null;
  roomText?: string | null;
  customLocation?: string | null;
  contactInfo?: string;
  lostFoundAt?: string;
  handoverPointId?: string | null;
  visibilityMode?: "PUBLIC" | "PRIVATE_DETAILS";
  status?: "OPEN" | "CLOSED" | "RESOLVED";
}

export interface ImageAnalysisResult {
  title: string;
  description: string;
  suggestedCategory: { id: string; name: string; parentId: string | null } | null;
  visualAttributes: string[];
  visibleText: string[];
  confidence: number;
  warnings: string[];
  assistedBy: string;
  model: string;
  imageCount: number;
}

export interface HandoverPoint {
  id: string;
  name: string;
  address?: string | null;
  openingHours?: string | null;
}

export interface CreateCustodyRequestPayload {
  postId?: string | null;
  claimId?: string | null;
  reason?: string | null;
  handoverPointId?: string | null;
  requestedIntakeAt?: string;
  intakeType?: "CUSTODY_TRANSFER" | "RETURN_HANDOVER";
}

export interface CustodyRequest {
  id: string;
  status: "PENDING" | "ACCEPTED" | "INTAKED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  requestedIntakeAt?: string | null;
}

export type WarehouseItemStatus = "PENDING_APPROVAL" | "RECEIVED" | "STORED" | "CLAIMED" | "RETURNED" | "EXPIRED" | "DISPOSED" | "DONATED" | "TRANSFERRED";
export type WarehouseImageProvenance = "SOURCE_POST" | "CONTACT_PHOTO" | "INTAKE" | "RETURN";
export type StaffCustodyStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "INTAKED";

export interface StaffWarehouseItem {
  id: string;
  postId: string | null;
  handoverPoint: { id: string; name: string | null; address: string | null } | null;
  itemName: string;
  description: string | null;
  category: { id: string; name: string | null } | null;
  location: { area: { id: string; name: string | null } | null; building: { id: string; name: string | null } | null; roomText: string | null };
  finder: { userId: string | null; userName: string | null; name: string | null; contact: string | null };
  status: WarehouseItemStatus;
  conditionNotes: string | null;
  storageCode: string | null;
  receivedAt: string;
  returnedAt: string | null;
  retentionDeadline: string | null;
  createdBy: { id: string; fullName: string | null };
  createdAt: string;
  updatedAt: string;
  logCount: number;
  receivedQuantity?: number | null;
  accessories?: string | null;
  thumbnail?: { id: string; provenance: WarehouseImageProvenance } | null;
}

export interface StaffWarehouseImage {
  id: string;
  provenance: WarehouseImageProvenance;
  uploaderId: string;
  uploadedAt: string;
  capturedAt: string | null;
  postId: string | null;
  intakeKey: string | null;
  returnId: string | null;
  url: string;
}

export interface StaffWarehouseStorageLog {
  id: string;
  warehouseItemId: string | null;
  postId: string | null;
  itemName?: string | null;
  handoverPoint: { id: string; name: string | null } | null;
  actor: { id: string; fullName: string | null };
  action: WarehouseItemStatus | "OVERDUE_MARKED" | "CONDITION_UPDATED";
  fromStatus: string | null;
  toStatus: string | null;
  conditionNotes: string | null;
  storageCode: string | null;
  note: string | null;
  createdAt: string;
}

export interface StaffWarehouseDashboard {
  stats: { totalItems: number; activeItems: number; receivedItems: number; storedItems: number; returnedItems: number; overdueItems: number };
  handoverCounts: { handoverPointId: string; name: string; address: string; itemCount: number; storedCount: number; overdueCount: number }[];
  total: number;
  page: number;
  pageSize: number;
  items: StaffWarehouseItem[];
}

export interface StaffCustodyRequest {
  id: string;
  claimId: string | null;
  roomId: string | null;
  postId: string | null;
  requester: { id: string; fullName: string | null };
  handler: { id: string; fullName: string | null } | null;
  status: StaffCustodyStatus;
  intakeType: "CUSTODY_TRANSFER" | "WALK_IN";
  reason: string | null;
  rejectionReason: string | null;
  handoverPoint: { id: string; name: string | null; address: string | null } | null;
  confirmedHandoverAt: string | null;
  requestedIntakeAt: string | null;
  warehouseItemId: string | null;
  createdAt: string;
  updatedAt: string;
  post: { id: string; title: string | null; thumbnailId?: string | null } | null;
  photoSource?: { lostPostId: string; title: string; imageId: string } | null;
}

export interface StaffCustodyAuditEntry {
  id: string;
  custodyRequestId: string;
  actorId: string;
  actorName: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface StaffCustodyIntakeContext {
  request: StaffCustodyRequest;
  post: { title: string; description: string | null; categoryId: string | null; areaId: string | null; buildingId: string | null; roomText: string | null; finderUserId: string; finderName: string | null; finderContact: string | null };
  images: StaffWarehouseImage[];
}

export interface StaffIntakeEvidencePayload {
  physicalReviewConfirmed: true;
  intakeKey: string;
  intakeImageIds: string[];
  receivedQuantity: number;
  accessories: string;
}

export interface StaffCreateWarehouseItemPayload extends StaffIntakeEvidencePayload {
  postId?: string | null;
  handoverPointId: string;
  itemName: string;
  description?: string | null;
  categoryId?: string | null;
  areaId?: string | null;
  buildingId?: string | null;
  roomText?: string | null;
  finderName?: string | null;
  finderContact?: string | null;
  conditionNotes: string;
  storageCode?: string | null;
  receivedAt?: string;
}

export interface StaffIntakeCustodyPayload extends StaffIntakeEvidencePayload {
  conditionNotes: string;
  storageCode?: string | null;
  itemName?: string;
  description?: string | null;
  categoryId?: string | null;
  areaId?: string | null;
  buildingId?: string | null;
  roomText?: string | null;
  finderName?: string | null;
  finderContact?: string | null;
  confirmedHandoverAt?: string | null;
}

export interface StaffReturnWarehousePayload {
  claimId?: string | null;
  recipientId?: string | null;
  receiverName: string;
  receiverIdentity: string;
  receiverPhone: string;
  proofImage: string;
  note?: string | null;
}

export type StaffCustodyFilter = StaffCustodyStatus | "AWAITING_INTAKE" | "";

export interface StaffCustodyListResponse {
  counts: Record<StaffCustodyStatus, number>;
  total: number;
  page: number;
  pageSize: number;
  items: StaffCustodyRequest[];
}

export interface StaffWarehouseFilters {
  overdue?: boolean;
  q?: string;
  status?: WarehouseItemStatus | "";
  handoverPointId?: string;
  page?: number;
  pageSize?: number;
}

export interface StaffClaimReview {
  claimId: string;
  recipientId: string;
  fullName: string;
  description: string | null;
  status: string;
  verified: boolean;
}

export interface UserReportPayload {
  targetType: "POST" | "USER" | "CLAIM" | "MESSAGE" | "HANDOVER";
  targetId: string;
  reason: string;
  details?: string;
  idempotencyKey?: string;
}

export type NotificationEmailMode = "IMMEDIATE" | "DELAYED_UNREAD" | "DIGEST" | "DISABLED";
export type NotificationCategory = "CHAT" | "CLAIM" | "MATCH" | "APPOINTMENT" | "HANDOVER" | "CUSTODY" | "OVERDUE" | "FEEDBACK";
export interface AppNotification {
  id: string; type: string; title: string; body: string | null; entityType: string | null; entityId: string | null;
  isRead: boolean; readAt: string | null; createdAt: string;
}
export interface NotificationListResponse { items: AppNotification[]; unreadTotal: number }
export interface NotificationPreference {
  inAppEnabled: boolean; pushEnabled: boolean; emailMode: NotificationEmailMode;
}
export interface NotificationPreferences {
  userId: string; chatMode: NotificationEmailMode; claimMode: NotificationEmailMode;
  categories: Record<NotificationCategory, NotificationPreference>;
  quietHoursStart: string | null; quietHoursEnd: string | null; timezone: string; updatedAt: string;
}
export type AdminAccessRole = "ADMIN" | "STAFF" | "USER";
export type AdminUserStatus = "ACTIVE" | "DISABLED";
export interface AdminUser {
  id: string; email: string; fullName: string; studentCode: string | null; phoneNumber: string | null;
  status: AdminUserStatus; roles: MobileUser["roles"]; accessRole: AdminAccessRole; createdAt: string; updatedAt: string;
}
export interface AdminDashboardKpis {
  filters: { from: string; to: string; days: number; granularity: "day" };
  totals: { posts: number; claims: number; appointments: number; returns: number };
  snapshot: { openPosts: number; custodyItems: number; unresolvedReports: number };
  trends: { date: string; posts: number; claims: number; appointments: number; returns: number; custody: number; reports: number }[];
  statusBreakdown: Record<string, { status: string; total: number }[]>;
}
export interface AdminCatalog {
  categories: { id: string; name: string; icon: string | null; parentId: string | null; isActive: boolean; sortOrder: number }[];
  areas: { id: string; name: string; description: string | null; isActive: boolean; sortOrder: number }[];
  buildings: { id: string; areaId: string; areaName: string; name: string; isActive: boolean; sortOrder: number }[];
  handoverPoints: { id: string; name: string; address: string; areaId: string | null; areaName: string | null; buildingId: string | null; buildingName: string | null; openingHours: string | null; contactInfo: string | null; mapImageUrl: string | null; mapPositionX: number | null; mapPositionY: number | null; isActive: boolean }[];
}
export interface AdminSystemConfig {
  id: string; configKey: string; configValue: string; valueType: "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "JSON";
  description: string | null; isPublic: boolean; updatedAt: string;
}
export interface AdminModerationReport {
  id: string; reporter: { id: string; fullName: string; email: string }; entityType: "POST" | "USER" | "CLAIM" | "CHAT" | "HANDOVER";
  entityId: string; sourceType: string | null; sourceId: string | null; reason: string; details: string | null;
  status: "PENDING" | "REVIEWED" | "DISMISSED" | "WITHDRAWN"; reviewer: { id: string; fullName: string } | null;
  reviewedAt: string | null; createdAt: string; entity: { type: string; title: string | null; status: string | null; ownerName: string | null; referenceId: string | null };
}
export interface UserReportRecord {
  id: string; entityType: "POST" | "USER" | "CLAIM" | "CHAT" | "HANDOVER"; entityId: string;
  sourceType: "POST" | "USER" | "CLAIM" | "MESSAGE" | "HANDOVER"; sourceId: string;
  reason: string; details: string | null; status: "PENDING" | "REVIEWED" | "DISMISSED" | "WITHDRAWN";
  resolution: string | null; reviewedAt: string | null; withdrawnAt: string | null; createdAt: string;
  target: { title: string; status: string };
}

interface RetryableRequest extends InternalAxiosRequestConfig {
  _authRetry?: boolean;
}

const authExpiredListeners = new Set<() => void>();
let refreshInFlight: Promise<SessionResponse> | null = null;

export const tokenStorage = {
  get: async () => {
    if (Platform.OS === "web") {
      try {
        return typeof localStorage !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  set: async (token: string) => {
    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(ACCESS_TOKEN_KEY, token);
      } catch {}
      return;
    }
    return SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },
  clear: async () => {
    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") localStorage.removeItem(ACCESS_TOKEN_KEY);
      } catch {}
      return;
    }
    return SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  },
};

export const cachedUserStorage = {
  async get(): Promise<MobileUser | null> {
    let value: string | null = null;
    if (Platform.OS === "web") {
      try {
        value = typeof localStorage !== "undefined" ? localStorage.getItem(CACHED_USER_KEY) : null;
      } catch {
        return null;
      }
    } else {
      value = await SecureStore.getItemAsync(CACHED_USER_KEY);
    }
    if (!value) return null;
    try {
      return JSON.parse(value) as MobileUser;
    } catch {
      if (Platform.OS === "web") {
        try { if (typeof localStorage !== "undefined") localStorage.removeItem(CACHED_USER_KEY); } catch {}
      } else {
        await SecureStore.deleteItemAsync(CACHED_USER_KEY);
      }
      return null;
    }
  },
  async set(user: MobileUser) {
    const json = JSON.stringify(user);
    if (Platform.OS === "web") {
      try { if (typeof localStorage !== "undefined") localStorage.setItem(CACHED_USER_KEY, json); } catch {}
      return;
    }
    return SecureStore.setItemAsync(CACHED_USER_KEY, json);
  },
  async clear() {
    if (Platform.OS === "web") {
      try { if (typeof localStorage !== "undefined") localStorage.removeItem(CACHED_USER_KEY); } catch {}
      return;
    }
    return SecureStore.deleteItemAsync(CACHED_USER_KEY);
  },
};

export function subscribeAuthExpired(listener: () => void) {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((listener) => listener());
}

function isAuthEndpoint(url = "") {
  return /\/auth\/(?:login|register|refresh|logout)(?:\?|$)/.test(url);
}

async function renewSession() {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<SessionResponse>(`${API_BASE_URL}/auth/refresh`, undefined, { timeout: 20_000, withCredentials: true })
      .then(async ({ data }) => {
        await Promise.all([tokenStorage.set(data.accessToken), cachedUserStorage.set(data.user)]);
        return data;
      })
      .catch(async (error: unknown) => {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          await Promise.all([tokenStorage.clear(), cachedUserStorage.clear()]);
          notifyAuthExpired();
        }
        throw error;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export const api = create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  const headers = AxiosHeaders.from(config.headers);
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  async (response) => {
    const { accessToken, user } = (response.data ?? {}) as Partial<SessionResponse>;
    if (accessToken && user && /\/auth\/(?:login|register|refresh)(?:\?|$)/.test(response.config.url ?? "")) {
      await Promise.all([tokenStorage.set(accessToken), cachedUserStorage.set(user)]);
    }
    return response;
  },
  async (error: AxiosError) => {
    const request = error.config as RetryableRequest | undefined;
    if (error.response?.status !== 401 || !request || isAuthEndpoint(request.url)) return Promise.reject(error);
    if (request._authRetry) {
      await Promise.all([tokenStorage.clear(), cachedUserStorage.clear()]).catch(() => undefined);
      notifyAuthExpired();
      return Promise.reject(error);
    }
    const headers = AxiosHeaders.from(request.headers);
    if (!headers.has("Authorization")) return Promise.reject(error);

    request._authRetry = true;
    try {
      const session = await renewSession();
      headers.set("Authorization", `Bearer ${session.accessToken}`);
      request.headers = headers;
      return api.request(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

function mediaApiPath(path: string) {
  const base = new URL(API_BASE_URL);
  const url = new URL(path, `${API_BASE_URL}/`);
  if (url.origin !== base.origin) throw new Error("Authenticated media must use the configured API host.");
  const basePath = base.pathname.replace(/\/+$/, "");
  let endpoint = url.pathname;
  if (endpoint.startsWith(`${basePath}/`)) endpoint = endpoint.slice(basePath.length);
  else if (endpoint === basePath) endpoint = "/";
  else if (basePath.endsWith("/api") && endpoint.startsWith("/api/")) endpoint = endpoint.slice(4);
  return `${endpoint}${url.search}`;
}

export async function mediaBlob(path: string): Promise<Blob> {
  const response = await api.get<Blob>(mediaApiPath(path), { responseType: "blob" });
  return response.data;
}

export async function loadMediaDataUri(path: string): Promise<string> {
  const blob = await mediaBlob(path);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Không đọc được ảnh")));
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được ảnh"));
    reader.readAsDataURL(blob);
  });
}

export async function appendFileToFormData(
  formData: FormData,
  fieldName: string,
  file: MobileImageFile
): Promise<void> {
  const filename = file.name || "image.jpg";
  const mimeType = file.type || "image/jpeg";
  if (file.uri.startsWith("/") || (file.id && !file.uri.startsWith("file:") && !file.uri.startsWith("content:"))) {
    try {
      const blob = await mediaBlob(file.uri);
      formData.append(fieldName, blob, filename);
      return;
    } catch {
      // Fallback to standard
    }
  }
  if (Platform.OS === "web") {
    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append(fieldName, blob, filename);
      return;
    } catch {
      // Fallback to standard object append if fetch fails
    }
  }
  formData.append(fieldName, {
    uri: file.uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
}

export function isNetworkError(error: unknown): error is AxiosError {
  return isAxiosError(error) && !error.response && error.code !== "ERR_CANCELED";
}

export function getApiErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (!error.response) return "Không thể kết nối máy chủ. Hãy kiểm tra mạng và thử lại.";
  }
  return error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

export function buildQueryString(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const str = query.toString();
  return str ? `?${str}` : "";
}

export const postService = {
  listPosts: (filters: PostListFilters = {}) =>
    api.get<PostListResponse>(`/posts${buildQueryString(filters as Record<string, unknown>)}`).then((res) => res.data),
  listMyPosts: (filters: PostListFilters = {}) =>
    api.get<PostListResponse>(`/posts/mine${buildQueryString(filters as Record<string, unknown>)}`).then((res) => res.data),
  getPost: (postId: string) =>
    api.get<PostSummary>(`/posts/${postId}`).then((res) => res.data),
  getMatches: (postId: string, page = 1, pageSize = 20) =>
    api.get<PostMatchesResponse>(`/posts/${postId}/matches${buildQueryString({ page, pageSize })}`).then((res) => res.data),
  recalculateMatches: (postId: string, page = 1, pageSize = 20) =>
    api.post<PostMatchesResponse>(`/posts/${postId}/matches/recalculate${buildQueryString({ page, pageSize })}`).then((res) => res.data),
  submitMatchFeedback: (postId: string, matchId: string, value: MatchFeedbackValue, note?: string | null) =>
    api.post<MatchFeedback>(`/posts/${postId}/matches/${matchId}/feedback`, {
      value,
      note,
      correlationKey: createCorrelationKey("match-feedback"),
    }).then((res) => res.data),
  dismissMatch: (postId: string, matchId: string, reason?: string | null) =>
    api.post<{ id: string; correlationKey: string; reason: string | null; createdAt: string }>(`/posts/${postId}/matches/${matchId}/dismiss`, {
      reason,
      correlationKey: createCorrelationKey("match-dismiss"),
    }).then((res) => res.data),
  createPost: (payload: CreatePostPayload): Promise<PostSummary> =>
    api.post<PostSummary>("/posts", payload).then((res) => res.data),
  updatePost: (postId: string, payload: UpdatePostPayload): Promise<PostSummary> =>
    api.patch<PostSummary>(`/posts/${postId}`, payload).then((res) => res.data),
  deletePost: (postId: string): Promise<void> =>
    api.delete<void>(`/posts/${postId}`).then((res) => res.data),
  analyzePostImage: async (type: "LOST" | "FOUND", files: MobileImageFile[]): Promise<ImageAnalysisResult> => {
    const formData = new FormData();
    formData.append("type", type);
    for (const file of files) {
      await appendFileToFormData(formData, "files", file);
    }
    return api.post<ImageAnalysisResult>("/posts/analyze-image", formData).then((res) => res.data);
  },
  uploadPostMedia: async (postId: string, file: MobileImageFile, mediaKind: "ITEM" | "EVIDENCE" = "ITEM"): Promise<{ id: string; url: string }> => {
    const formData = new FormData();
    await appendFileToFormData(formData, "file", file);
    formData.append("mediaKind", mediaKind);
    return api.post<{ id: string; url: string }>(`/posts/${postId}/media`, formData).then((res) => res.data);
  },
  deletePostMedia: (postId: string, mediaId: string): Promise<void> =>
    api.delete<void>(`/posts/${postId}/media/${mediaId}`).then((res) => res.data),
  getPostCatalog: () =>
    api.get<PostCatalog>("/posts/catalog").then((res) => res.data),
  listPublicHandoverPoints: () =>
    api.get<{ handoverPoints: HandoverPoint[] }>("/handover-points").then((res) => res.data),
  getMyCustodyRequestByPost: (postId: string) =>
    api.get<{ request: CustodyRequest | null; warehouseItem?: { id: string; status: string } | null }>(`/staff/custody-requests/mine/post/${postId}`).then((res) => res.data),
  createCustodyRequest: (payload: CreateCustodyRequestPayload) =>
    api.post<{ request: CustodyRequest; idempotent: boolean }>("/staff/custody-requests", payload).then((res) => res.data),
  submitReport: (payload: UserReportPayload) => {
    const body = {
      ...payload,
      idempotencyKey: payload.idempotencyKey ?? `rep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    return api.post("/reports", body).then((res) => res.data);
  },
  findConversationByPost: async (postId: string) => {
    try {
      const res = await api.get<{
        items: {
          id: string;
          item?: { postId?: string };
          posts?: { found?: { id?: string }; lost?: { id?: string } };
          conversation?: { lastMessageAt?: string | null; lastMessage?: string | null };
        }[];
        hasMore?: boolean;
      }>(`/claims?page=1&pageSize=50`);
      const match = res.data.items?.find((claim) => {
        const samePost = claim.item?.postId === postId || claim.posts?.found?.id === postId || claim.posts?.lost?.id === postId;
        const hasMessage = Boolean(claim.conversation?.lastMessageAt || claim.conversation?.lastMessage);
        return samePost && hasMessage;
      });
      return match ?? null;
    } catch {
      return null;
    }
  },
};

function createCorrelationKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRequestUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export const claimService = {
  list: (page = 1, pageSize = 50) =>
    api.get<ClaimListResponse>(`/claims${buildQueryString({ page, pageSize })}`).then((response) => response.data),
  get: (claimId: string) => api.get<ClaimRecord>(`/claims/${claimId}`).then((response) => response.data),
  create: (payload: { postId: string; description: string; approximateLostAt?: string; approximateLocation?: string; sourceFoundPostId?: string; contactCheckId?: string; requestKey?: string }) => {
    const requestKey = payload.requestKey ?? createCorrelationKey("claim");
    return api.post<ClaimRecord>("/claims", { ...payload, requestKey }, { headers: { "Idempotency-Key": requestKey } }).then((response) => response.data);
  },
  createDirectMessage: (postId: string, content: string, clientMessageId = createCorrelationKey("direct"), sourceFoundPostId?: string, contactCheckId?: string) =>
    api.post<{ claim: ClaimRecord; message: ClaimMessage }>("/claims/direct-messages", { postId, content, clientMessageId, sourceFoundPostId, contactCheckId }, { headers: { "Idempotency-Key": clientMessageId } }).then((response) => response.data),
  getRoom: (claimId: string) =>
    api.get<ClaimMessagesResponse["room"]>(`/claims/${claimId}/room`).then((response) => response.data),
  listMessages: (claimId: string, cursor?: { before: string; beforeId: string }, limit = 40) =>
    api.get<ClaimMessagesResponse>(`/claims/${claimId}/messages${buildQueryString({ ...cursor, limit })}`).then((response) => response.data),
  sendMessage: (claimId: string, content: string, clientMessageId = createCorrelationKey("message")) =>
    api.post<ClaimMessage>(`/claims/${claimId}/messages`, { content, clientMessageId }, { headers: { "Idempotency-Key": clientMessageId } }).then((response) => response.data),
  sendImage: async (claimId: string, file: MobileImageFile, content: string, clientMessageId = createCorrelationKey("image")) => {
    const formData = new FormData();
    await appendFileToFormData(formData, "file", file);
    formData.append("content", content);
    formData.append("clientMessageId", clientMessageId);
    return api.post<ClaimMessage>(`/claims/${claimId}/messages/images`, formData, { headers: { "Idempotency-Key": clientMessageId } }).then((response) => response.data);
  },
  listEvidence: (claimId: string) => api.get<{ items: ClaimEvidence[] }>(`/claims/${claimId}/evidence`).then((response) => response.data),
  uploadEvidence: async (claimId: string, file: MobileImageFile, description?: string) => {
    const formData = new FormData();
    await appendFileToFormData(formData, "file", file);
    if (description?.trim()) formData.append("description", description.trim());
    return api.post<ClaimEvidence>(`/claims/${claimId}/evidence`, formData).then((response) => response.data);
  },
  checkLostContactPhoto: async (postId: string, file: MobileImageFile) => {
    const formData = new FormData();
    formData.append("postId", postId);
    await appendFileToFormData(formData, "file", file);
    return api.post<{ checkId: string | null; approved: boolean; score: number; expiresAt: string | null; questions?: string[] }>("/claims/contact-photo-checks", formData).then((response) => response.data);
  },
  getVerificationTemplates: (claimId: string) => api.get<VerificationTemplatesResponse>(`/claims/${claimId}/verification/templates`).then((response) => response.data),
  getVerification: (claimId: string) => api.get<ClaimVerificationState>(`/claims/${claimId}/verification`).then((response) => response.data),
  sendVerificationQuestion: (claimId: string, payload: { templateId: string; templateVersion: number; promptKey: string; prompt: string; idempotencyKey: string }) =>
    api.post<ClaimVerificationState>(`/claims/${claimId}/verification/questions`, { ...payload, idempotencyKey: undefined }, { headers: { "Idempotency-Key": payload.idempotencyKey } }).then((response) => response.data),
  answerVerificationQuestion: (claimId: string, questionId: string, answer: string, idempotencyKey = createCorrelationKey("answer")) =>
    api.post<ClaimVerificationState>(`/claims/${claimId}/verification/questions/${questionId}/answer`, { answer }, { headers: { "Idempotency-Key": idempotencyKey } }).then((response) => response.data),
  decideVerification: (claimId: string, payload: { decision: ClaimDecision; reason: string; handoverPointId?: string; requestedIntakeAt?: string; correctsEventId?: string; idempotencyKey?: string }) => {
    const idempotencyKey = payload.idempotencyKey ?? createCorrelationKey("decision");
    return api.post<{ claim: ClaimRecord; verification: ClaimVerificationState; message: ClaimMessage | null }>(
      `/claims/${claimId}/verification/decision`, { ...payload, idempotencyKey: undefined }, { headers: { "Idempotency-Key": idempotencyKey } },
    ).then((response) => response.data);
  },
};

export const appointmentService = {
  list: (filters: { claimId?: string; page?: number } = {}) =>
    api.get<AppointmentListResponse>(`/appointments${buildQueryString(filters)}`).then((response) => response.data),
  get: (appointmentId: string) => api.get<AppointmentRecord>(`/appointments/${appointmentId}`).then((response) => response.data),
  create: (payload: { claimId: string; proposedAt: string; handoverPointId: string; requestKey?: string }) =>
    api.post<AppointmentRecord>("/appointments", { ...payload, requestKey: payload.requestKey ?? createRequestUuid() }).then((response) => response.data),
  act: (appointmentId: string, payload: { action: AppointmentAction; version: number; physicallyChecked?: boolean; reason?: string; requestKey?: string }) =>
    api.post<AppointmentRecord>(`/appointments/${appointmentId}/actions`, { ...payload, requestKey: payload.requestKey ?? createRequestUuid() }).then((response) => response.data),
  listHandoverPoints: () => postService.listPublicHandoverPoints(),
};

export const activityService = {
  getPostJourney: (postId: string, page = 1, asOf?: string) =>
    api.get<PostJourneyResponse>(`/posts/${postId}/journey${buildQueryString({ page, asOf })}`).then((res) => res.data),
};

export const returnService = {
  listCompleted: (page = 1) =>
    api.get<{ items: CompletedReturn[]; page: number; hasMore: boolean }>(`/returns/completed${buildQueryString({ page })}`).then((res) => res.data),
  getFeedbackEligibility: (appointmentId: string) =>
    api.get<ReturnFeedbackEligibility>(`/returns/${appointmentId}/feedback/eligibility`).then((res) => res.data),
  submitFeedback: (appointmentId: string, rating: number, comment: string) =>
    api.post<{ feedback: ReturnFeedbackRecord; reputationEventCreated: boolean; idempotent: boolean }>(
      `/returns/${appointmentId}/feedback`,
      { rating, comment: comment.trim() || null, idempotencyKey: createCorrelationKey("return-feedback") },
    ).then((res) => res.data),
};

export const staffService = {
  listWarehouseItems: (filters: StaffWarehouseFilters = {}) =>
    api.get<StaffWarehouseDashboard>(`/staff/warehouse-items${buildQueryString({ ...filters })}`).then((response) => response.data),
  getWarehouseItem: (itemId: string) =>
    api.get<StaffWarehouseItem>(`/staff/warehouse-items/${itemId}`).then((response) => response.data),
  listAllWarehouseLogs: (page = 1, pageSize = 20) =>
    api.get<{ logs: StaffWarehouseStorageLog[]; total: number; page: number; pageSize: number }>(`/staff/warehouse-logs${buildQueryString({ page, pageSize })}`).then((response) => response.data),
  getWarehouseImages: (itemId: string) =>
    api.get<{ images: StaffWarehouseImage[] }>(`/staff/warehouse-items/${itemId}/images`).then((response) => response.data.images),
  warehouseImagePath: (image: Pick<StaffWarehouseImage, "id" | "provenance">) =>
    `/staff/warehouse-images/${image.id}?provenance=${encodeURIComponent(image.provenance)}`,
  updateWarehouseItem: (itemId: string, payload: { status?: WarehouseItemStatus; conditionNotes?: string | null; storageCode?: string | null; note?: string | null }) =>
    api.patch<StaffWarehouseItem>(`/staff/warehouse-items/${itemId}`, payload).then((response) => response.data),
  uploadWarehouseProof: async (file: MobileImageFile, itemId: string) => {
    const formData = new FormData();
    await appendFileToFormData(formData, "file", file);
    formData.append("itemId", itemId);
    return api.post<{ id: string; url: string }>("/staff/warehouse-items/upload-proof", formData).then((response) => response.data);
  },
  returnWarehouseItem: (itemId: string, payload: StaffReturnWarehousePayload) =>
    api.post<StaffWarehouseItem>(`/staff/warehouse-items/${itemId}/return`, payload).then((response) => response.data),
  getReturnRecipients: (itemId: string) =>
    api.get<{ recipients: { claimId: string; recipientId: string; fullName: string }[] }>(`/staff/warehouse-items/${itemId}/return-recipients`).then((response) => response.data.recipients),
  getReturnClaimReviews: (itemId: string) =>
    api.get<{ claims: StaffClaimReview[] }>(`/staff/warehouse-items/${itemId}/return-claim-reviews`).then((response) => response.data.claims),
  verifyWarehouseClaim: (itemId: string, payload: { claimId: string; recipientId: string; verified: true; reason: string }) =>
    api.post<{ claims: StaffClaimReview[] }>(`/staff/warehouse-items/${itemId}/verify-claim`, payload).then((response) => response.data.claims),
  listWarehouseLogs: (itemId: string) =>
    api.get<{ logs: StaffWarehouseStorageLog[] }>(`/staff/warehouse-items/${itemId}/logs`).then((response) => response.data.logs),
  listCustodyRequests: (filters: { status?: StaffCustodyFilter; page?: number; pageSize?: number } = {}) =>
    api.get<StaffCustodyListResponse>(`/staff/custody-requests${buildQueryString(filters)}`).then((response) => response.data),
  getCustodyRequest: (requestId: string) =>
    api.get<{ request: StaffCustodyRequest; audit: StaffCustodyAuditEntry[] }>(`/staff/custody-requests/${requestId}`).then((response) => response.data),
  getCustodyIntakeContext: (requestId: string) =>
    api.get<StaffCustodyIntakeContext>(`/staff/custody-requests/${requestId}/intake-context`).then((response) => response.data),
  acceptCustodyRequest: (requestId: string, payload: { handoverPointId: string; confirmedHandoverAt?: string | null; reason?: string | null }) =>
    api.patch<StaffCustodyRequest>(`/staff/custody-requests/${requestId}/accept`, payload).then((response) => response.data),
  rejectCustodyRequest: (requestId: string, reason: string) =>
    api.patch<StaffCustodyRequest>(`/staff/custody-requests/${requestId}/reject`, { reason }).then((response) => response.data),
  confirmCustodyIntake: (requestId: string, payload: StaffIntakeCustodyPayload) =>
    api.post<StaffCustodyRequest>(`/staff/custody-requests/${requestId}/intake`, payload).then((response) => response.data),
  uploadIntakeImage: async (file: MobileImageFile, intakeKey: string, custodyRequestId?: string) => {
    const formData = new FormData();
    await appendFileToFormData(formData, "file", file);
    formData.append("intakeKey", intakeKey);
    if (custodyRequestId) formData.append("custodyRequestId", custodyRequestId);
    return api.post<{ id: string; url: string }>("/staff/warehouse-intake-images", formData).then((response) => response.data);
  },
  deleteIntakeImage: (imageId: string, intakeKey: string) =>
    api.delete<{ removed: boolean }>(`/staff/warehouse-intake-images/${imageId}`, { data: { intakeKey } }).then((response) => response.data),
  createWalkInWarehouseItem: (payload: StaffCreateWarehouseItemPayload) =>
    api.post<StaffWarehouseItem>("/staff/warehouse-items", payload).then((response) => response.data),
};

export const notificationService = {
  list: (limit = 50) => api.get<NotificationListResponse>(`/notifications${buildQueryString({ limit: Math.min(50, Math.max(1, limit)) })}`).then((res) => res.data),
  markRead: (id: string) => api.post<{ read: boolean }>(`/notifications/${id}/read`).then((res) => res.data),
  markAllRead: () => api.post<{ read: boolean; count: number }>("/notifications/read-all").then((res) => res.data),
  getPreferences: () => api.get<{ preferences: NotificationPreferences }>("/notifications/preferences").then((res) => res.data.preferences),
  updatePreferences: (payload: Omit<NotificationPreferences, "userId" | "updatedAt">) =>
    api.put<{ preferences: NotificationPreferences }>("/notifications/preferences", payload).then((res) => res.data.preferences),
};

export const userReportService = {
  submit: (payload: UserReportPayload) => {
    const body = { ...payload, idempotencyKey: payload.idempotencyKey ?? `mobile-${createRequestUuid()}` };
    return api.post<UserReportRecord>("/reports", body).then((res) => res.data);
  },
  list: (filters: { status?: UserReportRecord["status"] | ""; page?: number; pageSize?: number } = {}) =>
    api.get<{ total: number; page: number; pageSize: number; items: UserReportRecord[] }>(`/reports/mine${buildQueryString(filters)}`).then((res) => res.data),
  withdraw: (id: string) => api.post<UserReportRecord>(`/reports/mine/${id}/withdraw`).then((res) => res.data),
};

export const adminService = {
  getDashboard: (filters: { from?: string; to?: string } = {}) => api.get<AdminDashboardKpis>(`/admin/dashboard/kpis${buildQueryString(filters)}`).then((res) => res.data),
  exportStatistics: (payload: { from?: string; to?: string; format: "CSV" | "JSON"; sections?: ("overview" | "trends" | "statusBreakdown")[] }) =>
    api.post<{ fileName: string; mimeType: string; generatedAt: string; rowCount: number; format: "CSV" | "JSON"; content: string }>("/admin/statistics/export", payload).then((res) => res.data),
  listUsers: (filters: { q?: string; role?: AdminAccessRole | ""; status?: AdminUserStatus | ""; page?: number; pageSize?: number } = {}) =>
    api.get<{ total: number; page: number; pageSize: number; items: AdminUser[] }>(`/admin/users${buildQueryString(filters)}`).then((res) => res.data),
  createUser: (payload: { email: string; password: string; fullName: string; studentCode?: string | null; phoneNumber?: string | null; audienceRole?: "STUDENT" | "LECTURER" | null; accessRole: AdminAccessRole; status: AdminUserStatus; reason?: string | null }) =>
    api.post<AdminUser>("/admin/users", payload).then((res) => res.data),
  changeUserRole: (id: string, accessRole: AdminAccessRole, reason: string) => api.patch<AdminUser>(`/admin/users/${id}/role`, { accessRole, reason }).then((res) => res.data),
  changeUserStatus: (id: string, status: AdminUserStatus, reason: string) => api.patch<AdminUser>(`/admin/users/${id}/status`, { status, reason }).then((res) => res.data),
  listReports: (filters: { q?: string; status?: string; entityType?: string; page?: number; pageSize?: number } = {}) =>
    api.get<{ total: number; page: number; pageSize: number; items: AdminModerationReport[] }>(`/admin/reports${buildQueryString(filters)}`).then((res) => res.data),
  reviewReport: (id: string, actionType: "RESOLVE_REPORT" | "WARN_USER" | "HIDE_POST" | "DELETE_POST" | "BAN_USER" | "UNBAN_USER" | "DISMISS_REPORT", reason: string) =>
    api.patch<AdminModerationReport>(`/admin/reports/${id}/review`, { actionType, reason }).then((res) => res.data),
  getCatalog: () => api.get<AdminCatalog>("/admin/catalog").then((res) => res.data),
  createCategory: (payload: { name: string; icon?: string | null; parentId?: string | null; isActive?: boolean; sortOrder?: number }) => api.post("/admin/categories", payload).then((res) => res.data),
  updateCategory: (id: string, payload: Record<string, unknown>) => api.patch(`/admin/categories/${id}`, payload).then((res) => res.data),
  deleteCategory: (id: string) => api.delete(`/admin/categories/${id}`).then((res) => res.data),
  createArea: (payload: { name: string; description?: string | null; isActive?: boolean; sortOrder?: number }) => api.post("/admin/areas", payload).then((res) => res.data),
  updateArea: (id: string, payload: Record<string, unknown>) => api.patch(`/admin/areas/${id}`, payload).then((res) => res.data),
  deleteArea: (id: string) => api.delete(`/admin/areas/${id}`).then((res) => res.data),
  createBuilding: (payload: { name: string; areaId: string; isActive?: boolean; sortOrder?: number }) => api.post("/admin/buildings", payload).then((res) => res.data),
  updateBuilding: (id: string, payload: Record<string, unknown>) => api.patch(`/admin/buildings/${id}`, payload).then((res) => res.data),
  deleteBuilding: (id: string) => api.delete(`/admin/buildings/${id}`).then((res) => res.data),
  createHandoverPoint: (payload: Record<string, unknown>) => api.post("/admin/handover-points", payload).then((res) => res.data),
  updateHandoverPoint: (id: string, payload: Record<string, unknown>) => api.patch(`/admin/handover-points/${id}`, payload).then((res) => res.data),
  deleteHandoverPoint: (id: string) => api.delete(`/admin/handover-points/${id}`).then((res) => res.data),
  uploadHandoverMap: async (id: string, file: MobileImageFile) => {
    const formData = new FormData();
    await appendFileToFormData(formData, "file", file);
    return api.post(`/admin/handover-points/${id}/map-image`, formData).then((res) => res.data);
  },
  listConfigs: (filters: { q?: string; valueType?: string | ""; isPublic?: boolean | ""; page?: number; pageSize?: number } = {}) =>
    api.get<{ total: number; page: number; pageSize: number; items: AdminSystemConfig[] }>(`/admin/configs${buildQueryString(filters)}`).then((res) => res.data),
  createConfig: (payload: { configKey: string; configValue: string; valueType: AdminSystemConfig["valueType"]; description?: string | null; isPublic?: boolean; reason?: string | null }) => api.post<AdminSystemConfig>("/admin/configs", payload).then((res) => res.data),
  updateConfig: (id: string, payload: Partial<Pick<AdminSystemConfig, "configKey" | "configValue" | "valueType" | "description" | "isPublic">> & { reason?: string | null }) => api.patch<AdminSystemConfig>(`/admin/configs/${id}`, payload).then((res) => res.data),
  getConfigHistory: (id: string, limit = 20) => api.get<{ items: { id: string; action: string; configKey: string; oldValue: string | null; newValue: string; changedBy: string; changedAt: string; reason: string | null }[] }>(`/admin/configs/${id}/history${buildQueryString({ limit })}`).then((res) => res.data.items),
  deleteConfig: (id: string, reason?: string) => api.delete(`/admin/configs/${id}`, { data: { reason } }),
};
