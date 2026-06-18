import { useState } from "react";
import { downloadAndInstallApk } from "../service/update.service";

export default function UpdateModal({ data, onClose }: any) {
    const [progress, setProgress] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpdate = async () => {
        if (downloading) return;

        setDownloading(true);
        setError(null);
        setProgress(0);

        try {

            await downloadAndInstallApk(data.apkUrl, (p: number) => {
                setProgress(p);
            });
        } catch (err: any) {
            console.error("UPDATE ERROR:", err);

            let message = "Tải xuống thất bại";

            if (err?.message) {
                message += `: ${err.message}`;
            }

            if (err?.response?.status) {
                message += ` (HTTP ${err.response.status})`;
            }

            if (!err?.message) {
                message += "\n" + JSON.stringify(err, null, 2);
            }

            // 👉 HIỂN THỊ ALERT
            alert(message);

            setError(message);
            setDownloading(false);
        }
    };


    const handleRetry = () => {
        setError(null);
        handleUpdate();
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white p-5 rounded-2xl w-80 shadow-xl">
                <h2 className="text-lg font-bold text-gray-800">
                    🚀 Cập nhật ứng dụng
                </h2>

                <p className="mt-2 text-sm text-gray-600">
                    {data?.note || "Có phiên bản mới"}
                </p>

                {/* Progress */}
                {downloading && (
                    <div className="mt-4">
                        <div className="w-full bg-gray-200 h-3 rounded overflow-hidden">
                            <div
                                className="bg-green-500 h-3 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs mt-1 text-gray-500">
                            Đang tải... {progress}%
                        </p>
                    </div>
                )}

                {/* Error (hiển thị chi tiết + scroll) */}
                {error && (
                    <div className="mt-3 bg-red-50 border border-red-300 rounded p-2 max-h-32 overflow-auto">
                        <p className="text-red-600 text-xs whitespace-pre-wrap break-all">
                            {error}
                        </p>

                        {/* Retry */}
                        <button
                            onClick={handleRetry}
                            className="mt-2 text-xs text-blue-500 underline"
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {/* Buttons */}
                <div className="mt-5 flex gap-2">

                    <button
                        onClick={handleUpdate}
                        disabled={downloading}
                        className={`flex-1 py-2 rounded-lg text-white ${downloading
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-500 active:scale-95"
                            }`}
                    >
                        {downloading ? "Đang tải..." : "Cập nhật ngay"}
                    </button>
                </div>
            </div>
        </div>
    );
}