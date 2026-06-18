export const drawGuideFrame = (ctx, width, height, isValid) => {
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

    return {
        x: centerX - radiusX,
        y: centerY - radiusY,
        width: radiusX * 2,
        height: radiusY * 2,
    };
};