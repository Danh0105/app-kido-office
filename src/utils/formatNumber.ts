export const formatNumber = (value: number) => {
    return value?.toLocaleString("vi-VN") || "";
};

export const parseNumber = (value: string) => {
    if (!value) return 0;

    const cleaned = value.replace(/[^\d]/g, "");

    return cleaned ? Number(cleaned) : 0;
}