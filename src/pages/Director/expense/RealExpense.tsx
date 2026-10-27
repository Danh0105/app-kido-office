import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import SearchableSelect from "@/components/SearchableSelect";

import {
  Search,
  School2,
  ChevronRight,
  Wallet,
  TrendingUp,
  Landmark,
  BadgeDollarSign,
  Receipt,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";

import { schoolApi } from "@/service/school.api";
import { employeeApi } from "@/service/employee";
import { expensePeriodApi } from "@/service/expensePeriod";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { subjectApi } from "@/service/subject.api";
import { StatCard } from "./component/StatCard";
import RealExpenseDetail from "./RealExpenseDetail/index";
import GlobalExpenseReport from "./components/GlobalExpenseReport";
import SchoolInfoModal, { SchoolInfo } from "./components/SchoolInfoModal";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasRole } from "@/utils/auth";

/** Khớp `WRITE_ROLES` của `POST /school-expenses` ở backend. */
const canWriteSchoolExpense = () =>
  hasRole(
    "accountant",
    "ketoan_congno",
    "ketoan_truong",
    "thuquy",
    "troly_gd",
    "director",
  );
const getSchoolYearRange = (schoolYear: string) => {
  const years = schoolYear.match(/\d{4}/g)?.map(Number) || [];

  if (!years.length) return null;

  return {
    startYear: years[0],
    endYear: years[1] || years[0],
  };
};

const getCurrentSchoolYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;

  return `${startYear}-${startYear + 1}`;
};

const getExpensePeriodYear = (
  schoolYear: string,
  month: number,
  fallbackYear: number,
) => {
  const range = getSchoolYearRange(schoolYear);

  if (!range) return fallbackYear;

  return month >= 8 ? range.startYear : range.endYear;
};

// Thứ tự tháng trong năm học: 8 → 12 rồi 1 → 7.
const SCHOOL_YEAR_MONTHS = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
const getSchoolYearMonthOrder = (month: number) =>
  SCHOOL_YEAR_MONTHS.indexOf(month);

const getDefaultPeriodName = (month: number, year: number) =>
  `${String(month).padStart(2, "0")}/${year}`;

/** Tên hiển thị của kỳ: đã đổi tên / dòng tuỳ chỉnh thì dùng tên, không thì "Tháng M". */
const getPeriodLabel = (period: any) => {
  const month = Number(period?.month);
  if (month > 12) return period?.name || "";
  return period?.name &&
    period.name !== getDefaultPeriodName(month, Number(period.year))
    ? period.name
    : `Tháng ${month}`;
};

/**
 * Các kỳ đang có của 1 năm học — không bắt buộc đủ 12 tháng (tháng đã xoá thì
 * không hiện). Tháng thật (1–12) xếp theo năm học, dòng tuỳ chỉnh (tháng ảo
 * > 12, gắn năm bắt đầu) xếp sau.
 */
const getSchoolYearPeriods = (periods: any[], schoolYear: string) => {
  const range = getSchoolYearRange(schoolYear);
  if (!range) return [];

  const monthPeriods = periods
    .filter((p: any) => {
      const month = Number(p.month);
      return (
        month >= 1 &&
        month <= 12 &&
        Number(p.year) === getExpensePeriodYear(schoolYear, month, 0)
      );
    })
    .sort(
      (a: any, b: any) =>
        getSchoolYearMonthOrder(Number(a.month)) -
        getSchoolYearMonthOrder(Number(b.month)),
    );
  const customPeriods = periods
    .filter(
      (p: any) => Number(p.month) > 12 && Number(p.year) === range.startYear,
    )
    .sort((a: any, b: any) => Number(a.month) - Number(b.month));

  return [...monthPeriods, ...customPeriods];
};

/**
 * Chọn kỳ có sẵn để mở thay cho tháng/năm mong muốn: đúng tháng/năm nếu còn,
 * không thì tháng gần nhất trước đó trong năm học, rồi tới kỳ đầu tiên.
 * Trả null khi năm học chưa có kỳ nào.
 */
const pickSchoolYearPeriod = (
  periods: any[],
  schoolYear: string,
  month: number,
  year: number,
) => {
  const exact = periods.find(
    (p: any) => Number(p.month) === month && Number(p.year) === year,
  );
  if (exact) return exact;

  const yearPeriods = getSchoolYearPeriods(periods, schoolYear);
  const targetOrder = getSchoolYearMonthOrder(month);
  const previous = yearPeriods
    .filter(
      (p: any) =>
        Number(p.month) <= 12 &&
        getSchoolYearMonthOrder(Number(p.month)) <= targetOrder,
    )
    .pop();

  return previous || yearPeriods[0] || null;
};

const getPreferredSchoolYear = (schoolYears: string[]) => {
  const defaultSchoolYear = getCurrentSchoolYear();
  if (!schoolYears.length) return defaultSchoolYear;

  const currentSchoolYear = schoolYears.find((schoolYear) => {
    const range = getSchoolYearRange(schoolYear);

    return (
      range?.startYear === Number(defaultSchoolYear.slice(0, 4)) &&
      range.endYear === Number(defaultSchoolYear.slice(5))
    );
  });

  return currentSchoolYear || schoolYears[0];
};

