import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Building2, CalendarDays, Filter, MapPin, Pencil, Plus, Power, PowerOff, RefreshCw, Search, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import { policiesApi } from "@/service/policy";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";
import { schoolApi } from "@/service/school.api";
import { subjectApi, type Subject } from "@/service/subject.api";
import { getEmployeeId } from "@/utils/auth";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  schoolYearRolloverApi,
  type RolloverResult,
} from "@/service/schoolYearRollover.api";
import { DEFAULT_CHECKIN_RADIUS, mapsLinkOf, toLatLng } from "@/utils/geo";
import SubjectFormModal from "@/components/subject/SubjectFormModal";
import SearchableSelect from "@/components/SearchableSelect";
import FormCreate from "./FormCreate";
import { currentSchoolYear } from "@/pages/Teaching/lib";
import type {
  PolicyFilterOptions,
  PolicyPageItem,
  PolicyStatusValue,
} from "@/types/policy";

const PAGE_SIZE = 12;
type Tab = "policies" | "schools" | "subjects";
type SimpleOption = { value: string; label: string };
/** Trường trực thuộc nhân viên — đủ field cho thẻ danh sách và form chỉnh sửa. */
type ManagedSchool = {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  representative?: string;
  taxCode?: string;
  scale?: number | string | null;
  classCount?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  checkinRadius?: number | null;
  googleMapsUrl?: string | null;
  ward?: { id: number; name?: string; province?: { id: number; name?: string } } | null;
  /** 0 = đang hoạt động, 1 = đã ngưng (theo quy ước của backend). */
  status?: number | null;
};
/** Một chính sách của môn, theo `GET /policies/subject/:subjectId`. */
type SubjectPolicyRow = {
  id: number;
  status: PolicyStatusValue;
  createdAt: string;
  updatedAt?: string;
  note?: string | null;
  durationMonths?: number | null;
  data?: Record<string, unknown> | null;
};

const SCHOOL_ACTIVE = 0;
const SCHOOL_STOPPED = 1;
const emptySchoolForm = { name: "", address: "", representative: "", phone: "", taxCode: "", scale: "", classCount: "", regionId: "", wardId: "" };
const fallbackSchoolYears = () => {
  // Luôn có sẵn năm học đến 2028-2029 để tạo môn/chính sách cho năm tới,
  // kể cả khi hệ thống chưa có dữ liệu năm đó — không phụ thuộc đồng hồ máy chủ.
  const start = Math.max(new Date().getFullYear() + 2, 2028);
  return Array.from({ length: 12 }, (_, index) => {
    const year = start - index;
    return `${year}-${year + 1}`;
  });
};
/**
 * Sáu bộ lọc của tab "Tất cả chính sách" — khớp đúng query của `GET /policies/all`
 * (xem POLICY-ADMIN-LIST-API.md). URL query string là nguồn dữ liệu duy nhất:
 * không giữ state filter riêng để tránh lệch với URL khi back/forward/reload.
 */
const POLICY_FILTER_KEYS = [
  "status",
  "schoolId",
  "subjectId",
  "schoolYear",
  "fromDate",
  "toDate",
] as const;
type PolicyFilterKey = (typeof POLICY_FILTER_KEYS)[number];

