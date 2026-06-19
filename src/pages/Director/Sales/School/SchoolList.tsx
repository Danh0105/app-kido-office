import { useLocation, useNavigate, useParams } from "react-router-dom";
import { schoolApi } from "../../../../service/school.api";
import React, { useEffect, useMemo, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
type SchoolItem = {
  schoolId: number;
  schoolName: string;
  address: string;
  representative: string;
};

type SubjectGroup = {
  subjectName: string;
  schools: SchoolItem[];
};

export default function SchoolList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"school" | "subject">("school");
  const [schools, setSchools] = useState<any[]>([]);
  const { employeeId } = useParams();
  const location = useLocation();
  const ward = location.state?.ward;
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      if (!employeeId || !ward) return;

      const data = await schoolApi.getByEmployeeAndWard(
        Number(employeeId),
        Number(ward.id),
      );
      console.log("🚀 ~ file: SchoolList.tsx:86 ~ fetchData ~ data:", data);
      setSchools(data);
    };

    fetchData();
  }, [employeeId, ward]);

  const subjectGroups: SubjectGroup[] = useMemo(() => {
    const grouped: Record<string, SchoolItem[]> = schools.reduce(
      (acc: Record<string, SchoolItem[]>, school: any) => {
        (school.subjects || []).forEach((sub: any) => {
          const key = `${sub.name}_${sub.schoolYear}`;

          if (!acc[key]) {
            acc[key] = [];
          }

          acc[key].push({
            schoolId: school.id,
            schoolName: school.name,
            address: school.address,
            representative: school.representative,
          });
        });

        return acc;
      },
      {},
    );

    return Object.entries(grouped).map(([subjectName, schools]) => ({
      subjectName,
      schools,
    }));
  }, [schools]);
  useEffect(() => {
    if (tab !== "subject") return;
  }, [tab]);
  return (
    <div className="bg-gray-100 min-h-screen">
      <HeaderWithBack title="Danh sách trường | môn học" />
      <div className="flex bg-white rounded-xl p-1 mx-4 mt-[60px] shadow-sm">
        <button
          onClick={() => setTab("school")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === "school" ? "bg-blue-500 text-white" : "text-gray-600"
          }`}
        >
          Trường
        </button>

        <button
          onClick={() => setTab("subject")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === "subject" ? "bg-blue-500 text-white" : "text-gray-600"
          }`}
        >
          Môn học
        </button>
      </div>
      {tab === "school" && (
        <div className="p-4 space-y-3">
          {schools.map((item) => (
            <div
              key={item.id}
              onClick={() =>
                navigate(`/director/subject-list/${item.id}`, {
                  state: employeeId,
                })
              }
              className="bg-white rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3"
            >
              {/* Top */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900 text-base leading-tight">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {item.address}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-blue-600">
                    {item.scale}
                  </p>
                  <p className="text-xs text-gray-400">Học sinh</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Info grid */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Đại diện</span>
                  <span className="text-gray-800 font-medium text-right">
                    {item.representative}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">SĐT</span>
                  <span className="text-gray-800">{item.phone}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">MST</span>
                  <span className="text-gray-800">{item.taxCode}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Quy mô</span>
                  <span className="text-gray-800">{item.scale}</span>
                </div>
              </div>
              {/* Actions */}
              <div className="pt-2">
                {/*             <button
                  onClick={(e) => {
                    e.stopPropagation();

                    navigate(`/director/real-expense/${item.id}`, {
                      state: {
                        school: item,
                        employeeId,
                      },
                    });
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl font-medium transition active:scale-95"
                >
                  QL chi tiền
                </button> */}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "subject" && (
        <div className="p-4 space-y-3">
          {subjectGroups.map((group) => {
            const isOpen = openSubject === group.subjectName;

            return (
              <div key={group.subjectName} className="space-y-2">
                {/* Title môn */}
                <div
                  onClick={() =>
                    setOpenSubject(isOpen ? null : group.subjectName)
                  }
                  className="font-bold text-blue-600 flex justify-between items-center cursor-pointer"
                >
                  <span>{group.subjectName}</span>

                  <span className="text-xs bg-blue-100 px-2 py-1 rounded-full">
                    {group.schools.length}
                  </span>
                </div>

                {/* 👇 LIST trường (chỉ hiện khi click) */}
                {isOpen && (
                  <div className="max-h-64 overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-3">
                      {group.schools.map((s: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100"
                        >
                          <p className="font-medium text-sm">{s.schoolName}</p>
                          <p className="text-xs text-gray-500">{s.address}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
