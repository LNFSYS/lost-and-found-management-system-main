export type Role = "USER" | "STUDENT" | "LECTURER" | "STAFF" | "ADMIN";
export interface CurrentUser { id: string; email: string; fullName: string; studentCode: string | null; phoneNumber: string | null; roles: Role[]; status: "ACTIVE" | "DISABLED"; createdAt: string; updatedAt: string; }
export interface AdminCategory { id: string; name: string; icon: string | null; parentId: string | null; parentName: string | null; isActive: boolean; sortOrder: number; childCount: number; createdAt: string; }
export interface AdminArea { id: string; name: string; description: string | null; isActive: boolean; sortOrder: number; buildingCount: number; createdAt: string; }
export interface AdminBuilding { id: string; areaId: string; areaName: string; name: string; isActive: boolean; sortOrder: number; createdAt: string; }
export interface AdminCatalog { stats: { totalPosts: number; processingPosts: number; totalUsers: number; returnedPosts: number }; categories: AdminCategory[]; areas: AdminArea[]; buildings: AdminBuilding[]; }
export interface PostCatalog {
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  areas: Array<{ id: string; name: string }>;
  buildings: Array<{ id: string; areaId: string; name: string }>;
  handoverPoints: Array<{ id: string; name: string; address: string; openingHours: string | null }>;
}
export interface CreatePostPayload {
  type: "LOST" | "FOUND";
  title: string;
  description: string;
  categoryId: string;
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
export interface CreatedPost { id: string; type: "LOST" | "FOUND"; title: string; status: string; createdAt: string; }
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
export interface PostSummary {
  id: string;
  type: "LOST" | "FOUND";
  status: "OPEN" | "MATCHED" | "RESOLVED" | "CLOSED" | "EXPIRED" | "HIDDEN";
  visibilityMode: "PUBLIC" | "PRIVATE_DETAILS";
  title: string;
  description: string | null;
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
  media: Array<{ id: string; url: string; mediaKind: "ITEM" | "EVIDENCE" }>;
  canEdit: boolean;
  createdAt: string;
  matchSummary?: {
    candidateCount: number;
    suggestionCount: number;
    topScore: number | null;
    topTier: MatchTier | null;
    lastCalculatedAt: string | null;
  };
}
export type MatchTier = "WEAK" | "SUGGESTION" | "NOTIFY" | "HIGH_CONFIDENCE";
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
export interface PostMatchResult {
  matchId: string;
  candidate: PostSummary;
  totalScore: number;
  scoreTier: MatchTier;
  scores: {
    text: number;
    category: number;
    location: number;
    time: number;
    image: number;
    ocr: number;
  };
  explanation: MatchExplanation | null;
  matcherVersion: string;
  calculatedAt: string;
}
export interface PostMatchesResponse {
  source: PostSummary;
  matcherVersion: string;
  calculatedAt: string | null;
  thresholds: { weak: number; suggestion: number; notification: number; highConfidence: number };
  weights: { text: number; category: number; location: number; time: number; image: number; ocr: number };
  results: PostMatchResult[];
}
export interface PostListResponse { total: number; page: number; pageSize: number; items: PostSummary[]; }
export interface PostListFilters {
  q?: string;
  type?: "LOST" | "FOUND";
  status?: PostSummary["status"];
  categoryId?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "incident_newest" | "incident_oldest";
}
export type AdminCategoryPayload = { name?: string; icon?: string | null; parentId?: string | null; isActive?: boolean; sortOrder?: number };
export type AdminAreaPayload = { name?: string; description?: string | null; isActive?: boolean; sortOrder?: number };
export type AdminBuildingPayload = { name?: string; areaId?: string; isActive?: boolean; sortOrder?: number };
interface SessionResponse { user: CurrentUser; accessToken: string; accessTokenExpiresIn: string; }

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
let accessToken: string | null = null;
let refreshInFlight: Promise<SessionResponse | null> | null = null;

async function raw<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const session = await refreshSession();
    if (session) return raw<T>(path, init, false);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message ?? "Yêu cầu không thành công");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = raw<SessionResponse>("/auth/refresh", { method: "POST" }, false)
      .then((session) => { accessToken = session.accessToken; return session; })
      .catch(() => { accessToken = null; return null; })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

