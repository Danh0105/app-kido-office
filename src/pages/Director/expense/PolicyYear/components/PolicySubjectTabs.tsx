import { PolicySubject } from "../types";

type PolicySubjectTabsProps = {
  subjects: PolicySubject[];
  value: number | "all";
  onChange: (value: number | "all") => void;
};

export default function PolicySubjectTabs({
  subjects,
  value,
  onChange,
}: PolicySubjectTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`h-10 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${
          value === "all"
            ? "bg-slate-900 text-white shadow-sm"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Tất cả
      </button>
      {subjects.map((subject) => (
        <button
          key={subject.id}
          type="button"
          onClick={() => onChange(subject.id)}
          className={`h-10 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${
            value === subject.id
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          {subject.name}
        </button>
      ))}
    </div>
  );
}

