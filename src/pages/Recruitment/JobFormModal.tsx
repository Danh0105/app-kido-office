import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { departmentApi } from "@/service/department";
import { provinceApi } from "@/service/province";
import {
  recruitmentApi,
  type CreateRecruitmentJobPayload,
  type RecruitmentJob,
  type UpdateRecruitmentJobPayload,
} from "@/service/recruitment";
import { wardApi } from "@/service/ward";
import { getEmployeeName } from "@/utils/auth";
import PositionSelect from "./PositionSelect";
import { errorMessage, inputClass } from "./shared";

type Option = { id: number; name: string };
type LocationForm = {
  key: string;
  provinceId: string;
  wardId: string;
  address: string;
  wards: Option[];
};

type JobForm = {
  positionRole: string;
  code: string;
  title: string;
  industryIds: number[];
  seniority: string;
  experienceLevel: string;
  applicationDeadline: string;
  salaryMin: string;
  salaryMax: string;
  salaryNegotiable: boolean;
  salaryStructure: string;
  description: string;
  requirements: string;
  benefits: string;
  employmentType: string;
  numberOfPositions: string;
  skills: string[];
  educationLevel: string;
  probationPeriod: string;
  locations: LocationForm[];
  allowApplicationsWithoutCv: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  additionalPhones: string[];
};

type Errors = Partial<Record<keyof JobForm, string>>;

const SENIORITY = [
  ["INTERN", "Thực tập sinh"],
  ["STAFF", "Nhân viên"],
  ["SPECIALIST", "Chuyên viên"],
  ["TEAM_LEAD", "Trưởng nhóm"],
  ["DEPARTMENT_HEAD", "Trưởng phòng"],
  ["MANAGER", "Quản lý"],
  ["DIRECTOR", "Giám đốc"],
] as const;

const EXPERIENCE = [
  ["NONE", "Không yêu cầu"],
  ["UNDER_ONE_YEAR", "Dưới 1 năm"],
  ["ONE_YEAR", "1 năm"],
  ["TWO_YEARS", "2 năm"],
  ["THREE_YEARS", "3 năm"],
  ["THREE_TO_FIVE_YEARS", "3–5 năm"],
  ["OVER_FIVE_YEARS", "Trên 5 năm"],
] as const;

const EMPLOYMENT = [
  ["FULL_TIME", "Toàn thời gian"],
  ["PART_TIME", "Bán thời gian"],
  ["INTERNSHIP", "Thực tập"],
  ["CONTRACT", "Hợp đồng"],
  ["SEASONAL", "Thời vụ"],
  ["REMOTE", "Làm việc từ xa"],
  ["HYBRID", "Hybrid"],
  ["COLLABORATOR", "Cộng tác viên"],
] as const;

const SALARY_STRUCTURE = [
  ["FIXED", "Lương cố định"],
  ["BASE_KPI", "Lương cơ bản + KPI"],
  ["BASE_COMMISSION", "Lương cơ bản + hoa hồng"],
  ["SALES_BASED", "Lương theo doanh số"],
  ["NEGOTIABLE", "Thỏa thuận"],
] as const;

const EDUCATION = [
  ["NONE", "Không yêu cầu"],
  ["HIGH_SCHOOL", "THPT"],
  ["VOCATIONAL", "Trung cấp"],
  ["COLLEGE", "Cao đẳng"],
  ["UNIVERSITY", "Đại học"],
  ["POSTGRADUATE", "Sau đại học"],
] as const;

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,49}$/;
const PHONE_PATTERN = /^(?:\+84|0)\d{9,10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MONEY = 1_000_000_000_000;
const MAX_HTML = 20_000;
const today = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
};
const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blankLocation = (): LocationForm => ({
  key: key(),
  provinceId: "",
  wardId: "",
  address: "",
  wards: [],
});
const normalizePhone = (value: string) => value.replace(/[\s.()-]/g, "");
const formatDateVn = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
};
const textContent = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-z0-9#]+;/gi, "x")
    .trim();

