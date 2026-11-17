import type { ExpenseRequest } from "@/types/expenseRequest";
import {
  getExpenseWorkflowSteps,
  type WorkflowStepState,
} from "./workflowProgress";

const stepStyles: Record<
  WorkflowStepState,
  { circle: string; label: string; connector: string; note: string }
> = {
  completed: {
    circle: "border-emerald-600 bg-emerald-600 text-white",
    label: "text-emerald-800",
    connector: "bg-emerald-500",
    note: "Đã xong",
  },
  current: {
    circle: "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100",
    label: "text-blue-800",
    connector: "bg-slate-200",
    note: "Đang chờ",
  },
  upcoming: {
    circle: "border-slate-300 bg-white text-slate-400",
    label: "text-slate-500",
    connector: "bg-slate-200",
    note: "Chưa thực hiện",
  },
  stopped: {
    circle: "border-red-500 bg-red-50 text-red-600",
    label: "text-red-700",
    connector: "bg-slate-200",
    note: "Đã dừng",
  },
};

/**
 * Hiển thị trạng thái xử lý của một đề xuất ngay tại danh sách.
 * Không mở chi tiết, không tải log riêng; dùng trạng thái hiện tại của đề xuất.
 * Với các đề xuất có nhiều bước, dải tiến trình có thể cuộn ngang.
 */
export default function WorkflowProgressCompact({
  request,
}: {
  request: ExpenseRequest;
}) {
  const steps = getExpenseWorkflowSteps(request);
  const completedCount = steps.filter((step) => step.state === "completed").length;
  const current = steps.find((step) => step.state === "current");
  const stopped = steps.find((step) => step.state === "stopped");

  return (
    <section
      aria-label={`Tiến trình xử lý ${request.code || "đề xuất"}`}
      className="h-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-800">📍 Tiến trình xử lý</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {stopped
              ? `Đã dừng: ${stopped.label}`
              : current
                ? `Bước tiếp theo: ${current.label} · ${current.owner}`
                : "Đã hoàn thành tất cả các bước"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
          {completedCount}/{steps.length} bước
        </span>
      </div>

      <div
        className="mt-3 overflow-x-auto pb-2"
        role="region"
        tabIndex={0}
        aria-label="Các bước xử lý — có thể cuộn ngang"
      >
        <ol className="flex min-w-max items-start">
          {steps.map((step, index) => {
            const style = stepStyles[step.state];
            return (
              <li
                key={step.id}
                aria-current={step.state === "current" ? "step" : undefined}
                className="relative w-[112px] shrink-0 text-center"
              >
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-[14px] h-0.5 w-[calc(50%-15px)] ${stepStyles[steps[index - 1].state].connector}`}
                  />
                )}
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-0 top-[14px] h-0.5 w-[calc(50%-15px)] ${style.connector}`}
                  />
                )}
                <span
                  className={`relative mx-auto flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 text-xs font-bold ${style.circle}`}
                >
                  {step.state === "completed"
                    ? "✓"
                    : step.state === "stopped"
                      ? "✕"
                      : index + 1}
                </span>
                <div className={`mt-1 px-1 text-[11px] font-semibold leading-4 ${style.label}`}>
                  {step.label}
                </div>
                <div className="px-1 text-[10px] leading-4 text-slate-500">
                  {step.owner}
                </div>
                <div
                  className={`px-1 text-[10px] leading-4 ${
                    step.state === "current"
                      ? "font-semibold text-blue-600"
                      : step.state === "stopped"
                        ? "text-red-600"
                        : "text-slate-400"
                  }`}
                >
                  {style.note}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
