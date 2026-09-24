import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, Upload, X } from "lucide-react";
import type { PolicyContractCategory, PolicyContractFile } from "@/types/policy";
import {
  POLICY_CONTRACT_CATEGORIES,
  POLICY_CONTRACT_CATEGORY_LABELS,
} from "@/types/policy";
import { toast } from "react-hot-toast";
import { PolicyStatus } from "../../enum/PolicyStatus";
import { policiesApi } from "@/service/policy";
import {
  subjectCatalogApi,
  type SubjectCatalog,
} from "@/service/subjectCatalog.api";
import SearchableSelect from "@/components/SearchableSelect";
import { hasRole } from "@/utils/auth";
import { getApiErrorMessage } from "@/utils/apiError";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { isDirectorBrandUiEnabled } from "@/utils/directorUi";
import PolicyDetail from "../Policy/Sales";

type Employee = {
  id: number;
  name: string;
};

type Props = {
  employees: Employee[];
};

const PAGE_SIZE = 12;

const statusConfig: Record<string, { label: string; className: string }> = {
  [PolicyStatus.DRAFT]: {
    label: "Nháp",
    className: "bg-gray-100 text-gray-600",
  },
  [PolicyStatus.PENDING]: {
    label: "Chờ duyệt",
    className: "bg-yellow-100 text-yellow-700",
  },
  [PolicyStatus.SALE_ADMIN_APPROVED]: {
    label: "Sale Admin đã duyệt",
    className: "bg-blue-100 text-blue-700",
  },
  [PolicyStatus.DIRECTOR_APPROVED]: {
    label: "Giám đốc đã duyệt",
    className: "bg-green-100 text-green-700",
  },
  [PolicyStatus.REJECTED]: {
    label: "Từ chối",
    className: "bg-red-100 text-red-700",
  },
};

const isImageFile = (file: PolicyContractFile) =>
  /\.(jpe?g|png)$/i.test(file.originalName || file.url || "");

const getPolicyId = (item: any) => Number(item.policyId || item.id || 0);
const getStatus = (item: any) => item.policyStatus || item.status || "";
const getCreatedAt = (item: any) =>
  item.policyCreatedAt || item.createdAt || item.policyData?.createdAt || "";

/**
 * Thời điểm thao tác gần nhất — dùng để xếp "mới nhất lên đầu". KHÔNG dùng
 * `createdAt`: nhân viên sửa và gửi duyệt lại một chính sách CŨ thì
 * `createdAt` vẫn giữ nguyên từ lần tạo đầu tiên, chỉ `updatedAt` mới đổi.
 */
const getUpdatedAt = (item: any) =>
  item.policyUpdatedAt || item.updatedAt || getCreatedAt(item);

const uniqueOptions = (items: any[], idKey: string, nameKey: string) => {
  const map = new Map<string, string>();
  items.forEach((item) => {
    const id = String(item[idKey] ?? "");
    const name = String(item[nameKey] ?? "").trim();
    if (id && name) map.set(id, name);
  });
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );
};

/**
 * Khoá gom môn học: bỏ khoảng trắng thừa + không phân biệt hoa/thường —
 * cùng quy ước trùng tên với danh mục môn học của backend.
 */
const subjectKey = (name: unknown) =>
  String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * Option lọc theo môn học.
 *
 * Không gom theo `subjectId` được: đó là id môn học của **từng trường**, nên một
 * môn dạy ở 7 trường sẽ sinh ra 7 dòng trùng tên trong ô lọc. Gom theo tên môn
 * (chuẩn hoá) thì mỗi môn đúng một dòng.
 */
