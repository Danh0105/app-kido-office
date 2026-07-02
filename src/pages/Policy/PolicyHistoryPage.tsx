import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import HeaderWithBack from "@/components/HeaderWithBack";
import PolicyHistoryTimeline from "@/components/policy/PolicyHistoryTimeline";
import { policiesApi } from "@/service/policy";
import { PolicyHistoryEntry } from "@/types/policy";
import { getApiErrorMessage } from "@/utils/apiError";

export default function PolicyHistoryPage({
  audience,
}: {
  audience: "director" | "employee";
}) {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const [histories, setHistories] = useState<PolicyHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!policyId) return;

      try {
        setLoading(true);
        const response = await policiesApi.getHistoryByPolicy(Number(policyId));
        setHistories(
          Array.isArray(response) ? response : response?.data || [],
        );
      } catch (error: any) {
        toast.error(
          getApiErrorMessage(error, "Không thể tải lịch sử chính sách"),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [policyId]);

  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Lịch sử chỉnh sửa chính sách" />
      <main className="mx-auto max-w-5xl space-y-4 px-4 pb-12 pt-20">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              navigate(
                audience === "director"
                  ? `/director/policy/${policyId}`
                  : `/employee/policy/${policyId}`,
              )
            }
            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
          >
            Xem chính sách hiện tại
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Đang tải lịch sử...
          </div>
        ) : (
          <PolicyHistoryTimeline histories={histories} />
        )}
      </main>
    </div>
  );
}
