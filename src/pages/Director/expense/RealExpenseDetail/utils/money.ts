export const money = (value: number | string) => {
    return Number(value || 0).toLocaleString("vi-VN");
  };