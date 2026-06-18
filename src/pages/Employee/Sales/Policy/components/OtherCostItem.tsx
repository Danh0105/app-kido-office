import { formatNumber, parseNumber } from "../../../../../utils/formatNumber";

export const OtherCostItem = ({ k, v, onChangeKey, onChangeValue, onRemove }: any) => {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
                value={k}
                onChange={(e) => onChangeKey(e.target.value)}
                placeholder="Tên (vd: học phí)"
                className="
            w-full 
            px-3 py-2 
            border rounded-lg
            text-sm
        "
            />

            <input
                value={formatNumber(v)}
                onChange={(e) =>
                    onChangeValue(parseNumber(e.target.value))
                }
                placeholder="Số tiền"
                className="
            w-full sm:w-40
            px-3 py-2 
            border rounded-lg
            text-sm
        "
            />

            <button
                onClick={onRemove}
                className="
            w-full sm:w-auto
            bg-red-500 text-white
            px-3 py-2 rounded-lg
            text-sm
            active:scale-95
        "
            >
                Xóa
            </button>
        </div>
    );
};