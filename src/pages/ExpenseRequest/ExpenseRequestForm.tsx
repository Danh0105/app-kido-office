import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import MobileSelect from "@/pages/Employee/Sales/Suggest/MobileSelect";
import { getEmployeeId } from "@/utils/auth";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { expenseRequestApi } from "@/service/expenseRequest";
import {
  statusLabel,
  type ExpenseRequest,
} from "@/types/expenseRequest";
import { canDoStep, expenseBasePath, todayISO } from "./lib";

const MAX_SIZE = 50 * 1024 * 1024;

type Option = { id: number | string; name: string };
type ProposalTarget = "WARD" | "SCHOOL";

// Tạo đề xuất = gửi duyệt luôn (vào thẳng PENDING_APPROVAL), không có nháp.
// Có `:id` trên URL = chế độ sửa: chủ đơn được sửa ở mọi trạng thái; sau khi
// lưu, đề xuất luôn quay về chờ duyệt để chạy lại quy trình từ đầu. Nhân viên
// không chọn loại; Giám đốc phân loại khi duyệt. Có thể chuyển qua lại giữa
// đề xuất phường/xã và đề xuất trường.
export default function ExpenseRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editId = Number(id);
  const isEdit = Number.isInteger(editId) && editId > 0;
  const base = expenseBasePath();

  const [editing, setEditing] = useState<ExpenseRequest | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState("");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [deductPolicy, setDeductPolicy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [proposalTarget, setProposalTarget] =
    useState<ProposalTarget>("WARD");

  // Đề xuất phường/xã: khu vực → phường/xã.
  // Đề xuất trường: chọn trực tiếp trong danh sách trường được phụ trách.
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [wards, setWards] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [schoolYears, setSchoolYears] = useState<Option[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string | null>(
    null,
  );
  const [schoolYearsLoading, setSchoolYearsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Chế độ sửa: nạp đề xuất, kiểm tra quyền rồi đổ vào form.
  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    expenseRequestApi
      .getById(editId)
      .then(async (req) => {
        if (!active) return;
        if (!canDoStep("edit", req)) {
          toast.error("Đề xuất này không thể sửa");
          navigate(`${base}/${editId}`, { replace: true });
          return;
        }
        setEditing(req);
        setProposalTarget(req.schoolId ? "SCHOOL" : "WARD");
        setContent(req.content ?? "");
        setDescription(req.description ?? "");
        setParticipants(req.participants ?? "");
        setExpectedPaymentDate((req.expectedPaymentDate ?? "").slice(0, 10));
        setDeductPolicy(Boolean(req.deductPolicy));

        // Chọn sẵn đúng Khu vực → Phường/Xã → Trường đang lưu. Detail API
        // trả ward trực tiếp cho đề xuất theo xã, hoặc school.ward cho đề xuất
        // theo trường.
        let currentSchool: any = req.school ?? null;
        let currentWard: any = req.ward ?? req.school?.ward ?? null;

        // Tương thích response backend cũ chưa trả nested relation: dùng ID
        // đang lưu để tra lại trường/phường và vẫn hiện đúng lựa chọn cũ.
        if (req.schoolId && !currentWard) {
          try {
            const employeeSchools = await schoolApi.getByEmployee(getEmployeeId());
            const schoolList = Array.isArray(employeeSchools) ? employeeSchools : [];
            currentSchool =
              schoolList.find((school: any) => Number(school.id) === Number(req.schoolId)) ??
              currentSchool;
            currentWard = currentSchool?.ward ?? currentWard;
          } catch (locationError) {
            console.error("Không tải được địa bàn của trường", locationError);
          }
        }

        if (req.wardId && !currentWard) {
          try {
            currentWard = await wardApi.getById(Number(req.wardId));
          } catch (locationError) {
            console.error("Không tải được phường/xã đã chọn", locationError);
          }
        }

        if (!active) return;
        const currentProvinceId = Number(
          currentWard?.province_id ?? currentWard?.province?.id ?? 0,
        );
        if (currentWard?.id) {
          setWards([{ id: Number(currentWard.id), name: currentWard.name }]);
        }
        if (currentSchool?.id) {
          setSchools([{ id: Number(currentSchool.id), name: currentSchool.name }]);
        }
        if (currentWard?.province?.id) {
          setProvinces((current) =>
            current.some(
              (province) => Number(province.id) === Number(currentWard.province.id),
            )
              ? current
              : [
                  ...current,
                  {
                    id: Number(currentWard.province.id),
                    name: currentWard.province.name,
                  },
                ],
          );
        }
        if (currentProvinceId > 0) setSelectedRegion(currentProvinceId);
        if (currentWard?.id) setSelectedWard(Number(currentWard.id));
        setSelectedSchool(req.schoolId ? Number(req.schoolId) : null);

      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || "Không tải được đề xuất");
        navigate(base, { replace: true });
      })
      .finally(() => {
        if (active) setLoadingEdit(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editId]);

  // Khu vực (province) theo nhân viên
  useEffect(() => {
    provinceApi
      .getProvincesByEmployee(getEmployeeId())
      .then((res: any[]) => {
        const assigned = res.map((r) => ({ id: r.id, name: r.name }));
        // Giữ option hiện tại đã khôi phục từ đề xuất nếu địa bàn vừa được
        // bàn giao cho người khác, để giá trị cũ vẫn hiển thị trước khi đổi.
        setProvinces((current) => [
          ...assigned,
          ...current.filter(
            (province) =>
              !assigned.some(
                (item) => Number(item.id) === Number(province.id),
              ),
          ),
        ]);
      })
      .catch((e) => console.error(e));
  }, []);

  // Tab phường/xã: chọn khu vực → tải danh sách phường/xã.
  useEffect(() => {
    if (proposalTarget !== "WARD" || !selectedRegion) return;
    setWards([]);

    wardApi
      .getByEmployee(getEmployeeId(), selectedRegion)
      .then((res: any[]) => {
        const options = res.map((w) => ({ id: w.id, name: w.name }));
        setWards((currentOptions) => [
          ...options,
          ...currentOptions.filter(
            (ward) =>
              !options.some((item) => Number(item.id) === Number(ward.id)),
          ),
        ]);
        setSelectedWard((current) => {
          if (current) return current;
          return options.length === 1 ? Number(options[0].id) : null;
        });
      })
      .catch((e) => console.error(e));
  }, [proposalTarget, selectedRegion]);

  // Tab trường: tải thẳng toàn bộ trường thuộc phạm vi nhân viên, không bắt
  // người dùng chọn khu vực/phường-xã trung gian.
  useEffect(() => {
    if (proposalTarget !== "SCHOOL") return;

    let active = true;
    setSchoolsLoading(true);
    schoolApi
      .getByEmployee(getEmployeeId())
      .then((res: any) => {
        if (!active) return;
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : [];
        const options = list.map((school: any) => ({
          id: school.id,
          name: school?.ward?.name
            ? `${school.name} — ${school.ward.name}`
            : school.name,
        }));
        setSchools((currentOptions) => [
          ...options,
          ...currentOptions.filter(
            (school) =>
              !options.some((item) => Number(item.id) === Number(school.id)),
          ),
        ]);
      })
      .catch((e) => {
        console.error(e);
        if (active) setSchools([]);
      })
      .finally(() => {
        if (active) setSchoolsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [proposalTarget]);

  // Trường có thể chỉ khai môn học cho một số năm học nhất định — tải danh
  // sách năm có dữ liệu để chọn, tự chọn sẵn năm hiện tại nếu trường có.
  useEffect(() => {
    setSchoolYears([]);
    setSelectedSchoolYear(null);

    if (!selectedSchool) return;

    let active = true;
    setSchoolYearsLoading(true);

    subjectApi
      .getFinanceBySchool(selectedSchool)
      .then((response: any) => {
        if (!active) return;

        const subjects = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        const schoolYearValues: string[] = subjects
          .map((subject: any) => String(subject?.schoolYear || "").trim())
          .filter((schoolYear: string) => Boolean(schoolYear));
        const options: Option[] = [...new Set<string>(schoolYearValues)]
          .sort((first, second) => second.localeCompare(first))
          .map((schoolYear) => ({ id: schoolYear, name: schoolYear }));

        setSchoolYears(options);

        if (options.length > 0) {
          const now = new Date();
          const startYear =
            now.getMonth() + 1 >= 8
              ? now.getFullYear()
              : now.getFullYear() - 1;
          const currentSchoolYear = `${startYear}-${startYear + 1}`;
          const preferred =
            options.find((option) => option.id === currentSchoolYear) ||
            options[0];

          setSelectedSchoolYear(String(preferred.id));
        }
      })
      .catch((e) => {
        console.error(e);
        if (active) setSchoolYears([]);
      })
      .finally(() => {
        if (active) setSchoolYearsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSchool]);

  const pickFile = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      setError("Tệp tối đa 50MB");
      return;
    }
    setError("");
    setFile(f);
  };

  const dateChanged =
    !editing ||
    expectedPaymentDate !== (editing.expectedPaymentDate ?? "").slice(0, 10);

  const validate = () => {
    if (!content.trim()) return "Vui lòng nhập tiêu đề";
    if (content.length > 500) return "Tiêu đề tối đa 500 ký tự";
    if (!expectedPaymentDate) return "Vui lòng chọn ngày mong muốn";
    // Sửa mà giữ nguyên ngày cũ (có thể đã qua) thì không bắt "từ hôm nay".
    if (dateChanged && expectedPaymentDate < todayISO())
      return "Ngày mong muốn phải từ hôm nay trở đi";
    if (proposalTarget === "WARD" && !selectedWard)
      return "Vui lòng chọn phường/xã";
    if (proposalTarget === "SCHOOL" && !selectedSchool)
      return "Vui lòng chọn trường";
    if (proposalTarget === "SCHOOL" && selectedSchool) {
      if (schoolYearsLoading) return "Đang tải danh sách năm học";
      if (schoolYears.length === 0)
        return "Trường chưa có dữ liệu năm học";
      if (!selectedSchoolYear) return "Vui lòng chọn năm học";
    }
    return "";
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    if (
      isEdit &&
      !window.confirm(
        "Lưu thay đổi sẽ đưa đề xuất về Chờ duyệt và gửi duyệt lại từ đầu. Tiếp tục?",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await expenseRequestApi.update(editId, {
          content: content.trim(),
          description: description.trim() || undefined,
          participants: participants.trim() || undefined,
          deductPolicy,
          expectedPaymentDate: dateChanged ? expectedPaymentDate : undefined,
          schoolId:
            proposalTarget === "SCHOOL" && selectedSchool
              ? Number(selectedSchool)
              : undefined,
          schoolYear:
            proposalTarget === "SCHOOL" &&
            selectedSchool &&
            selectedSchoolYear
              ? String(selectedSchoolYear)
              : undefined,
          wardId:
            proposalTarget === "WARD" && selectedWard
              ? Number(selectedWard)
              : undefined,
          file: file || undefined,
        });
        toast.success("Đã sửa đề xuất và gửi duyệt lại từ đầu");
        navigate(`${base}/${editId}`, { replace: true });
        return;
      }
      const created = await expenseRequestApi.create({
        content: content.trim(),
        description: description.trim() || undefined,
        participants: participants.trim() || undefined,
        deductPolicy,
        expectedPaymentDate,
        wardId:
          proposalTarget === "WARD" && selectedWard
            ? Number(selectedWard)
            : undefined,
        schoolId:
          proposalTarget === "SCHOOL" && selectedSchool
            ? Number(selectedSchool)
            : undefined,
        schoolYear:
          proposalTarget === "SCHOOL" &&
          selectedSchool &&
          selectedSchoolYear
            ? String(selectedSchoolYear)
            : undefined,
        file: file || undefined,
      });
      toast.success("Đã gửi đề xuất, chờ giám đốc duyệt");
      navigate(`${base}/${created.id}`, { replace: true });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || (isEdit ? "Sửa thất bại" : "Gửi thất bại"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title={isEdit ? "Sửa đề xuất chi" : "Tạo đề xuất chi"} />

      {loadingEdit ? (
        <p className="mt-[80px] text-center text-sm text-gray-400">Đang tải…</p>
      ) : (
      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">
        {editing && editing.status !== "PENDING_APPROVAL" && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            ⚠️ Đề xuất <b>{editing.code}</b> đang ở trạng thái{" "}
            <b>{statusLabel(editing.status, editing.requestKind ?? "CASH")}</b>.
            Sau khi lưu, đề xuất sẽ quay về <b>Chờ duyệt</b> và chạy lại quy
            trình từ đầu.
          </div>
        )}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div>
            <label className="text-sm text-gray-600">Đối tượng đề xuất</label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
              {(
                [
                  { value: "WARD", label: "Đề xuất phường/xã" },
                  { value: "SCHOOL", label: "Đề xuất trường" },
                ] as { value: ProposalTarget; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    if (tab.value === proposalTarget) return;
                    setProposalTarget(tab.value);
                    setSelectedRegion(null);
                    setSelectedWard(null);
                    setSelectedSchool(null);
                    setSelectedSchoolYear(null);
                    setWards([]);
                    setSchools([]);
                    setError("");
                  }}
                  className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                    proposalTarget === tab.value
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {isEdit && (
              <p className="mt-1 text-xs text-gray-400">
                Đổi đối tượng sẽ chuyển đề xuất sang phường/xã hoặc trường mới đã chọn.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Giám đốc sẽ quyết định đây là đề xuất tiền, thiết bị hay sửa chữa khi duyệt.
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Tiêu đề <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={content}
              maxLength={500}
              onChange={(e) => setContent(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: Sửa máy chiếu phòng học hoặc chi tiếp khách"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Nội dung / lý do</label>
            <textarea
              value={description}
              rows={3}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="Mô tả chi tiết nhu cầu và lý do đề xuất"
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={deductPolicy}
              onChange={(e) => setDeductPolicy(e.target.checked)}
              className="h-4 w-4"
            />
            Trừ chính sách
          </label>

          <div>
            <label className="text-sm text-gray-600">Thành phần tham gia</label>
            <textarea
              value={participants}
              rows={2}
              maxLength={500}
              onChange={(e) => setParticipants(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: Giám đốc, kế toán, khách hàng dự án X"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Ngày mong muốn{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={expectedPaymentDate}
              min={isEdit ? undefined : todayISO()}
              onChange={(e) => setExpectedPaymentDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {proposalTarget === "WARD" && (
            <MobileSelect
              label="Khu vực"
              placeholder="Chọn khu vực"
              value={selectedRegion}
              options={provinces}
              onChange={(value) => {
                setSelectedRegion(value ? Number(value) : null);
                setSelectedWard(null);
                setWards([]);
              }}
            />
          )}

          {proposalTarget === "WARD" && wards.length > 0 && (
            <MobileSelect
              label="Phường/Xã *"
              placeholder="Chọn phường/xã"
              value={selectedWard}
              options={wards}
              onChange={(value) => {
                setSelectedWard(value ? Number(value) : null);
              }}
            />
          )}

          {proposalTarget === "SCHOOL" && (
            <MobileSelect
              label="Trường *"
              placeholder={schoolsLoading ? "Đang tải trường..." : "Chọn trường"}
              value={selectedSchool}
              options={schools}
              onChange={(value) => setSelectedSchool(value ? Number(value) : null)}
              disabled={schoolsLoading}
            />
          )}

          {proposalTarget === "WARD" && selectedWard && (
            <p className="-mt-2 text-xs text-blue-600">
              Đề xuất này sẽ được ghi nhận cho xã/phường đã chọn.
            </p>
          )}

          {proposalTarget === "SCHOOL" && selectedSchool && (
            <MobileSelect
              label="Năm học *"
              placeholder={
                schoolYearsLoading
                  ? "Đang tải năm học..."
                  : "Chọn năm học"
              }
              value={selectedSchoolYear}
              options={schoolYears}
              onChange={setSelectedSchoolYear}
              disabled={schoolYearsLoading || schoolYears.length === 0}
            />
          )}

          <div>
            <label className="text-sm text-gray-600">
              Tệp đính kèm{isEdit && editing?.attachments?.length ? " (chọn tệp mới để thay)" : ""}
            </label>
            <input
              type="file"
              onChange={(e) => pickFile(e.target.files)}
              className="w-full mt-1 text-sm"
            />
            {file && (
              <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1">
                <span className="truncate">📎 {file.name}</span>
                <button onClick={() => setFile(null)} className="text-red-500 ml-2">
                  ✕
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <p className="text-xs text-gray-400 text-center px-4">
          {isEdit
            ? "Có thể sửa ở mọi trạng thái. Mỗi lần lưu sẽ gửi duyệt lại từ đầu."
            : "Sau khi gửi, đề xuất sẽ chuyển đến giám đốc duyệt. Có thể sửa lại ở mọi trạng thái; mỗi lần sửa sẽ duyệt lại từ đầu."}
        </p>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium active:scale-95 disabled:opacity-60"
        >
          {saving
            ? isEdit ? "Đang lưu…" : "Đang gửi…"
            : isEdit
              ? "Lưu & gửi duyệt lại"
              : "Gửi đề xuất"}
        </button>
      </div>
      )}
    </div>
  );
}
