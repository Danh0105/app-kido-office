/**
 * Giữ một giá trị nhạy cảm (số CCCD / số TK vừa reveal) CHỈ trong bộ nhớ và tự
 * xoá sau `ttlMs`. Không ghi localStorage / sessionStorage / store bền vững.
 */
export const REVEAL_TTL_MS = 45_000;

export class ExpiringSecret {
  private value: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private expiresAt = 0;
  private readonly ttlMs: number;
  private readonly onChange: (value: string | null) => void;

  // Không dùng parameter property: file được `node --test` chạy trực tiếp (strip types).
  constructor(ttlMs: number, onChange: (value: string | null) => void) {
    this.ttlMs = ttlMs;
    this.onChange = onChange;
  }

  set(value: string) {
    this.stop();
    this.value = value;
    this.expiresAt = Date.now() + this.ttlMs;
    this.onChange(value);
    this.timer = setTimeout(() => this.clear(), this.ttlMs);
  }

  clear() {
    this.stop();
    if (this.value !== null) {
      this.value = null;
      this.onChange(null);
    }
  }

  get(): string | null {
    return this.value;
  }

  remainingMs(now: number = Date.now()): number {
    return this.value === null ? 0 : Math.max(0, this.expiresAt - now);
  }

  private stop() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