export default function AllPoliciesTab({ employees }: Props) {
  const navigate = useNavigate();
  const isBrand = isDirectorBrandUiEnabled();
  const [policies, setPolicies] = useState<any[]>([]);
  // Popup chi tiết chính sách (desktop). Đóng thì tải lại danh sách để trạng
  // thái duyệt/từ chối vừa làm trong popup hiện ngay.
  const [openDetail, setOpenDetail] = useState<{
    policyId: number;
    state: any;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subjectCatalogs, setSubjectCatalogs] = useState<SubjectCatalog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingPolicyId, setUploadingPolicyId] = useState<number | null>(null);
  const [filesModal, setFilesModal] = useState<{ policyId: number; files: PolicyContractFile[]; canUpload: boolean } | null>(null);
  const uploadPolicyIdRef = useRef<number | null>(null);
  const uploadCategoryRef = useRef<PolicyContractCategory>("CONTRACT");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUploadContract = hasRole("saleadmin", "salesadmin", "salesadmin_la");
  const [filters, setFilters] = useState({
    policyCode: "",
    status: "",
    schoolId: "",
    subject: "",
    schoolYear: "",
    employeeId: "",
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    subjectCatalogApi.list().then(setSubjectCatalogs).catch((reason) =>
      console.error("Load subject catalogs failed", reason),
    );
  }, []);

  useEffect(() => {
    if (!employees.length) return;
    let active = true;

    const loadPolicies = async () => {
      setLoading(true);
      setError("");
      try {
        const results = await Promise.allSettled(
          employees.map(async (employee) => {
            const rows = await policiesApi.getStatsAdvanced({
              employeeId: employee.id,
              allStatuses: true,
            });
            return (Array.isArray(rows) ? rows : []).map((row) => ({
              ...row,
              employeeId: Number(row.employeeId || employee.id),
              employeeName:
                row.employeeName || row.consultantName || employee.name,
            }));
          }),
        );

        const merged = results.flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        );
        const unique = Array.from(
          new Map(
            merged.map((item) => [
              `${getPolicyId(item)}-${item.employeeId}`,
              item,
            ]),
          ).values(),
        );
        const enriched = await Promise.all(
          unique.map(async (item) => {
            const policyId = getPolicyId(item);
            if (!policyId || (getStatus(item) && getCreatedAt(item))) return item;

            try {
              const response = await policiesApi.findOne(policyId);
              const detail = response;
              return {
                ...item,
                status: getStatus(item) || detail?.status || "",
                createdAt: getCreatedAt(item) || detail?.createdAt || "",
              };
            } catch {
              return item;
            }
          }),
        );

        if (active) setPolicies(enriched);
        if (active && results.every((result) => result.status === "rejected")) {
          setError("Không thể tải danh sách chính sách.");
        }
      } catch (err) {
        console.error("Load all policies failed", err);
        if (active) setError("Không thể tải danh sách chính sách.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPolicies();
    return () => {
      active = false;
    };
  }, [employees, reloadKey]);

  const schools = useMemo(
    () => uniqueOptions(policies, "schoolId", "schoolName"),
    [policies],
  );
  const subjects = useMemo(
    () => subjectCatalogs.map((item) => ({ id: String(item.id), name: item.name })),
    [subjectCatalogs],
  );
  const schoolYears = useMemo(
    () =>
      Array.from(
        new Set(policies.map((item) => item.schoolYear).filter(Boolean)),
      ).sort((a, b) => String(b).localeCompare(String(a))),
    [policies],
  );

  const filteredPolicies = useMemo(() => {
    const result = policies.filter((item) => {
      if (
        filters.policyCode.trim() &&
        !String(getPolicyId(item)).includes(filters.policyCode.trim())
      )
        return false;
      if (filters.status && getStatus(item) !== filters.status) return false;
      if (filters.schoolId && String(item.schoolId) !== filters.schoolId)
        return false;
      if (filters.subject) {
        const catalog = subjectCatalogs.find(
          (entry) => String(entry.id) === filters.subject,
        );
        const itemCatalogId =
          item.catalogId || item.subjectCatalogId || item.subject?.catalogId;
        const matchesCatalogId =
          itemCatalogId && String(itemCatalogId) === filters.subject;
        const matchesLegacyName =
          catalog && subjectKey(item.subjectName) === subjectKey(catalog.name);
        if (!matchesCatalogId && !matchesLegacyName) return false;
      }
      if (filters.schoolYear && String(item.schoolYear) !== filters.schoolYear)
        return false;
      if (filters.employeeId && String(item.employeeId) !== filters.employeeId)
        return false;

      const createdAt = getCreatedAt(item);
      const createdTime = createdAt ? new Date(createdAt).getTime() : 0;
      if (filters.fromDate) {
        const fromTime = new Date(`${filters.fromDate}T00:00:00`).getTime();
        if (!createdTime || createdTime < fromTime) return false;
      }
      if (filters.toDate) {
        const toTime = new Date(`${filters.toDate}T23:59:59.999`).getTime();
        if (!createdTime || createdTime > toTime) return false;
      }
      return true;
    });

    // Backend trả theo tỉnh/xã/trường/môn để gom nhóm hiển thị, không theo
    // thời gian — khi đã lọc còn 1 nhân viên thì việc đó không còn ý nghĩa,
    // đổi sang mới nhất lên đầu để thấy ngay chính sách vừa gửi duyệt. Xếp
    // theo `updatedAt`, không phải `createdAt`: sửa + gửi duyệt lại một
    // chính sách cũ không đổi `createdAt`.
    return [...result].sort((a, b) => {
      const timeA = new Date(getUpdatedAt(a) || 0).getTime();
      const timeB = new Date(getUpdatedAt(b) || 0).getTime();
      return timeB - timeA;
    });
  }, [policies, filters, subjectCatalogs]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPolicies.length / PAGE_SIZE),
  );
  const paginatedPolicies = useMemo(
    () =>
      filteredPolicies.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [filteredPolicies, currentPage],
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setCurrentPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  // Giống hệt cách bấm vào thông báo chính sách (Director/Home.tsx): lấy đầy đủ
  // chi tiết chính sách trước, để trang Sales hiện đủ thông tin ngay từ đầu
  // thay vì phải tự fetch lại. Desktop mở popup tại chỗ; mobile vẫn chuyển
  // trang vì trang chi tiết có pinch-zoom riêng cho màn nhỏ.
  const openPolicy = async (policyId: number, employeeId?: number) => {
    if (!policyId) return;
    let state: any = { user: employeeId };
    try {
      const res = await policiesApi.findOne(policyId);
      state = { ...res, user: employeeId };
    } catch (err) {
      console.error("Load policy detail failed", err);
    }
    if (window.innerWidth >= 1024) {
      setOpenDetail({ policyId, state });
      return;
    }
    navigate(`/director/policy/${policyId}`, { state });
  };

  const closeDetail = () => {
    setOpenDetail(null);
    setReloadKey((key) => key + 1);
  };

  const uploadContract = async (fileList?: FileList | null) => {
    const policyId = uploadPolicyIdRef.current;
    const files = Array.from(fileList ?? []);
    if (files.length === 0 || !policyId) return;

    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`"${file.name}" vượt quá 20 MB`);
        return;
      }
    }

    const category = uploadCategoryRef.current;
    setUploadingPolicyId(policyId);
    try {
      const contract = await policiesApi.uploadContract(policyId, files, category);
      setPolicies((current) => current.map((item) =>
        getPolicyId(item) === policyId
          ? {
              ...item,
              contractFiles: contract.contractFiles ?? [],
              contractFileUrl: contract.contractFileUrl,
              contractFileName: contract.contractFileName,
            }
          : item,
      ));
      setFilesModal((current) =>
        current && current.policyId === policyId
          ? { ...current, files: contract.contractFiles ?? [] }
          : current,
      );
      toast.success(files.length > 1 ? `Đã upload ${files.length} file hợp đồng` : "Đã upload file hợp đồng");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể upload hợp đồng"));
    } finally {
      setUploadingPolicyId(null);
      uploadPolicyIdRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeContract = async (policyId: number, file: PolicyContractFile) => {
    if (!window.confirm(`Xoá hợp đồng "${file.originalName}"?`)) return;
    setUploadingPolicyId(policyId);
    try {
      const contract = await policiesApi.removeContract(policyId, file.id);
      setPolicies((current) => current.map((item) =>
        getPolicyId(item) === policyId
          ? {
              ...item,
              contractFiles: contract.contractFiles ?? [],
              contractFileUrl: contract.contractFileUrl,
              contractFileName: contract.contractFileName,
            }
          : item,
      ));
      setFilesModal((current) =>
        current && current.policyId === policyId
          ? { ...current, files: contract.contractFiles ?? [] }
          : current,
      );
      toast.success("Đã xoá hợp đồng");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xoá hợp đồng"));
    } finally {
      setUploadingPolicyId(null);
    }
  };

  const renderCategorySection = (
    category: PolicyContractCategory,
    files: PolicyContractFile[],
    policyId: number,
    canUpload: boolean,
  ) => {
    const categoryFiles = files.filter(
      (file) => (file.category ?? "CONTRACT") === category,
    );
    return (
      <div key={category} className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-white px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-semibold text-gray-800">
              {POLICY_CONTRACT_CATEGORY_LABELS[category]}
            </span>
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {categoryFiles.length}
            </span>
          </div>
          {canUpload && (
            <button
              type="button"
              disabled={uploadingPolicyId !== null}
              onClick={() => {
                uploadPolicyIdRef.current = policyId;
                uploadCategoryRef.current = category;
                fileInputRef.current?.click();
              }}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingPolicyId === policyId ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              Thêm file
            </button>
          )}
        </div>
        {categoryFiles.length === 0 ? (
          <p className="px-3 py-3 text-xs text-gray-400">Chưa có file</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto p-3">
            {categoryFiles.map((file) => (
              <li key={file.id} className="rounded-xl border border-gray-100 p-2">
                <div className="flex min-w-0 items-center gap-2">
                  {isImageFile(file) && (
                    <a
                      href={resolveApiFileUrl(file.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <img
                        src={resolveApiFileUrl(file.url)}
                        alt={file.originalName}
                        className="h-12 w-12 rounded-md border border-gray-100 object-cover"
                      />
                    </a>
                  )}
                  <a
                    href={resolveApiFileUrl(file.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={file.originalName}
                    className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
                  >
                    {!isImageFile(file) && <span className="shrink-0" aria-hidden>📎</span>}
                    <span className="truncate">{file.originalName}</span>
                    <ExternalLink size={14} className="shrink-0" />
                  </a>
                  {canUploadContract && file.id !== "legacy" && (
                    <button
                      type="button"
                      disabled={uploadingPolicyId !== null}
                      onClick={() => void removeContract(policyId, file)}
                      title="Xoá file này"
                      className="ml-auto shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 pb-8 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void uploadContract(event.target.files)}
      />
      <div className={`bg-white rounded-2xl p-4 shadow-sm ${isBrand ? "border border-blue-900/10" : ""}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            inputMode="numeric"
            value={filters.policyCode}
            onChange={(e) => updateFilter("policyCode", e.target.value)}
            placeholder="Tìm theo mã chính sách…"
            className="border rounded-xl px-3 py-2.5 text-sm"
          />

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="border rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusConfig).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>

          <SearchableSelect
            value={filters.schoolId}
            onChange={(value) => updateFilter("schoolId", value)}
            options={schools.map((item) => ({ id: Number(item.id), name: item.name }))}
            placeholder="Tất cả trường học"
            searchPlaceholder="Tìm trường học…"
            className="text-sm"
          />

          <SearchableSelect value={filters.subject} onChange={(value) => updateFilter("subject", value)} options={subjects} placeholder="Tất cả môn học" searchPlaceholder="Tìm môn học…" />

          <select
            value={filters.schoolYear}
            onChange={(e) => updateFilter("schoolYear", e.target.value)}
            className="border rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">Tất cả năm học</option>
            {schoolYears.map((year) => (
              <option key={String(year)} value={String(year)}>{String(year)}</option>
            ))}
          </select>

          <SearchableSelect value={filters.employeeId} onChange={(value) => updateFilter("employeeId", value)} options={employees} placeholder="Tất cả nhân viên" searchPlaceholder="Tìm nhân viên…" />

          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0 text-xs text-gray-500">
              Từ ngày tạo
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => updateFilter("fromDate", e.target.value)}
                className="w-full min-w-0 border rounded-xl px-3 py-2 mt-1 text-sm text-gray-700"
              />
            </label>
            <label className="min-w-0 text-xs text-gray-500">
              Đến ngày tạo
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => updateFilter("toDate", e.target.value)}
                className="w-full min-w-0 border rounded-xl px-3 py-2 mt-1 text-sm text-gray-700"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{filteredPolicies.length} chính sách</span>
          <button
            type="button"
            onClick={() => {
              setCurrentPage(1);
              setFilters({
                policyCode: "", status: "", schoolId: "", subject: "", schoolYear: "",
                employeeId: "", fromDate: "", toDate: "",
              });
            }}
            className={`${isBrand ? "text-[#005BEA]" : "text-blue-600"} font-medium`}
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-gray-500 py-8">Đang tải chính sách...</p>}
      {!loading && error && <p className="text-center text-red-500 py-8">{error}</p>}
      {!loading && !error && filteredPolicies.length === 0 && (
        <p className="text-center text-gray-500 py-8">Không có chính sách phù hợp.</p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginatedPolicies.map((item) => {
            const policyId = getPolicyId(item);
            const status = statusConfig[getStatus(item)] || {
              label: "Không xác định",
              className: "bg-gray-100 text-gray-500",
            };
            const createdAt = getCreatedAt(item);
            const updatedAt = getUpdatedAt(item);

            // Backend chỉ cho upload hợp đồng khi chính sách đã DIRECTOR_APPROVED.
            const approved = getStatus(item) === PolicyStatus.DIRECTOR_APPROVED;
            // Ưu tiên danh sách nhiều file; bản ghi cũ chưa có thì dựng từ cột đơn.
            const contractFiles: PolicyContractFile[] =
              item.contractFiles?.length
                ? item.contractFiles
                : item.contractFileUrl
                  ? [{
                      id: "legacy",
                      url: item.contractFileUrl,
                      originalName: item.contractFileName || "Hợp đồng PDF",
                      size: 0,
                      uploadedById: 0,
                      uploadedAt: "",
                    }]
                  : [];
            const contractUrl = contractFiles.length > 0 ? "có" : "";

            return (
              <div
                key={`${policyId}-${item.employeeId}`}
                className={`bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition ${isBrand ? "border border-blue-900/10" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => openPolicy(policyId, item.employeeId)}
                  className="w-full text-left space-y-3"
                >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Mã CS: #{policyId}</p>
                    <p className="font-semibold text-gray-900">{item.schoolName || "Chưa có tên trường"}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.subjectName || "Chưa có môn học"}</p>
                  </div>
                  <span className={`shrink-0 h-fit text-xs px-2.5 py-1 rounded-full ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Nhân viên: <span className="font-medium">{item.employeeName || "-"}</span></p>
                  <p>Năm học: <span className="font-medium">{item.schoolYear || "-"}</span></p>
                  <p>Ngày tạo: <span className="font-medium">{createdAt ? new Date(createdAt).toLocaleDateString("vi-VN") : "-"}</span></p>
                  <p>Ngày gửi duyệt: <span className="font-medium">{updatedAt ? new Date(updatedAt).toLocaleDateString("vi-VN") : "-"}</span></p>
                </div>
                </button>
                {(contractUrl || (canUploadContract && approved)) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFilesModal({
                          policyId,
                          files: contractFiles,
                          canUpload: canUploadContract && approved,
                        })
                      }
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-blue-200 px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <span aria-hidden>📎</span>
                      {contractFiles.length > 0 ? `Upload file (${contractFiles.length})` : "Upload file"}
                    </button>
                  </div>
                )}
                {!approved && canUploadContract && !contractUrl && (
                  <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                    Chỉ được upload hợp đồng khi chính sách đã được Giám đốc duyệt
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && filteredPolicies.length > 0 && (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ${isBrand ? "border border-blue-900/10" : ""}`}>
          <p className="text-sm text-gray-500">
            Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filteredPolicies.length)} trong tổng{" "}
            {filteredPolicies.length} chính sách
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <span className="min-w-20 text-center text-sm text-gray-600">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {openDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={closeDetail}
        >
          <div
            className="relative flex h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-blue-900/10 bg-white px-5 py-3">
              <h2 className="text-lg font-bold text-[#0047B8]">Chi tiết chính sách</h2>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PolicyDetail
                key={openDetail.policyId}
                embedded
                policyId={openDetail.policyId}
                initialState={openDetail.state}
                onClose={closeDetail}
              />
            </div>
          </div>
        </div>
      )}

      {filesModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setFilesModal(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-base font-bold text-gray-900">
                Tổng hợp file ({filesModal.files.length})
              </h2>
              <button
                type="button"
                onClick={() => setFilesModal(null)}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 sm:grid sm:grid-cols-1 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
              {POLICY_CONTRACT_CATEGORIES.map((category) =>
                renderCategorySection(category, filesModal.files, filesModal.policyId, filesModal.canUpload),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
