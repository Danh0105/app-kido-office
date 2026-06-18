// components/Pagination.tsx

type Props = {
  currentPage: number;

  totalPages: number;

  onPrev: () => void;

  onNext: () => void;
};

export default function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      {/* PREV */}
      <button
        disabled={currentPage === 1}
        onClick={onPrev}
        className="
          h-10 px-4 rounded-xl
          border border-slate-200
          bg-white

          hover:bg-slate-50

          disabled:opacity-50
          disabled:cursor-not-allowed

          transition-all
        "
      >
        Trước
      </button>

      {/* PAGE */}
      <div className="px-4 font-semibold text-slate-700">
        {currentPage} / {totalPages || 1}
      </div>

      {/* NEXT */}
      <button
        disabled={currentPage === totalPages || totalPages === 0}
        onClick={onNext}
        className="
          h-10 px-4 rounded-xl
          border border-slate-200
          bg-white

          hover:bg-slate-50

          disabled:opacity-50
          disabled:cursor-not-allowed

          transition-all
        "
      >
        Sau
      </button>
    </div>
  );
}
