type TabType = string;

type Props = {
  tab: TabType;

  setTab: (tab: TabType) => void;

  subjects: any[];

  setSubjectId: (subjectId: number) => void;
};

const staticTabs = [
  {
    key: "summary",
    label: "Tổng hợp",
    activeClass: "bg-emerald-600 text-white shadow-lg",
  },
];

export default function Tabs({ tab, setTab, subjects, setSubjectId }: Props) {
  console.log("Rendering Tabs with subjects:", subjects);
  const subjectTabs = subjects.map((subject: any) => ({
    key: `subject-${subject.id}`,

    label: `${subject.code} • ${subject.name}`,

    activeClass: "bg-purple-600 text-white shadow-lg",
  }));

  const tabs = [...staticTabs, ...subjectTabs];

  return (
    <div
      className="
        bg-white
        rounded-3xl
        p-2

        flex flex-wrap gap-2

        shadow-sm
      "
    >
      {tabs.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            setTab(item.key);
            if (item.key.startsWith("subject-")) {
              const subjectId = Number(item.key.replace("subject-", ""));
              setSubjectId(subjectId);
            }
          }}
          className={`
            h-12 px-5 rounded-2xl

            font-semibold
            whitespace-nowrap

            transition-all

            ${
              tab === item.key
                ? item.activeClass
                : "text-slate-500 hover:bg-slate-50"
            }
          `}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
