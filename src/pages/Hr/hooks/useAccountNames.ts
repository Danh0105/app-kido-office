import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hrAccessApi, type LegacyAccount } from "@/service/hr/hr.api";

/** Danh sách tài khoản (API cũ) để hiện tên thay cho id — lỗi thì hiện id. */
export function useAccounts() {
  return useQuery({
    queryKey: ["hr", "accounts"],
    queryFn: hrAccessApi.accounts,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useAccountNames(): Map<number, string> {
  const { data } = useAccounts();
  return useMemo(() => {
    const map = new Map<number, string>();
    for (const a of (data ?? []) as LegacyAccount[]) {
      map.set(a.id, a.name || a.email || `Tài khoản #${a.id}`);
    }
    return map;
  }, [data]);
}
