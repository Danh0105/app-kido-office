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