const fallbackStatus: Record<PolicyStatusValue, string> = {
  DRAFT: "Nháp", PENDING: "Chờ duyệt", SALE_ADMIN_APPROVED: "SA đã kiểm",
  DIRECTOR_APPROVED: "Đã duyệt", REJECTED: "Từ chối",
};
const badgeClass: Record<PolicyStatusValue, string> = {
  DRAFT: "bg-slate-100 text-slate-600", PENDING: "bg-amber-100 text-amber-700",
  SALE_ADMIN_APPROVED: "bg-blue-100 text-blue-700", DIRECTOR_APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function PolicySelector() {
  const employeeId = Number(getEmployeeId());
  const [tab, setTab] = useState<Tab>("policies");
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PolicyPageItem[]>([]);
  const [options, setOptions] = useState<PolicyFilterOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regions, setRegions] = useState<SimpleOption[]>([]);
  const [wards, setWards] = useState<SimpleOption[]>([]);
  const [managementRegion, setManagementRegion] = useState("");
  const [managementWard, setManagementWard] = useState("");
  const [managementSchool, setManagementSchool] = useState("");
  const [managementYear, setManagementYear] = useState("");
  const [schools, setSchools] = useState<ManagedSchool[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [managementSearch, setManagementSearch] = useState("");
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [schoolSaving, setSchoolSaving] = useState(false);
  const [schoolForm, setSchoolForm] = useState(emptySchoolForm);
  const [editingSchool, setEditingSchool] = useState<ManagedSchool | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<number | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policySchool, setPolicySchool] = useState("");
  // Mặc định năm học hiện tại để tạo chính sách không phải chọn lại năm.
  const [policyYear, setPolicyYear] = useState(currentSchoolYear());
  const [policySubject, setPolicySubject] = useState("");
  const [policySchools, setPolicySchools] = useState<Array<{ id: number; name: string }>>([]);
  const [policySubjects, setPolicySubjects] = useState<Subject[]>([]);
  const [policyOptionsLoading, setPolicyOptionsLoading] = useState(false);
  const [policyRefresh, setPolicyRefresh] = useState(0);
  const [editingPolicy, setEditingPolicy] = useState<{
    id: number;
    subjectId: number;
    data: Record<string, unknown>;
  } | null>(null);
  const [openingPolicyId, setOpeningPolicyId] = useState<number | null>(null);
  const [schoolSubjects, setSchoolSubjects] = useState<{
    school: { id: number; name: string };
    subjects: Subject[];
    loading: boolean;
  } | null>(null);
  const [subjectPolicies, setSubjectPolicies] = useState<{
    subject: Subject;
    policies: SubjectPolicyRow[];
    loading: boolean;
  } | null>(null);

  // Tuỳ chọn cho 6 bộ lọc — tách loading/error riêng để lỗi tải option không
  // làm mất danh sách chính sách đang xem; `optionsReloadKey` cho nút "Thử lại".
  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    setOptionsError("");
    policiesApi.getFilterOptions()
      .then((response) => {
        if (!active) return;
        setOptions(response);
      })
      .catch((reason) => {
        console.error("Load policy filter options failed", reason);
        if (active) setOptionsError(getApiErrorMessage(reason, "Không tải được bộ lọc"));
      })
      .finally(() => active && setOptionsLoading(false));
    return () => { active = false; };
  }, [optionsReloadKey]);

  useEffect(() => {
    if (!employeeId) return;
    provinceApi.getProvincesByEmployee(employeeId)
      .then((rows: Array<{ id: number; provinceId?: number; name?: string; province?: { id?: number; name?: string } }>) => {
        setRegions(rows.map((row) => ({
          value: String(row.provinceId || row.province?.id || row.id),
          label: row.name || row.province?.name || "—",
        })));
      })
      .catch((reason) => console.error("Load management regions failed", reason));
  }, [employeeId]);

  useEffect(() => {
    setManagementWard("");
    setWards([]);
    if (!employeeId || !managementRegion) return;
    wardApi.getByEmployee(employeeId, Number(managementRegion))
      .then((rows: Array<{ id: number; name: string }>) =>
        setWards(rows.map((row) => ({ value: String(row.id), label: row.name }))),
      )
      .catch((reason) => console.error("Load management wards failed", reason));
  }, [employeeId, managementRegion]);

  const getEmployeeSchools = async () => {
    if (!employeeId) return [];

    // Lấy trực tiếp theo employeeId trên trường (school.employee), không phụ
    // thuộc vào việc ward có bản ghi employee_region hay không — tránh sót
    // trường khi khu vực chưa/không còn gắn qua employee_region.
    const response = await schoolApi.getByEmployee(employeeId);
    const employeeSchools = Array.isArray(response)
      ? response
      : response?.data || [];

    return employeeSchools as ManagedSchool[];
  };

  const loadSchools = async () => {
    if (!employeeId) {
      setSchools([]);
      return;
    }
    try {
      setSchools(await getEmployeeSchools());
    } catch (reason) {
      console.error("Load employee schools failed", reason);
      setSchools([]);
      toast.error("Không tải được danh sách trường trực thuộc");
    }
  };
  const openSchoolSubjects = async (school: { id: number; name: string }) => {
    setSchoolSubjects({ school, subjects: [], loading: true });
    try {
      const rows = await subjectApi.getBySchool(school.id);
      setSchoolSubjects({
        school,
        subjects: Array.isArray(rows) ? rows : rows?.data || [],
        loading: false,
      });
    } catch (reason) {
      console.error("Load subjects by school failed", reason);
      toast.error("Không tải được môn học của trường");
      setSchoolSubjects(null);
    }
  };

  /** Toàn bộ chính sách của một môn — mở từ thẻ môn ở tab Quản lý môn học. */
  const openSubjectPolicies = async (subject: Subject) => {
    setSubjectPolicies({ subject, policies: [], loading: true });
    try {
      const rows = await policiesApi.getBySubject(subject.id);
      setSubjectPolicies({
        subject,
        policies: Array.isArray(rows) ? rows : rows?.data || [],
        loading: false,
      });
    } catch (reason) {
      console.error("Load policies by subject failed", reason);
      toast.error(getApiErrorMessage(reason, "Không tải được chính sách của môn"));
      setSubjectPolicies(null);
    }
  };

  /**
   * Mở một chính sách để sửa. Danh sách đã kèm `data` nên không cần gọi lại
   * chi tiết; thiếu `data` (dữ liệu cũ) mới phải lấy thêm.
   */
  const openPolicyRow = async (subjectId: number, policy: SubjectPolicyRow) => {
    if (policy.data) {
      setEditingPolicy({ id: policy.id, subjectId, data: policy.data });
      setSubjectPolicies(null);
      return;
    }

    setOpeningPolicyId(policy.id);
    try {
      const response = await policiesApi.findOne(policy.id);
      const detail = (response as any)?.policy || response;
      if (!detail?.data) throw new Error("Policy detail is incomplete");
      setEditingPolicy({ id: policy.id, subjectId, data: detail.data });
      setSubjectPolicies(null);
    } catch (reason) {
      console.error("Load policy for editing failed", reason);
      toast.error(getApiErrorMessage(reason, "Không tải được dữ liệu chính sách"));
    } finally {
      setOpeningPolicyId(null);
    }
  };

  /** Nếu môn đã có chính sách thì mở bản đó; chỉ mở form tạo khi chưa tồn tại. */
  const createPolicyForSubject = async (subject: Subject) => {
    try {
      const response = await policiesApi.getBySubject(subject.id);
      const existingPolicy = (Array.isArray(response) ? response : response?.data || [])[0];
      if (existingPolicy) {
        toast("Môn học này đã có chính sách. Đang mở chính sách hiện có để chỉnh sửa.");
        await openPolicyRow(subject.id, existingPolicy);
        return;
      }

      setSubjectPolicies(null);
      setPolicySubject(String(subject.id));
      setShowPolicyForm(true);
    } catch (reason) {
      console.error("Check existing policy failed", reason);
      toast.error(getApiErrorMessage(reason, "Không kiểm tra được chính sách hiện có"));
    }
  };

  const loadSubjects = () => {
    subjectApi.getAll()
      .then((rows) => {
        const employeeSchoolIds = new Set(schools.map((school) => school.id));
        setSubjects(
          (Array.isArray(rows) ? rows : []).filter((subject) =>
            employeeSchoolIds.has(Number(subject.schoolId)),
          ),
        );
      })
      .catch((reason) => console.error("Load subjects failed", reason));
  };

  useEffect(() => {
    if (tab === "schools") void loadSchools();
    if (tab === "subjects") void loadSchools();
  }, [tab, employeeId]);

  // Từ khoá dùng chung cho hai tab quản lý → đổi tab thì xoá, tránh danh sách
  // trống vì còn dính từ khoá của tab trước.
  useEffect(() => {
    setManagementSearch("");
  }, [tab]);

  useEffect(() => {
    if (tab === "subjects" && schools.length > 0) loadSubjects();
    if (tab === "subjects" && schools.length === 0) setSubjects([]);
  }, [tab, schools]);

  const openSchoolCreate = () => {
    setEditingSchool(null);
    setSchoolForm(emptySchoolForm);
    setManagementRegion("");
    setShowSchoolForm(true);
  };

  /**
   * Mở form với dữ liệu trường hiện có. Khu vực/phường-xã chọn sẵn theo ward
   * của trường; wardId chỉ được gửi khi có giá trị nên trường thiếu ward vẫn
   * sửa được các thông tin khác mà không bị ghi đè địa bàn.
   */
  const openSchoolEdit = (school: ManagedSchool) => {
    setEditingSchool(school);
    setSchoolForm({
      name: school.name || "",
      address: school.address || "",
      representative: school.representative || "",
      phone: school.phone || "",
      taxCode: school.taxCode || "",
      scale: school.scale == null ? "" : String(school.scale),
      classCount: school.classCount == null ? "" : String(school.classCount),
      regionId: school.ward?.province?.id ? String(school.ward.province.id) : "",
      wardId: school.ward?.id ? String(school.ward.id) : "",
    });
    // Nạp danh sách phường/xã của khu vực đang gắn để select hiện đúng tên.
    setManagementRegion(school.ward?.province?.id ? String(school.ward.province.id) : "");
    setShowSchoolForm(true);
  };

  const closeSchoolForm = () => {
    setShowSchoolForm(false);
    setEditingSchool(null);
    setSchoolForm(emptySchoolForm);
  };

  const saveSchool = async () => {
    if (!schoolForm.name.trim()) {
      toast.error("Vui lòng nhập tên trường");
      return;
    }
    if (!editingSchool && !schoolForm.wardId) {
      toast.error("Vui lòng chọn phường/xã");
      return;
    }
    setSchoolSaving(true);
    const payload = {
      name: schoolForm.name.trim(), address: schoolForm.address.trim(),
      representative: schoolForm.representative.trim(), phone: schoolForm.phone.trim(),
      taxCode: schoolForm.taxCode.trim(), scale: Number(schoolForm.scale) || 0,
      classCount: Number(schoolForm.classCount) || 0,
    };
    try {
      if (editingSchool) {
        await schoolApi.update(editingSchool.id, {
          ...payload,
          ...(schoolForm.wardId && { wardId: Number(schoolForm.wardId) }),
        });
        toast.success("Đã cập nhật trường");
      } else {
        await schoolApi.create({
          ...payload,
          employeeId,
          wardId: Number(schoolForm.wardId),
        });
        toast.success("Đã tạo trường");
      }
      closeSchoolForm();
      void loadSchools();
      policiesApi.getFilterOptions().then(setOptions);
    } catch (reason: any) {
      toast.error(
        reason?.response?.data?.message ||
          (editingSchool ? "Không thể cập nhật trường" : "Không thể tạo trường"),
      );
    } finally {
      setSchoolSaving(false);
    }
  };

  /** Ngưng / kích hoạt lại trường — không xoá dữ liệu, chỉ đổi status. */
  const toggleSchoolStatus = async (school: ManagedSchool) => {
    const stopped = Number(school.status) === SCHOOL_STOPPED;
    const nextStatus = stopped ? SCHOOL_ACTIVE : SCHOOL_STOPPED;
    const confirmMessage = stopped
      ? `Kích hoạt lại trường "${school.name}"?`
      : `Ngưng hoạt động trường "${school.name}"?`;
    if (!window.confirm(confirmMessage)) return;

    setStatusSavingId(school.id);
    try {
      await schoolApi.updateStatus(school.id, nextStatus);
      toast.success(stopped ? "Đã kích hoạt lại trường" : "Đã ngưng hoạt động trường");
      void loadSchools();
    } catch (reason: any) {
      toast.error(
        reason?.response?.data?.message || "Không thể cập nhật trạng thái trường",
      );
    } finally {
      setStatusSavingId(null);
    }
  };

  /**
   * Xoá môn học. Backend để Policy.subject ở onDelete CASCADE nên xoá môn là
   * xoá luôn toàn bộ chính sách của môn — phải xác nhận lại lần hai khi môn
   * đang có chính sách.
   */
  const deleteSubject = async (subject: Subject) => {
    const label = `${subject.name}${subject.schoolYear ? ` (${subject.schoolYear})` : ""}`;
    if (!window.confirm(`Xoá môn "${label}" của ${subject.school?.name || "trường #" + subject.schoolId}?`)) return;

    // policyCount == null: API chưa trả số chính sách → cảnh báo chung, không
    // được im lặng bỏ qua vì xoá môn vẫn cascade xoá chính sách.
    const warning =
      subject.policyCount == null
        ? "Nếu môn này đang có chính sách thì các chính sách đó cũng bị xoá và không thể hoàn tác. Vẫn xoá?"
        : subject.policyCount > 0
          ? `Môn này đang có ${subject.policyCount} chính sách. Xoá môn sẽ xoá luôn ${subject.policyCount} chính sách đó và không thể hoàn tác. Vẫn xoá?`
          : "";
    if (warning && !window.confirm(warning)) return;

    setDeletingSubjectId(subject.id);
    try {
      await subjectApi.remove(subject.id);
      toast.success("Đã xoá môn học");
      loadSubjects();
      // Chính sách của môn bị xoá theo → làm mới danh sách và bộ lọc.
      setPolicyRefresh((value) => value + 1);
      policiesApi.getFilterOptions().then(setOptions);
      // Popup "Danh sách môn của trường" đang mở đúng trường này thì cũng làm mới.
      setSchoolSubjects((current) =>
        current && current.school.id === subject.schoolId
          ? { ...current, subjects: current.subjects.filter((item) => item.id !== subject.id) }
          : current,
      );
    } catch (reason: any) {
      toast.error(reason?.response?.data?.message || "Không thể xoá môn học");
    } finally {
      setDeletingSubjectId(null);
    }
  };

  /**
   * URL query string là nguồn dữ liệu duy nhất cho 6 bộ lọc + trang — không có
   * state filter riêng nên không thể lệch nhau, và reload/back/forward tự
   * khôi phục đúng bộ lọc đang xem.
   */
  const filters = useMemo(
    () => ({
      status: searchParams.get("status") || "",
      schoolId: searchParams.get("schoolId") || "",
      subjectId: searchParams.get("subjectId") || "",
      schoolYear: searchParams.get("schoolYear") || "",
      fromDate: searchParams.get("fromDate") || "",
      toDate: searchParams.get("toDate") || "",
    }),
    [searchParams],
  );
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page")) || 1));

  const dateRangeError =
    filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
      ? "Từ ngày không được lớn hơn Đến ngày"
      : "";

  const updateFilter = (key: PolicyFilterKey, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      // Đổi filter thì luôn về trang 1.
      next.delete("page");
      return next;
    });
  };

  const clearPolicyFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      [...POLICY_FILTER_KEYS, "page"].forEach((key) => next.delete(key));
      return next;
    });
  };

  const setPolicyPage = (updater: number | ((current: number) => number)) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const currentPage = Math.max(1, Number(prev.get("page")) || 1);
      const nextPage =
        typeof updater === "function" ? updater(currentPage) : updater;
      if (nextPage > 1) next.set("page", String(nextPage));
      else next.delete("page");
      return next;
    });
  };

  // Debounce 350ms gộp các lần đổi filter liên tiếp thành một request; `active`
  // bỏ qua response cũ nếu vẫn lỡ chạy chồng lên request mới hơn.
  useEffect(() => {
    if (dateRangeError) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      policiesApi
        .getAll({
          page,
          limit: PAGE_SIZE,
          status: filters.status || undefined,
          schoolId: filters.schoolId ? Number(filters.schoolId) : undefined,
          subjectId: filters.subjectId ? Number(filters.subjectId) : undefined,
          schoolYear: filters.schoolYear || undefined,
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        })
        .then((response) => {
          if (!active) return;
          setItems(response.data);
          setPagination({
            total: response.pagination.total,
            totalPages: response.pagination.totalPages,
          });
        })
        .catch((reason) => {
          console.error("Load policies failed", reason);
          // Lỗi 400 (vd chặn ở dateRangeError trước khi tới đây, nhưng backend
          // vẫn có thể trả 400 vì lý do khác) hiện nguyên văn, không xoá bộ lọc.
          if (active) {
            setError(getApiErrorMessage(reason, "Không tải được danh sách chính sách"));
          }
        })
        .finally(() => active && setLoading(false));
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    page,
    filters.status,
    filters.schoolId,
    filters.subjectId,
    filters.schoolYear,
    filters.fromDate,
    filters.toDate,
    policyRefresh,
    dateRangeError,
  ]);

  const statusLabels = new Map(
    (options?.statuses || []).map((item) => [item.value, item.label]),
  );
  const activeFilters = Object.values(filters).filter(Boolean).length;

  // Nếu chọn trường, lấy danh sách môn của trường đó; nếu không chọn thì dùng toàn bộ danh sách
  const policyFilterSubjects = useMemo(() => {
    if (!filters.schoolId) {
      // Deduplication: chỉ giữ môn đầu tiên nếu có trùng lặp (theo name)
      const seen = new Map<string, boolean>();
      return (options?.subjects || []).filter((subject) => {
        if (seen.has(subject.name)) return false;
        seen.set(subject.name, true);
        return true;
      });
    }

    // Nếu chọn trường, hiển thị môn toàn bộ (vì API subjects không kèm schoolId,
    // nên không thể filter ở đây — giao diện sẽ vẫn hiển thị toàn bộ môn)
    return options?.subjects || [];
  }, [options?.subjects, filters.schoolId]);
  // Gộp năm học thực tế từ backend với dải năm mặc định (đến 2028-2029) —
  // trước đây chỉ dùng backend khi có dữ liệu nên bị mất các năm tương lai
  // chưa phát sinh môn học nào.
  const managementYears = Array.from(
    new Set([...(options?.schoolYears || []), ...fallbackSchoolYears()]),
  ).sort((a, b) => b.localeCompare(a));
  const policyYears = Array.from(
    new Set(
      [
        ...policySubjects
          .map((subject) => subject.schoolYear)
          .filter((year): year is string => Boolean(year)),
        ...(options?.schoolYears || []),
        ...fallbackSchoolYears(),
      ],
    ),
  ).sort((a, b) => b.localeCompare(a));
  const policySubjectsByYear = policySubjects.filter(
    (subject) => !policyYear || subject.schoolYear === policyYear,
  );

  const managementKeyword = managementSearch.trim().toLocaleLowerCase("vi");
  const matchKeyword = (...fields: Array<string | undefined | null>) =>
    !managementKeyword ||
    fields.some((field) =>
      field?.toLocaleLowerCase("vi").includes(managementKeyword),
    );

  const filteredSchools = schools.filter((school) =>
    matchKeyword(school.name, school.address, school.phone, school.taxCode),
  );

  /**
   * Bộ lọc của tab môn học: trường + năm học + từ khoá. Hai select này cũng là
   * giá trị mặc định khi bấm "Tạo môn" nên lọc xong tạo môn là đúng trường/năm
   * đang xem.
   */
  const filteredSubjects = subjects.filter((subject) => {
    if (managementSchool && String(subject.schoolId) !== managementSchool) return false;
    if (managementYear && subject.schoolYear !== managementYear) return false;
    return matchKeyword(
      subject.name,
      subject.school?.name,
      subject.code,
      subject.contractNumber,
    );
  });

  const subjectFilterCount =
    (managementSchool ? 1 : 0) + (managementYear ? 1 : 0) + (managementKeyword ? 1 : 0);

  const clearSubjectFilters = () => {
    setManagementSchool("");
    setManagementYear("");
    setManagementSearch("");
  };

  const openPolicyForm = async () => {
    setPolicySchool("");
    setPolicyYear("");
    setPolicySubject("");
    setPolicySchools([]);
    setPolicySubjects([]);
    setShowPolicyForm(true);

    if (!employeeId) {
      toast.error("Không xác định được nhân viên đăng nhập");
      return;
    }

    setPolicyOptionsLoading(true);
    try {
      setPolicySchools(await getEmployeeSchools());
    } catch (reason) {
      console.error("Load schools by employee failed", reason);
      toast.error("Không tải được danh sách trường được phân cho bạn");
    } finally {
      setPolicyOptionsLoading(false);
    }
  };

  const changePolicySchool = async (schoolId: string) => {
    setPolicySchool(schoolId);
    setPolicyYear("");
    setPolicySubject("");
    setPolicySubjects([]);

    if (!schoolId) return;
    setPolicyOptionsLoading(true);
    try {
      const rows = await subjectApi.getBySchool(Number(schoolId));
      setPolicySubjects(Array.isArray(rows) ? rows : rows?.data || []);
    } catch (reason) {
      console.error("Load subjects by school failed", reason);
      toast.error("Không tải được năm học và môn học của trường");
    } finally {
      setPolicyOptionsLoading(false);
    }
  };

  /**
   * Chọn xong Trường → Năm học → Môn học thì kiểm tra ngay môn đã có chính
   * sách chưa, thay vì đợi đến lúc bấm lưu mới báo — chọn xong là biết sẽ vào
   * form tạo mới hay form sửa. Có rồi thì mở luôn bản đó để sửa; chưa có mới
   * giữ nguyên picker để FormCreate hiện form tạo mới.
   */
  const selectPolicySubject = async (subjectId: string) => {
    setPolicySubject(subjectId);
    if (!subjectId) return;

    try {
      const response = await policiesApi.getBySubject(Number(subjectId));
      const existingPolicy = (Array.isArray(response) ? response : response?.data || [])[0];
      if (existingPolicy) {
        toast("Môn học này đã có chính sách. Đang mở chính sách hiện có để chỉnh sửa.");
        setShowPolicyForm(false);
        await openPolicyRow(Number(subjectId), existingPolicy);
      }
    } catch (reason) {
      console.error("Check existing policy failed", reason);
      toast.error(getApiErrorMessage(reason, "Không kiểm tra được chính sách hiện có"));
    }
  };

  const openPolicyForEdit = async (item: PolicyPageItem) => {
    if (openingPolicyId) return;

    setOpeningPolicyId(item.policyId);
    try {
      const response = await policiesApi.findOne(item.policyId);
      const detail = (response as any)?.policy || response;
      const subjectId = Number(detail?.subjectId || item.subjectId);

      if (!subjectId || !detail?.data) {
        throw new Error("Policy detail is incomplete");
      }

      setEditingPolicy({
        id: item.policyId,
        subjectId,
        data: detail.data,
      });
    } catch (reason: any) {
      console.error("Load policy for editing failed", reason);
      toast.error(
        reason?.response?.data?.message ||
          "Không tải được dữ liệu chính sách để chỉnh sửa",
      );
    } finally {
      setOpeningPolicyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      <HeaderWithBack title="Chính sách" />
      <main className="mx-auto max-w-7xl px-4 pt-20">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Chính sách kinh doanh</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Toàn bộ chính sách</h1>
          <p className="mt-1 text-sm text-slate-500">Tìm kiếm và lọc theo dữ liệu chính thức từ hệ thống.</p>
        </div>

        <nav className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <TabButton active={tab === "policies"} onClick={() => setTab("policies")} icon={<Filter size={15} />} label="Tất cả chính sách" />
          <TabButton active={tab === "schools"} onClick={() => setTab("schools")} icon={<Building2 size={15} />} label="Quản lý trường" />
          <TabButton active={tab === "subjects"} onClick={() => setTab("subjects")} icon={<BookOpen size={15} />} label="Quản lý môn học" />
        </nav>

        {tab === "schools" && (
          <DirectManagement title="Tất cả trường" icon={<Building2 size={22} />} search={managementSearch} onSearch={setManagementSearch} onCreate={openSchoolCreate} createLabel="Tạo trường" searchPlaceholder="Tìm trường, địa chỉ, SĐT, MST...">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredSchools.map((school) => {
                const stopped = Number(school.status) === SCHOOL_STOPPED;
                const point = toLatLng(school);
                const hasLocation = !!point;

                return (
                  <div
                    key={school.id}
                    className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition ${stopped ? "opacity-70" : "hover:border-blue-200 hover:shadow-md"}`}
                  >
                    <button type="button" onClick={() => void openSchoolSubjects(school)} className="flex-1 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-900">{school.name}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${stopped ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                          {stopped ? "Đã ngưng" : "Đang hoạt động"}
                        </span>
                      </div>
                      <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                        <MapPin size={12} className="mt-[2px] shrink-0" />
                        <span>{school.address || "—"}</span>
                      </p>

                      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-2 text-xs">
                        <InfoField label="Mã trường" value={`#${school.id}`} />
                        <InfoField label="Người đại diện" value={school.representative} />
                        <InfoField label="Số điện thoại" value={school.phone} />
                        <InfoField label="Mã số thuế" value={school.taxCode} />
                        <InfoField label="Quy mô học sinh" value={formatCount(school.scale)} />
                        <InfoField label="Số lớp" value={formatCount(school.classCount)} />
                        <InfoField label="Phường/Xã" value={school.ward?.name} />
                        <InfoField label="Khu vực" value={school.ward?.province?.name} />
                      </dl>
                    </button>

                    <div className="mt-2 border-t border-slate-100 pt-2 text-[11px]">
                      {hasLocation ? (
                        <>
                          <span className={`rounded-full px-2 py-[2px] font-bold ${school.googleMapsUrl ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {school.googleMapsUrl ? "Đã đặt vị trí" : "Chưa có link Maps"}
                          </span>
                          <span className="text-slate-500">
                            {" "}· bán kính check-in {school.checkinRadius || DEFAULT_CHECKIN_RADIUS}m
                          </span>
                          <p className="mt-1 text-slate-500">
                            Toạ độ: {point.latitude}, {point.longitude}{" "}
                            <a
                              href={mapsLinkOf(school.googleMapsUrl, point)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              Xem trên Maps
                            </a>
                          </p>
                        </>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-[2px] font-bold text-amber-700">
                          Chưa đặt vị trí check-in
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openSchoolEdit(school)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-amber-50 py-2 text-xs font-bold text-amber-700 transition active:scale-95"
                      >
                        <Pencil size={13} />Sửa thông tin
                      </button>
                      <button
                        type="button"
                        disabled={statusSavingId === school.id}
                        onClick={() => void toggleSchoolStatus(school)}
                        className={`inline-flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50 ${stopped ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
                      >
                        {stopped ? <Power size={13} /> : <PowerOff size={13} />}
                        {statusSavingId === school.id ? "Đang lưu..." : stopped ? "Kích hoạt lại" : "Ngưng hoạt động"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DirectManagement>
        )}

        {tab === "subjects" && (
          <DirectManagement title="Tất cả môn học" icon={<BookOpen size={22} />} search={managementSearch} onSearch={setManagementSearch} onCreate={() => setShowSubjectForm(true)} createLabel="Tạo môn" searchPlaceholder="Tìm môn học, trường, mã môn, số HĐ...">
            <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Trường"
                  value={managementSchool}
                  options={schools.map((item) => ({ value: String(item.id), label: item.name }))}
                  onChange={setManagementSchool}
                />
                <Select
                  label="Năm học"
                  value={managementYear}
                  options={managementYears.map((year) => ({ value: year, label: year }))}
                  onChange={setManagementYear}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {filteredSubjects.length}/{subjects.length} môn học
                </span>
                {subjectFilterCount > 0 && (
                  <button type="button" onClick={clearSubjectFilters} className="font-bold text-blue-600">
                    Xoá bộ lọc ({subjectFilterCount})
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Trường và năm học đang lọc cũng là giá trị mặc định khi bấm "Tạo môn".
              </p>
            </div>
            {filteredSubjects.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
                <BookOpen className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  {subjects.length === 0
                    ? "Các trường của bạn chưa có môn học nào"
                    : "Không có môn học nào khớp bộ lọc"}
                </p>
                {subjectFilterCount > 0 && subjects.length > 0 && (
                  <button type="button" onClick={clearSubjectFilters} className="mt-2 text-xs font-bold text-blue-600">
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredSubjects.map((subject) => {
                const policyCount = subject.policyCount || 0;

                return (
                  <div key={subject.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-md">
                    <button
                      type="button"
                      onClick={() => void openSubjectPolicies(subject)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-900">{subject.name}</p>
                        {subject.schoolYear && (
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                            {subject.schoolYear}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                        <Building2 size={12} className="mt-[2px] shrink-0" />
                        <span>{subject.school?.name || `Trường #${subject.schoolId}`}</span>
                      </p>

                      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-2 text-xs">
                        <InfoField label="Mã môn" value={subject.code} />
                        <InfoField label="Danh mục môn" value={subject.catalog?.name || (subject.catalogId ? undefined : "Chưa map danh mục")} />
                        <InfoField label="Số học sinh" value={formatCount(subject.studentCount)} />
                        <InfoField label="Số lớp" value={formatCount(subject.classCount)} />
                        <InfoField label="Tổng số tiết" value={formatCount(subject.totalLessons)} />
                        <InfoField label="Thời hạn HĐ" value={subject.contractDuration ? `${subject.contractDuration} tháng` : ""} />
                        <InfoField label="Thời hạn PL" value={subject.appendixDuration ? `${subject.appendixDuration} tháng` : ""} />
                        <InfoField label="Ngày khai giảng" value={formatDateValue(subject.startDate)} />
                        <InfoField label="Số hợp đồng" value={subject.contractNumber} />
                        <InfoField label="Số chính sách" value={formatCount(policyCount)} />
                        <InfoField label="Ngày tạo" value={formatDateValue(subject.createdAt)} />
                      </dl>

                      <p className="mt-2 text-[11px] font-bold text-blue-600">
                        Chọn để xem {policyCount > 0 ? `${policyCount} ` : ""}chính sách của môn
                      </p>
                    </button>

                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingSubject(subject)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-amber-50 py-2 text-xs font-bold text-amber-700 transition active:scale-95"
                      >
                        <Pencil size={13} />Sửa môn
                      </button>
                      <button
                        type="button"
                        disabled={deletingSubjectId === subject.id}
                        onClick={() => void deleteSubject(subject)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-50 py-2 text-xs font-bold text-red-600 transition active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {deletingSubjectId === subject.id ? "Đang xoá..." : "Xoá môn"}
                      </button>
                    </div>

                    {policyCount > 0 && (
                      <p className="mt-2 text-[11px] text-amber-700">
                        Xoá môn sẽ xoá luôn {policyCount} chính sách của môn.
                      </p>
                    )}

                  </div>
                );
              })}
            </div>
          </DirectManagement>
        )}

        {tab === "policies" && <><div className="mb-3 flex justify-end"><button type="button" onClick={() => void openPolicyForm()} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm"><Plus size={16} />Tạo chính sách</button></div><section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {optionsError && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span>{optionsError}</span>
              <button
                type="button"
                onClick={() => setOptionsReloadKey((value) => value + 1)}
                className="inline-flex shrink-0 items-center gap-1 font-bold"
              >
                <RefreshCw size={12} />Thử lại
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            <Select label="Trạng thái" value={filters.status} options={(options?.statuses || []).map(x => ({ value: x.value, label: x.label }))} onChange={v => updateFilter("status", v)} disabled={optionsLoading} />
            <div className="text-[11px] font-semibold text-slate-500">
              Trường
              <SearchableSelect
                value={filters.schoolId}
                onChange={v => updateFilter("schoolId", v)}
                options={options?.schools || []}
                placeholder="Tất cả"
                searchPlaceholder="Tìm trường…"
                disabled={optionsLoading}
                className="mt-1"
              />
            </div>
            <Select label="Môn học" value={filters.subjectId} options={policyFilterSubjects.map(x => ({ value: String(x.id), label: x.name }))} onChange={v => updateFilter("subjectId", v)} disabled={optionsLoading} />
            <Select label="Năm học" value={filters.schoolYear} options={(options?.schoolYears || []).map(x => ({ value: x, label: x }))} onChange={v => updateFilter("schoolYear", v)} disabled={optionsLoading} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:w-1/2 sm:pr-1">
            <label className="text-[11px] font-semibold text-slate-500">
              Từ ngày
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => updateFilter("fromDate", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal text-slate-700"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Đến ngày
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => updateFilter("toDate", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal text-slate-700"
              />
            </label>
          </div>
          {dateRangeError && (
            <p className="mt-1 text-[11px] font-semibold text-red-600">{dateRangeError}</p>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{pagination.total} chính sách</span>
            {activeFilters > 0 && <button onClick={clearPolicyFilters} className="font-bold text-blue-600">Xóa bộ lọc</button>}
          </div>
        </section>

        {loading && <div className="py-16 text-center text-sm text-slate-500">Đang tải chính sách...</div>}
        {!loading && error && <div className="rounded-2xl bg-red-50 p-6 text-center text-sm text-red-600">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white py-16 text-center">
            <Filter className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              {activeFilters > 0
                ? "Không có chính sách phù hợp với bộ lọc."
                : "Không có chính sách phù hợp"}
            </p>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.policyId}
                type="button"
                disabled={openingPolicyId !== null}
                onClick={() => void openPolicyForEdit(item)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md disabled:cursor-wait disabled:opacity-70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-bold text-slate-900">{item.schoolName || "—"}</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-blue-700"><BookOpen size={14} />{item.subjectName || "—"}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass[item.policyStatus]}`}>{statusLabels.get(item.policyStatus) || fallbackStatus[item.policyStatus]}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><CalendarDays size={13} />{item.schoolYear ?? "—"}</span>
                  <span className="flex items-center gap-1"><Building2 size={13} />{item.employeeName ?? "—"}</span>
                  <span className="col-span-2">Ngày tạo: {formatVietnamDate(item.policyCreatedAt)}</span>
                  <span className="col-span-2 font-semibold text-blue-600">
                    {openingPolicyId === item.policyId
                      ? "Đang mở chính sách..."
                      : "Chọn để chỉnh sửa"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && pagination.totalPages > 0 && <div className="mt-4 flex items-center justify-center gap-3"><button disabled={page <= 1} onClick={() => setPolicyPage(p => p - 1)} className="rounded-xl border bg-white px-4 py-2 text-sm disabled:opacity-40">Trước</button><span className="text-sm text-slate-600">{page}/{pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => setPolicyPage(p => p + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm disabled:opacity-40">Sau</button></div>}</>}
      </main>
      {showSchoolForm && <SchoolFormModal form={schoolForm} setForm={setSchoolForm} regions={regions} wards={wards} editing={!!editingSchool} setRegion={(value) => { setSchoolForm((current) => ({ ...current, regionId: value, wardId: "" })); setManagementRegion(value); }} onClose={closeSchoolForm} onSave={saveSchool} saving={schoolSaving} />}
      {subjectPolicies && (
        <SubjectPoliciesModal
          state={subjectPolicies}
          openingPolicyId={openingPolicyId}
          onClose={() => setSubjectPolicies(null)}
          onOpenPolicy={(policy) =>
            void openPolicyRow(subjectPolicies.subject.id, policy)
          }
          onCreatePolicy={() => void createPolicyForSubject(subjectPolicies.subject)}
          statusLabels={statusLabels}
        />
      )}
      {schoolSubjects && (
        <SchoolSubjectsModal
          state={schoolSubjects}
          years={managementYears}
          onClose={() => setSchoolSubjects(null)}
          onApplied={() => {
            // Môn năm mới + chính sách nháp vừa được tạo → làm mới cả popup,
            // tab môn học và danh sách chính sách.
            void openSchoolSubjects(schoolSubjects.school);
            loadSubjects();
            setPolicyRefresh((value) => value + 1);
            policiesApi.getFilterOptions().then(setOptions);
          }}
          onOpenPolicies={(subject) => {
            // Chuyển sang popup chính sách của môn — đóng popup này để tránh
            // hai popup cùng z-index chồng nhau, popup sau (trường) đè lên trước.
            setSchoolSubjects(null);
            void openSubjectPolicies(subject);
          }}
          onEditSubject={setEditingSubject}
          onDeleteSubject={(subject) => void deleteSubject(subject)}
          deletingSubjectId={deletingSubjectId}
        />
      )}
      {(showSubjectForm || editingSubject) && (
        <SubjectFormModal
          schoolId={
            editingSubject
              ? editingSubject.schoolId
              : managementSchool
                ? Number(managementSchool)
                : undefined
          }
          schoolYear={(editingSubject ? editingSubject.schoolYear : managementYear) || undefined}
          schools={schools}
          subject={editingSubject}
          onClose={() => { setShowSubjectForm(false); setEditingSubject(null); }}
          onSaved={() => {
            setShowSubjectForm(false);
            setEditingSubject(null);
            loadSubjects();
            // Sửa môn có thể đổi môn/số liệu đang hiện trên danh sách chính sách.
            setPolicyRefresh((value) => value + 1);
            policiesApi.getFilterOptions().then(setOptions);
            // Popup "Danh sách môn của trường" đang mở đúng trường này thì tải lại.
            if (schoolSubjects) void openSchoolSubjects(schoolSubjects.school);
          }}
        />
      )}
      {showPolicyForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4">
            <FormCreate
              setShowModal={(open: boolean) => {
                setShowPolicyForm(open);
                if (!open) setPolicyRefresh((value) => value + 1);
              }}
              subjectId={policySubject ? Number(policySubject) : undefined}
              setPolicy={() => undefined}
              picker={{
                schools: policySchools.map((school) => ({ value: String(school.id), label: school.name })),
                schoolId: policySchool,
                onSchoolChange: (value) => void changePolicySchool(value),
                years: policyYears.map((year) => ({ value: year, label: year })),
                schoolYear: policyYear,
                onYearChange: (value) => { setPolicyYear(value); setPolicySubject(""); },
                subjects: policySubjectsByYear.map((subject) => ({ value: String(subject.id), label: subject.name })),
                subjectId: policySubject,
                onSubjectChange: (value) => void selectPolicySubject(value),
                loading: policyOptionsLoading,
              }}
              onExistingPolicy={(policy, subjectId) => {
                setShowPolicyForm(false);
                return openPolicyRow(subjectId, policy);
              }}
            />
          </div>
        </div>
      )}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4">
            <FormCreate
              setShowModal={(open: boolean) => {
                if (!open) {
                  setEditingPolicy(null);
                  setPolicyRefresh((value) => value + 1);
                }
              }}
              subjectId={editingPolicy.subjectId}
              setPolicy={() => undefined}
              defaultData={editingPolicy.data}
              id={editingPolicy.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const formatVietnamDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

function Select({ label, value, options, onChange, disabled = false, placeholder = "Tất cả" }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean; placeholder?: string }) {
  return <label className="text-[11px] font-semibold text-slate-500">{label}<SearchableSelect value={value} disabled={disabled} onChange={onChange} options={options.map(option => ({ id: option.value, name: option.label }))} placeholder={placeholder} searchPlaceholder={`Tìm ${label.toLocaleLowerCase("vi-VN")}…`} className="mt-1 font-normal" /></label>;
}

/** Ngày dạng "YYYY-MM-DD" hoặc ISO → dd/mm/yyyy; rỗng thì để thẻ hiện "—". */
const formatDateValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatVietnamDate(value);
};

/** Số 0 là dữ liệu thật, chỉ null/undefined mới coi là chưa có. */
const formatCount = (value?: number | string | null) =>
  value == null || value === "" ? "" : Number(value).toLocaleString("vi-VN");

/** Một dòng "nhãn — giá trị" trong bảng thông tin của thẻ trường / môn học. */
function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>{icon}<span>{label}</span></button>;
}

function DirectManagement({ title, icon, search, onSearch, onCreate, createLabel, searchPlaceholder = "Tìm kiếm...", children }: { title: string; icon: ReactNode; search: string; onSearch: (value: string) => void; onCreate: () => void; createLabel: string; searchPlaceholder?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900">{icon}<h2 className="text-lg font-bold">{title}</h2></div>
        <button onClick={onCreate} className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Plus size={15} />{createLabel}</button>
      </div>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-9 text-sm" />
        {search && (
          <button onClick={() => onSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400">
            <X size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function SchoolFormModal({ form, setForm, regions, wards, setRegion, onClose, onSave, saving, editing }: any) {
  const field = (key: string, label: string) => (
    <label className="text-xs font-semibold text-slate-500">
      {label}
      <input
        value={form[key]}
        onChange={(e) => setForm((current: any) => ({ ...current, [key]: e.target.value }))}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-2xl rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex justify-between">
          <div>
            <h2 className="text-lg font-bold">{editing ? "Sửa thông tin trường" : "Tạo trường"}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {editing
                ? "Đổi khu vực / phường-xã nếu muốn chuyển trường sang địa bàn khác."
                : "Chọn khu vực và phường/xã trước khi nhập thông tin trường."}
            </p>
          </div>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          <Select
            label={editing ? "Khu vực" : "Khu vực *"}
            value={form.regionId}
            options={regions}
            onChange={setRegion}
            placeholder="Chọn khu vực"
          />
          <Select
            label={editing ? "Phường/Xã" : "Phường/Xã *"}
            value={form.wardId}
            options={wards}
            disabled={!form.regionId}
            placeholder={form.regionId ? "Chọn phường/xã" : "Chọn khu vực trước"}
            onChange={(value) => setForm((current: any) => ({ ...current, wardId: value }))}
          />
          {field("name", "Tên trường *")}
          {field("address", "Địa chỉ")}
          {field("representative", "Người đại diện")}
          {field("phone", "Số điện thoại")}
          {field("taxCode", "Mã số thuế")}
          {field("scale", "Quy mô học sinh")}
          {field("classCount", "Số lớp")}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5">Hủy</button>
          <button
            disabled={saving}
            onClick={onSave}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo trường"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "2025-2026" → "2026-2027"; không đọc được thì trả về rỗng. */
const nextSchoolYear = (year?: string) => {
  const start = Number(year?.match(/^(\d{4})/)?.[1]);
  return Number.isFinite(start) ? `${start + 1}-${start + 2}` : "";
};

/** Toàn bộ chính sách của một môn học. */
function SubjectPoliciesModal({
  state,
  openingPolicyId,
  onClose,
  onOpenPolicy,
  onCreatePolicy,
  statusLabels,
}: {
  state: { subject: Subject; policies: SubjectPolicyRow[]; loading: boolean };
  openingPolicyId: number | null;
  onClose: () => void;
  onOpenPolicy: (policy: SubjectPolicyRow) => void;
  onCreatePolicy: () => void;
  statusLabels: Map<PolicyStatusValue, string>;
}) {
  const { subject, policies, loading } = state;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{subject.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {subject.school?.name || `Trường #${subject.schoolId}`}
              {subject.schoolYear ? ` · Năm học ${subject.schoolYear}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100">✕</button>
        </div>

        <button
          type="button"
          onClick={onCreatePolicy}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white"
        >
          <Plus size={15} />Tạo chính sách mới cho môn này
        </button>

        {loading && <div className="py-10 text-center text-sm text-slate-500">Đang tải chính sách...</div>}

        {!loading && policies.length === 0 && (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-slate-500">
            Môn này chưa có chính sách nào
          </div>
        )}

        {!loading && policies.length > 0 && (
          <>
            <p className="mb-2 text-xs text-slate-500">{policies.length} chính sách</p>
            <div className="space-y-2">
              {policies.map((policy) => {
                const fee = Number(policy.data?.fee ?? 0);
                const profitPerHS = Number(policy.data?.companyProfitPerHS ?? 0);
                const months = policy.durationMonths || Number(policy.data?.durationMonths ?? 0);

                return (
                  <button
                    key={policy.id}
                    type="button"
                    disabled={openingPolicyId !== null}
                    onClick={() => onOpenPolicy(policy)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:shadow-sm disabled:cursor-wait disabled:opacity-70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">Chính sách #{policy.id}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass[policy.status]}`}>
                        {statusLabels.get(policy.status) || fallbackStatus[policy.status]}
                      </span>
                    </div>

                    <dl className="mt-2 space-y-1 text-xs">
                      <InfoField label="Học phí" value={fee > 0 ? `${fee.toLocaleString("vi-VN")} đ` : ""} />
                      <InfoField label="LN công ty / HS" value={profitPerHS > 0 ? `${Math.round(profitPerHS).toLocaleString("vi-VN")} đ` : ""} />
                      <InfoField label="Số tháng" value={months > 0 ? `${months} tháng` : ""} />
                      <InfoField label="Ngày tạo" value={formatDateValue(policy.createdAt)} />
                      <InfoField label="Cập nhật" value={formatDateValue(policy.updatedAt)} />
                    </dl>

                    {policy.note && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                        Ghi chú: {policy.note}
                      </p>
                    )}

                    <p className="mt-2 text-[11px] font-bold text-blue-600">
                      {openingPolicyId === policy.id ? "Đang mở chính sách..." : "Chọn để xem / sửa"}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SchoolSubjectsModal({
  state,
  years,
  onClose,
  onApplied,
  onOpenPolicies,
  onEditSubject,
  onDeleteSubject,
  deletingSubjectId,
}: {
  state: { school: { id: number; name: string }; subjects: Subject[]; loading: boolean };
  /** Danh sách năm học để chọn năm đích. */
  years: string[];
  onClose: () => void;
  onApplied: () => void;
  onOpenPolicies: (subject: Subject) => void;
  onEditSubject: (subject: Subject) => void;
  onDeleteSubject: (subject: Subject) => void;
  deletingSubjectId: number | null;
}) {
  // Năm nguồn chỉ lấy trong các năm trường đang có môn — năm không có môn thì
  // backend từ chối ngay ("chưa có môn học nào trong năm ...").
  const subjectYears = useMemo(
    () =>
      Array.from(
        new Set(
          state.subjects
            .map((subject) => subject.schoolYear)
            .filter((year): year is string => Boolean(year)),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [state.subjects],
  );

  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [pickedSubjectIds, setPickedSubjectIds] = useState<number[]>([]);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<RolloverResult | null>(null);

  // Môn của năm nguồn — đây là tập môn được phép chọn để áp.
  const fromSubjects = useMemo(
    () => state.subjects.filter((subject) => subject.schoolYear === fromYear),
    [state.subjects, fromYear],
  );

  const chooseFromYear = (year: string) => {
    setFromYear(year);
    setToYear(nextSchoolYear(year));
    // Mặc định áp tất cả môn của năm vừa chọn, người dùng bỏ tick môn không cần.
    setPickedSubjectIds(
      state.subjects
        .filter((subject) => subject.schoolYear === year)
        .map((subject) => subject.id),
    );
    setResult(null);
  };

  // Mặc định: năm gần nhất đang có môn → năm liền sau.
  useEffect(() => {
    if (fromYear || subjectYears.length === 0) return;
    chooseFromYear(subjectYears[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectYears]);

  /**
   * Danh sách môn được tải lại (mở popup, hoặc vừa áp xong) thì bỏ những id
   * không còn tồn tại. Chỉ tick lại toàn bộ khi tick cũ đã mất sạch vì môn bị
   * xoá/đổi năm — người dùng tự bỏ tick hết thì tôn trọng, không tick lại.
   */
  useEffect(() => {
    if (!fromYear || fromSubjects.length === 0) return;
    const ids = fromSubjects.map((subject) => subject.id);
    setPickedSubjectIds((current) => {
      const kept = current.filter((id) => ids.includes(id));
      if (kept.length === current.length) return current;
      return kept.length > 0 ? kept : ids;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSubjects]);

  const toggleSubject = (id: number) => {
    setResult(null);
    setPickedSubjectIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const allPicked = fromSubjects.length > 0 && pickedSubjectIds.length === fromSubjects.length;

  const targetYears = Array.from(new Set([...years, nextSchoolYear(fromYear)]))
    .filter((year) => year && year !== fromYear)
    .sort((a, b) => b.localeCompare(a));

  /**
   * Xem trước rồi mới chạy thật: người dùng thấy đúng số môn / số chính sách
   * sẽ được tạo trước khi đồng ý, vì đây là thao tác tạo dữ liệu hàng loạt.
   */
  const applyRollover = async () => {
    if (!fromYear || !toYear) {
      toast.error("Vui lòng chọn năm học cũ và năm học mới");
      return;
    }
    if (fromYear === toYear) {
      toast.error("Năm học cũ và năm học mới phải khác nhau");
      return;
    }
    if (pickedSubjectIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 môn để áp");
      return;
    }

    setApplying(true);
    setResult(null);
    try {
      const input = {
        schoolId: state.school.id,
        fromYear,
        toYear,
        subjectIds: pickedSubjectIds,
      };
      const preview = await schoolYearRolloverApi.preview(input);

      if (preview.subjectsCopied === 0) {
        setResult(preview);
        toast.error(`Không có môn nào để tạo cho năm ${toYear}`);
        return;
      }

      const confirmed = window.confirm(
        `Áp chính sách ${fromYear} → ${toYear} cho ${state.school.name}:\n\n` +
          `• Tạo ${preview.subjectsCopied} môn học của năm ${toYear}\n` +
          `• Sao chép ${preview.policiesCopied} chính sách đã duyệt sang trạng thái Nháp\n` +
          (preview.subjectsSkipped > 0
            ? `• Bỏ qua ${preview.subjectsSkipped} môn (năm ${toYear} đã có)\n`
            : "") +
          `\nTiếp tục?`,
      );
      if (!confirmed) {
        setResult(preview);
        return;
      }

      const applied = await schoolYearRolloverApi.apply(input);
      setResult(applied);
      toast.success(
        `Đã tạo ${applied.subjectsCopied} môn và ${applied.policiesCopied} chính sách nháp cho năm ${toYear}`,
      );
      onApplied();
    } catch (reason) {
      toast.error(getApiErrorMessage(reason, "Không áp được chính sách sang năm mới"));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{state.school.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Danh sách môn học của trường</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100">✕</button>
        </div>

        {/* ÁP CHÍNH SÁCH SANG NĂM HỌC MỚI */}
        <section className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Áp chính sách sang năm học mới</h3>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Tạo môn học của năm mới theo môn năm cũ, đồng thời sao chép các chính sách
            <b> đã duyệt</b> của năm cũ sang <b>trạng thái Nháp</b> — bạn sửa lại số liệu
            rồi gửi duyệt cho năm mới.
          </p>

          {subjectYears.length === 0 ? (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-amber-700">
              Trường chưa có môn học nào để áp sang năm mới.
            </p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select
                  label="Năm học cũ (nguồn)"
                  value={fromYear}
                  options={subjectYears.map((year) => ({ value: year, label: year }))}
                  onChange={chooseFromYear}
                  placeholder="Chọn năm học cũ"
                />
                <Select
                  label="Năm học mới (đích)"
                  value={toYear}
                  options={targetYears.map((year) => ({ value: year, label: year }))}
                  onChange={(value) => {
                    setToYear(value);
                    setResult(null);
                  }}
                  placeholder="Chọn năm học mới"
                />
              </div>

              {/* CHỌN MÔN ĐỂ ÁP */}
              <div className="mt-3 rounded-xl bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">
                    Môn áp sang năm mới ({pickedSubjectIds.length}/{fromSubjects.length})
                  </p>
                  {fromSubjects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setPickedSubjectIds(
                          allPicked ? [] : fromSubjects.map((subject) => subject.id),
                        );
                      }}
                      className="text-[11px] font-bold text-blue-600"
                    >
                      {allPicked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </button>
                  )}
                </div>

                {fromSubjects.length === 0 ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Năm {fromYear || "—"} chưa có môn học nào.
                  </p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {fromSubjects.map((subject) => (
                      <li key={subject.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-xs hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={pickedSubjectIds.includes(subject.id)}
                            onChange={() => toggleSubject(subject.id)}
                            className="h-4 w-4 shrink-0 accent-blue-600"
                          />
                          <span className="min-w-0 flex-1 truncate text-slate-800">{subject.name}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatCount(subject.classCount)} lớp · {formatCount(subject.studentCount)} HS
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                disabled={applying || !fromYear || !toYear || pickedSubjectIds.length === 0}
                onClick={() => void applyRollover()}
                className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {applying
                  ? "Đang xử lý..."
                  : `Áp dụng chính sách${pickedSubjectIds.length > 0 ? ` (${pickedSubjectIds.length} môn)` : ""}`}
              </button>

              {result && (
                <div className="mt-3 rounded-xl bg-white p-3 text-xs">
                  <p className="font-bold text-slate-900">
                    {result.dryRun ? "Xem trước" : "Kết quả"} {result.fromYear} → {result.toYear}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {result.subjectsCopied} môn · {result.policiesCopied} chính sách nháp
                    {result.subjectsSkipped > 0 && ` · bỏ qua ${result.subjectsSkipped} môn`}
                  </p>
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                    {result.items.map((item) => (
                      <li key={item.fromSubjectId} className="flex items-start justify-between gap-2">
                        <span className="text-slate-700">{item.name}</span>
                        <span className={`shrink-0 ${item.status === "COPIED" ? "text-emerald-700" : "text-slate-400"}`}>
                          {item.status === "COPIED"
                            ? `${item.approvedPolicies} chính sách`
                            : item.reason || "Bỏ qua"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {state.loading && <div className="py-10 text-center text-sm text-slate-500">Đang tải môn học...</div>}

        {!state.loading && state.subjects.length === 0 && (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-slate-500">
            Trường chưa có môn học nào
          </div>
        )}

        {!state.loading && state.subjects.length > 0 && (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {state.subjects.map((subject) => {
              const policyCount = subject.policyCount || 0;

              return (
                <div key={subject.id} className="rounded-xl border border-slate-200 p-3">
                  <button
                    type="button"
                    onClick={() => onOpenPolicies(subject)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900">{subject.name}</p>
                      {subject.schoolYear && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          {subject.schoolYear}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500">
                      <span>Số lớp: {subject.classCount ?? "—"}</span>
                      <span>Số học sinh: {subject.studentCount ?? "—"}</span>
                      <span className="col-span-2">Chính sách: {policyCount}</span>
                    </div>
                    <p className="mt-2 text-[11px] font-bold text-blue-600">
                      Chọn để xem {policyCount > 0 ? `${policyCount} ` : ""}chính sách của môn
                    </p>
                  </button>

                  <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => onEditSubject(subject)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-50 py-1.5 text-[11px] font-bold text-amber-700 transition active:scale-95"
                    >
                      <Pencil size={12} />Sửa môn
                    </button>
                    <button
                      type="button"
                      disabled={deletingSubjectId === subject.id}
                      onClick={() => onDeleteSubject(subject)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-50 py-1.5 text-[11px] font-bold text-red-600 transition active:scale-95 disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      {deletingSubjectId === subject.id ? "Đang xoá..." : "Xoá môn"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