function initialForm(job?: RecruitmentJob): JobForm {
  const industryIds =
    job?.industryIds?.length
      ? job.industryIds
      : job?.departmentId
      ? [job.departmentId]
      : job?.department?.id
      ? [job.department.id]
      : [];
  const locations = job?.workLocations?.length
    ? job.workLocations.map((item) => ({
        key: key(),
        provinceId: String(item.provinceId),
        wardId: String(item.wardId),
        address: item.address,
        wards: [{ id: item.wardId, name: item.wardName }],
      }))
    : [blankLocation()];
  return {
    positionRole: job?.positionRole ?? "",
    code: job?.code ?? "",
    title: job?.title ?? "",
    industryIds,
    seniority: job?.seniority ?? "",
    experienceLevel: job?.experienceLevel ?? "",
    applicationDeadline: job?.applicationDeadline ?? "",
    salaryMin: job?.salaryMin == null ? "" : String(job.salaryMin),
    salaryMax: job?.salaryMax == null ? "" : String(job.salaryMax),
    salaryNegotiable:
      job?.salaryNegotiable ??
      Boolean(job && job.salaryMin == null && job.salaryMax == null),
    salaryStructure: job?.salaryStructure ?? "",
    description: job?.description ?? job?.responsibilities ?? "",
    requirements: job?.requirements ?? "",
    benefits: job?.benefits ?? "",
    employmentType: job?.employmentType ?? "FULL_TIME",
    numberOfPositions: String(job?.numberOfPositions ?? 1),
    skills: job?.screeningCriteria?.requiredSkills ?? [],
    educationLevel: job?.educationLevel ?? "NONE",
    probationPeriod: job?.probationPeriod ?? "",
    locations,
    allowApplicationsWithoutCv: job?.allowApplicationsWithoutCv ?? true,
    contactName: job?.contactName ?? getEmployeeName() ?? "",
    contactEmail: job?.contactEmail ?? "",
    contactPhone: job?.contactPhone ?? "",
    additionalPhones: job?.additionalPhones ?? [],
  };
}

