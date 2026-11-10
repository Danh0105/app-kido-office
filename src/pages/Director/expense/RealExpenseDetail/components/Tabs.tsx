type TabType = string;

type Props = {
  tab: TabType;

  setTab: (tab: TabType) => void;

  subjects: any[];

  setSubjectId: (subjectId: number) => void;

  /** Hiện tab "Lương GV CTV" (kế toán, thủ quỹ, ban giám đốc). */
  showCollaboratorPayroll?: boolean;
};

const staticTabs = [
  {
    key: "summary",
    label: "Tổng hợp",
    activeClass: "bg-emerald-600 text-white shadow-lg",
  },
];

const policyYearTab = {
  key: "policy-year",
  label: "Chính sách năm",
  activeClass: "bg-blue-600 text-white shadow-lg",
};

const collaboratorPayrollTab = {
  key: "ctv-payroll",
  label: "Lương GV CTV",
  activeClass: "bg-indigo-600 text-white shadow-lg",
};

export default function Tabs({
  tab,
  setTab,
  subjects,
  setSubjectId,
  showCollaboratorPayroll = false,
}: Props) {
  console.log("Rendering Tabs with subjects:", subjects);
  const subjectTabs = subjects.map((subject: any) => ({
    key: `subject-${subject.id}`,

    label: `${subject.code} • ${subject.name}`,

    activeClass: "bg-purple-600 text-white shadow-lg",
  }));

  const tabs = [
    ...staticTabs,
    ...subjectTabs,
    policyYearTab,
    ...(showCollaboratorPayroll ? [collaboratorPayrollTab] : []),
  ];

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
            } else {
              setSubjectId(0);
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
