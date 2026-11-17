export type StatisticsPolicy = Record<string, any>;

export type DashboardFilters = {
  keyword: string;
  provinceId: number | null;
  wardId: number | null;
  schoolId: number | null;
  subjectId: number | null;
  schoolYear: string;
};

export type DashboardBreakdown = {
  id: string | number;
  name: string;
  policies: number;
  schools: number;
  students: number;
  periods: number;
};

export type DeviceBreakdown = {
  key: string;
  name: string;
  quantity: number;
  schools: number;
  estimatedValue: number;
  allocations: Array<{
    schoolId: number;
    schoolName: string;
    provinceName: string;
    quantity: number;
    estimatedValue: number;
  }>;
};

export type StatisticsDashboardModel = {
  summary: {
    policies: number;
    schools: number;
    subjects: number;
    students: number;
    periods: number;
    provinces: number;
    employees: number;
    devices: number;
    contractCoverage: number;
    averageCompanyUnit: number;
  };
  years: DashboardBreakdown[];
  employees: DashboardBreakdown[];
  provinces: DashboardBreakdown[];
  subjects: DashboardBreakdown[];
  schools: DashboardBreakdown[];
  devices: DeviceBreakdown[];
  alerts: {
    missingContract: StatisticsPolicy[];
    missingStudentCount: StatisticsPolicy[];
    missingPeriods: StatisticsPolicy[];
    nonPositiveCompanyUnit: StatisticsPolicy[];
  };
};

const COST_FIELDS = [
  "csvc",
  "giaovien",
  "csthang",
  "thietbi",
  "giaoCu",
  "vanHanh",
  "thuetndn",
] as const;

export const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

export const getPolicyId = (policy: StatisticsPolicy) =>
  numberValue(policy.policyId || policy.id);

export const getPolicyData = (policy: StatisticsPolicy) => {
  if (policy?.policyData && typeof policy.policyData === "object") {
    return policy.policyData;
  }
  if (policy?.data && typeof policy.data === "object") return policy.data;
  return {};
};

export const getCompanyUnit = (policy: StatisticsPolicy) => {
  const data = getPolicyData(policy);
  const tax = numberValue(data.thue ?? data.tax);
  const fixedCosts = COST_FIELDS.reduce(
    (total, field) => total + numberValue(data[field]),
    0
  );
  return numberValue(data.fee) - tax - fixedCosts;
};

export const hasContract = (policy: StatisticsPolicy) =>
  Boolean(
    policy.contractNumber ||
      policy.contractFileUrl ||
      (Array.isArray(policy.contractFiles) && policy.contractFiles.length > 0)
  );

export const getPolicyDevices = (policy: StatisticsPolicy) => {
  const devices = getPolicyData(policy).htthietbi;
  return Array.isArray(devices) ? devices : [];
};

export const getDeviceName = (device: any) =>
  String(device?.category || device?.name || device?.type || "").trim();

export const getDeviceQuantity = (device: any) =>
  numberValue(device?.qty ?? device?.quantity);

const uniquePolicies = (policies: StatisticsPolicy[]) => {
  const rows = new Map<string, StatisticsPolicy>();
  policies.forEach((policy, index) => {
    const id = getPolicyId(policy);
    const fallback = `${policy.schoolId || "school"}-${
      policy.subjectId || "subject"
    }-${policy.schoolYear || "year"}-${index}`;
    rows.set(id ? `policy-${id}` : fallback, policy);
  });
  return Array.from(rows.values());
};

export const filterStatisticsPolicies = (
  policies: StatisticsPolicy[],
  filters: DashboardFilters
) => {
  const keyword = normalizeText(filters.keyword);

  return uniquePolicies(policies).filter((policy) => {
    if (
      filters.provinceId &&
      numberValue(policy.provinceId) !== filters.provinceId
    ) {
      return false;
    }
    if (filters.wardId && numberValue(policy.wardId) !== filters.wardId) {
      return false;
    }
    if (filters.schoolId && numberValue(policy.schoolId) !== filters.schoolId) {
      return false;
    }
    if (
      filters.subjectId &&
      numberValue(policy.subjectId) !== filters.subjectId
    ) {
      return false;
    }
    if (filters.schoolYear && policy.schoolYear !== filters.schoolYear) {
      return false;
    }
    if (
      keyword &&
      !normalizeText(
        [
          policy.schoolName,
          policy.subjectName,
          policy.provinceName,
          policy.wardName,
          policy.contractNumber,
        ].join(" ")
      ).includes(keyword)
    ) {
      return false;
    }
    return true;
  });
};

const buildBreakdown = (
  policies: StatisticsPolicy[],
  getId: (policy: StatisticsPolicy) => string | number,
  getName: (policy: StatisticsPolicy) => string
) => {
  const groups = new Map<
    string | number,
    DashboardBreakdown & { schoolIds: Set<number> }
  >();

  policies.forEach((policy) => {
    const id = getId(policy);
    if (id === "" || id === 0 || id === null || id === undefined) return;
    const current = groups.get(id) || {
      id,
      name: getName(policy) || "Chưa xác định",
      policies: 0,
      schools: 0,
      students: 0,
      periods: 0,
      schoolIds: new Set<number>(),
    };
    current.policies += 1;
    current.students += numberValue(policy.studentCount);
    current.periods += numberValue(policy.totalLessons);
    const schoolId = numberValue(policy.schoolId);
    if (schoolId) current.schoolIds.add(schoolId);
    groups.set(id, current);
  });

  return Array.from(groups.values()).map(({ schoolIds, ...group }) => ({
    ...group,
    schools: schoolIds.size,
  }));
};

