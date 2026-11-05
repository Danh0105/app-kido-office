import { useEffect, useState, type ImgHTMLAttributes } from "react";

import api from "@/service/api";

/** Tải file bằng Axios để bearer token đi kèm, rồi chỉ mở object URL nội bộ. */
export const openAuthenticatedFile = async (url: string, name?: string) => {
  // Mở tab ngay trong user gesture để trình duyệt không chặn popup sau lúc
  // request có bearer token hoàn tất.
  const opened = window.open("about:blank", "_blank");
  if (opened) opened.opener = null;

  try {
    const response = await api.get(url, { responseType: "blob" });
    const objectUrl = URL.createObjectURL(response.data);

    if (opened) {
      opened.location.href = objectUrl;
    } else {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name || "tai-lieu";
      link.click();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    opened?.close();
    throw error;
  }
};

export function AuthenticatedFileImage({
  fileUrl,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fileUrl: string }) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    void api
      .get(fileUrl, { responseType: "blob" })
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(undefined));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  if (!src) return <span className={props.className} aria-hidden />;
  return <img {...props} src={src} />;
}
