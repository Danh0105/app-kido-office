// components/FilterBar.tsx

type Props = {
  keyword: string;

  periods: any[];

  selectedPeriod: any;

  setKeyword: (value: string) => void;

  setCurrentPage: (page: number) => void;

  setSelectedPeriod: (period: any) => void;
};

export default function FilterBar({
  keyword,
  periods,
  selectedPeriod,
  setKeyword,
  setCurrentPage,
  setSelectedPeriod,
}: Props) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm">
      <div className="flex flex-col md:flex-row gap-4">
        {/* SEARCH */}
        <input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);

            setCurrentPage(1);
          }}
          placeholder="Tìm môn học, người chi..."
          className="
            flex-1 h-12 rounded-xl
            border border-slate-200
            px-4

            outline-none

            focus:ring-2
            focus:ring-blue-200
          "
        />

        {/* PERIOD */}
        <select
          value={selectedPeriod?.id || ""}
          onChange={(e) => {
            const period = periods.find(
              (item: any) => item.id === Number(e.target.value),
            );

            setSelectedPeriod(period || null);
          }}
          className="
            h-12 w-full md:w-64
            rounded-xl

            border border-slate-200

            px-4

            outline-none

            focus:ring-2
            focus:ring-blue-200
          "
        >
          <option value="">Tất cả kỳ</option>

          {periods.map((period: any) => (
            <option key={period.id} value={period.id}>
              {period.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
