import { useLocation, useNavigate, useParams } from "react-router-dom";
import { schoolApi } from "../../../../service/school.api";
import React, { useEffect, useMemo, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import {
  DEFAULT_CHECKIN_RADIUS,
  isValidLatLng,
  mapsLinkOf,
} from "@/utils/geo";
import { isDirectorBrandUiEnabled } from "@/utils/directorUi";
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
  const isBrand = isDirectorBrandUiEnabled();
  const [tab, setTab] = useState<"school" | "subject">("school");
  const [schools, setSchools] = useState<any[]>([]);
  const { employeeId } = useParams();
  const location = useLocation();
  const ward = location.state?.ward;
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      if (!employeeId) return;

      // Có ward (đi từ danh sách phường/xã) thì lọc theo ward; vào thẳng từ
      // trang hồ sơ nhân viên (không chọn ward) thì hiện mọi trường của nhân viên.
      const data = ward
        ? await schoolApi.getByEmployeeAndWard(Number(employeeId), Number(ward.id))
        : await schoolApi.getByEmployee(Number(employeeId));

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
    <>
    <div className={isBrand ? "bg-[#FFF8E6] min-h-screen text-[#0047B8]" : "bg-gray-100 min-h-screen"}>
      <HeaderWithBack title="Danh sách trường | môn học" brandSidebarInset={isBrand} />
      <div className={`flex bg-white rounded-xl p-1 mx-4 mt-[60px] shadow-sm ${isBrand ? "lg:max-w-6xl lg:mx-auto border border-blue-900/10" : ""}`}>
        <button
          onClick={() => setTab("school")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === "school"
              ? isBrand ? "bg-[#005BEA] text-white" : "bg-blue-500 text-white"
              : "text-gray-600"
          }`}
        >
          Trường
        </button>

        <button
          onClick={() => setTab("subject")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === "subject"
              ? isBrand ? "bg-[#005BEA] text-white" : "bg-blue-500 text-white"
              : "text-gray-600"
          }`}
        >
          Môn học
        </button>
      </div>
      {tab === "school" && (
        <div className={`p-4 space-y-3 ${isBrand ? "lg:max-w-6xl lg:mx-auto lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0" : ""}`}>
          {schools.map((item) => (
            <div
              key={item.id}
              onClick={() =>
                navigate(`/director/subject-list/${item.id}`, {
                  state: employeeId,
                })
              }
              className={`bg-white rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3 ${isBrand ? "border border-blue-900/10 hover:shadow-md" : ""}`}
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

                  {/* Vị trí check-in dạy học */}
                  {isValidLatLng(item) ? (
                    <p className="text-[11px] text-gray-500 mt-1">
                      {item.googleMapsUrl ? (
                        <span className="px-2 py-[2px] rounded-full bg-emerald-100 text-emerald-700 font-medium">
                          Đã đặt vị trí
                        </span>
                      ) : (
                        <span className="px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-medium">
                          Chưa có link Maps
                        </span>
                      )}{" "}
                      · bán kính {item.checkinRadius || DEFAULT_CHECKIN_RADIUS}m ·{" "}
                      <a
                        href={mapsLinkOf(item.googleMapsUrl, {
                          latitude: Number(item.latitude),
                          longitude: Number(item.longitude),
                        })}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-500 underline"
                      >
                        Xem trên Google Maps
                      </a>
                    </p>
                  ) : (
                    <span className="inline-block text-[11px] px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-medium mt-1">
                      Chưa đặt vị trí
                    </span>
                  )}
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
        <div className={`p-4 space-y-3 ${isBrand ? "lg:max-w-6xl lg:mx-auto" : ""}`}>
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
                          className={`bg-white rounded-2xl p-3 shadow-sm border ${isBrand ? "border-blue-900/10" : "border-gray-100"}`}
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
    </>
  );
}
