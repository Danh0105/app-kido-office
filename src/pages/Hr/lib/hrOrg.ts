/**
 * Cơ cấu tổ chức phía FE (thuần) — PHẢN CHIẾU `src/hr/organization/org-policy.ts`
 * để gợi ý lựa chọn hợp lệ. Backend vẫn kiểm tra thật.
 */

export type OrgUnitType = "COMPANY" | "BRANCH" | "DEPARTMENT" | "TEAM";
export type OrgUnitStatus = "ACTIVE" | "INACTIVE";
export type OrgLeaderRole = "DEPARTMENT_HEAD" | "BRANCH_DIRECTOR" | "COMPANY_DIRECTOR" | "DEPUTY";

export const ORG_UNIT_TYPE_LABELS: Record<OrgUnitType, string> = {
  COMPANY: "Công ty",
  BRANCH: "Chi nhánh",
  DEPARTMENT: "Phòng ban",
  TEAM: "Nhóm",
};

export const ORG_LEADER_ROLE_LABELS: Record<OrgLeaderRole, string> = {
  DEPARTMENT_HEAD: "Trưởng đơn vị",
  BRANCH_DIRECTOR: "Giám đốc chi nhánh",
  COMPANY_DIRECTOR: "Giám đốc công ty",
  DEPUTY: "Phó",
};

export const ALLOWED_PARENT_TYPES: Record<OrgUnitType, OrgUnitType[]> = {
  COMPANY: [],
  BRANCH: ["COMPANY"],
  DEPARTMENT: ["COMPANY", "BRANCH", "DEPARTMENT"],
  TEAM: ["DEPARTMENT"],
};

export const LEADER_ROLE_UNIT_TYPES: Record<OrgLeaderRole, OrgUnitType[]> = {
  DEPARTMENT_HEAD: ["DEPARTMENT", "TEAM"],
  BRANCH_DIRECTOR: ["BRANCH"],
  COMPANY_DIRECTOR: ["COMPANY"],
  DEPUTY: ["COMPANY", "BRANCH", "DEPARTMENT", "TEAM"],
};

export const APPROVER_KIND_LABELS: Record<string, string> = {
  DEPARTMENT_HEAD: "Trưởng đơn vị",
  BRANCH_DIRECTOR: "Giám đốc chi nhánh",
  COMPANY_DIRECTOR: "Giám đốc công ty",
};

export interface OrgUnitFlat {
  id: number;
  code: string;
  name: string;
  unitType: OrgUnitType;
  parentId: number | null;
  status: OrgUnitStatus;
}

export interface OrgTreeNode<T extends OrgUnitFlat = OrgUnitFlat> {
  unit: T;
  depth: number;
  children: OrgTreeNode<T>[];
}

/** Dựng cây từ danh sách phẳng; đơn vị mồ côi (cha không có trong danh sách) đưa lên gốc. */
export function buildOrgTree<T extends OrgUnitFlat>(units: T[]): OrgTreeNode<T>[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const children = new Map<number | null, T[]>();
  for (const u of units) {
    const key = u.parentId !== null && byId.has(u.parentId) ? u.parentId : null;
    children.set(key, [...(children.get(key) ?? []), u]);
  }
  const order: Record<OrgUnitType, number> = { COMPANY: 0, BRANCH: 1, DEPARTMENT: 2, TEAM: 3 };
  const sort = (list: T[]) =>
    [...list].sort((a, b) => order[a.unitType] - order[b.unitType] || a.name.localeCompare(b.name, "vi"));
  const build = (parent: number | null, depth: number, seen: Set<number>): OrgTreeNode<T>[] =>
    sort(children.get(parent) ?? [])
      .filter((u) => !seen.has(u.id))
      .map((u) => {
        const next = new Set(seen).add(u.id);
        return { unit: u, depth, children: build(u.id, depth + 1, next) };
      });
  return build(null, 0, new Set());
}

/** Làm phẳng cây theo thứ tự hiển thị (bỏ qua nhánh đang thu gọn). */
export function flattenOrgTree<T extends OrgUnitFlat>(
  roots: OrgTreeNode<T>[],
  collapsed: Set<number> = new Set(),
): OrgTreeNode<T>[] {
  const out: OrgTreeNode<T>[] = [];
  const walk = (nodes: OrgTreeNode<T>[]) => {
    for (const n of nodes) {
      out.push(n);
      if (!collapsed.has(n.unit.id)) walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/** Đơn vị có thể làm cha cho loại `childType` (loại hợp lệ, đang hoạt động, không phải chính nó/con cháu). */
export function parentCandidates<T extends OrgUnitFlat>(units: T[], childType: OrgUnitType, excludeSubtreeOf?: number): T[] {
  const allowed = ALLOWED_PARENT_TYPES[childType];
  const excluded = new Set<number>();
  if (excludeSubtreeOf !== undefined) {
    const stack = [excludeSubtreeOf];
    while (stack.length) {
      const id = stack.pop()!;
      if (excluded.has(id)) continue;
      excluded.add(id);
      for (const u of units) if (u.parentId === id) stack.push(u.id);
    }
  }
  return units.filter((u) => u.status === "ACTIVE" && allowed.includes(u.unitType) && !excluded.has(u.id));
}

export function leaderRolesFor(unitType: OrgUnitType): OrgLeaderRole[] {
  return (Object.keys(LEADER_ROLE_UNIT_TYPES) as OrgLeaderRole[]).filter((r) =>
    LEADER_ROLE_UNIT_TYPES[r].includes(unitType),
  );
}
