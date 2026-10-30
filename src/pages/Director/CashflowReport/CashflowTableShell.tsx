import type { ReactNode } from "react";
import FadeContent from "@/components/ReactBits/FadeContent";

type Props = {
  title: string;
  description?: ReactNode;
  icon: ReactNode;
  children: ReactNode;
  headerAside?: ReactNode;
  footer?: ReactNode;
};

/** Khung kính nhẹ dùng chung cho mọi bảng trong Quản lý thu chi. */
export default function CashflowTableShell({
  title,
  description,
  icon,
  children,
  headerAside,
  footer,
}: Props) {
  return (
    <FadeContent blur trigger="mount" duration={0.42}>
      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60 backdrop-blur-2xl">
        <header className="flex flex-col gap-3 border-b border-slate-200/70 bg-white/75 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.9)]">
              {icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-950 sm:text-lg">
                {title}
              </h2>
              {description && (
                <div className="mt-1 max-w-4xl text-[13px] leading-5 text-slate-600">
                  {description}
                </div>
              )}
            </div>
          </div>
          {headerAside && <div className="shrink-0">{headerAside}</div>}
        </header>
        {children}
        {footer && (
          <footer className="border-t border-slate-200/70 bg-slate-50/70 px-5 py-3">
            {footer}
          </footer>
        )}
      </section>
    </FadeContent>
  );
}

export const appleTableHead =
  "bg-[#f5f5f7]/95 text-[11px] font-semibold uppercase tracking-[0.055em] text-slate-600 backdrop-blur-xl";

export const appleHeaderCell =
  "border-b border-slate-200/90 px-4 py-3 text-left align-middle whitespace-nowrap";

export const appleCell =
  "border-b border-slate-200/70 px-4 py-3 align-middle text-[14px] leading-5 text-slate-700";
