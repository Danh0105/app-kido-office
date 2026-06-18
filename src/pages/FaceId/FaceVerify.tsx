import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { faceApi } from "../../service/face";
type Props = {
  onSuccess?: (user: any) => void;
};
// 🎯 VẼ KHUNG GUIDE
const drawGuideFrame = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isValid: boolean,
) => {
  const centerX = width / 2;
  const centerY = height / 2;

  const radiusX = width * 0.22;
  const radiusY = height * 0.32;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

  ctx.lineWidth = 4;
  ctx.strokeStyle = isValid ? "#00ff88" : "#ff4444";
  ctx.stroke();

  ctx.font = "16px Arial";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("Đặt khuôn mặt vào khung", centerX, centerY - radiusY - 20);

  return {
    x: centerX - radiusX,
    y: centerY - radiusY,
    frameWidth: radiusX * 2,
    frameHeight: radiusY * 2,
  };
};

// 🎯 CHECK FACE TRONG KHUNG
const isFaceInsideFrame = (
  faceBox: faceapi.Box,
  frame: {
    x: number;
    y: number;
    frameWidth: number;
    frameHeight: number;
  },
) => {
  const faceCenterX = faceBox.x + faceBox.width / 2;
  const faceCenterY = faceBox.y + faceBox.height / 2;

  return (
    faceCenterX > frame.x &&
    faceCenterX < frame.x + frame.frameWidth &&
    faceCenterY > frame.y &&
    faceCenterY < frame.y + frame.frameHeight
  );
};
export default function FaceVerify({ onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noFaceTimeoutRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("⏳ Đang khởi tạo...");
  const isLoggingInRef = useRef(false);
  const statusRef = useRef(status);
  const updateStatus = (newStatus: string) => {
    if (statusRef.current !== newStatus) {
      statusRef.current = newStatus;
      setStatus(newStatus);
    }
  };
  const stopCamera = () => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  };
  // 🚀 LOAD MODEL + CAMERA
  useEffect(() => {
    const init = async () => {
      const MODEL_URL = "/models";

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setLoading(false);
      updateStatus("👀 Đưa mặt vào khung");
    };

    init();
  }, []);

  // 🎥 DETECT + LOGIN
  useEffect(() => {
    if (loading) return;

    const video = videoRef.current!;
    const canvas = canvasRef.current!;

    let interval: any;

    // thời gian mất mặt
    let noFaceSince: number | null = null;

    const start = () => {
      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      canvas.width = displaySize.width;
      canvas.height = displaySize.height;

      faceapi.matchDimensions(canvas, displaySize);

      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGuideFrame(ctx, canvas.width, canvas.height, false);

      interval = setInterval(async () => {
        // đang login thì bỏ qua detect
        if (isLoggingInRef.current) return;

        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resized = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext("2d")!;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 🎯 vẽ khung mặc định
        let frame = drawGuideFrame(ctx, canvas.width, canvas.height, false);

        // =====================================================
        // KHÔNG TÌM THẤY KHUÔN MẶT
        // =====================================================
        if (resized.length === 0) {
          // bắt đầu đếm thời gian mất mặt
          if (!noFaceSince) {
            noFaceSince = Date.now();
          }

          // chỉ reset status nếu mất mặt > 2s
          if (Date.now() - noFaceSince > 2000) {
            updateStatus("👀 Đưa mặt vào khung");
          }

          return;
        }

        // thấy mặt lại => reset timer
        noFaceSince = null;

        // =====================================================
        // FACE DETECTED
        // =====================================================
        const box = resized[0].detection.box;

        // kiểm tra mặt trong khung
        const isValid = isFaceInsideFrame(box, frame);

        // vẽ lại khung theo trạng thái
        drawGuideFrame(ctx, canvas.width, canvas.height, isValid);

        // vẽ detection box
        faceapi.draw.drawDetections(canvas, resized);

        // lấy descriptor
        const descriptor = Array.from(resized[0].descriptor);

        // =====================================================
        // LOGIN
        // =====================================================
        if (!isLoggingInRef.current && isValid) {
          isLoggingInRef.current = true;

          updateStatus("🔐 Đang đăng nhập...");

          try {
            const res = await faceApi.login(descriptor);

            localStorage.setItem("access_token", res.access_token);

            updateStatus("🎉 Đăng nhập thành công");

            stopCamera();

            onSuccess?.(res.user);
          } catch (err) {
            updateStatus("❌ Không nhận diện");

            // delay 2s
            await new Promise((resolve) => setTimeout(resolve, 2000));

            updateStatus("👀 Đưa mặt vào khung");

            isLoggingInRef.current = false;

            return;
          }
        }
      }, 500); // detect mỗi 0.5s cho mượt hơn
    };

    video.addEventListener("play", start);

    return () => {
      video.removeEventListener("play", start);

      clearInterval(interval);

      if (noFaceTimeoutRef.current) {
        clearTimeout(noFaceTimeoutRef.current);
      }
    };
  }, [loading]);

  return (
    <div
      className="
        flex flex-col items-center 
        px-4 py-6

        bg-black text-white
        "
    >
      {/* TITLE */}
      <h1 className="text-xl sm:text-2xl font-bold mb-4 text-center">
        🔐 Đăng nhập bằng khuôn mặt
      </h1>

      {/* CAMERA WRAPPER */}
      <div
        className="
            relative 

            w-full 
            max-w-[500px]

            aspect-[4/3] sm:aspect-[4/3] lg:h-[350px] lg:aspect-auto
            "
      >
        {/* VIDEO */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="
                    rounded-xl shadow-lg 
                    w-full h-full 
                    object-cover
                "
        />

        {/* CANVAS */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>

      {/* STATUS */}
      <div
        className="
            mt-4 
            text-sm sm:text-lg 
            font-medium 
            text-center
            "
      >
        {status}
      </div>

      {/* TIP (mobile only) */}
      <div className="mt-3 text-xs text-gray-400 text-center sm:hidden">
        Giữ điện thoại ngang tầm mặt và đủ ánh sáng
      </div>
    </div>
  );
}
