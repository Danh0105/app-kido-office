import api from "./api";

export type TryOnStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";

/** Trạng thái đã chốt — thấy các giá trị này thì ngừng hỏi lại. */
export const TRYON_TERMINAL: TryOnStatus[] = ["SUCCEEDED", "FAILED"];

export const TRYON_SIZES = ["1024x1536", "1024x1024", "1536x1024"] as const;
export type TryOnSize = (typeof TRYON_SIZES)[number];

export interface TryOnJob {
  id: number;
  status: TryOnStatus;
  personImageUrl: string | null;
  garmentImageUrl: string | null;
  resultImageUrl: string | null;
  prompt: string;
  model: string;
  size: string;
  errorCode: string | null;
  errorMessage: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  createdBy: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface TryOnListResponse {
  data: TryOnJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Job vừa tạo — chỉ response này mới kèm `publicToken` (khách chưa đăng nhập),
 * các API sau không trả lại nữa nên phải giữ lại ở máy client.
 */
export interface CreatedTryOnJob extends TryOnJob {
  publicToken: string | null;
}

export const virtualTryonApi = {
  /**
   * Tạo job — trả về ngay ở trạng thái PENDING, ảnh chưa có. Gọi `getById`
   * tới khi status vào `TRYON_TERMINAL` mới có `resultImageUrl`.
   */
  create: async (input: {
    person: File;
    garment: File;
    prompt?: string;
    size?: TryOnSize;
  }): Promise<CreatedTryOnJob> => {
    const form = new FormData();
    form.append("person", input.person);
    form.append("garment", input.garment);
    if (input.prompt?.trim()) form.append("prompt", input.prompt.trim());
    if (input.size) form.append("size", input.size);

    const res = await api.post("/virtual-tryon", form);
    return res.data;
  },

  /** `token` bắt buộc với job tạo lúc chưa đăng nhập. */
  getById: async (id: number, token?: string | null): Promise<TryOnJob> => {
    const res = await api.get(`/virtual-tryon/${id}`, {
      params: token ? { token } : undefined,
    });
    return res.data;
  },

  list: async (params: {
    status?: TryOnStatus;
    page?: number;
    limit?: number;
  } = {}): Promise<TryOnListResponse> => {
    const res = await api.get("/virtual-tryon", { params });
    return res.data;
  },

  remove: async (id: number, token?: string | null) => {
    const res = await api.delete(`/virtual-tryon/${id}`, {
      params: token ? { token } : undefined,
    });
    return res.data;
  },
};

/**
 * Lịch sử của khách CHƯA đăng nhập.
 *
 * Không gọi được `list` (API đó bắt đăng nhập, và cố ý vậy để không ai duyệt
 * được ảnh chân dung của người khác), nên giữ cặp {id, token} ngay tại máy.
 * Xoá dữ liệu trình duyệt là mất lịch sử — chấp nhận được với luồng vãng lai.
 */
const LOCAL_KEY = "virtual_tryon_local_jobs";
const LOCAL_MAX = 12;

export type LocalTryOnRef = { id: number; token: string | null };

export const localTryOnHistory = {
  all(): LocalTryOnRef[] {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((x) => Number.isFinite(x?.id)) : [];
    } catch {
      return [];
    }
  },

  add(ref: LocalTryOnRef) {
    const next = [ref, ...this.all().filter((x) => x.id !== ref.id)].slice(
      0,
      LOCAL_MAX,
    );
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  },

  remove(id: number) {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify(this.all().filter((x) => x.id !== id)),
    );
  },
};
