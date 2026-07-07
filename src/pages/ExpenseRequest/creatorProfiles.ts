import { employeeApi } from "@/service/employee";
import type { ExpenseCreator, ExpenseRequest } from "@/types/expenseRequest";

import {
  creatorDepartment,
  creatorId,
  creatorName,
  creatorPhone,
} from "./lib";

const creatorCache = new Map<number, ExpenseCreator | null>();

const pickText = (...values: unknown[]) =>
  values.find((value) => typeof value === "string" && value.trim()) as
    | string
    | undefined;

const normalizeEmployeePayload = (payload: any) => {
  let data =
    payload?.data ??
    payload?.employee ??
    payload?.user ??
    payload?.profile ??
    payload;

  data = Array.isArray(data) ? data[0] : data;

  if (data?.employee && typeof data.employee === "object" && !data.name) {
    return data.employee;
  }
  if (data?.user && typeof data.user === "object" && !data.name) {
    return data.user;
  }
  if (data?.profile && typeof data.profile === "object" && !data.name) {
    return data.profile;
  }

  return data;
};

const normalizeCreator = (
  payload: any,
  fallbackId: number,
): ExpenseCreator | null => {
  const data = normalizeEmployeePayload(payload);
  if (!data || typeof data !== "object") return null;

  const id = Number(data.id ?? data.employeeId ?? data.userId ?? fallbackId);
  const name = pickText(
    data.name,
    data.displayName,
    data.fullName,
    data.full_name,
    data.employeeName,
    data.employee_name,
    data.username,
  );
  const phone = pickText(
    data.phone,
    data.phoneNumber,
    data.phone_number,
    data.mobile,
  );
  const email = pickText(data.email);
  const department =
    data.department && typeof data.department === "object"
      ? {
          id: data.department.id,
          name: pickText(data.department.name, data.department.title),
        }
      : pickText(data.department, data.departmentName, data.department_name);
  const departmentName =
    typeof department === "string" ? department : department?.name;
  const roles = Array.isArray(data.roles)
    ? data.roles.map(String)
    : data.role
      ? [String(data.role)]
      : undefined;

  if (!name && !phone && !email && !departmentName) return null;

  return {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    name,
    phone,
    email,
    department,
    departmentName,
    roles,
  };
};

const getExistingCreator = (request: ExpenseRequest) =>
  request.creator ||
  (typeof request.createdBy === "object" ? request.createdBy : undefined);

const needsCreatorLookup = (request: ExpenseRequest) => {
  const id = creatorId(request);
  if (!id) return false;

  return (
    creatorName(request) === `#${id}` ||
    !creatorPhone(request) ||
    !creatorDepartment(request)
  );
};

const mergeCreator = (
  request: ExpenseRequest,
  resolvedCreator: ExpenseCreator,
): ExpenseRequest => {
  const existing = getExistingCreator(request);
  const id = creatorId(request) || resolvedCreator.id;

  return {
    ...request,
    creator: {
      id,
      name: existing?.name || resolvedCreator.name,
      phone: existing?.phone || resolvedCreator.phone,
      email: existing?.email || resolvedCreator.email,
      department: existing?.department || resolvedCreator.department,
      departmentName: existing?.departmentName || resolvedCreator.departmentName,
      roles: existing?.roles || resolvedCreator.roles,
    },
  };
};

export const enrichExpenseRequestsWithCreators = async (
  requests: ExpenseRequest[],
) => {
  const ids = Array.from(
    new Set(
      requests
        .filter(needsCreatorLookup)
        .map((request) => creatorId(request))
        .filter((id): id is number => Boolean(id)),
    ),
  );

  if (ids.length === 0) return requests;

  const entries = await Promise.all(
    ids.map(async (id) => {
      if (creatorCache.has(id)) {
        return [id, creatorCache.get(id) || null] as const;
      }

      try {
        const employee = await employeeApi.getById(id);
        const creator = normalizeCreator(employee, id);
        creatorCache.set(id, creator);
        return [id, creator] as const;
      } catch (error) {
        console.warn(`Không tải được thông tin người đề xuất #${id}`, error);
        creatorCache.set(id, null);
        return [id, null] as const;
      }
    }),
  );

  const creatorsById = new Map(
    entries.filter(
      (entry): entry is readonly [number, ExpenseCreator] =>
        entry[1] !== null,
    ),
  );

  if (creatorsById.size === 0) return requests;

  return requests.map((request) => {
    const id = creatorId(request);
    const creator = id ? creatorsById.get(id) : undefined;
    return creator ? mergeCreator(request, creator) : request;
  });
};

export const enrichExpenseRequestWithCreator = async (
  request: ExpenseRequest,
) => {
  const [enriched] = await enrichExpenseRequestsWithCreators([request]);
  return enriched || request;
};
