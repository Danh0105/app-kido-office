import { useEffect, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import { suggestApi } from "@/service/suggest";
import { policiesApi } from "@/service/policy";
import { useParams } from "react-router-dom";
import { getEmployeeRole } from "@/utils/auth";

type Suggest = {
  id: number;
  content: string;
  component?: string;
  description?: string;
  issueDate?: string;
  fileUrl?: string;
  status: "DRAFT" | "PENDING" | "REVIEWED" | "APPROVED" | "REJECTED";
  policyId?: number;
  policy?: {
    id: number;
    status?: string;
    data?: {
      fee?: number;
      csvc?: number;
      thue?: number;
      giaovien?: number;
      teacherCompany?: number;
      csthang?: number;
      cdhd?: number;
      thietbi?: number;
      giaoCu?: number;
      thuetndn?: number;
      vanHanh?: number;
      companyProfit?: number;
      httienmat?: any[];
      htthietbi?: any[];
    };
    subject?: {
      id: number;
      name: string;
      schoolYear?: string;
      studentCount?: number;
      totalLessons?: number;
      contractNumber?: string;
      contractDuration?: number;
      school?: {
        id: number;
        name: string;
        address?: string;
        phone?: string;
        representative?: string;
        scale?: number;
        classCount?: number;
        taxCode?: string;
        ward?: { id: number; name: string };
      };
    };
  };
};

const fmt = (v: any) => (v != null ? Number(v).toLocaleString() : "N/A");

const statusClass: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  REVIEWED: "bg-green-100 text-green-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function SuggestReview() {
  const suggestId = useParams().suggestId;
  const [data, setData] = useState<Suggest | null>(null);
  const [loading, setLoading] = useState(false);
  const role = getEmployeeRole();

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await suggestApi.getById(Number(suggestId));

      if (!res.policy && res.policyId) {
        res.policy = await policiesApi.findOne(res.policyId);
      }
      console.log(res);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReview = async (id: number, status: "REVIEWED" | "REJECTED") => {
    try {
      let rejectReason = "";
      if (status === "REJECTED") {
        rejectReason = prompt("Nhập lý do từ chối") || "";
        if (!rejectReason) return;
      }
      await suggestApi.review(id, { status, rejectReason });
      alert("Xử lý thành công");
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const handleApprove = async (id: number, status: "APPROVED" | "REJECTED") => {
    try {
      let rejectReason = "";
      if (status === "REJECTED") {
        rejectReason = prompt("Nhập lý do từ chối") || "";
        if (!rejectReason) return;
      }
      await suggestApi.approve(id, { status, rejectReason });
      alert("Duyệt thành công");
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen flex flex-col">
        <HeaderWithBack title="Đề xuất" />
        <div className="text-center text-gray-400 text-sm py-10 mt-[60px]">
          Đang tải...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-100 min-h-screen flex flex-col">
        <HeaderWithBack title="Đề xuất" />
        <div className="text-center text-gray-400 text-sm py-16 mt-[60px]">
          Không tìm thấy đề xuất
        </div>
      </div>
    );
  }

  const school = data.policy?.subject?.school;
  const subject = data.policy?.subject;
  const policy = data.policy;
  const d = policy?.data;
  const tienmat = d?.httienmat || [];
  const thietbi = d?.htthietbi || [];

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title="Đề xuất" />

      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">
        {/* ===== SCHOOL ===== */}
        {school && (
          <div className="border border-blue-200 rounded-2xl overflow-hidden bg-white">
            <div className="bg-blue-50 px-4 py-3">
              <h3 className="font-bold text-blue-800 text-base">
                🏫 {school.name}
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <InfoItem
                icon="📍"
                label="Địa chỉ"
                value={school.address}
                span={2}
              />
              <InfoItem
                icon="👤"
                label="Đại diện"
                value={school.representative}
              />
              <InfoItem icon="📞" label="SĐT" value={school.phone} />
              <InfoItem icon="🏢" label="MST" value={school.taxCode} />
              <InfoItem icon="🗺️" label="Khu vực" value={school.ward?.name} />
              <InfoItem icon="🧑‍🎓" label="Sĩ số" value={school.scale} />
              <InfoItem icon="🏫" label="Số lớp" value={school.classCount} />
            </div>
          </div>
        )}

        {/* ===== SUBJECT TABLE ===== */}
        {subject && (
          <div className="overflow-x-auto border border-gray-200 rounded-2xl bg-white">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-blue-600 text-white">
                  {[
                    "Môn học",
                    "Sĩ số",
                    "Số tiết",
                    "Hợp đồng",
                    "Năm học",
                    "Học phí",
                    "Số tháng",
                    "CSVC",
                    "Thuế",
                    "GV trường",
                    "GV công ty",
                    "CS tháng",
                    "CS ký HĐ",
                    "Thiết bị",
                    "Giáo cụ",
                    "Thuế TNDN",
                    "Vận hành",
                    "CTY thu",
                  ].map((col) => (
                    <th key={col} className="px-2 py-2 font-medium text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-yellow-50">
                  <td className="px-2 py-2 font-medium text-blue-700">
                    {subject.name}
                  </td>
                  <td className="px-2 py-2">{fmt(subject.studentCount)}</td>
                  <td className="px-2 py-2">{fmt(subject.totalLessons)}</td>
                  <td className="px-2 py-2">
                    {subject.contractNumber || "N/A"}
                  </td>
                  <td className="px-2 py-2">{subject.schoolYear || "N/A"}</td>
                  <td className="px-2 py-2">{fmt(d?.fee)}</td>
                  <td className="px-2 py-2">{fmt(subject.contractDuration)}</td>
                  <td className="px-2 py-2">{fmt(d?.csvc)}</td>
                  <td className="px-2 py-2">{fmt(d?.thue)}</td>
                  <td className="px-2 py-2">{fmt(d?.giaovien)}</td>
                  <td className="px-2 py-2">{fmt(d?.teacherCompany)}</td>
                  <td className="px-2 py-2">{fmt(d?.csthang)}</td>
                  <td className="px-2 py-2">{fmt(d?.cdhd)}</td>
                  <td className="px-2 py-2">{fmt(d?.thietbi)}</td>
                  <td className="px-2 py-2">{fmt(d?.giaoCu)}</td>
                  <td className="px-2 py-2">{fmt(d?.thuetndn)}</td>
                  <td className="px-2 py-2">{fmt(d?.vanHanh)}</td>
                  <td className="px-2 py-2 font-semibold text-green-700">
                    {fmt(d?.companyProfit)}
                  </td>
                </tr>

                {tienmat.map((item: any, idx: number) => (
                  <tr key={`tm-${idx}`} className="bg-green-50">
                    <td className="px-2 py-2 font-medium">Tiền mặt</td>
                    <td className="px-2 py-2" colSpan={2}>
                      🔥 Chính sách
                    </td>
                    <td className="px-2 py-2 font-semibold">
                      {fmt(item.money)}
                    </td>
                    <td className="px-2 py-2">{fmt(item.students)} HS</td>
                    <td className="px-2 py-2">{item.months} tháng</td>
                    <td className="px-2 py-2" colSpan={12} />
                  </tr>
                ))}

                {thietbi.map((item: any, idx: number) => (
                  <tr key={`tb-${idx}`} className="bg-blue-50">
                    <td className="px-2 py-2 font-medium">Thiết bị</td>
                    <td className="px-2 py-2" colSpan={2}>
                      {item.category} (SL: {item.qty})
                    </td>
                    <td className="px-2 py-2 font-semibold">
                      {fmt(item.price)}
                    </td>
                    <td className="px-2 py-2">{fmt(item.students)} HS</td>
                    <td className="px-2 py-2">{item.months} tháng</td>
                    <td className="px-2 py-2" colSpan={12} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== SUGGEST INFO ===== */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-[2px] rounded-full font-medium ${
                statusClass[data.status] || ""
              }`}
            >
              {data.status}
            </span>
            {data.issueDate && (
              <span className="text-xs text-gray-400">{data.issueDate}</span>
            )}
            {policy?.status && (
              <span className="text-[10px] px-2 py-[1px] bg-blue-100 text-blue-700 rounded-full font-medium">
                CS: {policy.status}
              </span>
            )}
          </div>

          <p className="font-semibold text-gray-900">{data.content}</p>

          {data.description && (
            <p className="text-sm text-gray-600">{data.description}</p>
          )}
          {data.component && (
            <p className="text-xs text-gray-500">
              Thành phần: {data.component}
            </p>
          )}
          {data.fileUrl && (
            <a
              href={`https://sales.kidoedu.vn${data.fileUrl}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-blue-500 font-medium"
            >
              📎 Xem file
            </a>
          )}

          {/* ACTION */}
          <div className="flex gap-2 pt-2">
            {role === "saleadmin" && data.status === "PENDING" && (
              <>
                <button
                  onClick={() => handleReview(data.id, "REVIEWED")}
                  className="flex-1 py-2 text-xs bg-green-500 text-white rounded-xl font-medium active:scale-95"
                >
                  ✔️ Kiểm tra
                </button>
                <button
                  onClick={() => handleReview(data.id, "REJECTED")}
                  className="flex-1 py-2 text-xs bg-red-500 text-white rounded-xl font-medium active:scale-95"
                >
                  ❌ Từ chối
                </button>
              </>
            )}

            {role === "director" &&
              (data.status === "PENDING" || data.status === "REVIEWED") && (
                <>
                  <button
                    onClick={() => handleApprove(data.id, "APPROVED")}
                    className="flex-1 py-2 text-xs bg-blue-500 text-white rounded-xl font-medium active:scale-95"
                  >
                    ✔️ Duyệt
                  </button>
                  <button
                    onClick={() => handleApprove(data.id, "REJECTED")}
                    className="flex-1 py-2 text-xs bg-red-500 text-white rounded-xl font-medium active:scale-95"
                  >
                    ❌ Không duyệt
                  </button>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  span,
}: {
  icon: string;
  label: string;
  value: any;
  span?: number;
}) {
  if (value == null || value === "") return null;

  return (
    <div className={span === 2 ? "md:col-span-2" : ""}>
      <span className="mr-1">{icon}</span>
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="font-medium">{value}</span>
    </div>
  );
}
