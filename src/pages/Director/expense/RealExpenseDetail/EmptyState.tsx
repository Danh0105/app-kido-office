// components/EmptyState.tsx

type Props = {
  text?: string;
};

export default function EmptyState({ text = "Không có dữ liệu" }: Props) {
  return (
    <div
      className="
        bg-white
        rounded-3xl
        p-10
        text-center
        shadow-sm
        border border-slate-100
      "
    >
      {/* ICON */}
      <div
        className="
          w-16 h-16
          mx-auto

          rounded-2xl
          bg-slate-100

          flex items-center justify-center
        "
      >
        <span className="text-2xl">📭</span>
      </div>

      {/* TEXT */}
      <p className="text-slate-500 mt-4 text-sm">{text}</p>
    </div>
  );
}
