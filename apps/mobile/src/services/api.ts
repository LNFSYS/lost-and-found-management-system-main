import axios, { AxiosHeaders, create, isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "lnfs.access-token";
const CACHED_USER_KEY = "lnfs.cached-user";
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || "http://localhost:3001/api").replace(/\/+$/, "");

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

export interface UserReportPayload {
  targetType: "POST" | "CLAIM" | "CHAT" | "HANDOVER";
  targetId: string;
  reason: string;
  details?: string;
  idempotencyKey?: string;
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
