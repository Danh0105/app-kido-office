import { useState } from "react";
import axios from "axios";

export default function UploadApk() {
    const [file, setFile] = useState<File | null>(null);
    const [version, setVersion] = useState("");
    const [note, setNote] = useState("");
    const [force, setForce] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleUpload = async () => {
        if (!file || !version) {
            alert("Thiếu file hoặc version");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("version", version);
        formData.append("note", note);
        formData.append("force", String(force));

        try {
            setLoading(true);

            await axios.post(
                "https://sales.kidoedu.vn/admin/version/upload",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            alert("Upload thành công 🎉");
        } catch (err) {
            console.error(err);
            alert("Upload thất bại ❌");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Upload APK</h2>

            <div>
                <label>Version</label>
                <input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.2"
                />
            </div>

            <div>
                <label>Note</label>
                <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Fix bug"
                />
            </div>

            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={force}
                        onChange={(e) => setForce(e.target.checked)}
                    />
                    Force update
                </label>
            </div>

            <div>
                <input
                    type="file"
                    accept=".apk"
                    onChange={(e) => {
                        if (e.target.files) {
                            setFile(e.target.files[0]);
                        }
                    }}
                />
            </div>

            <button onClick={handleUpload} disabled={loading}>
                {loading ? "Đang upload..." : "Upload"}
            </button>
        </div>
    );
}