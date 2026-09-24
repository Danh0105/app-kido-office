import React, { useEffect, useState } from "react";
import { subjectApi } from "../../../../service/subject.api";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
import SubjectFormModal, {
  type EditableSubject,
} from "@/components/subject/SubjectFormModal";
type Subject = {
  id: number;
  name: string;
  /** Môn trong danh mục; null với dữ liệu cũ chưa map được. */
  catalogId: number | null;
  status: number;
  studentCount: number;
  classCount: number;
  totalLessons: number;
  contractDuration: number;
  appendixDuration: number;
  startDate: string;
  contractNumber: string;
  policyCount: number;
  note: string;
  schoolYear: string;
};
export default function SubjectList() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const schoolYear = location.state;
  const schoolId = Number(id);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState();
  /** undefined = đóng, null = thêm mới, có giá trị = sửa. */
  const [formTarget, setFormTarget] = useState<
    EditableSubject | null | undefined
  >(undefined);

  // ================== HANDLE ==================
  const reload = async () => {
    const data = await subjectApi.getBySchoolYear(schoolYear, schoolId);
    setSubjects(data);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await reload();
      } catch (err) {
        console.error("Load subjects failed", err);
      }
    };

    if (schoolId) fetchData();
  }, [schoolId]);

  const handleDelete = async (id: number) => {
    if (confirm("Xóa môn học này?")) {
      await subjectApi.remove(id);

      const data = await subjectApi.getBySchoolYear(schoolYear, schoolId);
      setSubjects(data);
    }
  };
  const showModalNote = (note) => {
    setOpen(true);
    setNote(note);
  };

  const getSchoolYears = () => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];

    for (let y = 2021; y <= currentYear; y++) {
      years.push(`${y}-${y + 1}`);
    }

    return years;
  };
  // ================== UI ==================

  return (
    <div className="bg-gray-100 min-h-screen">
      <HeaderWithBack title="Danh sách môn học" />
      {/* LIST */}
      <div className="p-4 mt-[60px] space-y-3">
        <div className="p-4 space-y-3">
          {subjects.map((item) => {
            return (
              <div
                key={item.id}
                onClick={() =>
                  navigate(`/employee/policy-list/${item.id}`, {
                    state: item,
                  })
                }
                className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3"
              >
                {/* TOP */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      📘
                    </div>

                    {/* Name */}
                    <div>
                      <p className="font-semibold text-gray-900 text-sm dark:text-white">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white">
                        Số học sinh: {item.studentCount}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white">
                        Số lớp: {item.classCount}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white">
                        Tổng số tiết: {item.totalLessons}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white">
                        Thời hạn HĐ: {item.contractDuration}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white">
                        Thời hạn PL: {item.appendixDuration}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white">
                        Ngày khai giảng:{" "}
                        {item.startDate
                          ? new Date(item.startDate).toLocaleDateString("vi-VN")
                          : ""}
                      </p>

                      <p className="text-xs text-gray-400 dark:text-white">
                        Số HĐ: {item.contractNumber}
                      </p>
                    </div>
                  </div>
                  {/* STATUS BADGE */}
                  <div className="flex flex-col items-center gap-2">
                    <p
                      className={`text-xs text-center px-4 py-1 rounded-full font-medium inline-flex items-center justify-center bg-red-100 text-red-600`}
                    >
                      Tổng CS
                    </p>

                    {/* Ghi chú */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        showModalNote(item.note);
                      }}
                      className="flex items-center gap-2 text-gray-500 text-xs"
                    >
                      <p
                        className={`text-xs text-center px-4 py-1 rounded-full font-medium inline-flex items-center justify-center  text-red-600`}
                      >
                        {item.policyCount}
                      </p>
                    </div>
                  </div>
                </div>
                <h1 className="text-dark font-semibold text-sm text-center flex-1">
                  Năm học: {item.schoolYear || "2024-2025"}
                </h1>
                {/* ACTION */}
                <div
                  className="flex gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setFormTarget(item)}
                    className="flex-1 py-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium"
                  >
                    ✏️ Sửa
                  </button>

                  {/*          <button
                                        onClick={() => handleDelete(item.id)}
                                        className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium"
                                    >
                                        🗑️ Xóa
                                    </button> */}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BUTTON ADD */}
      <button
        onClick={() => setFormTarget(null)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 text-white text-2xl shadow-lg active:scale-90"
      >
        +
      </button>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 w-80 shadow-lg">
            <h3 className="font-semibold mb-2">Ghi chú</h3>
            <p className="text-sm text-gray-600 mb-4">
              {note || "Chưa có ghi chú"}
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {formTarget !== undefined && (
        <SubjectFormModal
          schoolId={schoolId}
          schoolYear={schoolYear}
          subject={formTarget}
          onClose={() => setFormTarget(undefined)}
          onSaved={() => {
            setFormTarget(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
}