function storeSession(session: SessionResponse) { accessToken = session.accessToken; return session.user; }

function queryString(filters: PostListFilters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

async function mediaBlob(path: string, retry = true): Promise<Blob> {
  const headers = new Headers();
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path.replace(/^\/api/, "")}`, { headers, credentials: "include" });
  if (response.status === 401 && retry && await refreshSession()) return mediaBlob(path, false);
  if (!response.ok) throw new Error("Không thể tải ảnh vật phẩm");
  return response.blob();
}

export const api = {
  requestRegistrationOtp: (email: string) => raw<{ delivered: boolean; expiresInMinutes: number }>("/auth/register/request-otp", { method: "POST", body: JSON.stringify({ email }) }),
  register: async (payload: { email: string; otp: string; password: string; fullName: string; audienceRole: "STUDENT" | "LECTURER"; studentCode?: string; phoneNumber?: string }) => storeSession(await raw<SessionResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) })),
  login: async (email: string, password: string) => storeSession(await raw<SessionResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),
  logout: async () => { await raw<void>("/auth/logout", { method: "POST" }); accessToken = null; },
  forgotPassword: (email: string) => raw<{ delivered: boolean; message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (email: string, token: string, newPassword: string) => raw<{ reset: boolean }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, token, newPassword }) }),
  me: () => raw<{ user: CurrentUser }>("/auth/me").then((payload) => payload.user),
  updateProfile: (payload: Partial<Pick<CurrentUser, "fullName" | "studentCode" | "phoneNumber">>) => raw<{ user: CurrentUser }>("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }).then((result) => result.user),
  getPostCatalog: () => raw<PostCatalog>("/posts/catalog"),
  listPosts: (filters: PostListFilters = {}) => raw<PostListResponse>(`/posts${queryString(filters)}`),
  listMyPosts: (filters: PostListFilters = {}) => raw<PostListResponse>(`/posts/mine${queryString(filters)}`),
  getPost: (postId: string) => raw<PostSummary>(`/posts/${postId}`),
  getPostMedia: (path: string) => mediaBlob(path),
  createPost: (payload: CreatePostPayload) => raw<CreatedPost>("/posts", { method: "POST", body: JSON.stringify(payload) }),
  analyzePostImage: (type: "LOST" | "FOUND", files: File[]) => {
    const form = new FormData();
    form.append("type", type);
    files.forEach((file) => form.append("files", file));
    return raw<ImageAnalysisResult>("/posts/analyze-image", { method: "POST", body: form });
  },
  uploadPostMedia: (postId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("mediaKind", "ITEM");
    return raw(`/posts/${postId}/media`, { method: "POST", body: form });
  },
  getPostMatches: (postId: string) => raw<PostMatchesResponse>(`/posts/${postId}/matches`),
  recalculatePostMatches: (postId: string) => raw<PostMatchesResponse>(`/posts/${postId}/matches/recalculate`, { method: "POST" }),
  getAdminCatalog: () => raw<AdminCatalog>("/admin/catalog"),
  createAdminCategory: (payload: Required<Pick<AdminCategoryPayload, "name">> & AdminCategoryPayload) => raw<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminCategory: (id: string, payload: AdminCategoryPayload) => raw<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAdminCategory: (id: string) => raw<void>(`/admin/categories/${id}`, { method: "DELETE" }),
  createAdminArea: (payload: Required<Pick<AdminAreaPayload, "name">> & AdminAreaPayload) => raw<AdminArea>("/admin/areas", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminArea: (id: string, payload: AdminAreaPayload) => raw<AdminArea>(`/admin/areas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAdminArea: (id: string) => raw<void>(`/admin/areas/${id}`, { method: "DELETE" }),
  createAdminBuilding: (payload: Required<Pick<AdminBuildingPayload, "name" | "areaId">> & AdminBuildingPayload) => raw<AdminBuilding>("/admin/buildings", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminBuilding: (id: string, payload: AdminBuildingPayload) => raw<AdminBuilding>(`/admin/buildings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAdminBuilding: (id: string) => raw<void>(`/admin/buildings/${id}`, { method: "DELETE" })
};
