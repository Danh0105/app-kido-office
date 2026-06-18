import { useEffect, useRef, useState } from "react"
import * as faceapi from "face-api.js"
import { loadModels } from "../utils/faceApi"

export default function FaceRecognition() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const [isReady, setIsReady] = useState(false)

    // 🚀 Load model + camera
    useEffect(() => {
        const init = async () => {
            await loadModels()

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
            })

            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }

            setIsReady(true)
        }

        init()
    }, [])

    // 🎯 Detect face realtime
    useEffect(() => {
        if (!isReady) return

        const video = videoRef.current!
        const canvas = canvasRef.current!

        video.addEventListener("play", () => {
            const displaySize = {
                width: video.videoWidth,
                height: video.videoHeight,
            }

            faceapi.matchDimensions(canvas, displaySize)

            const interval = setInterval(async () => {
                const detections = await faceapi
                    .detectAllFaces(
                        video,
                        new faceapi.TinyFaceDetectorOptions()
                    )
                    .withFaceLandmarks()
                    .withFaceDescriptors()

                const resized = faceapi.resizeResults(detections, displaySize)

                const ctx = canvas.getContext("2d")!
                ctx.clearRect(0, 0, canvas.width, canvas.height)

                faceapi.draw.drawDetections(canvas, resized)

            }, 100)

            return () => clearInterval(interval)
        })
    }, [isReady])

    return (
        <div className="relative">
            <video
                ref={videoRef}
                autoPlay
                muted
                className="rounded-xl"
                width={720}
                height={560}
            />
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0"
            />
        </div>
    )
}