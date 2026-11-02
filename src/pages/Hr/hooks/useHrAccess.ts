import { useQuery } from "@tanstack/react-query";
import { hrAccessApi, hrSystemApi } from "@/service/hr/hr.api";
import {
  hasAnyHrPermission,
  hasPermission,
  hasUnrestricted,
  type HrPermissionCode,
} from "../lib/hrAccess";

export const HR_ACCESS_QUERY_KEY = ["hr", "access", "me"] as const;

/**
 * Quyền HR hiệu lực (từ backend). Lỗi (chưa có module HR, mất mạng, 401…)
 * được coi là "không có quyền HR" — menu HR không hiện, không bật toast.
 */
export function useHrAccess(enabled = true) {
  const query = useQuery({
    queryKey: HR_ACCESS_QUERY_KEY,
    queryFn: hrAccessApi.me,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const access = query.data ?? null;
  return {
    access,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasAny: hasAnyHrPermission(access),
    has: (code: HrPermissionCode) => hasPermission(access, code),
    hasUnrestricted: (code: HrPermissionCode) => hasUnrestricted(access, code),
  };
}

/**
 * Trạng thái mã hoá (cần ACCESS_VIEW). `known = false` khi không đọc được —
 * UI khi đó không đoán, chỉ dựa vào lỗi 503 backend trả khi thao tác.
 */
export function useHrCryptoStatus(enabled: boolean) {
  const query = useQuery({
    queryKey: ["hr", "crypto-status"],
    queryFn: hrSystemApi.cryptoStatus,
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
  const status = query.data ?? null;
  return {
    status,
    known: !!status,
    isLoading: query.isLoading && enabled,
    isError: query.isError,
    /** Chắc chắn không ghi/giải mã được (chỉ khi đã đọc được trạng thái). */
    writeUnavailable: !!status && status.status !== "AVAILABLE",
    revealUnavailable: !!status && !status.encryptionKeyringReady,
  };
}
