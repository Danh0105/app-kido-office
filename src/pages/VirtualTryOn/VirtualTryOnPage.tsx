import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Download, Loader2, Sparkles, Trash2 } from "lucide-react";

import HeaderWithBack from "@/components/HeaderWithBack";
import { getApiErrorMessage } from "@/utils/apiError";
// Backend trả `/uploads/...` (tương đối) trong khi FE chạy ở domain khác với
// API — phải ghép origin của API, không thì ảnh 404 ngay trên domain FE.
import { resolveApiFileUrl } from "@/utils/fileUrl";
import {
  localTryOnHistory,
  TryOnJob,
  TryOnSize,
  TRYON_SIZES,
  virtualTryonApi,
} from "@/service/virtualTryon";
import { getEmployeeId } from "@/utils/auth";

import ImagePicker from "./ImagePicker";
import { useTryOnJob } from "./useTryOnJob";

const SIZE_LABELS: Record<TryOnSize, string> = {
  "1024x1536": "Dọc (3:4)",
  "1024x1024": "Vuông (1:1)",
  "1536x1024": "Ngang (4:3)",
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Đang xếp hàng…",
  PROCESSING: "Đang tạo ảnh…",
  SUCCEEDED: "Xong",
  FAILED: "Thất bại",
};

export default function VirtualTryOnPage() {
  const [person, setPerson] = useState<File | null>(null);
  const [garment, setGarment] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<TryOnSize>("1024x1536");
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<TryOnJob[]>([]);
  const { job, waiting, error, track, reset } = useTryOnJob();

  // Trang mở công khai: khách chưa đăng nhập không gọi được API danh sách
  // (API đó cố ý bắt đăng nhập để không ai duyệt ảnh của người khác), nên
  // lịch sử của họ lấy từ {id, token} lưu tại máy.
  const loggedIn = !!getEmployeeId();

  const loadHistory = async () => {
    try {
      if (loggedIn) {
        const res = await virtualTryonApi.list({ limit: 12 });
        setHistory(res.data);
        return;
      }

      const refs = localTryOnHistory.all();
      const loaded = await Promise.all(
        refs.map((ref) =>
          virtualTryonApi.getById(ref.id, ref.token).catch(() => null),
        ),
      );
      // Job đã bị xoá ở server thì dọn luôn khỏi lịch sử máy.
      loaded.forEach((item, index) => {
        if (!item) localTryOnHistory.remove(refs[index].id);
      });
      setHistory(loaded.filter((item): item is TryOnJob => !!item));
    } catch {
      // Lịch sử hỏng không chặn việc tạo ảnh mới — bỏ qua im lặng.
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Job vừa xong thì làm mới lịch sử để thấy ngay bản mới nhất.
  useEffect(() => {
    if (job?.status === "SUCCEEDED" || job?.status === "FAILED") loadHistory();
  }, [job?.status]);

  const canSubmit = !!person && !!garment && !submitting && !waiting;

  const handleSubmit = async () => {
    if (!person || !garment) return;

    setSubmitting(true);
    try {
      const created = await virtualTryonApi.create({
        person,
        garment,
        prompt,
        size,
      });
      if (created.publicToken) {
        localTryOnHistory.add({ id: created.id, token: created.publicToken });
      }
      track(created, created.publicToken);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tạo được yêu cầu thử đồ"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNew = () => {
    reset();
    setPerson(null);
    setGarment(null);
    setPrompt("");
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Xoá ảnh thử đồ này?")) return;
    try {
      const token =
        localTryOnHistory.all().find((ref) => ref.id === id)?.token ?? null;
      await virtualTryonApi.remove(id, token);
      localTryOnHistory.remove(id);
      if (job?.id === id) reset();
      loadHistory();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Xoá thất bại"));
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen pb-24">
      <HeaderWithBack title="Thử đồ ảo" />

      {/*
        Giới hạn bề ngang: đây là màn thao tác dọc (2 ô ảnh + nút), kéo hết
        chiều rộng màn hình lớn thì 2 ô ảnh phình rất to mà vẫn trống hai bên.
      */}
      <div className="px-3 pt-[68px] pb-4 space-y-3 w-full max-w-md mx-auto">
        {/* ===== Chọn ảnh ===== */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <ImagePicker
              label="Ảnh người mặc"
              hint="Ảnh rõ mặt, thấy được thân trên"
              file={person}
              onChange={setPerson}
              disabled={waiting}
            />
            <ImagePicker
              label="Ảnh trang phục"
              hint="Chụp thẳng món đồ, nền đơn giản"
              file={garment}
              onChange={setGarment}
              disabled={waiting}
            />
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-1.5">Khổ ảnh</p>
            <div className="flex gap-2">
              {TRYON_SIZES.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={waiting}
                  onClick={() => setSize(value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                    size === value
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {SIZE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-1.5">
              Yêu cầu thêm{" "}
              <span className="font-normal text-gray-400">(không bắt buộc)</span>
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={waiting}
              rows={2}
              maxLength={2000}
              placeholder="VD: chỉnh áo bỏ trong quần, giữ nguyên nền…"
              className="w-full p-3 rounded-xl border text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">
              Bỏ trống sẽ giữ nguyên khuôn mặt, dáng người và bối cảnh, chỉ thay
              trang phục.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-500 disabled:bg-gray-300 text-white py-3 rounded-xl font-medium transition"
          >
            {submitting || waiting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {waiting ? STATUS_TEXT[job?.status ?? "PENDING"] : "Đang gửi…"}
              </>
            ) : (
              <>
                <Sparkles size={16} /> Tạo ảnh thử đồ
              </>
            )}
          </button>

          {waiting && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Thường mất 15–60 giây, giữ nguyên màn hình này.
            </p>
          )}
        </div>

        {/* ===== Kết quả ===== */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-sm">
            {error}
          </div>
        )}

        {job?.status === "SUCCEEDED" && job.resultImageUrl && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-700 mb-2">Kết quả</p>
            <img
              src={resolveApiFileUrl(job.resultImageUrl)}
              alt="Ảnh thử đồ"
              className="w-full rounded-xl"
            />
            <div className="mt-3 flex gap-2">
              <a
                href={resolveApiFileUrl(job.resultImageUrl)}
                download
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                <Download size={15} /> Tải ảnh
              </a>
              <button
                onClick={handleNew}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium"
              >
                Thử bộ khác
              </button>
            </div>
          </div>
        )}

        {/* ===== Lịch sử ===== */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Đã thử gần đây
            </p>
            <div className="grid grid-cols-3 gap-2">
              {history.map((item) => (
                <div key={item.id} className="relative">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                    {item.resultImageUrl ? (
                      <img
                        src={resolveApiFileUrl(item.resultImageUrl)}
                        alt={`Thử đồ #${item.id}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className={`text-[10px] px-1.5 text-center ${
                          item.status === "FAILED"
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        {STATUS_TEXT[item.status] ?? item.status}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    aria-label={`Xoá thử đồ #${item.id}`}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
