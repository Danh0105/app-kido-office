import React from "react";
import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { faceApi } from "../../service/face";

let modelsLoaded = false;
const CAPTURE_STEPS = [
  {
    label: "🙂 Giữ chính diện",
    type: "center",
  },

  {
    label: "↩️ Quay nhẹ sang trái",
    type: "left",
  },

  {
    label: "↪️ Quay nhẹ sang phải",
    type: "right",
  },

  {
    label: "🔍 Đưa mặt lại gần",
    type: "near",
  },

  {
    label: "📏 Ra xa một chút",
    type: "far",
  },
];
const loadBaseModels = async () => {
  if (modelsLoaded) return;

  const MODEL_URL = "/models";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
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

  // 🌑 overlay tối
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, width, height);

  // 🧠 clear vùng oval (focus)
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = isValid ? 5 : 3;
  // reset mode
  ctx.globalCompositeOperation = "source-over";

  // 🎯 viền oval
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

  ctx.lineWidth = 4;
  ctx.strokeStyle = isValid ? "#00ff88" : "#ff4444";
  ctx.shadowBlur = isValid ? 20 : 0;
  ctx.shadowColor = isValid ? "#00ff88" : "transparent";
  ctx.stroke();

  // ✨ text
  ctx.font = "16px Arial";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  return {
    x: centerX - radiusX,
    y: centerY - radiusY,
    frameWidth: radiusX * 2,
    frameHeight: radiusY * 2,
  };
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const euclideanDistance = (a: number[], b: number[]) => {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];

    sum += diff * diff;
  }

  return Math.sqrt(sum);
};