function validate(form: JobForm, full: boolean, creating: boolean): Errors {
  const errors: Errors = {};
  // Server bắt buộc chức danh khi tạo (cấp tài khoản lúc Đã tuyển); vị trí cũ
  // chưa gắn thì sửa vẫn lưu được.
  if (creating && !form.positionRole)
    errors.positionRole = "Vui lòng chọn chức danh hệ thống.";
  if (!CODE_PATTERN.test(form.code.trim().toUpperCase()))
    errors.code = 'Chỉ gồm chữ, số, "-" hoặc "_" (2–50 ký tự).';
  if (!form.title.trim()) errors.title = "Vui lòng nhập tiêu đề vị trí.";
  else if (form.title.trim().length > 255) errors.title = "Tối đa 255 ký tự.";
  if (form.industryIds.length > 3)
    errors.industryIds = "Chỉ được chọn tối đa 3 ngành nghề.";

  const positions = Number(form.numberOfPositions);
  if (!Number.isInteger(positions) || positions < 1 || positions > 1000)
    errors.numberOfPositions = "Số lượng phải là số nguyên từ 1 đến 1000.";

  const parseMoney = (field: "salaryMin" | "salaryMax") => {
    const raw = form[field].trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) {
      errors[field] = "Số tiền không hợp lệ.";
      return null;
    }
    return value;
  };
  const min = parseMoney("salaryMin");
  const max = parseMoney("salaryMax");
  if (min != null && max != null && min > max)
    errors.salaryMax = "Lương tối đa không được thấp hơn lương tối thiểu.";

  for (const field of ["description", "requirements", "benefits"] as const) {
    if (form[field].length > MAX_HTML) errors[field] = "Tối đa 20.000 ký tự.";
  }

  const phones = [form.contactPhone, ...form.additionalPhones]
    .map(normalizePhone)
    .filter(Boolean);
  if (form.contactEmail && !EMAIL_PATTERN.test(form.contactEmail.trim()))
    errors.contactEmail = "Email không hợp lệ.";
  if (form.contactPhone && !PHONE_PATTERN.test(normalizePhone(form.contactPhone)))
    errors.contactPhone = "Số điện thoại Việt Nam không hợp lệ.";
  if (form.additionalPhones.some((item) => !PHONE_PATTERN.test(normalizePhone(item))))
    errors.additionalPhones = "Có số điện thoại bổ sung không hợp lệ.";
  if (new Set(phones).size !== phones.length)
    errors.additionalPhones = "Các số điện thoại không được trùng nhau.";
  if (form.applicationDeadline && form.applicationDeadline < today())
    errors.applicationDeadline = "Hạn nộp không được là ngày đã qua.";
  if (
    form.locations.some((item) => {
      const values = [item.provinceId, item.wardId, item.address.trim()];
      return values.some(Boolean) && !values.every(Boolean);
    })
  )
    errors.locations = "Địa điểm đã nhập phải có đủ tỉnh/thành, phường/xã và địa chỉ.";

  if (!full) return errors;
  if (!form.industryIds.length)
    errors.industryIds = "Vui lòng chọn ít nhất một ngành nghề.";
  if (!form.seniority) errors.seniority = "Vui lòng chọn cấp bậc.";
  if (!form.experienceLevel)
    errors.experienceLevel = "Vui lòng chọn kinh nghiệm.";
  if (!form.applicationDeadline)
    errors.applicationDeadline = "Vui lòng chọn hạn nộp hồ sơ.";
  if (!form.salaryNegotiable) {
    if (!form.salaryMin.trim()) errors.salaryMin = "Vui lòng nhập lương tối thiểu.";
    if (!form.salaryMax.trim()) errors.salaryMax = "Vui lòng nhập lương tối đa.";
  }
  if (!textContent(form.description))
    errors.description = "Vui lòng nhập mô tả công việc.";
  if (!textContent(form.requirements))
    errors.requirements = "Vui lòng nhập yêu cầu công việc.";
  if (!textContent(form.benefits)) errors.benefits = "Vui lòng nhập quyền lợi.";
  if (
    !form.locations.length ||
    form.locations.some(
      (item) => !item.provinceId || !item.wardId || !item.address.trim()
    )
  )
    errors.locations = "Vui lòng nhập đủ tỉnh/thành, phường/xã và địa chỉ.";
  if (!form.contactName.trim()) errors.contactName = "Vui lòng nhập họ tên.";
  if (!form.contactEmail.trim()) errors.contactEmail = "Vui lòng nhập email.";
  if (!form.contactPhone.trim())
    errors.contactPhone = "Vui lòng nhập số điện thoại.";
  return errors;
}

