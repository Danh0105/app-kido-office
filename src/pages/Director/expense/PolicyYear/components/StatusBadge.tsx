import { CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { PolicyYearStatus } from "../types";

const STATUS_META: Record<
  PolicyYearStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  DRAFT: {
    label: "Nháp",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Clock3,
  },
  ACTIVE: {
    label: "Đang áp dụng",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: CheckCircle2,
  },
  LOCKED: {
    label: "Đã khóa",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: LockKeyhole,
  },
};

export default function StatusBadge({
  status,
}: {
  status: PolicyYearStatus;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${meta.className}`}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