// 🎯 CHECK FACE TRONG KHUNG
const isFaceInsideFrame = (faceBox: any, frame: any) => {
  const faceCenterX = faceBox.x + faceBox.width / 2;
  const faceCenterY = faceBox.y + faceBox.height / 2;

  return (
    faceCenterX > frame.x &&
    faceCenterX < frame.x + frame.frameWidth &&
    faceCenterY > frame.y &&
    faceCenterY < frame.y + frame.frameHeight
  );
};
type Props = {
  onSuccess?: () => void;
};
export default function RegisterFace({ onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("⏳ Đang khởi tạo...");
  const validStartRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);
  const statusRef = useRef("");
  const statusTimeRef = useRef(0);
  const descriptorsRef = useRef<number[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const lostFaceSinceRef = useRef<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const isFrozenRef = useRef(false);
  const statusLockRef = useRef(false);
  const isCapturingRef = useRef(false);
  const currentStepRef = useRef("");
  const stepStableCountRef = useRef(0);
  const progressTimeoutRef = useRef<any>(null);
  const [stepProgress, setStepProgress] = useState(0);
  const updateStepProgressSmooth = (value: number, delay = 180) => {
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }

    progressTimeoutRef.current = setTimeout(() => {
      setStepProgress(value);
    }, delay);
  };
  const updateStatus = (newStatus: string, duration = 1200) => {
    if (statusLockRef.current) return;

    // 🔥 tránh render lại cùng text
    if (statusRef.current === newStatus) {
      return;
    }

    statusRef.current = newStatus;

    requestAnimationFrame(() => {
      setStatus(newStatus);
    });

    statusLockRef.current = true;

    setTimeout(() => {
      statusLockRef.current = false;
    }, duration);
  };
  // 🚀 INIT
  const getFacePose = (detection: any) => {
    const landmarks = detection.landmarks;

    const nose = landmarks.getNose();

    const jaw = landmarks.getJawOutline();

    const leftJaw = jaw[0];
    const rightJaw = jaw[16];

    const centerX = (leftJaw.x + rightJaw.x) / 2;

    const noseX = nose[3].x;

    const yaw = noseX - centerX;

    const box = detection.detection.box;

    return {
      yaw,
      width: box.width,
      height: box.height,
    };
  };

  useEffect(() => {
    if (loading) return;

    const video = videoRef.current!;
    const canvas = canvasRef.current!;

    const handleLoaded = () => {
      const video = videoRef.current!;
      const canvas = canvasRef.current!;

      if (!video.videoWidth || !video.videoHeight) return;

      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      canvas.width = displaySize.width;
      canvas.height = displaySize.height;

      faceapi.matchDimensions(canvas, displaySize);

      const lostFrameCountRef = { current: 0 };
      const invalidFrameCountRef = { current: 0 };

      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGuideFrame(ctx, canvas.width, canvas.height, false);

      intervalRef.current = setInterval(async () => {
        // 🔥 đang capture thì bỏ qua realtime detect
        if (isCapturingRef.current) return;

        if (isFrozenRef.current) return;

        if (!video || video.readyState !== 4) return;

        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.6,
            }),
          )
          .withFaceLandmarks();

        const resized = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext("2d")!;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 🎯 luôn vẽ frame trước
        const frame = drawGuideFrame(ctx, canvas.width, canvas.height, false);

        let isValid = false;

        // =================================================
        // CÓ KHUÔN MẶT
        // =================================================
        if (resized.length > 0) {
          lostFaceSinceRef.current = null;

          const box = resized[0].detection.box;

          // check face trong khung
          isValid = isFaceInsideFrame(box, frame);

          // redraw frame theo trạng thái
          drawGuideFrame(ctx, canvas.width, canvas.height, isValid);

          // =============================================
          // FACE VALID
          // =============================================
          if (isValid) {
            lostFrameCountRef.current = 0;
            invalidFrameCountRef.current = 0;

            if (!validStartRef.current) {
              validStartRef.current = Date.now();
            }

            const duration = Date.now() - validStartRef.current;

            const step = Math.min(5, Math.floor(duration / 300));

            updateStatus(`⏳ Đang xác nhận ${step}/5`, 500);

            // ✅ giữ ổn định đủ lâu
            if (duration > 1500 && !submittedRef.current) {
              submittedRef.current = true;

              // 🔥 tránh crash render loop
              setTimeout(() => {
                handleAutoSubmit();
              }, 0);
            }
          }

          // =============================================
          // FACE INVALID
          // =============================================
          else {
            lostFrameCountRef.current++;
            invalidFrameCountRef.current++;

            // ⚠️ chỉ reset sau nhiều frame fail
            if (invalidFrameCountRef.current > 5) {
              updateStatus("📍 Đưa mặt vào khung", 1200);

              validStartRef.current = null;
              submittedRef.current = false;
            }
          }
        }

        // =================================================
        // KHÔNG CÓ KHUÔN MẶT
        // =================================================
        else {
          if (!lostFaceSinceRef.current) {
            lostFaceSinceRef.current = Date.now();
          }

          const lostDuration = Date.now() - lostFaceSinceRef.current;

          // chỉ báo lỗi nếu mất mặt > 1s
          if (lostDuration > 1000) {
            updateStatus("❌ Không thấy khuôn mặt", 1200);

            validStartRef.current = null;
            submittedRef.current = false;
          }
        }
      }, 450);
    };

    const waitVideoReady = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      if (video.readyState === 4) {
        clearInterval(waitVideoReady);
        handleLoaded();
      }
    }, 100);

    return () => {
      clearInterval(waitVideoReady);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      video.removeEventListener("loadedmetadata", handleLoaded);
    };
  }, [loading]);
  const startCamera = async () => {
    try {
      updateStatus("📷 Đang mở camera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      updateStatus("⏳ Đang tải model...");
      await loadBaseModels();

      setLoading(false);
      updateStatus("✅ Sẵn sàng");
    } catch (err: any) {
      updateStatus("❌ Lỗi camera: " + err.message);
    }
  };
  const stopCamera = () => {
    // stop stream
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    // clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
  const resetAll = () => {
    // 🛑 stop camera + loop
    stopCamera();

    // 🧠 reset state logic
    validStartRef.current = null;
    submittedRef.current = false;
    descriptorsRef.current = [];
    lostFaceSinceRef.current = null;
    isFrozenRef.current = false;

    // 🧾 reset status control
    statusRef.current = "";
    statusTimeRef.current = 0;

    // 🎯 reset UI
    updateStatus("📷 Sẵn sàng quét khuôn mặt");
    setCurrentStep(0);
    // ⚙️ reset flags
    setIsProcessing(false);
    setLoading(true); // 🔥 cực quan trọng để re-init detect

    // 📹 clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  // 📸 REGISTER
  const handleAutoSubmit = async () => {
    if (isProcessing) return;

    isCapturingRef.current = true;
    setIsProcessing(true);
    try {
      updateStatus("🧠 Đang phân tích khuôn mặt...");

      const video = videoRef.current!;

      // =================================================
      // LOAD MODEL ONCE
      // =================================================
      if (!faceapi.nets.faceRecognitionNet.isLoaded) {
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
      }

      // =================================================
      // RESET
      // =================================================
      descriptorsRef.current = [];

      const collected: number[][] = [];

      let failedFrames = 0;

      // =================================================
      // COLLECT MULTI FRAMES
      // =================================================
      let stepIndex = 0;

      while (stepIndex < CAPTURE_STEPS.length) {
        const step = CAPTURE_STEPS[stepIndex];

        if (currentStepRef.current !== step.label) {
          currentStepRef.current = step.label;

          setCurrentStep(stepIndex);

          updateStatus(step.label, 1500);
        }

        const detection = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.5,
            }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          await sleep(400);

          continue;
        }

        const pose = getFacePose(detection);

        let passed = false;

        // =================================================
        // CHECK TỪNG STEP
        // =================================================

        switch (step.type) {
          case "center":
            passed = Math.abs(pose.yaw) < 18;

            break;

          case "left":
            passed = pose.yaw > 18;
            break;

          case "right":
            passed = pose.yaw < -18;
            break;

          case "near":
            passed = pose.width > 170;

            break;

          case "far":
            passed = pose.width < 140;

            break;
        }
        if (!passed) {
          stepStableCountRef.current = 0;

          await sleep(300);

          continue;
        }

        // phải giữ đúng liên tục
        stepStableCountRef.current++;
        updateStepProgressSmooth(stepStableCountRef.current);
        if (stepStableCountRef.current < 3) {
          await sleep(200);
          continue;
        }

        stepStableCountRef.current = 3;
        updateStepProgressSmooth(3, 250);
        const descriptor = Array.from(detection.descriptor);
        let isDuplicate = false;

        for (const old of collected) {
          const distance = euclideanDistance(descriptor, old);

          if (distance < 0.08) {
            isDuplicate = true;

            break;
          }
        }

        if (isDuplicate) {
          updateStatus("🔄 Di chuyển nhẹ khuôn mặt");

          await sleep(500);

          continue;
        }
        collected.push(descriptor);

        // 🎯 mỗi step lấy 3 frame
        if (collected.length >= (stepIndex + 1) * 3) {
          stepIndex++;

          updateStatus("✅ OK");

          await sleep(1200);
          stepStableCountRef.current = 0;
          setStepProgress(0);
        }

        await sleep(700);
      }

      // =================================================
      // VALIDATE
      // =================================================
      if (collected.length < 10) {
        submittedRef.current = false;

        await showError("Không đủ dữ liệu khuôn mặt chất lượng cao");

        submittedRef.current = false;

        setIsProcessing(false);

        return;
      }

      // =================================================
      // SAVE
      // =================================================
      descriptorsRef.current = collected;

      updateStatus("🚀 Đang mã hóa dữ liệu...");

      const data = await faceApi.registerEmployee({
        descriptors: descriptorsRef.current,
      });

      // =================================================
      // SUCCESS
      // =================================================
      setStatus("🎉 Đăng ký thành công");

      setTimeout(() => {
        stopCamera();

        resetAll();

        onSuccess?.();
      }, 1200);
    } catch (err: any) {
      console.error(err);

      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Lỗi hệ thống";

      await showError(errorMsg);

      submittedRef.current = false;
    } finally {
      isCapturingRef.current = false;

      setIsProcessing(false);
    }
  };

  const showError = async (message: string, delay = 2500) => {
    isFrozenRef.current = true;

    setStatus("❌ " + message);

    await sleep(delay);

    isFrozenRef.current = false;
  };
  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* CARD */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 text-center relative">
        {/* TITLE */}
        <h1 className="text-xl font-bold mb-4">📸 Đăng ký khuôn mặt</h1>

        {/* CAMERA */}
        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black">
          {!streamRef.current && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white z-10">
              📷 Đang khởi tạo camera...{" "}
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            style={{ transform: "scaleX(-1)" }}
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* OVERLAY tối */}
          <div className="absolute inset-0 bg-black/40" />

          {/* KHUNG OVAL */}

          {/* ICON trạng thái */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
            Quét khuôn mặt
          </div>
        </div>

        {/* STATUS */}
        <div className="mt-4">
          {/* STATUS TEXT */}
          <div className="text-sm font-medium text-gray-700 min-h-[24px]">
            {status}
          </div>

          {/* STEP PROGRESS */}
          {isProcessing && (
            <div className="mt-3 bg-gray-100 rounded-2xl p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold text-gray-700">
                  {CAPTURE_STEPS[currentStep]?.label}
                </span>

                <span className="text-blue-600 font-bold">
                  {stepProgress}/3
                </span>
              </div>

              {/* PROGRESS BAR */}
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-700 ease-out"
                  style={{
                    width: `${(stepProgress / 3) * 100}%`,
                  }}
                />
              </div>

              {/* TOTAL STEP */}
              <div className="text-xs text-gray-500 mt-2 text-right">
                Bước {currentStep + 1}/{CAPTURE_STEPS.length}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
