export type PolicyOtherCost = {
  id?: string | number;
  name?: string;
  unitPrice?: number | string;
  percent?: number | string;
  value?: number | string;
  tax?: number | string;
};

export const normalizeOtherCosts = (value: unknown): PolicyOtherCost[] =>
  Array.isArray(value) ? value : [];

export const getPolicyOtherCosts = (subject: any): PolicyOtherCost[] => {
  const policies = Array.isArray(subject?.policies)
    ? subject.policies
    : subject?.policy
      ? [subject.policy]
      : [];
  const rows = [
    ...policies.flatMap((policy: any) =>
      Array.isArray(policy?.data?.ttcs) ? policy.data.ttcs : [],
    ),
    ...(Array.isArray(subject?.data?.ttcs) ? subject.data.ttcs : []),
    ...(Array.isArray(subject?.ttcs) ? subject.ttcs : []),
  ];
  const costs = [
    ...rows.flatMap((row: any) => normalizeOtherCosts(row?.otherCosts)),
    ...policies.flatMap((policy: any) =>
      normalizeOtherCosts(policy?.data?.otherCosts || policy?.otherCosts),
    ),
    ...normalizeOtherCosts(subject?.data?.otherCosts || subject?.otherCosts),
  ];
  const uniqueCosts = new Map<string, PolicyOtherCost>();

  costs.forEach((item, index) => {
    const key = String(
      item.id ?? item.name?.trim().toLocaleLowerCase("vi-VN") ?? index,
    );
    const current = uniqueCosts.get(key);

    // Ưu tiên bản ghi có dữ liệu thuế để cột Thuế Chi khác luôn được hiển thị.
    if (!current || Number(item.tax ?? 0) !== 0) {
      uniqueCosts.set(key, item);
    }
  });

  return Array.from(uniqueCosts.values());
};

export const getOtherCostKey = (item: PolicyOtherCost, index: number) =>
  String(item.id ?? `${item.name || "other-cost"}-${index}`);

export const getOtherCostUnitPrice = (item: PolicyOtherCost) =>
  item.unitPrice !== undefined && item.unitPrice !== null
    ? Number(item.unitPrice) - Number(item.tax ?? 0)
    : Number(item.percent ?? item.value ?? 0) - Number(item.tax ?? 0);

export const getOtherCostGrossPrice = (item: PolicyOtherCost) =>
  item.unitPrice !== undefined && item.unitPrice !== null
    ? Number(item.unitPrice)
    : Number(item.percent ?? item.value ?? 0);

export const getOtherCostTax = (item: PolicyOtherCost) => Number(item.tax ?? 0);

export const getOtherCostsTotal = (items: PolicyOtherCost[]) =>
  items.reduce((total, item) => total + getOtherCostUnitPrice(item), 0);