const buildDevices = (policies: StatisticsPolicy[]): DeviceBreakdown[] => {
  const devices = new Map<
    string,
    DeviceBreakdown & {
      schoolIds: Set<number>;
      allocationMap: Map<number, DeviceBreakdown["allocations"][number]>;
    }
  >();

  policies.forEach((policy) => {
    getPolicyDevices(policy).forEach((device: any) => {
      const name = getDeviceName(device);
      const key = normalizeText(name);
      if (!key) return;

      const quantity = getDeviceQuantity(device);
      const price = numberValue(device?.price ?? device?.unitPrice);
      const estimatedValue = quantity * price;
      const schoolId = numberValue(policy.schoolId);
      const current = devices.get(key) || {
        key,
        name,
        quantity: 0,
        schools: 0,
        estimatedValue: 0,
        allocations: [],
        schoolIds: new Set<number>(),
        allocationMap: new Map(),
      };

      current.quantity += quantity;
      current.estimatedValue += estimatedValue;
      if (schoolId) current.schoolIds.add(schoolId);

      if (schoolId) {
        const allocation = current.allocationMap.get(schoolId) || {
          schoolId,
          schoolName: policy.schoolName || `Trường #${schoolId}`,
          provinceName: policy.provinceName || "Chưa xác định",
          quantity: 0,
          estimatedValue: 0,
        };
        allocation.quantity += quantity;
        allocation.estimatedValue += estimatedValue;
        current.allocationMap.set(schoolId, allocation);
      }

      devices.set(key, current);
    });
  });

  return Array.from(devices.values())
    .map(({ schoolIds, allocationMap, ...device }) => ({
      ...device,
      schools: schoolIds.size,
      allocations: Array.from(allocationMap.values()).sort(
        (left, right) =>
          right.quantity - left.quantity ||
          left.schoolName.localeCompare(right.schoolName, "vi")
      ),
    }))
    .sort(
      (left, right) =>
        right.quantity - left.quantity ||
        left.name.localeCompare(right.name, "vi")
    );
};

export const buildStatisticsDashboardModel = (
  input: StatisticsPolicy[]
): StatisticsDashboardModel => {
  const policies = uniquePolicies(input);
  const schoolIds = new Set(
    policies.map((policy) => numberValue(policy.schoolId)).filter(Boolean)
  );
  const subjectIds = new Set(
    policies.map((policy) => numberValue(policy.subjectId)).filter(Boolean)
  );
  const provinceIds = new Set(
    policies.map((policy) => numberValue(policy.provinceId)).filter(Boolean)
  );
  const employeeIds = new Set(
    policies.map((policy) => numberValue(policy.employeeId)).filter(Boolean)
  );
  const contractCount = policies.filter(hasContract).length;
  const companyUnits = policies
    .map(getCompanyUnit)
    .filter((value) => Number.isFinite(value));
  const devices = buildDevices(policies);

  return {
    summary: {
      policies: policies.length,
      schools: schoolIds.size,
      subjects: subjectIds.size,
      students: policies.reduce(
        (total, policy) => total + numberValue(policy.studentCount),
        0
      ),
      periods: policies.reduce(
        (total, policy) => total + numberValue(policy.totalLessons),
        0
      ),
      provinces: provinceIds.size,
      employees: employeeIds.size,
      devices: devices.reduce((total, device) => total + device.quantity, 0),
      contractCoverage: policies.length
        ? Math.round((contractCount / policies.length) * 100)
        : 0,
      averageCompanyUnit: companyUnits.length
        ? companyUnits.reduce((total, value) => total + value, 0) /
          companyUnits.length
        : 0,
    },
    years: buildBreakdown(
      policies,
      (policy) => policy.schoolYear || "Chưa có năm học",
      (policy) => policy.schoolYear || "Chưa có năm học"
    ).sort((left, right) => left.name.localeCompare(right.name, "vi")),
    employees: buildBreakdown(
      policies,
      (policy) =>
        numberValue(policy.employeeId) || policy.employeeName || "unknown",
      (policy) => policy.employeeName || "Chưa xác định"
    ).sort(
      (left, right) =>
        right.students - left.students ||
        left.name.localeCompare(right.name, "vi")
    ),
    provinces: buildBreakdown(
      policies,
      (policy) =>
        numberValue(policy.provinceId) || policy.provinceName || "unknown",
      (policy) => policy.provinceName || "Chưa xác định"
    ).sort((left, right) => right.students - left.students),
    subjects: buildBreakdown(
      policies,
      (policy) =>
        numberValue(policy.subjectId) || policy.subjectName || "unknown",
      (policy) => policy.subjectName || "Chưa xác định"
    ).sort((left, right) => right.students - left.students),
    schools: buildBreakdown(
      policies,
      (policy) =>
        numberValue(policy.schoolId) || policy.schoolName || "unknown",
      (policy) => policy.schoolName || "Chưa xác định"
    ).sort(
      (left, right) =>
        right.students - left.students ||
        left.name.localeCompare(right.name, "vi")
    ),
    devices,
    alerts: {
      missingContract: policies.filter((policy) => !hasContract(policy)),
      missingStudentCount: policies.filter(
        (policy) => numberValue(policy.studentCount) <= 0
      ),
      missingPeriods: policies.filter(
        (policy) => numberValue(policy.totalLessons) <= 0
      ),
      nonPositiveCompanyUnit: policies.filter(
        (policy) => getCompanyUnit(policy) <= 0
      ),
    },
  };
};
