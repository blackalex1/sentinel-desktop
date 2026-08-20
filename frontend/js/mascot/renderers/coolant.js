/**
 * Windows Sentinel - Liquid Cooling Conduits (СВО) & Radiator Fins Renderer
 * GPU Optimization: Eliminated shadowBlur — replaced with layered alpha strokes/fills.
 */
(function (root, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else {
        root.WindowsSentinelCoolantRenderer = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {

    class WindowsSentinelCoolantRenderer {
        static draw(ctx, fx, fy, s, shockOffsetY, isRunning, isAwake, sleepProgress, cpu, netSpeed, now) {
            const coolantR = isRunning ? (cpu > 80 ? 239 : 56)  : 139;
            const coolantG = isRunning ? (cpu > 80 ?  68 : 189) :  92;
            const coolantB = isRunning ? (cpu > 80 ?  68 : 248) : 246;

            ctx.save();
            ctx.lineCap = "round";

            // 1. Armored Outer Conduit Casings (Titanium & Rubber sleeve)
            ctx.lineWidth = 4.2 * s;
            ctx.strokeStyle = "rgba(15, 23, 42, 0.95)";
            ctx.beginPath();
            ctx.moveTo(fx(20), fy(6 + shockOffsetY));
            ctx.bezierCurveTo(fx(10), fy(12 + shockOffsetY), fx(34), fy(22 + shockOffsetY), fx(44), fy(18 + shockOffsetY));
            ctx.moveTo(fx(80), fy(6 + shockOffsetY));
            ctx.bezierCurveTo(fx(90), fy(12 + shockOffsetY), fx(66), fy(22 + shockOffsetY), fx(56), fy(18 + shockOffsetY));
            ctx.stroke();

            // 2. Flowing Neon Coolant Core — layered strokes instead of shadowBlur
            // Outer soft glow stroke
            const glowAlpha = 0.28 * isAwake + 0.08 * sleepProgress;
            ctx.lineWidth = 4.0 * s;
            ctx.strokeStyle = `rgba(${coolantR}, ${coolantG}, ${coolantB}, ${glowAlpha})`;
            ctx.stroke();
            // Mid stroke
            ctx.lineWidth = 2.4 * s;
            ctx.strokeStyle = `rgba(${coolantR}, ${coolantG}, ${coolantB}, ${0.55 * isAwake + 0.15 * sleepProgress})`;
            ctx.stroke();
            // Bright core
            ctx.lineWidth = 1.2 * s;
            ctx.strokeStyle = `rgba(${coolantR}, ${coolantG}, ${coolantB}, ${0.90 * isAwake + 0.25 * sleepProgress})`;
            ctx.stroke();

            // 3. Mecha Crown Intake Horns with Radiator Fin Tips
            ctx.fillStyle = "#1e293b";
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 * isAwake + 0.2 * sleepProgress})`;
            ctx.lineWidth = 1.2 * s;
            ctx.beginPath();
            ctx.moveTo(fx(24), fy(24 + shockOffsetY));
            ctx.lineTo(fx(20), fy(6 + shockOffsetY));
            ctx.lineTo(fx(32), fy(14 + shockOffsetY));
            ctx.closePath();
            ctx.moveTo(fx(76), fy(24 + shockOffsetY));
            ctx.lineTo(fx(80), fy(6 + shockOffsetY));
            ctx.lineTo(fx(68), fy(14 + shockOffsetY));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 4. Crown Radiator Fin Tips — layered fills instead of shadowBlur
            // Outer glow blob
            const beaconIntensity = isAwake * (0.6 + Math.min((netSpeed || 0) / (1024 * 600), 0.4)) + sleepProgress * 0.25;
            const beaconGlowAlpha = beaconIntensity * 0.40;
            if (beaconGlowAlpha > 0.01) {
                ctx.fillStyle = `rgba(${coolantR}, ${coolantG}, ${coolantB}, ${beaconGlowAlpha})`;
                ctx.beginPath();
                ctx.arc(fx(20), fy(6 + shockOffsetY), 5.0 * s, 0, Math.PI * 2);
                ctx.arc(fx(80), fy(6 + shockOffsetY), 5.0 * s, 0, Math.PI * 2);
                ctx.fill();
            }
            // Mid glow
            const beaconMidAlpha = beaconIntensity * 0.65;
            ctx.fillStyle = `rgba(${coolantR}, ${coolantG}, ${coolantB}, ${beaconMidAlpha})`;
            ctx.beginPath();
            ctx.arc(fx(20), fy(6 + shockOffsetY), 3.2 * s, 0, Math.PI * 2);
            ctx.arc(fx(80), fy(6 + shockOffsetY), 3.2 * s, 0, Math.PI * 2);
            ctx.fill();
            // Core dot
            ctx.fillStyle = `rgba(${coolantR}, ${coolantG}, ${coolantB}, ${Math.min(1.0, beaconIntensity * 0.95)})`;
            ctx.beginPath();
            ctx.arc(fx(20), fy(6 + shockOffsetY), 2.0 * s, 0, Math.PI * 2);
            ctx.arc(fx(80), fy(6 + shockOffsetY), 2.0 * s, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    return WindowsSentinelCoolantRenderer;
}));
