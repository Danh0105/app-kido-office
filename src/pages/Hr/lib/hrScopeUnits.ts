/**
 * Chọn đơn vị cho phạm vi quyền (trang Phân quyền HR). Danh sách lấy từ
 * `GET /organization/scope-options` — backend đã lọc theo phạm vi ACCESS_ADMIN
 * của người dùng và ngày hiệu lực. Chỉ hỗ trợ giao diện: POST cấp quyền vẫn qua
 * M1 (permission + scope + period) ở backend.
 * Không enum / parameter property (test chạy bằng node strip-types).
 */
import type { HrScope } from "./hrAccess";
import type { OrgUnitType } from "./hrOrg";

/** Phạm vi có gắn đơn vị → loại đơn vị tương ứng (khớp backend SCOPE_OPTION_UNIT_TYPES). */
export const SCOPE_UNIT_TYPES: Partial<Record<HrScope, OrgUnitType[]>> = {
  BRANCH: ["BRANCH"],
  ORG_UNIT: ["DEPARTMENT", "TEAM"],
};

export type ScopeOptionType = "BRANCH" | "ORG_UNIT";

export const scopeNeedsUnit = (scope: HrScope): scope is ScopeOptionType => scope in SCOPE_UNIT_TYPES;

/** Projection tối thiểu backend trả về. */
export interface ScopeOption {
  id: number;
  code: string;
  name: string;
  unitType: OrgUnitType;
  parentId: number | null;
  path: string;
}

export interface ScopeOptionItem {
  id: number;
  /** Nhãn hiển thị + chuỗi tìm kiếm: tên · mã · loại — đường dẫn. */
  name: string;
}

/**
 * Lựa chọn cho ô chọn. `typeLabels` (ORG_UNIT_TYPE_LABELS) truyền vào để lib
 * không import giá trị từ lib khác.
 */
export function scopeOptionItems(options: ScopeOption[], typeLabels?: Record<OrgUnitType, string>): ScopeOptionItem[] {
  return options.map((o) => ({
    id: o.id,
    name: `${o.name} · ${o.code} · ${typeLabels?.[o.unitType] ?? o.unitType} — ${o.path}`,
  }));
}

/** Đơn vị đã chọn còn nằm trong danh sách hiện tại (phạm vi + ngày hiệu lực) không. */
export function isValidScopeOption(options: ScopeOption[], id: number | null): boolean {
  return id !== null && options.some((o) => o.id === id);
}

/** scopeRefId gửi API: chỉ khi phạm vi cần đơn vị; còn lại undefined. */
export function scopeRefIdFor(scope: HrScope, unitId: number | null): number | undefined {
  return scopeNeedsUnit(scope) && unitId !== null ? unitId : undefined;
}

/** Nhãn phạm vi của quyền đã cấp: `tên (DV0002)`; không tra được → `#id`. */
export function scopeUnitLabel(units: Pick<ScopeOption, "id" | "code" | "name">[] | undefined, id: number | null): string {
  if (id === null) return "";
  const unit = units?.find((u) => u.id === id);
  return unit ? `${unit.name} (${unit.code})` : `#${id}`;
}
