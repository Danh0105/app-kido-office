export type PolicyOtherCost = {
  id?: string | number;
  name?: string;
  percent?: number | string;
  tax?: number | string;
};

export const normalizeOtherCosts = (value: unknown): PolicyOtherCost[] =>
  Array.isArray(value) ? value : [];

export const getPolicyOtherCosts = (subject: any): PolicyOtherCost[] =>
  normalizeOtherCosts(
    subject?.policies?.[0]?.data?.ttcs?.[0]?.otherCosts,
  );

export const getOtherCostKey = (
  item: PolicyOtherCost,
  index: number,
) => String(item.id ?? `${item.name || "other-cost"}-${index}`);

export const getOtherCostUnitPrice = (item: PolicyOtherCost) =>
  Number(item.percent || 0) - Number(item.tax || 0);

export const getOtherCostsTotal = (items: PolicyOtherCost[]) =>
  items.reduce((total, item) => total + getOtherCostUnitPrice(item), 0);
