/**
 * Bỏ dấu tiếng Việt + hạ chữ thường để so khớp khi tìm kiếm.
 * Nhờ vậy gõ "tieu hoc binh khanh" vẫn ra "TRƯỜNG TIỂU HỌC BÌNH KHÁNH".
 */
export const normalizeText = (value: string) =>
    (value || "")
        .normalize("NFD")
        // Bỏ các dấu thanh/dấu mũ đã tách ra sau khi chuẩn hoá NFD.
        .replace(/[̀-ͯ]/g, "")
        // đ/Đ không tách được bằng NFD nên phải thay riêng.
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();

/** Chuỗi `haystack` có chứa `needle` không, bỏ qua dấu và hoa thường. */
export const matchesSearch = (haystack: string, needle: string) =>
    normalizeText(haystack).includes(normalizeText(needle));

/**
 * Tên trường đang nhập không thống nhất ("TIỂU HỌC X", "TRƯỜNG TIỂU HỌC X",
 * "TH X"...) nên quy cả tên lẫn từ khoá về cùng dạng viết tắt.
 * Cụm dài phải đứng trước cụm ngắn.
 */
const SCHOOL_TYPE_ABBR: [RegExp, string][] = [
    [/\btrung hoc co so\b/g, "thcs"],
    [/\btrung hoc pho thong\b/g, "thpt"],
    [/\btieu hoc\b/g, "th"],
    [/\bmam non\b/g, "mn"],
    [/\bmau giao\b/g, "mg"],
];
const SCHOOL_TYPES = new Set(SCHOOL_TYPE_ABBR.map(([, abbr]) => abbr));

/**
 * Khoá tìm kiếm: bỏ dấu, bỏ ký tự đặc biệt, rút gọn loại trường và bỏ chữ
 * "trường" đứng đầu/đứng trước loại trường (tên lúc có lúc không). Nhờ vậy
 * "truong tieu hoc binh khanh", "th binh khanh" và "TIỂU HỌC BÌNH KHÁNH" ra
 * cùng một khoá; còn "Xuân Trường" (địa danh) vẫn giữ nguyên.
 */
export const toSearchKey = (value: string) => {
    let key = normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
    for (const [pattern, abbr] of SCHOOL_TYPE_ABBR) key = key.replace(pattern, abbr);
    return key
        .replace(/^truong\b|\btruong (?=(?:th|thcs|thpt|mn|mg)\b)/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

// Từ chỉ loại trường phải khớp nguyên từ — gõ "tiểu học" không ra cả THCS.
const hasWordPrefix = (words: string[], token: string) =>
    SCHOOL_TYPES.has(token)
        ? words.includes(token)
        : words.some((word) => word.startsWith(token));

/**
 * Mức khớp của một mục với từ khoá (các tham số đều đã qua `toSearchKey`).
 * Trả về null nếu không khớp; số càng nhỏ càng khớp sát:
 *   0 trùng tên · 1 tên bắt đầu bằng từ khoá · 2 mọi từ đều có trong tên
 *   3 tên chứa từ khoá khi bỏ khoảng trắng ("binhkhanh")
 *   4 có từ chỉ khớp ở phần phụ (địa chỉ, xã/phường).
 * Các từ không cần đúng thứ tự: "binh khanh th" vẫn ra "TH Bình Khánh".
 */
export const rankSearchKey = (nameKey: string, queryKey: string, extraKey = ""): number | null => {
    if (!queryKey || nameKey === queryKey) return 0;

    const tokens = queryKey.split(" ");
    const nameWords = nameKey.split(" ");
    if (tokens.every((token) => hasWordPrefix(nameWords, token))) {
        return nameKey.startsWith(queryKey) ? 1 : 2;
    }
    if (
        !tokens.some((token) => SCHOOL_TYPES.has(token)) &&
        nameKey.replace(/ /g, "").includes(queryKey.replace(/ /g, ""))
    ) {
        return 3;
    }

    const extraWords = extraKey ? extraKey.split(" ") : [];
    if (tokens.every((token) => hasWordPrefix(nameWords, token) || hasWordPrefix(extraWords, token))) {
        return 4;
    }
    return null;
};