function payload(form: JobForm, job?: RecruitmentJob) {
  const text = (value: string) => value.trim() || null;
  const data: CreateRecruitmentJobPayload = {
    // Không gửi null: server không cho bỏ chức danh đã gắn.
    ...(form.positionRole ? { positionRole: form.positionRole } : {}),
    code: form.code.trim().toUpperCase(),
    title: form.title.trim(),
    departmentId: form.industryIds[0] ?? null,
    industryIds: form.industryIds,
    seniority: text(form.seniority),
    experienceLevel: text(form.experienceLevel),
    applicationDeadline: text(form.applicationDeadline),
    employmentType: form.employmentType,
    numberOfPositions: Number(form.numberOfPositions),
    salaryMin:
      form.salaryNegotiable || !form.salaryMin.trim()
        ? null
        : Number(form.salaryMin),
    salaryMax:
      form.salaryNegotiable || !form.salaryMax.trim()
        ? null
        : Number(form.salaryMax),
    salaryNegotiable: form.salaryNegotiable,
    salaryStructure: form.salaryNegotiable
      ? "NEGOTIABLE"
      : text(form.salaryStructure),
    currency: "VND",
    description: text(form.description),
    requirements: text(form.requirements),
    benefits: text(form.benefits),
    educationLevel: text(form.educationLevel),
    probationPeriod: text(form.probationPeriod),
    workLocations: form.locations
      .filter((item) => item.provinceId || item.wardId || item.address.trim())
      .map((item) => ({
        provinceId: Number(item.provinceId),
        wardId: Number(item.wardId),
        address: item.address.trim(),
      })),
    allowApplicationsWithoutCv: form.allowApplicationsWithoutCv,
    contactName: text(form.contactName),
    contactEmail: text(form.contactEmail),
    contactPhone: form.contactPhone
      ? normalizePhone(form.contactPhone)
      : null,
    additionalPhones: form.additionalPhones.map(normalizePhone),
    screeningCriteria: {
      ...(job?.screeningCriteria ?? {}),
      requiredSkills: form.skills,
    },
  };
  return data;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#005BEA]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[10px] font-semibold text-rose-600">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

function RichTextEditor({
  value,
  onChange,
  error,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label: string;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value)
      editorRef.current.innerHTML = value;
  }, [value]);
  const command = (name: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, argument);
    onChange(editorRef.current?.innerHTML ?? "");
  };
  const tools: Array<[string, string, string?]> = [
    ["B", "bold"],
    ["I", "italic"],
    ["U", "underline"],
    ["•", "insertUnorderedList"],
    ["1.", "insertOrderedList"],
    ["←", "justifyLeft"],
    ["↔", "justifyCenter"],
    ["→", "justifyRight"],
    ["↶", "undo"],
    ["↷", "redo"],
  ];
  return (
    <FormField label={`${label} *`} error={error}>
      <div
        className={`overflow-hidden rounded-xl border bg-white transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 ${
          error ? "border-rose-300" : "border-slate-200"
        }`}
      >
        <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50 p-2">
          {tools.map(([text, name]) => (
            <button
              key={name}
              type="button"
              title={name}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command(name)}
              className="flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-bold text-slate-600 hover:bg-white hover:text-[#005BEA]"
            >
              {text}
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-invalid={Boolean(error)}
          data-placeholder={placeholder}
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          className="min-h-32 px-3 py-2.5 text-xs leading-6 text-slate-700 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
        />
      </div>
    </FormField>
  );
}

function DatePickerField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="relative">
      <input
        value={formatDateVn(value)}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        placeholder="DD/MM/YYYY"
        className={`${inputClass} pointer-events-none ${
          error ? "border-rose-300 ring-1 ring-rose-200" : ""
        }`}
      />
      <input
        type="date"
        min={today()}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Hạn nộp hồ sơ"
        aria-invalid={Boolean(error)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase()))
      return setDraft("");
    onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#005BEA]"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Xóa ${value}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            }
          }}
          className="min-w-40 flex-1 bg-transparent px-1 py-1 text-xs outline-none"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

