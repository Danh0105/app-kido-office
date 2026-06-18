import { drawGuideFrame } from "@/utils/canvas.utils";
import * as faceapi from "face-api.js";
import { useEffect, useRef } from "react";
const FACE_CONFIG = {
    inputSize: 160,
    scoreThreshold: 0.5,
    detectInterval: 400,
};
export const useFaceDetection = (videoRef, canvasRef, onValidFace) => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isFaceInsideFrame = (box, frame) => {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        return (
            centerX > frame.x &&
            centerX < frame.x + frame.width &&
            centerY > frame.y &&
            centerY < frame.y + frame.height
        );
    };
    useEffect(() => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        const start = () => {
            const size = {
                width: video.videoWidth,
                height: video.videoHeight,
            };

            canvas.width = size.width;
            canvas.height = size.height;

            intervalRef.current = setInterval(async () => {
                const detections = await faceapi
                    .detectAllFaces(
                        video,
                        new faceapi.TinyFaceDetectorOptions(FACE_CONFIG)
                    )
                    .withFaceLandmarks();

                const resized = faceapi.resizeResults(detections, size);
                const ctx = canvas.getContext("2d");

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                let frame = drawGuideFrame(ctx, canvas.width, canvas.height, false);

                if (resized.length > 0) {
                    const box = resized[0].detection.box;

                    const isValid = isFaceInsideFrame(box, frame);

                    drawGuideFrame(ctx, canvas.width, canvas.height, isValid);

                    if (isValid) {
                        onValidFace(video, box);
                    }
                }
            }, FACE_CONFIG.detectInterval);
        };

        video.addEventListener("loadedmetadata", start);

        return () => {
            video.removeEventListener("loadedmetadata", start);

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);
};