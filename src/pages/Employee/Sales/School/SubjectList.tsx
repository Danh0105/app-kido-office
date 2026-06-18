import React, { useEffect, useState } from "react";
import { subjectApi } from "../../../../service/subject.api";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
type Subject = {
  id: number;
  name: string;
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
type SubjectForm = {
  name: string;
  status: number;

  studentCount: number;
  classCount: number;
  totalLessons: number;

  contractDuration: number;
  appendixDuration: number;

  startDate: string;
  contractNumber: string;
  schoolYear: string;
};
const FormField = ({
  label,
  value,
  error,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (val: string) => void;
  type?: string;
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-3">
      <label
        className="
                    w-36 text-sm font-medium
                    text-gray-600 dark:text-gray-300
                "
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
                    flex-1 
                    px-4 py-3 
                    rounded-2xl 
                    border 
                    outline-none 
                    text-sm
                    transition-all duration-200

                    ${
                      error
                        ? "border-red-500 focus:ring-2 focus:ring-red-400"
                        : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-400"
                    }

                    bg-white dark:bg-gray-800
                    text-black dark:text-white
                    placeholder-gray-400 dark:placeholder-gray-500
                `}
      />
    </div>

    {error && <p className="text-xs text-red-500 ml-36">{error}</p>}
  </div>
);
export default function SubjectList() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const schoolYear = location.state;
  const schoolId = Number(id);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [note, setNote] = useState();
  const [form, setForm] = useState<SubjectForm>({
    name: "",
    status: 1,

    studentCount: 0,
    classCount: 0,
    totalLessons: 0,

    contractDuration: 0,
    appendixDuration: 0,

    startDate: "",
    contractNumber: "",
    schoolYear: "",
  });

  // ================== HANDLE ==================
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await subjectApi.getBySchoolYear(schoolYear, schoolId);
        console.log("data", data);
        setSubjects(data);
      } catch (err) {
        console.error("Load subjects failed", err);
      }
    };

    if (schoolId) fetchData();
  }, [schoolId]);
  const handleChange = (key: keyof SubjectForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      status: 1,
      studentCount: 0,
      classCount: 0,
      totalLessons: 0,
      contractDuration: 0,
      appendixDuration: 0,
      startDate: "",
      contractNumber: "",
      schoolYear: "",
    });
    setEditingId(null);
    setShowModal(false);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = "Vui lòng nhập tên môn";
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      name: form.name,
      schoolId: schoolId,
      classCount: Number(form.classCount),
      studentCount: Number(form.studentCount),
      totalLessons: Number(form.totalLessons),
      contractDuration: Number(form.contractDuration),
      appendixDuration: Number(form.appendixDuration),
      startDate: form.startDate,
      contractNumber: form.contractNumber,
      schoolYear: schoolYear,
    };
    try {
      if (editingId) {
        await subjectApi.update(editingId, payload);
      } else {
        await subjectApi.create(payload);
      }

      const data = await subjectApi.getBySchoolYear(schoolYear, schoolId);
      setSubjects(data);

      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (item: any) => {
    setForm({
      name: item.name,
      status: item.status,

      studentCount: item.studentCount || 0,
      classCount: item.classCount || 0,
      totalLessons: item.totalLessons || 0,
      contractDuration: item.contractDuration || 0,
      appendixDuration: item.appendixDuration || 0,
      startDate: item.startDate || "",
      contractNumber: item.contractNumber || "",
      schoolYear: item.schoolYear || "",
    });

    setEditingId(item.id);
    setShowModal(true);
  };

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
                    onClick={() => handleEdit(item)}
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
        onClick={() => {
          setEditingId(null);
          resetForm();
          setShowModal(true);
        }}
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
      {showModal && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={resetForm}
          />

          {/* Bottom Sheet */}
          <div
            className="
      absolute bottom-0 left-0 right-0
      bg-white dark:bg-slate-900
      rounded-t-3xl
      max-h-[92vh]
      flex flex-col
      shadow-2xl
    "
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingId ? "Sửa môn học" : "Tạo môn học"}
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Nhập thông tin môn học
                  </p>
                </div>

                <button
                  onClick={resetForm}
                  className="
            w-10 h-10 rounded-xl
            bg-slate-100 dark:bg-slate-800
            flex items-center justify-center
            text-slate-500
          "
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <FormField
                label="Tên môn học"
                value={form.name}
                onChange={(v) => handleChange("name", v)}
                type="text"
              />
              <FormField
                label="Số học sinh"
                value={String(form.studentCount)}
                onChange={(v) => handleChange("studentCount", Number(v))}
                type="number"
              />

              <FormField
                label="Số lớp"
                value={String(form.classCount)}
                onChange={(v) => handleChange("classCount", Number(v))}
                type="number"
              />

              <FormField
                label="Tổng số tiết"
                value={String(form.totalLessons)}
                onChange={(v) => handleChange("totalLessons", Number(v))}
                type="number"
              />

              <FormField
                label="Thời hạn HĐ (tháng)"
                value={String(form.contractDuration)}
                onChange={(v) => handleChange("contractDuration", Number(v))}
                type="number"
              />

              <FormField
                label="Thời hạn PL (tháng)"
                value={String(form.appendixDuration)}
                onChange={(v) => handleChange("appendixDuration", Number(v))}
                type="number"
              />

              <FormField
                label="Ngày khai giảng"
                value={form.startDate}
                onChange={(v) => handleChange("startDate", v)}
                type="date"
              />
            </div>

            {/* Footer */}
            <div
              className="
        p-5
        border-t border-slate-100 dark:border-slate-800
        bg-white dark:bg-slate-900
        sticky bottom-0
      "
            >
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={resetForm}
                  className="
            h-12 rounded-xl
            bg-slate-100 hover:bg-slate-200
            text-slate-700 font-medium
          "
                >
                  Huỷ
                </button>

                <button
                  onClick={handleSubmit}
                  className="
            h-12 rounded-xl
            bg-blue-600 hover:bg-blue-700
            text-white font-semibold
            shadow-lg shadow-blue-500/20
          "
                >
                  {editingId ? "Cập nhật" : "Lưu môn học"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
