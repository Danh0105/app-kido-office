/**
 * Danh mục "Nguồn thu chi" — chọn ở cột "Khoản thu/chi" bảng Hóa Đơn và cột
 * "Nguồn chi" bảng Chi Ngoài, lưu theo số hiệu tài khoản. BE (sales-management src/revenue-item/invoice-cash-account.ts)
 * giữ cùng danh mục để kiểm tra — thêm/bớt tài khoản phải sửa cả hai nơi.
 */
export const invoiceCashAccountGroups = [
  {
    label: "111 - Tiền mặt",
    accounts: [
      { code: "1111", name: "Tiền mặt tại quỹ" },
      { code: "1112", name: "Tiền TK Sếp Khôi" },
      { code: "1113", name: "Tiền mặt - Anh Trung" },
      { code: "1114", name: "Tiền mặt - Cầm" },
      { code: "1115", name: "Tiền mặt - Nhung" },
    ],
  },
  {
    label: "112 - Tiền gửi ngân hàng",
    accounts: [
      { code: "1121", name: "TK Techcombank - ICHI" },
      { code: "1125", name: "TK MB Bank - ICHI" },
      { code: "1126", name: "TK Vietcombank - ICHI" },
      { code: "1127", name: "TK Vietinbank - ICHI" },
      { code: "1128", name: "TK Techcombank - Chuyển đổi số" },
      { code: "1129", name: "TK Techcombank - Kido" },
      { code: "11210", name: "TK Vietinbank - Kido" },
      { code: "11211", name: "TK Techcombank - Anh Việt" },
      { code: "11212", name: "TK MB Bank - ST" },
      { code: "11213", name: "TK MB Bank - GATE" },
    ],
  },
];

/** "1121 - TK Techcombank - ICHI"; mã không có trong danh mục thì trả nguyên mã. */
export const invoiceCashAccountLabel = (code?: string | null) => {
  if (!code) return "";
  const account = invoiceCashAccountGroups
    .flatMap((group) => group.accounts)
    .find((item) => item.code === code);
  return account ? `${account.code} - ${account.name}` : code;
};
