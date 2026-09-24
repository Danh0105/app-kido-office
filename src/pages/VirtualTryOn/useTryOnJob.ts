import { useCallback, useEffect, useRef, useState } from "react";

import {
  TRYON_TERMINAL,
  TryOnJob,
  virtualTryonApi,
} from "@/service/virtualTryon";

/** Nhịp hỏi lại. Sinh ảnh mất ~15–60s nên 2s là đủ mượt mà không spam API. */
const POLL_MS = 2000;

/**
 * Trần thời gian chờ. Job treo quá lâu (mạng đứt, tiến trình chết giữa chừng)
 * thì dừng hỏi và báo rõ, thay vì quay vòng vô hạn.
 */
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Theo dõi một job thử đồ tới khi có kết quả.
 *
 * Dọn timer khi component unmount hoặc khi đổi sang job khác — không thì tab
 * mở lâu sẽ tích nhiều vòng polling chạy song song.
 */
export function useTryOnJob() {
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const aliveRef = useRef(true);
  /** Job của khách chưa đăng nhập chỉ hỏi lại được khi kèm token. */
  const tokenRef = useRef<string | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimer();
    };
  }, []);

  const poll = useCallback((id: number) => {
    clearTimer();

    timerRef.current = window.setTimeout(async () => {
      if (!aliveRef.current) return;

      try {
        const next = await virtualTryonApi.getById(id, tokenRef.current);
        if (!aliveRef.current) return;

        setJob(next);

        if (TRYON_TERMINAL.includes(next.status)) {
          setWaiting(false);
          if (next.status === "FAILED") {
            setError(next.errorMessage || "Tạo ảnh thất bại");
          }
          return;
        }

        if (Date.now() - startedAtRef.current > TIMEOUT_MS) {
          setWaiting(false);
          setError(
            "Chờ quá lâu chưa có kết quả. Ảnh có thể vẫn đang xử lý — mở lại lịch sử để kiểm tra.",
          );
          return;
        }

        poll(id);
      } catch {
        if (!aliveRef.current) return;
        // Lỗi mạng lúc hỏi lại không có nghĩa là job hỏng — thử tiếp cho tới
        // khi chạm trần thời gian.
        if (Date.now() - startedAtRef.current > TIMEOUT_MS) {
          setWaiting(false);
          setError("Mất kết nối khi chờ kết quả, thử tải lại trang");
          return;
        }
        poll(id);
      }
    }, POLL_MS);
  }, []);

  /** Bắt đầu theo dõi job vừa tạo. */
  const track = useCallback(
    (created: TryOnJob, token?: string | null) => {
      tokenRef.current = token ?? null;
      setJob(created);
      setError(null);
      startedAtRef.current = Date.now();

      if (TRYON_TERMINAL.includes(created.status)) {
        setWaiting(false);
        return;
      }

      setWaiting(true);
      poll(created.id);
    },
    [poll],
  );

  const reset = useCallback(() => {
    clearTimer();
    tokenRef.current = null;
    setJob(null);
    setWaiting(false);
    setError(null);
  }, []);

  return { job, waiting, error, track, reset, setError };
}
