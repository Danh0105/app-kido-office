import { useEffect, useState } from "react";
import type { Paginated } from "@/service/recruitment";
import { errorMessage } from "./shared";

/** Ignore stale requests when filters change or a panel closes. */
export function usePagedRecruitment<T>(
  fetch: (params: Record<string, unknown>) => Promise<Paginated<T>>,
  params: Record<string, unknown>,
  revision = 0
) {
  const key = JSON.stringify(params);
  const [result, setResult] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setResult(null);
    fetch(JSON.parse(key))
      .then(
        (data) => {
          if (active) setResult(data);
        },
        (err) => {
          if (active) setError(errorMessage(err));
        }
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetch, key, revision, retry]);
  return { result, loading, error, reload: () => setRetry((v) => v + 1) };
}
