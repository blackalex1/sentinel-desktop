/**
 * Windows Sentinel - Overclock Quantum Diamond Arc Reactor Renderer
 * GPU Optimization: Eliminated shadowBlur — replaced with layered alpha fills.
 */
(function (root, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else {
        root.WindowsSentinelReactorRenderer = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {

    class WindowsSentinelReactorRenderer {
        static draw(ctx, fx, fy, s, shockOffsetY, isRunning, cpu, cobaltBlue, isAwake, sleepProgress, wakeFlash, now) {
            const breathFreq = 0.0018 * isAwake + 0.0008 * sleepProgress;
            const glowIntensity = (Math.sin(now * breathFreq) * 0.5 + 0.5);

            // Pick reactor colors
            const coreR = isRunning ? (cpu > 80 ? 239 : 56)  : 139;
            const coreG = isRunning ? (cpu > 80 ?  68 : 189) :  92;
            const coreB = isRunning ? (cpu > 80 ?  68 : 248) : 246;

            ctx.save();
            // 1. Titanium Magnetic Clamps
            ctx.fillStyle = "#1e293b";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = 0.8 * s;
            ctx.beginPath();
            ctx.rect(fx(46), fy(41 + shockOffsetY), 8 * s, 3.5 * s);
            ctx.rect(fx(46), fy(80 + shockOffsetY), 8 * s, 3.5 * s);
            ctx.fill();
            ctx.stroke();

            // 2. Outer Diamond Glow layer (replaces shadowBlur)
            const outerGlowAlpha = (0.20 + glowIntensity * 0.15) * isAwake + wakeFlash * 0.35;
            if (outerGlowAlpha > 0.01) {
                ctx.fillStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${outerGlowAlpha})`;
                ctx.beginPath();
                ctx.moveTo(fx(50), fy(40 + shockOffsetY));
                ctx.lineTo(fx(68), fy(58 + shockOffsetY));
                ctx.lineTo(fx(50), fy(84 + shockOffsetY));
                ctx.lineTo(fx(32), fy(58 + shockOffsetY));
                ctx.closePath();
                ctx.fill();
            }

            // 2. Solid Outer Diamond (Razor-Sharp, No Warping)
            ctx.fillStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${0.85 + glowIntensity * 0.15})`;
            ctx.beginPath();
            ctx.moveTo(fx(50), fy(44 + shockOffsetY));
            ctx.lineTo(fx(64), fy(58 + shockOffsetY));
            ctx.lineTo(fx(50), fy(80 + shockOffsetY));
            ctx.lineTo(fx(36), fy(58 + shockOffsetY));
            ctx.closePath();
            ctx.fill();

            // 3. Inner Overclock Spark glow layer
            const sparkR = isRunning ? 245 : 167;
            const sparkG = isRunning ? 158 :  91;
            const sparkB = isRunning ?  11 : 250;
            const sparkGlowAlpha = (0.20 + glowIntensity * 0.20) * isAwake;
            if (sparkGlowAlpha > 0.01) {
                ctx.fillStyle = `rgba(${sparkR}, ${sparkG}, ${sparkB}, ${sparkGlowAlpha})`;
                ctx.beginPath();
                ctx.moveTo(fx(50), fy(47 + shockOffsetY));
                ctx.lineTo(fx(61), fy(58 + shockOffsetY));
                ctx.lineTo(fx(50), fy(76 + shockOffsetY));
                ctx.lineTo(fx(39), fy(58 + shockOffsetY));
                ctx.closePath();
                ctx.fill();
            }

            // 3. Inner Overclock Spark core
            ctx.fillStyle = `rgba(${sparkR}, ${sparkG}, ${sparkB}, ${0.90 + glowIntensity * 0.10})`;
            ctx.beginPath();
            ctx.moveTo(fx(50), fy(50 + shockOffsetY));
            ctx.lineTo(fx(58), fy(58 + shockOffsetY));
            ctx.lineTo(fx(50), fy(73 + shockOffsetY));
            ctx.lineTo(fx(42), fy(58 + shockOffsetY));
            ctx.closePath();
            ctx.fill();

            // 4. White Singularity Heart — glow layer
            const heartBaseAlpha = 0.75 + glowIntensity * 0.25 * isAwake + wakeFlash * 0.8;
            const heartAlpha = Math.min(1.0, heartBaseAlpha);
            const heartGlowAlpha = (0.25 + glowIntensity * 0.20) * isAwake + wakeFlash * 0.40;
            if (heartGlowAlpha > 0.01) {
                ctx.fillStyle = `rgba(255, 255, 255, ${heartGlowAlpha})`;
                ctx.beginPath();
                ctx.moveTo(fx(50), fy(51 + shockOffsetY));
                ctx.lineTo(fx(57), fy(58 + shockOffsetY));
                ctx.lineTo(fx(50), fy(67 + shockOffsetY));
                ctx.lineTo(fx(43), fy(58 + shockOffsetY));
                ctx.closePath();
                ctx.fill();
            }

            // 4. White Singularity Heart core
            ctx.fillStyle = `rgba(255, 255, 255, ${heartAlpha})`;
            ctx.beginPath();
            ctx.moveTo(fx(50), fy(54 + shockOffsetY));
            ctx.lineTo(fx(54), fy(58 + shockOffsetY));
            ctx.lineTo(fx(50), fy(64 + shockOffsetY));
            ctx.lineTo(fx(46), fy(58 + shockOffsetY));
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    return WindowsSentinelReactorRenderer;
}));