export default function JobFormModal({
  job,
  onClose,
  onSaved,
}: {
  job?: RecruitmentJob;
  onClose: () => void;
  onSaved: (job: RecruitmentJob, continueFlow: boolean) => void;
}) {
  const initial = useMemo(() => initialForm(job), [job]);
  const [form, setForm] = useState(initial);
  const initialSnapshot = useRef(JSON.stringify(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [departments, setDepartments] = useState<Option[]>([]);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [industrySearch, setIndustrySearch] = useState("");
  const [industryOpen, setIndustryOpen] = useState(false);
  const [saving, setSaving] = useState<"draft" | "continue" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(form) !== initialSnapshot.current;

  const set = <K extends keyof JobForm>(field: K, value: JobForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  useEffect(() => {
    Promise.all([departmentApi.findAll(), provinceApi.getAll()])
      .then(([departmentList, provinceList]) => {
        setDepartments(
          departmentList.map(({ id, name }: Option) => ({ id, name }))
        );
        setProvinces(
          provinceList.map(({ id, name }: Option) => ({ id, name }))
        );
      })
      .catch(() => toast.error("Không tải được danh mục cho form tuyển dụng"));
  }, []);

  useEffect(() => {
    form.locations.forEach((location) => {
      if (!location.provinceId || location.wards.length > 1) return;
      wardApi
        .getByProvince(Number(location.provinceId))
        .then((list) => {
          setForm((current) => ({
            ...current,
            locations: current.locations.map((item) =>
              item.key === location.key
                ? {
                    ...item,
                    wards: list.map(({ id, name }: Option) => ({ id, name })),
                  }
                : item
            ),
          }));
        })
        .catch(() => undefined);
    });
    // Chỉ nạp danh mục phường cho dữ liệu ban đầu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    onClose();
  }, [dirty, onClose, saving]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, saving]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [requestClose]);

  const filteredDepartments = useMemo(() => {
    const query = industrySearch.trim().toLocaleLowerCase("vi");
    return departments.filter(
      (item) =>
        form.industryIds.includes(item.id) ||
        !query ||
        item.name.toLocaleLowerCase("vi").includes(query)
    );
  }, [departments, form.industryIds, industrySearch]);

  const changeProvince = async (locationKey: string, provinceId: string) => {
    setForm((current) => ({
      ...current,
      locations: current.locations.map((item) =>
        item.key === locationKey
          ? { ...item, provinceId, wardId: "", wards: [] }
          : item
      ),
    }));
    setErrors((current) => ({ ...current, locations: undefined }));
    if (!provinceId) return;
    try {
      const list = await wardApi.getByProvince(Number(provinceId));
      setForm((current) => ({
        ...current,
        locations: current.locations.map((item) =>
          item.key === locationKey
            ? {
                ...item,
                wards: list.map(({ id, name }: Option) => ({ id, name })),
              }
            : item
        ),
      }));
    } catch {
      toast.error("Không tải được danh sách phường/xã");
    }
  };

  const submit = async (continueFlow: boolean) => {
    const found = validate(form, continueFlow, !job);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      toast.error(
        continueFlow
          ? "Vui lòng hoàn tất các trường bắt buộc"
          : "Vui lòng kiểm tra các trường chưa hợp lệ"
      );
      requestAnimationFrame(() => {
        const invalid = formRef.current?.querySelector<HTMLElement>(
          '[aria-invalid="true"]'
        );
        invalid?.focus();
        invalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setSaving(continueFlow ? "continue" : "draft");
    try {
      const data = payload(form, job);
      const saved = job
        ? await recruitmentApi.updateJob(
            job.id,
            data as UpdateRecruitmentJobPayload
          )
        : await recruitmentApi.createJob(data);
      initialSnapshot.current = JSON.stringify(form);
      toast.success(job ? "Đã lưu vị trí tuyển dụng" : "Đã tạo bản nháp vị trí");
      onSaved(saved, continueFlow);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  const errorProps = (field: keyof JobForm) => ({
    "aria-invalid": Boolean(errors[field]),
    className: `${inputClass} ${errors[field] ? "border-rose-300 ring-1 ring-rose-200" : ""}`,
  });

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[2px]">
      <div className="flex h-full flex-col bg-[#F6F8FC] lg:mx-auto lg:max-w-6xl lg:shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#005BEA]">
              Quản lý tuyển dụng
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-900">
              {job ? "Chỉnh sửa vị trí tuyển dụng" : "Tạo vị trí tuyển dụng"}
            </h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={Boolean(saving)}
            aria-label="Đóng form"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => event.preventDefault()}
          className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-6"
        >
          <Section title="1. Thông tin cơ bản">
            <div className="grid gap-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <FormField label="Mã vị trí *" error={errors.code}>
                  <input
                    value={form.code}
                    onChange={(event) => set("code", event.target.value.toUpperCase())}
                    placeholder="SALES-HCM-01"
                    {...errorProps("code")}
                  />
                </FormField>
              </div>
              <div className="md:col-span-8">
                <FormField label="Tiêu đề vị trí tuyển dụng *" error={errors.title}>
                  <input
                    value={form.title}
                    onChange={(event) => set("title", event.target.value)}
                    placeholder="Nhập tên vị trí tuyển dụng"
                    {...errorProps("title")}
                  />
                </FormField>
              </div>

              <div className="md:col-span-12">
                <PositionSelect
                  value={form.positionRole}
                  required={!job}
                  onChange={(value, label) => {
                    set("positionRole", value);
                    if (!form.title.trim() && label) set("title", label);
                  }}
                />
                {errors.positionRole ? (
                  <span className="mt-1 block text-[10px] font-semibold text-rose-600">
                    {errors.positionRole}
                  </span>
                ) : (
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Quyết định quyền của tài khoản được cấp khi ứng viên Đã tuyển.
                  </span>
                )}
              </div>

              <div className="relative md:col-span-12">
                <FormField
                  label="Ngành nghề tuyển dụng * (tối đa 3)"
                  error={errors.industryIds}
                  hint="Nguồn dữ liệu: danh mục phòng ban hiện có."
                >
                  <button
                    type="button"
                    aria-invalid={Boolean(errors.industryIds)}
                    onClick={() => setIndustryOpen((value) => !value)}
                    className={`${inputClass} flex items-center justify-between text-left`}
                  >
                    <span className="flex flex-wrap gap-1">
                      {form.industryIds.length
                        ? form.industryIds.map((id) => (
                            <span
                              key={id}
                              className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#005BEA]"
                            >
                              {departments.find((item) => item.id === id)?.name ||
                                `#${id}`}
                            </span>
                          ))
                        : "Chọn ngành nghề"}
                    </span>
                    <ChevronDown size={15} />
                  </button>
                </FormField>
                {industryOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <input
                      autoFocus
                      value={industrySearch}
                      onChange={(event) => setIndustrySearch(event.target.value)}
                      className={inputClass}
                      placeholder="Tìm ngành nghề…"
                    />
                    <div className="mt-2 max-h-44 overflow-y-auto">
                      {filteredDepartments.map((item) => {
                        const checked = form.industryIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!checked && form.industryIds.length >= 3}
                              onChange={() =>
                                set(
                                  "industryIds",
                                  checked
                                    ? form.industryIds.filter((id) => id !== item.id)
                                    : [...form.industryIds, item.id]
                                )
                              }
                            />
                            {item.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-4">
                <FormField label="Cấp bậc *" error={errors.seniority}>
                  <select
                    value={form.seniority}
                    onChange={(event) => set("seniority", event.target.value)}
                    {...errorProps("seniority")}
                  >
                    <option value="">Chọn cấp bậc</option>
                    {SENIORITY.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="md:col-span-4">
                <FormField label="Kinh nghiệm *" error={errors.experienceLevel}>
                  <select
                    value={form.experienceLevel}
                    onChange={(event) => set("experienceLevel", event.target.value)}
                    {...errorProps("experienceLevel")}
                  >
                    <option value="">Chọn kinh nghiệm</option>
                    {EXPERIENCE.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="md:col-span-4">
                <FormField label="Hạn nộp hồ sơ *" error={errors.applicationDeadline}>
                  <DatePickerField
                    value={form.applicationDeadline}
                    onChange={(value) => set("applicationDeadline", value)}
                    error={errors.applicationDeadline}
                  />
                </FormField>
              </div>

              <div className="md:col-span-8">
                <FormField label="Khoảng lương *" error={errors.salaryMin || errors.salaryMax}>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      disabled={form.salaryNegotiable}
                      value={form.salaryMin}
                      onChange={(event) => set("salaryMin", event.target.value)}
                      placeholder="Tối thiểu"
                      {...errorProps("salaryMin")}
                    />
                    <span className="text-slate-400">→</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      disabled={form.salaryNegotiable}
                      value={form.salaryMax}
                      onChange={(event) => set("salaryMax", event.target.value)}
                      placeholder="Tối đa"
                      {...errorProps("salaryMax")}
                    />
                    <span className="text-[10px] font-bold text-slate-500">VNĐ</span>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.salaryNegotiable}
                      onChange={(event) => set("salaryNegotiable", event.target.checked)}
                    />
                    Thỏa thuận
                  </label>
                </FormField>
              </div>
              <div className="md:col-span-4">
                <FormField label="Cấu trúc lương">
                  <select
                    value={form.salaryStructure}
                    onChange={(event) => set("salaryStructure", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Chọn cấu trúc</option>
                    {SALARY_STRUCTURE.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>
          </Section>

          <Section title="2. Chi tiết công việc">
            <div className="space-y-4">
              <RichTextEditor
                label="Mô tả công việc"
                value={form.description}
                onChange={(value) => set("description", value)}
                error={errors.description}
                placeholder="Nhập nhiệm vụ và phạm vi công việc…"
              />
              <RichTextEditor
                label="Yêu cầu công việc"
                value={form.requirements}
                onChange={(value) => set("requirements", value)}
                error={errors.requirements}
                placeholder="Nhập học vấn, kinh nghiệm, kiến thức và kỹ năng…"
              />
              <RichTextEditor
                label="Quyền lợi"
                value={form.benefits}
                onChange={(value) => set("benefits", value)}
                error={errors.benefits}
                placeholder="Nhập thu nhập, thưởng, bảo hiểm và phúc lợi…"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Hình thức làm việc *">
                  <select
                    value={form.employmentType}
                    onChange={(event) => set("employmentType", event.target.value)}
                    className={inputClass}
                  >
                    {EMPLOYMENT.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Số lượng tuyển *" error={errors.numberOfPositions}>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() =>
                        set("numberOfPositions", String(Math.max(1, Number(form.numberOfPositions || 1) - 1)))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-l-xl border border-r-0 border-slate-200"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.numberOfPositions}
                      onChange={(event) => set("numberOfPositions", event.target.value)}
                      aria-invalid={Boolean(errors.numberOfPositions)}
                      className="h-10 min-w-0 flex-1 border border-slate-200 px-3 text-center text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => set("numberOfPositions", String(Number(form.numberOfPositions || 0) + 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-r-xl border border-l-0 border-slate-200"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Kỹ năng yêu cầu">
                    <TagInput
                      values={form.skills}
                      onChange={(values) => set("skills", values)}
                      placeholder="Nhập kỹ năng, nhấn Enter…"
                    />
                  </FormField>
                </div>
                <FormField label="Bằng cấp">
                  <select
                    value={form.educationLevel}
                    onChange={(event) => set("educationLevel", event.target.value)}
                    className={inputClass}
                  >
                    {EDUCATION.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </FormField>
                <div>
                  {form.probationPeriod ? (
                    <FormField label="Thời gian thử việc">
                      <div className="flex gap-2">
                        <input
                          value={form.probationPeriod}
                          onChange={(event) => set("probationPeriod", event.target.value)}
                          placeholder="Ví dụ: 2 tháng"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => set("probationPeriod", "")}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </FormField>
                  ) : (
                    <button
                      type="button"
                      onClick={() => set("probationPeriod", "2 tháng")}
                      className="mt-6 text-xs font-bold text-[#005BEA]"
                    >
                      + Thời gian thử việc
                    </button>
                  )}
                </div>
              </div>

              <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-800">
                Form không thu thập yêu cầu giới tính hoặc độ tuổi vì đây không phải tiêu chí sàng lọc hợp lệ trong chính sách tuyển dụng hiện tại.
              </p>
            </div>
          </Section>

          <Section title="3. Địa điểm làm việc">
            <div className="space-y-3">
              {form.locations.map((location, index) => (
                <div key={location.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">Địa điểm {index + 1}</span>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => set("locations", form.locations.filter((item) => item.key !== location.key))}
                        className="text-rose-600"
                        aria-label={`Xóa địa điểm ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <FormField label="Tỉnh/Thành phố *">
                        <select
                          value={location.provinceId}
                          onChange={(event) => void changeProvince(location.key, event.target.value)}
                          aria-invalid={Boolean(errors.locations && !location.provinceId)}
                          className={inputClass}
                        >
                          <option value="">Chọn tỉnh/thành</option>
                          {provinces.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    <div className="md:col-span-3">
                      <FormField label="Phường/Xã *">
                        <select
                          value={location.wardId}
                          onChange={(event) =>
                            set("locations", form.locations.map((item) =>
                              item.key === location.key ? { ...item, wardId: event.target.value } : item
                            ))
                          }
                          disabled={!location.provinceId}
                          aria-invalid={Boolean(errors.locations && !location.wardId)}
                          className={inputClass}
                        >
                          <option value="">Chọn phường/xã</option>
                          {location.wards.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    <div className="md:col-span-6">
                      <FormField label="Địa chỉ chi tiết *">
                        <input
                          value={location.address}
                          onChange={(event) =>
                            set("locations", form.locations.map((item) =>
                              item.key === location.key ? { ...item, address: event.target.value } : item
                            ))
                          }
                          aria-invalid={Boolean(errors.locations && !location.address.trim())}
                          className={inputClass}
                          placeholder="Số nhà, tên đường…"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              ))}
              {errors.locations && <p className="text-[10px] font-semibold text-rose-600">{errors.locations}</p>}
              <button
                type="button"
                disabled={form.locations.length >= 5}
                onClick={() => set("locations", [...form.locations, blankLocation()])}
                className="text-xs font-bold text-[#005BEA] disabled:text-slate-400"
              >
                + Thêm địa điểm làm việc ({form.locations.length}/5)
              </button>
            </div>
          </Section>

          <Section title="4. Tùy chọn khác">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-xs font-bold text-slate-700">Cho phép ứng tuyển không cần CV</p>
                <p className="mt-1 text-[10px] text-slate-400">Khi tắt, backend yêu cầu ứng viên có CV trước khi tạo hồ sơ.</p>
              </div>
              <input
                type="checkbox"
                checked={form.allowApplicationsWithoutCv}
                onChange={(event) => set("allowApplicationsWithoutCv", event.target.checked)}
                className="h-5 w-5 accent-[#005BEA]"
              />
            </label>
          </Section>

          <Section title="5. Thông tin người liên hệ">
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Họ và tên *" error={errors.contactName}>
                <input
                  value={form.contactName}
                  onChange={(event) => set("contactName", event.target.value)}
                  placeholder="Nhập tên người phụ trách tuyển dụng"
                  {...errorProps("contactName")}
                />
              </FormField>
              <FormField label="Email nhận hồ sơ *" error={errors.contactEmail}>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => set("contactEmail", event.target.value)}
                  placeholder="hr@example.com"
                  {...errorProps("contactEmail")}
                />
              </FormField>
              <FormField label="Số điện thoại *" error={errors.contactPhone}>
                <input
                  inputMode="tel"
                  value={form.contactPhone}
                  onChange={(event) => set("contactPhone", event.target.value)}
                  placeholder="0901234567"
                  {...errorProps("contactPhone")}
                />
              </FormField>
            </div>
            <div className="mt-4 space-y-2">
              {form.additionalPhones.map((phone, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => {
                      const next = [...form.additionalPhones];
                      next[index] = event.target.value;
                      set("additionalPhones", next);
                    }}
                    aria-invalid={Boolean(errors.additionalPhones)}
                    className={inputClass}
                    placeholder="Số điện thoại bổ sung"
                  />
                  <button
                    type="button"
                    onClick={() => set("additionalPhones", form.additionalPhones.filter((_, itemIndex) => itemIndex !== index))}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {errors.additionalPhones && <p className="text-[10px] font-semibold text-rose-600">{errors.additionalPhones}</p>}
              {form.additionalPhones.length < 5 && (
                <button
                  type="button"
                  onClick={() => set("additionalPhones", [...form.additionalPhones, ""])}
                  className="text-xs font-bold text-[#005BEA]"
                >
                  + Thêm số điện thoại
                </button>
              )}
            </div>
          </Section>
        </form>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={requestClose}
            disabled={Boolean(saving)}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:opacity-50"
          >
            Quay lại
          </button>
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={Boolean(saving)}
            className="flex h-10 items-center gap-2 rounded-xl border border-blue-200 px-4 text-xs font-bold text-[#005BEA] disabled:opacity-50"
          >
            {saving === "draft" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu bản nháp
          </button>
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={Boolean(saving)}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#005BEA] px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving === "continue" && <Loader2 size={14} className="animate-spin" />}
            Lưu &amp; tiếp tục
          </button>
        </footer>
      </div>
    </div>
  );
}
