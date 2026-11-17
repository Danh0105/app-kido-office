import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, X } from "lucide-react";
import { policiesApi } from "@/service/policy";
import PolicyDetail from "../../Policy/Sales";
import type { PolicyRef } from "../quantityStats";

type Props = {
  schoolName: string;
  policies: PolicyRef[];
  /** Chính sách mở sẵn; không truyền thì mở chính sách đầu tiên. */
  initialPolicyId?: number;
  onClose: () => void;
};

/**
 * Popup "Chi tiết chính sách" của tab Học sinh & số tiết — nhúng nguyên trang
 * chi tiết chính sách (Policy/Sales.tsx, chế độ `embedded`) giống danh sách
 * chính sách. Trường có nhiều môn thì chọn môn ở thanh trên.
 * Màn nhỏ chuyển sang trang chi tiết như danh sách chính sách (trang đó có
 * pinch-zoom riêng cho điện thoại).
 */
export default function PolicyDetailModal({
  schoolName,
  policies,
  initialPolicyId,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const isWide = typeof window === "undefined" || window.innerWidth >= 1024;
  const [selectedId, setSelectedId] = useState<number | null>(
    initialPolicyId ||
      (isWide || policies.length === 1 ? policies[0]?.policyId : null) ||
      null,
  );
  const [detail, setDetail] = useState<{ policyId: number; state: any } | null>(
    null,
  );

  // Giống AllPoliciesTab: lấy đủ chi tiết trước để trang hiện ngay đủ thông tin.
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const ref = policies.find((policy) => policy.policyId === selectedId);
    setDetail(null);
    policiesApi
      .findOne(selectedId)
      .then((res: any) => ({ ...res, user: ref?.employeeId || undefined }))
      .catch(() => ({ user: ref?.employeeId || undefined }))
      .then((state) => {
        if (!active) return;
        if (!isWide) {
          navigate(`/director/policy/${selectedId}`, { state });
          return;
        }
        setDetail({ policyId: selectedId, state });
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          isWide ? "h-[92vh] max-w-[1400px]" : "max-h-[80vh] max-w-md"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-blue-900/10 bg-white px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#0047B8]">
              Chi tiết chính sách
            </h2>
            <p className="truncate text-sm text-slate-500">{schoolName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {policies.length > 1 && (
          <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            {policies.map((policy) => (
              <button
                key={policy.policyId}
                type="button"
                onClick={() => setSelectedId(policy.policyId)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  selectedId === policy.policyId
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                }`}
              >
                <FileText size={15} />
                {policy.subjectName}
                <span className="font-semibold opacity-80">
                  · {policy.studentCount.toLocaleString("vi-VN")} HS
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!policies.length ? (
            <p className="p-8 text-center text-base text-slate-500">
              Trường chưa có chính sách đã duyệt.
            </p>
          ) : !selectedId ? (
            <p className="p-8 text-center text-base text-slate-500">
              Chọn môn để xem chi tiết chính sách.
            </p>
          ) : !detail ? (
            <div className="flex items-center justify-center gap-2 p-12 text-base font-semibold text-slate-500">
              <Loader2 size={20} className="animate-spin text-blue-600" />
              Đang tải chính sách...
            </div>
          ) : (
            <PolicyDetail
              key={detail.policyId}
              embedded
              policyId={detail.policyId}
              initialState={detail.state}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
