import { useEffect, useState } from "react";

const textToImage = (text: string) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const fontSize = 16;
    const padding = 10;

    // đo kích thước text
    ctx!.font = `${fontSize}px Arial`;
    const textWidth = ctx!.measureText(text).width;

    canvas.width = textWidth + padding * 2;
    canvas.height = 200; // chiều cao cho text dọc

    ctx!.font = `${fontSize}px Arial`;
    ctx!.fillStyle = "#000";
    ctx!.textAlign = "center";

    // 🔥 xoay canvas
    ctx!.translate(canvas.width / 2, canvas.height / 2);
    ctx!.rotate(-Math.PI / 2);

    ctx!.fillText(text, 0, 0);

    return canvas.toDataURL("image/png");
};
export const VerticalTextImage = ({ text }: { text: string }) => {
    const [src, setSrc] = useState("");

    useEffect(() => {
        setSrc(textToImage(text));
    }, [text]);

    return (
        <img
            src={src}
            alt=""
            style={{ height: 120 }}
        />
    );
};