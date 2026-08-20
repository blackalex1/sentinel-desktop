/**
 * Windows Sentinel - 4-Quadrant Windows Visor & Eyes Renderer
 * GPU Optimization: Eliminated shadowBlur — replaced with layered alpha fills.
 */
(function (root, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else {
        root.WindowsSentinelVisorRenderer = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {

    class WindowsSentinelVisorRenderer {
        static draw(ctx, fx, fy, s, shockOffsetY, gazeX, gazeY, breathe, eyeOpenness, isRunning, cpu, now, sleepProgress) {
            const isAwake = 1 - sleepProgress;
            const mainCyan = "#38BDF8";

            // 1. Visor Glass Screen Inset
            ctx.save();
            ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
            ctx.beginPath();
            ctx.moveTo(fx(26), fy(29 + shockOffsetY));
            ctx.lineTo(fx(74), fy(29 + shockOffsetY));
            ctx.lineTo(fx(74), fy(47 + shockOffsetY));
            ctx.lineTo(fx(50), fy(53 + shockOffsetY));
            ctx.lineTo(fx(26), fy(47 + shockOffsetY));
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // 2. 4-Quadrant Windows Cyber Visor Eyes
            // Eye color
            const eyeR = isRunning ? (cpu > 80 ? 239 : 56)  : 139;
            const eyeG = isRunning ? (cpu > 80 ?  68 : 189) :  92;
            const eyeB = isRunning ? (cpu > 80 ?  68 : 248) : 246;

            const eyeOffsetGx = gazeX * 3.5 * s * isAwake;
            const eyeOffsetGy = gazeY * 2.5 * s * isAwake + breathe * 0.3;
            const currentAperture = Math.max(0.08, eyeOpenness * isAwake);

            ctx.save();

            if (currentAperture > 0.18) {
                // Outer glow layer (replaces shadowBlur)
                const glowAlpha = 0.30 * isAwake;
                if (glowAlpha > 0.02) {
                    ctx.fillStyle = `rgba(${eyeR}, ${eyeG}, ${eyeB}, ${glowAlpha})`;
                    // Left eye halo
                    ctx.fillRect(fx(27) + eyeOffsetGx, fy(32 + shockOffsetY) + eyeOffsetGy, 17 * s, 9 * s * currentAperture);
                    // Right eye halo
                    ctx.fillRect(fx(56) + eyeOffsetGx, fy(32 + shockOffsetY) + eyeOffsetGy, 17 * s, 9 * s * currentAperture);
                }

                // Core bright fill
                ctx.fillStyle = `rgba(${eyeR}, ${eyeG}, ${eyeB}, ${0.9 * isAwake + 0.1})`;

                // Left Quad-Segment (Windows Logo Left Eye)
                ctx.fillRect(fx(28) + eyeOffsetGx, fy(33 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);
                ctx.fillRect(fx(36) + eyeOffsetGx, fy(33 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);
                ctx.fillRect(fx(28) + eyeOffsetGx, fy(38 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);
                ctx.fillRect(fx(36) + eyeOffsetGx, fy(38 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);

                // Right Quad-Segment (Windows Logo Right Eye)
                ctx.fillRect(fx(57) + eyeOffsetGx, fy(33 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);
                ctx.fillRect(fx(65) + eyeOffsetGx, fy(33 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);
                ctx.fillRect(fx(57) + eyeOffsetGx, fy(38 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);
                ctx.fillRect(fx(65) + eyeOffsetGx, fy(38 + shockOffsetY) + eyeOffsetGy, 6.5 * s, 3.5 * s * currentAperture);
            } else {
                // Sleep Slits — soft glow via wide + thin stroke (no shadowBlur)
                const slitColor = isRunning ? mainCyan : "#8B5CF6";
                const slitGlowAlpha = 0.35 * isAwake + 0.15 * sleepProgress;

                // Wide soft outer stroke
                ctx.strokeStyle = slitColor.startsWith('#')
                    ? `rgba(${parseInt(slitColor.slice(1,3),16)}, ${parseInt(slitColor.slice(3,5),16)}, ${parseInt(slitColor.slice(5,7),16)}, ${slitGlowAlpha})`
                    : slitColor;
                ctx.lineWidth = (4.5 * sleepProgress + 2.5 * isAwake) * s;
                ctx.beginPath();
                ctx.moveTo(fx(28) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.lineTo(fx(43) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.moveTo(fx(57) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.lineTo(fx(72) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.stroke();

                // Thin bright core stroke
                ctx.strokeStyle = slitColor;
                ctx.lineWidth = (1.4 * sleepProgress + 0.9 * isAwake) * s;
                ctx.beginPath();
                ctx.moveTo(fx(28) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.lineTo(fx(43) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.moveTo(fx(57) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.lineTo(fx(72) + eyeOffsetGx, fy(37 + shockOffsetY) + eyeOffsetGy);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    return WindowsSentinelVisorRenderer;
}));
