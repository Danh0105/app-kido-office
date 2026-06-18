type Props = {
  subject: any;
};

export default function SubjectCard({ subject }: Props) {
  return (
    <div
      className="
          bg-white
          rounded-2xl
          p-5
          shadow-sm
          border border-slate-100
        "
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{subject.name}</h2>

          <p className="text-sm text-slate-400 mt-1">{subject.code || "--"}</p>
        </div>
      </div>
    </div>
  );
}