const EMPLOYEE_PAGE_SIZE = 10;

export default function RealExpense() {
  // SEARCH
  const [keyword, setKeyword] = useState("");

  // DATA
  const [schools, setSchools] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [hasRemainingExpense, setHasRemainingExpense] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | "">("");
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState(() =>
    getCurrentSchoolYear(),
  );
  const today = new Date();

  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const [selectedPeriod, setSelectedPeriod] = useState<any>({
    month: currentMonth,
    year: currentYear,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  // LOADING
  const [loading, setLoading] = useState(false);
  const [activeExpenseId, setActiveExpenseId] = useState<number | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);

  const [activeSchool, setActiveSchool] = useState<any>(null);
  /** Kế toán sửa thông tin trường in trên hóa đơn (MST, mã ĐVQHNS...). */
  const [editingSchoolInfo, setEditingSchoolInfo] = useState<SchoolInfo | null>(
    null,
  );
  const [employeePage, setEmployeePage] = useState(1);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mainView, setMainView] = useState<"schools" | "report">("schools");
  const [customPeriodName, setCustomPeriodName] = useState("");
  // "" = dòng tuỳ chỉnh; số = thêm lại tháng thật (1–12) chưa có trong năm học.
  const [customPeriodMonth, setCustomPeriodMonth] = useState<number | "">("");
  const [addingCustomPeriod, setAddingCustomPeriod] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [editingPeriodName, setEditingPeriodName] = useState("");
  const [deletingPeriod, setDeletingPeriod] = useState<any>(null);
  // FETCH ALL SCHOOL
  const fetchSchools = async (customPage = pagination.page) => {
    try {
      setLoading(true);

      const res = await schoolApi.getAll({
        page: customPage,
        limit: pagination.limit,
        hasRemainingExpense,
        keyword,
      });
      setSchools(res.data || []);

      setPagination(res.pagination);
    } catch (error: any) {
      console.log(error);
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách trường"));
    } finally {
      setLoading(false);
    }
  };

  // FETCH SCHOOLS OF A SELECTED EMPLOYEE
  const fetchSchoolsByEmployee = async (employeeId: number) => {
    try {
      setLoading(true);

      const employee = employees.find((item) => item.id === employeeId);

      const res = await schoolApi.getAll({
        employeeName: employee?.name,
        page: 1,
        limit: 1000,
      });
      console.log("getAll by employeeName res:", res);

      // employeeName is an ILIKE match, narrow to the exact employee
      const list = (res?.data || []).filter(
        (school: any) => school.employee?.id === employeeId,
      );

      setSchools(list);
      setPagination({
        total: list.length,
        page: 1,
        limit: list.length || 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } catch (error: any) {
      console.log(error);
      toast.error(
        getApiErrorMessage(error, "Không thể tải trường của nhân viên"),
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await employeeApi.getAll();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log(error);
    }
  };

  // Mỗi trường có danh sách kỳ chi phí RIÊNG — không schoolId thì để trống,
  // tránh hiện nhầm kỳ của trường khác.
  // Trường mà `periods` / `selectedPeriod.id` hiện đang thuộc về — dùng để
  // không lấy nhầm id kỳ của trường trước khi vừa chuyển trường.
  const periodsSchoolIdRef = useRef<number | null>(null);
  // Request tạo kỳ đang chạy, theo key trường-tháng-năm — nhiều nơi (mở
  // trường, đổi tháng, đổi năm học) có thể cùng lúc đòi cùng 1 kỳ, chỉ gọi
  // API 1 lần.
  const pendingPeriodRef = useRef(new Map<string, Promise<any>>());
  // Tương tự cho bảng chi phí theo key trường-kỳ: mở trường có thể chạy chồng
  // nhiều lượt (effect theo kỳ / năm học) — gọi tạo song song sẽ sinh 2 bảng
  // cho cùng 1 kỳ (backend chỉ kiểm tra trước khi insert).
  const pendingExpenseRef = useRef(new Map<string, Promise<number | null>>());

  const addPeriodToList = (period: any) => {
    setPeriods((prev: any[]) =>
      prev.some((p: any) => p.id === period.id) ? prev : [period, ...prev],
    );
  };

  // Lấy kỳ (tháng/năm) của 1 trường, chưa có thì tạo. Backend tạo kiểu
  // idempotent (đã có thì trả kỳ cũ) nên an toàn khi gọi lặp.
  const ensurePeriod = (
    schoolId: number,
    month: number,
    year: number,
    name?: string,
  ) => {
    const key = `${schoolId}-${month}-${year}`;
    const pending = pendingPeriodRef.current.get(key);
    if (pending) return pending;

    const promise = expensePeriodApi
      .create({
        month,
        year,
        name: name || getDefaultPeriodName(month, year),
        schoolId,
      })
      .then((res: any) => {
        const period = res?.data || res;
        if (periodsSchoolIdRef.current === schoolId) addPeriodToList(period);
        return period;
      })
      .finally(() => {
        pendingPeriodRef.current.delete(key);
      });

    pendingPeriodRef.current.set(key, promise);
    return promise;
  };

  // Năm học của trường lấy từ môn học — cùng nguồn và cách chọn với màn chi
  // tiết (schoolYears + handleSchoolYearsChange). Năm đang chọn không có trong
  // danh sách thì đổi sang năm của trường; trường chưa có môn thì giữ nguyên.
  const resolveSchoolYear = async (schoolId: number) => {
    try {
      const res = await subjectApi.getFinanceBySchool(schoolId);
      const subjects = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];
      const years = [
        ...new Set<string>(
          subjects.map((s: any) => s.schoolYear).filter(Boolean),
        ),
      ].sort(
        (a, b) =>
          Number(b.match(/\d{4}/)?.[0] || 0) -
          Number(a.match(/\d{4}/)?.[0] || 0),
      );

      return !years.length || years.includes(selectedSchoolYear)
        ? selectedSchoolYear
        : getPreferredSchoolYear(years);
    } catch (error) {
      console.log(error);
      return selectedSchoolYear;
    }
  };

  // Id bảng chi phí của trường trong kỳ, chưa có thì tạo (nếu có quyền).
  // null = chưa có và không tạo được (đã báo người dùng).
  const ensureSchoolExpense = (schoolId: number, periodId: number) => {
    const key = `${schoolId}-${periodId}`;
    const pending = pendingExpenseRef.current.get(key);
    if (pending) return pending;

    const promise = (async (): Promise<number | null> => {
      const existedRes = await schoolExpenseApi.checkExisted(schoolId, periodId);
      const existed = existedRes?.data || existedRes;
      if (existed?.id) return existed.id;

      // Backend chỉ cho Kế toán / Kế toán công nợ / Kế toán trưởng / Thủ quỹ /
      // Trợ lý GĐ / GĐ tạo bảng chi phí — role khác gọi create là 403.
      if (!canWriteSchoolExpense()) {
        toast.error(
          "Trường này chưa có bảng chi phí. Chỉ Kế toán, Kế toán trưởng, Thủ quỹ, Trợ lý GĐ hoặc Giám đốc mới tạo được.",
        );
        return null;
      }

      const createdRes = await schoolExpenseApi.create({ schoolId, periodId });
      const created = createdRes?.data || createdRes;
      if (!created?.id) {
        alert("Không tạo được phiếu thu chi");
        return null;
      }
      return created.id;
    })().finally(() => {
      pendingExpenseRef.current.delete(key);
    });

    pendingExpenseRef.current.set(key, promise);
    return promise;
  };

  const fetchPeriods = async (schoolId?: number | null) => {
    periodsSchoolIdRef.current = schoolId || null;

    if (!schoolId) {
      setPeriods([]);
      setSelectedPeriod({ month: currentMonth, year: currentYear });
      return;
    }

    try {
      const res = await expensePeriodApi.getAll({ schoolId });

      // Đã chuyển sang trường khác trong lúc chờ — bỏ kết quả cũ.
      if (periodsSchoolIdRef.current !== schoolId) return;

      const periodData = Array.isArray(res) ? res : res?.data || [];

      setPeriods(periodData);

      // Giữ kỳ đang chọn nếu thuộc trường này (vừa mở từ danh sách trường),
      // không thì chọn kỳ có sẵn gần tháng hiện tại — không tự tạo lại tháng
      // đã xoá.
      setSelectedPeriod((prev: any) =>
        prev?.id && periodData.some((item: any) => item.id === prev.id)
          ? prev
          : pickSchoolYearPeriod(
              periodData,
              selectedSchoolYear,
              currentMonth,
              currentYear,
            ) || { month: currentMonth, year: currentYear },
      );
    } catch (error) {
      console.log(error);
    }
  };
  // SEARCH SCHOOL — debounce 350ms để không gọi API mỗi lần gõ phím, tìm
  // không dấu + nhiều từ được xử lý ở backend (SchoolsService.search).
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (value: string) => {
    try {
      if (!value.trim()) {
        fetchSchools();
        return;
      }

      setLoading(true);

      const res = await schoolApi.search(value);

      setSchools(res || []);
    } catch (error: any) {
      console.log(error);
      toast.error(getApiErrorMessage(error, "Không thể tìm kiếm trường"));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setKeyword(value);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearch(value), 350);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchSchoolsByEmployee(Number(selectedEmployeeId));
    } else {
      fetchSchools();
    }
  }, [hasRemainingExpense, selectedEmployeeId]);

  useEffect(() => {
    fetchPeriods(activeSchool?.id || null);
  }, [activeSchool?.id]);

  useEffect(() => {
    setEmployeePage(1);
  }, [selectedEmployeeId]);

  const employeeTotalPages = Math.max(
    1,
    Math.ceil(schools.length / EMPLOYEE_PAGE_SIZE),
  );

  const visibleSchools = useMemo(() => {
    if (activeSchool) {
      return schools.filter((school) => school.id === activeSchool.id);
    }
    if (selectedEmployeeId) {
      const start = (employeePage - 1) * EMPLOYEE_PAGE_SIZE;
      return schools.slice(start, start + EMPLOYEE_PAGE_SIZE);
    }
    return schools;
  }, [schools, activeSchool, selectedEmployeeId, employeePage]);

  const schoolYearPeriods = useMemo(
    () => getSchoolYearPeriods(periods, selectedSchoolYear),
    [periods, selectedSchoolYear],
  );

  // Tháng thật (1–12) chưa có kỳ trong năm học — chọn được ở "+ Thêm dòng".
  const missingSchoolYearMonths = useMemo(
    () =>
      SCHOOL_YEAR_MONTHS.filter(
        (month) =>
          !schoolYearPeriods.some((p: any) => Number(p.month) === month),
      ),
    [schoolYearPeriods],
  );

  // Đổi năm học → mở kỳ có sẵn tương ứng, không tự tạo kỳ mới.
  const handleChangePeriod = (month: number, year: number) => {
    const period = pickSchoolYearPeriod(
      periods,
      selectedSchoolYear,
      month,
      year,
    );
    if (period) {
      setSelectedPeriod(period);
      return;
    }

    const fallbackMonth = month > 12 ? currentMonth : month;
    setSelectedPeriod({
      month: fallbackMonth,
      year: getExpensePeriodYear(selectedSchoolYear, fallbackMonth, year),
    });
  };

  const closeAddPeriodForm = () => {
    setAddingCustomPeriod(false);
    setCustomPeriodName("");
    setCustomPeriodMonth("");
  };

  const handleAddCustomPeriod = async () => {
    const name = customPeriodName.trim();
    if (!activeSchool?.id) return;
    if (!customPeriodMonth && !name) return;

    try {
      let created: any;

      if (customPeriodMonth) {
        // Thêm lại tháng thật đã xoá (hoặc chưa từng tạo) của năm học.
        const year = getExpensePeriodYear(
          selectedSchoolYear,
          customPeriodMonth,
          currentYear,
        );
        created = await ensurePeriod(
          activeSchool.id,
          customPeriodMonth,
          year,
          name || undefined,
        );
      } else {
        // Không truyền month — backend tự cấp số tháng "ảo" (> 12) chưa dùng
        // trong năm này (của trường này), tránh đụng 12 tháng thật và tránh
        // race-condition.
        const range = getSchoolYearRange(selectedSchoolYear);
        const year = range?.startYear || currentYear;

        created = await expensePeriodApi.create({
          year,
          name,
          schoolId: activeSchool.id,
        });
        addPeriodToList(created);
      }

      setSelectedPeriod(created);
      closeAddPeriodForm();
    } catch (error) {
      console.log(error);
      toast.error(getApiErrorMessage(error, "Không thể tạo dòng mới"));
    }
  };

  const handleSaveEditPeriod = async () => {
    const name = editingPeriodName.trim();
    if (!editingPeriodId || !name) return;

    try {
      const updated = await expensePeriodApi.update(editingPeriodId, { name });

      setPeriods((prev: any) =>
        prev.map((p: any) => (p.id === editingPeriodId ? updated : p)),
      );
      setSelectedPeriod((prev: any) =>
        prev?.id === editingPeriodId ? updated : prev,
      );
      setEditingPeriodId(null);
      setEditingPeriodName("");
    } catch (error) {
      console.log(error);
      toast.error(getApiErrorMessage(error, "Không thể đổi tên dòng"));
    }
  };

  // `window.confirm` không đáng tin cậy trong webview (VSCode extension) —
  // dùng modal tự viết thay vì hộp thoại xác nhận gốc của trình duyệt.
  const requestDeletePeriod = (period: any) => setDeletingPeriod(period);

  const handleDeletePeriod = async () => {
    const period = deletingPeriod;
    if (!period) return;

    try {
      await expensePeriodApi.delete(period.id);

      const remaining = periods.filter((p: any) => p.id !== period.id);
      setPeriods(remaining);

      // Xoá đúng kỳ đang mở → chuyển sang kỳ còn lại gần nhất; năm học không
      // còn kỳ nào thì đóng phiếu, không tự tạo lại tháng vừa xoá.
      if (selectedPeriod?.id === period.id) {
        const next = pickSchoolYearPeriod(
          remaining,
          selectedSchoolYear,
          Number(period.month),
          Number(period.year),
        );
        setSelectedPeriod(next);
        if (!next) setActiveExpenseId(null);
      }
      setDeletingPeriod(null);
    } catch (error) {
      console.log(error);
      toast.error(getApiErrorMessage(error, "Không thể xoá dòng"));
    }
  };

  const handleDuplicatePeriod = async (period: any) => {
    try {
      const created = await expensePeriodApi.duplicate(period.id);

      setPeriods((prev: any) => [created, ...prev]);
      setSelectedPeriod(created);
      toast.success(
        `Đã nhân bản "${getPeriodLabel(period)}" kèm toàn bộ dữ liệu thu chi`,
      );
    } catch (error) {
      console.log(error);
      toast.error(getApiErrorMessage(error, "Không thể nhân bản dòng"));
    }
  };

  const handleSchoolYearsChange = useCallback((years: string[]) => {
    setSchoolYears(years);
    // Trường chưa có môn (chưa có năm học nào) → giữ năm học đang chọn: đổi năm
    // ở đây sẽ kéo theo đổi kỳ và tự tạo thêm một kỳ trống của năm khác.
    setSelectedSchoolYear((currentSchoolYear) =>
      !years.length || years.includes(currentSchoolYear)
        ? currentSchoolYear
        : getPreferredSchoolYear(years),
    );
  }, []);

  useEffect(() => {
    if (!selectedSchoolYear || !selectedPeriod) return;

    const month = Number(selectedPeriod?.month || currentMonth);
    const periodYear = getExpensePeriodYear(
      selectedSchoolYear,
      month,
      Number(selectedPeriod?.year || currentYear),
    );

    if (periodYear !== Number(selectedPeriod?.year)) {
      handleChangePeriod(month, periodYear);
    }
  }, [selectedSchoolYear, selectedPeriod?.month, selectedPeriod?.year]);

  const handleOpenSchoolExpense = async (school: any) => {
    try {
      // Chưa chọn kỳ (vd. vừa xoá hết kỳ của năm học) → nhắm tháng hiện tại.
      const targetPeriod = selectedPeriod || {
        month: currentMonth,
        year: currentYear,
      };

      setLoadingDetail(true);

      let expenseId: number | null = null;
      let periodId: number;

      // Chỉ dùng id kỳ đang chọn khi nó thuộc đúng trường này — vừa chuyển
      // trường thì selectedPeriod.id có thể còn là kỳ của trường trước.
      if (targetPeriod.id && periodsSchoolIdRef.current === school.id) {
        periodId = targetPeriod.id;
      } else {
        // Dòng tuỳ chỉnh (tháng ảo > 12) là riêng từng trường — sang trường
        // khác thì quay về tháng hiện tại.
        const isCustom = Number(targetPeriod.month) > 12;
        const month = isCustom ? currentMonth : Number(targetPeriod.month);
        const year = isCustom ? currentYear : Number(targetPeriod.year);

        // Chọn đúng năm học của trường TRƯỚC khi tìm / tạo kỳ: tạo theo năm
        // đang chọn rồi màn chi tiết mới đổi sang năm của trường thì sinh thêm
        // một kỳ + bảng chi phí trống ở năm kia.
        const schoolYear = await resolveSchoolYear(school.id);
        const periodYear = getExpensePeriodYear(schoolYear, month, year);

        // Không bắt buộc đủ 12 tháng: ưu tiên kỳ có sẵn của trường, chỉ tự
        // tạo khi năm học này của trường chưa có kỳ nào (mở lần đầu) — tháng
        // đã xoá không bị tạo lại.
        const schoolPeriods =
          periodsSchoolIdRef.current === school.id
            ? periods
            : await expensePeriodApi
                .getAll({ schoolId: school.id })
                .then((res: any) =>
                  Array.isArray(res) ? res : res?.data || [],
                );
        const period =
          pickSchoolYearPeriod(
            schoolPeriods,
            schoolYear,
            month,
            periodYear,
          ) || (await ensurePeriod(school.id, month, periodYear));

        periodId = period.id;

        // Đổi năm + kỳ trong cùng một lượt render để effect đồng bộ năm học
        // không thấy kỳ lệch năm rồi tự mở (và tạo) kỳ khác.
        if (schoolYear !== selectedSchoolYear) setSelectedSchoolYear(schoolYear);
        if (period.id !== selectedPeriod?.id) setSelectedPeriod(period);
      }
      expenseId = await ensureSchoolExpense(school.id, periodId);
      if (!expenseId) return;

      setSelectedSchoolId(school.id);
      setActiveSchool(school);
      setActiveExpenseId(expenseId);

      // scroll xuống detail
      setTimeout(() => {
        document.getElementById("school-expense-detail")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error: any) {
      console.log(error);
      toast.error(
        getApiErrorMessage(error, "Không thể mở phiếu thu chi của trường"),
      );
    } finally {
      setLoadingDetail(false);
    }
  };
  useEffect(() => {
    if (activeSchool && selectedPeriod) {
      handleOpenSchoolExpense(activeSchool);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    if (!selectedSchoolId || !schools.length) return;

    const school = schools.find((item) => item.id === selectedSchoolId);

    if (school) {
      setActiveSchool(school);
    }
  }, [schools, selectedSchoolId]);
  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Quản lý thu chi" />

      <div className="mt-[60px] p-4">
        <div
          className={`grid grid-cols-1 gap-5 items-start ${
            !activeExpenseId && mainView === "report"
              ? ""
              : "xl:grid-cols-[minmax(0,1fr)_150px]"
          }`}
        >
          {/* HERO */}

          <div className="space-y-5">
            {!activeExpenseId && (
              <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm">
                <button
                  onClick={() => setMainView("schools")}
                  className={`flex-1 rounded-xl px-4 py-3 text-base font-bold ${
                    mainView === "schools"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Danh sách trường
                </button>
                <button
                  onClick={() => setMainView("report")}
                  className={`flex-1 rounded-xl px-4 py-3 text-base font-bold ${
                    mainView === "report"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Báo cáo tổng hợp
                </button>
              </div>
            )}
            {!activeExpenseId && mainView === "report" ? (
              <GlobalExpenseReport />
            ) : (
            <>
            {/* SEARCH */}
            <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 bg-slate-100 rounded-2xl px-4 h-14">
                <Search size={20} className="text-slate-400" />

                <input
                  value={keyword}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Tìm trường học hoặc MST..."
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700"
                />
              </div>
            </div>

            <>
              {/* BACK BUTTON */}
              {activeExpenseId && (
                <button
                  onClick={() => {
                    setActiveExpenseId(null);
                    setActiveSchool(null);
                    setSchoolYears([]);
                    setSelectedSchoolYear(getCurrentSchoolYear());
                  }}
                  className="
        fixed bottom-[1vh] right-6 z-50
        h-10 px-4 rounded-2xl
        bg-slate-900 hover:bg-slate-800
        text-white font-semibold text-sm
        shadow-2xl shadow-slate-300/40
        transition-all duration-200
        hover:scale-105
        flex items-center gap-1
      "
                >
                  ← Quay lại
                </button>
              )}

              {/* LIST */}
              <div className="space-y-4">
                {!activeExpenseId && (
                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-semibold text-slate-800">
                          Chỉ hiện trường còn chi
                        </p>

                        <p className="text-sm text-slate-400 mt-1">
                          Lọc các trường còn phải chi ngoài hợp đồng
                        </p>
                      </div>

                      <button
                        onClick={() => setHasRemainingExpense((prev) => !prev)}
                        className={`
              relative w-14 h-8 rounded-full transition-all
              ${hasRemainingExpense ? "bg-emerald-500" : "bg-slate-300"}
            `}
                      >
                        <div
                          className={`
                absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all
                ${hasRemainingExpense ? "left-7" : "left-1"}
              `}
                        />
                      </button>
                    </label>

                    <div>
                      <p className="font-semibold text-slate-800">
                        Lọc theo nhân viên phụ trách
                      </p>

                      <SearchableSelect
                        value={String(selectedEmployeeId)}
                        onChange={(value) => setSelectedEmployeeId(value ? Number(value) : "")}
                        options={employees}
                        placeholder="Tất cả nhân viên"
                        searchPlaceholder="Tìm nhân viên…"
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />

                    <p className="text-slate-400 text-sm mt-4">
                      Đang tải dữ liệu...
                    </p>
                  </div>
                ) : schools.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleSchools.map((school) => {
                      const isSelected = activeSchool?.id === school.id;
                      const isOpen = isSelected && Boolean(activeExpenseId);

                      return (
                        <div
                          key={school.id}
                          className={
                            isSelected
                              ? "sm:col-span-2 space-y-4"
                              : "space-y-4"
                          }
                        >
                          {/* CARD */}
                          <div
                            onClick={() =>
                              !activeExpenseId &&
                              handleOpenSchoolExpense(school)
                            }
                            className={`
                              group
                              bg-white
                              rounded-2xl
                              border border-slate-200
                              p-4
                              hover:shadow-lg
                              hover:border-blue-200
                              transition-all
                              cursor-pointer
                              ${isOpen ? "sticky top-[72px] z-40 shadow-lg" : ""}
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                                <School2 size={20} className="text-white" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                                    {school.name}
                                  </h3>

                                  <div className="flex shrink-0 items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        school.status === 0
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {school.status === 0
                                        ? "Hoạt động"
                                        : "Ngừng"}
                                    </span>

                                    <ChevronRight
                                      size={18}
                                      className="shrink-0 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-blue-600"
                                    />
                                  </div>
                                </div>

                                <div
                                  className={`mt-1 grid gap-1 ${
                                    isOpen
                                      ? "sm:grid-cols-2 sm:gap-x-8"
                                      : "grid-cols-1"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-xs text-slate-500">
                                      {school.address}
                                    </p>

                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                                      {school.taxCode && (
                                        <span>MST: {school.taxCode}</span>
                                      )}
                                      {school.budgetCode && (
                                        <span>
                                          Mã ĐVQHNS: {school.budgetCode}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div
                                    className={`min-w-0 ${
                                      isOpen
                                        ? "sm:border-l sm:border-slate-100 sm:pl-8"
                                        : ""
                                    }`}
                                  >
                                    {school.employee?.name && (
                                      <div className="flex flex-wrap items-center gap-x-2 text-xs">
                                        <span className="font-semibold text-slate-700">
                                          {school.employee.name}
                                        </span>
                                        {school.employee.phone && (
                                          <span className="text-slate-400">
                                            {school.employee.phone}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {canWriteSchoolExpense() && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSchoolInfo(school);
                                        }}
                                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                                      >
                                        ✏️ Sửa thông tin
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* KPI */}
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              <div className="bg-slate-50 rounded-xl p-2 text-center">
                                <p className="text-[10px] text-slate-400">
                                  Học sinh
                                </p>

                                <p className="font-bold text-slate-900 text-sm">
                                  {school.scale}
                                </p>
                              </div>

                              <div className="bg-slate-50 rounded-xl p-2 text-center">
                                <p className="text-[10px] text-slate-400">
                                  Lớp
                                </p>

                                <p className="font-bold text-slate-900 text-sm">
                                  {school.classCount}
                                </p>
                              </div>

                              <div className="bg-slate-50 rounded-xl p-2 text-center">
                                <p className="text-[10px] text-slate-400">
                                  Kỳ KT
                                </p>

                                <p className="font-bold text-slate-900 text-sm">
                                  {school.schoolExpenses?.length || 0}
                                </p>
                              </div>
                            </div>

                          </div>

                          {/* DETAIL */}
                          {isSelected && activeExpenseId && (
                            <div className="animate-in fade-in duration-300">
                              <RealExpenseDetail
                                schoolExpenseId={activeExpenseId}
                                school={activeSchool}
                                selectedSchoolYear={selectedSchoolYear}
                                onSchoolYearChange={setSelectedSchoolYear}
                                onSchoolYearsChange={handleSchoolYearsChange}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                      <School2 size={36} className="text-slate-400" />
                    </div>

                    <p className="text-slate-500 font-semibold mt-5">
                      Không tìm thấy trường học
                    </p>

                    <p className="text-sm text-slate-400 mt-2">
                      Thử tìm kiếm bằng tên trường hoặc mã số thuế
                    </p>
                  </div>
                )}
              </div>

              {/* PAGINATION */}
              {!activeExpenseId && schools.length > 0 && (
                <div className="flex items-center justify-between pt-5">
                  <div className="text-sm text-slate-500">
                    Tổng {selectedEmployeeId ? schools.length : pagination.total} trường
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={
                        selectedEmployeeId
                          ? employeePage <= 1
                          : !pagination.hasPrevPage
                      }
                      onClick={() =>
                        selectedEmployeeId
                          ? setEmployeePage((prev) => Math.max(1, prev - 1))
                          : fetchSchools(pagination.page - 1)
                      }
                      className="
            h-11 px-5 rounded-2xl
            border border-slate-200
            bg-white
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
                    >
                      Trước
                    </button>

                    <div
                      className="
            h-11 min-w-[110px]
            px-4
            rounded-2xl
            bg-blue-50
            text-blue-700
            font-bold
            flex items-center justify-center
          "
                    >
                      {selectedEmployeeId ? employeePage : pagination.page} /{" "}
                      {selectedEmployeeId
                        ? employeeTotalPages
                        : pagination.totalPages}
                    </div>

                    <button
                      disabled={
                        selectedEmployeeId
                          ? employeePage >= employeeTotalPages
                          : !pagination.hasNextPage
                      }
                      onClick={() =>
                        selectedEmployeeId
                          ? setEmployeePage((prev) =>
                              Math.min(employeeTotalPages, prev + 1),
                            )
                          : fetchSchools(pagination.page + 1)
                      }
                      className="
            h-11 px-5 rounded-2xl
            bg-blue-600
            text-white
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
                    >
                      Tiếp
                    </button>
                  </div>
                </div>
              )}
            </>
            </>
            )}
          </div>
          {(activeExpenseId || mainView === "schools") && (
          <div className="sticky top-[80px] z-20">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* HEADER */}

              {/* BODY */}
              <div className="p-3 space-y-3">
                {/* SCHOOL YEAR */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">
                      Năm học
                    </p>
                  </div>

                  <select
                    value={selectedSchoolYear}
                    onChange={(e) => setSelectedSchoolYear(e.target.value)}
                    disabled={!activeSchool || !schoolYears.length}
                    className="
        w-full h-9 rounded-xl border border-slate-200
        bg-white px-3 text-sm font-medium text-slate-700
        outline-none focus:border-emerald-500
        disabled:bg-slate-100 disabled:text-slate-400
      "
                  >
                    {!schoolYears.length && (
                      <option value="">
                        {activeSchool
                          ? "Không có năm học"
                          : "Chọn trường trước"}
                      </option>
                    )}
                    {schoolYears.map((schoolYear) => (
                      <option key={schoolYear} value={schoolYear}>
                        {schoolYear}
                      </option>
                    ))}
                  </select>
                </div>

                {/* MONTH */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">
                      Tháng
                    </p>

                    <p className="text-[11px] text-slate-400">
                      {selectedPeriod?.month
                        ? String(selectedPeriod.month).padStart(2, "0")
                        : "—"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-[420px] overflow-auto pr-1">
                    {activeSchool && !schoolYearPeriods.length && (
                      <p className="px-1 py-2 text-xs text-slate-400">
                        Chưa có kỳ nào trong năm học. Bấm "+ Thêm dòng" để tạo.
                      </p>
                    )}

                    {schoolYearPeriods.map((period: any) => {
                      // Tháng ảo (> 12) là dòng tuỳ chỉnh / bản sao.
                      const isCustom = Number(period.month) > 12;
                      const label = getPeriodLabel(period);
                      const active = selectedPeriod?.id === period.id;
                      const editing = editingPeriodId === period.id;

                      return (
                        <div
                          key={period.id}
                          className={`
              rounded-xl border text-sm font-semibold transition-all
              px-2 py-1.5
              ${
                active
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : isCustom
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300"
                    : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
              }
              ${editing ? "ring-2 ring-emerald-400" : ""}
            `}
                        >
                          <button
                            onClick={() => setSelectedPeriod(period)}
                            className="w-full text-left truncate px-1 block"
                          >
                            {label}
                          </button>

                          <div className="flex items-center justify-end gap-1 mt-1">
                            <button
                              onClick={() => {
                                setEditingPeriodId(period.id);
                                setEditingPeriodName(label);
                              }}
                              title="Sửa tên"
                              className={`p-1 rounded-lg transition-colors ${
                                active
                                  ? "hover:bg-blue-700"
                                  : isCustom
                                    ? "hover:bg-emerald-100"
                                    : "hover:bg-slate-100"
                              }`}
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              onClick={() => handleDuplicatePeriod(period)}
                              title="Nhân bản (kèm toàn bộ dữ liệu thu chi)"
                              className={`p-1 rounded-lg transition-colors ${
                                active
                                  ? "hover:bg-blue-700"
                                  : isCustom
                                    ? "hover:bg-emerald-100"
                                    : "hover:bg-emerald-100 hover:text-emerald-600"
                              }`}
                            >
                              <Copy size={14} />
                            </button>

                            <button
                              onClick={() => requestDeletePeriod(period)}
                              title="Xoá dòng"
                              className={`p-1 rounded-lg transition-colors ${
                                active
                                  ? "hover:bg-blue-700"
                                  : "hover:bg-red-100 hover:text-red-600"
                              }`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {addingCustomPeriod ? (
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <select
                        value={customPeriodMonth}
                        onChange={(e) =>
                          setCustomPeriodMonth(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                        className="
              h-9 rounded-xl border border-slate-200
              bg-white px-2 text-sm outline-none focus:border-emerald-500
            "
                      >
                        <option value="">Dòng tuỳ chỉnh</option>
                        {missingSchoolYearMonths.map((month) => (
                          <option key={month} value={month}>
                            Tháng {month}
                          </option>
                        ))}
                      </select>
                      <input
                        autoFocus
                        value={customPeriodName}
                        onChange={(e) => setCustomPeriodName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddCustomPeriod();
                          if (e.key === "Escape") closeAddPeriodForm();
                        }}
                        placeholder={
                          customPeriodMonth
                            ? `Tháng ${customPeriodMonth}`
                            : "Tên dòng..."
                        }
                        className="
              h-9 rounded-xl border border-slate-200
              bg-white px-3 text-sm outline-none focus:border-emerald-500
            "
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleAddCustomPeriod}
                          disabled={
                            !customPeriodMonth && !customPeriodName.trim()
                          }
                          className="flex-1 h-9 px-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={closeAddPeriodForm}
                          className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-slate-500 text-sm"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingCustomPeriod(true)}
                      disabled={!activeSchool}
                      title={
                        !activeSchool ? "Chọn trường trước" : undefined
                      }
                      className="
            w-full h-9 mt-1.5 rounded-xl border border-dashed border-slate-300
            text-slate-500 text-sm font-semibold hover:border-emerald-400 hover:text-emerald-600
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-500
          "
                    >
                      + Thêm dòng
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {editingPeriodId !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
          onClick={() => {
            setEditingPeriodId(null);
            setEditingPeriodName("");
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5"
          >
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Đổi tên dòng
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Đặt tên hiển thị cho dòng này trong sidebar.
            </p>

            <input
              autoFocus
              value={editingPeriodName}
              onChange={(e) => setEditingPeriodName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEditPeriod();
                if (e.key === "Escape") {
                  setEditingPeriodId(null);
                  setEditingPeriodName("");
                }
              }}
              placeholder="Tên dòng..."
              className="
        w-full h-11 rounded-xl border border-slate-200
        bg-white px-3.5 text-sm outline-none
        focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
        transition-all
      "
            />

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  setEditingPeriodId(null);
                  setEditingPeriodName("");
                }}
                className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleSaveEditPeriod}
                disabled={!editingPeriodName.trim()}
                className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSchoolInfo && (
        <SchoolInfoModal
          school={editingSchoolInfo}
          onClose={() => setEditingSchoolInfo(null)}
          onSaved={(updated) => {
            setSchools((list) =>
              list.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
            );
            setActiveSchool((current: any) =>
              current?.id === updated.id ? { ...current, ...updated } : current,
            );
            setEditingSchoolInfo(null);
          }}
        />
      )}

      {deletingPeriod && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
          onClick={() => setDeletingPeriod(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5"
          >
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Xoá dòng "{getPeriodLabel(deletingPeriod)}"?
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Toàn bộ dữ liệu thu chi của dòng này sẽ bị xoá vĩnh viễn. Hành
              động này không thể hoàn tác.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingPeriod(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleDeletePeriod}
                className="h-10 px-5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                Xoá dòng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
