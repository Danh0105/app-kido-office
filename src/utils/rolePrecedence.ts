const BROAD_ROLES = [
  "director",
  "director_la",
  "saleadmin",
  "salesadmin",
  "salesadmin_la",
] as const;

export const hasBroadRoleIn = (roles: readonly string[]): boolean =>
  BROAD_ROLES.some((role) => roles.includes(role));

/**
 * Trợ lý GĐ ưu tiên hơn các role nghiệp vụ hẹp như Kế toán/Thủ quỹ, nhưng
 * vẫn đứng sau Giám đốc/Sales Admin nếu một tài khoản kiêm role quản lý rộng.
 */
export const isDirectorAssistantViewerIn = (
  roles: readonly string[],
): boolean => roles.includes("troly_gd") && !hasBroadRoleIn(roles);

export const isChiefAccountantIn = (roles: readonly string[]): boolean =>
  roles.includes("ketoan_truong") &&
  !hasBroadRoleIn(roles) &&
  !isDirectorAssistantViewerIn(roles);

export const isAccountantOnlyIn = (roles: readonly string[]): boolean =>
  roles.includes("accountant") &&
  !hasBroadRoleIn(roles) &&
  !isDirectorAssistantViewerIn(roles);
