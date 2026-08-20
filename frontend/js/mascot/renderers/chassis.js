/**
 * Windows Sentinel - Titanium PC Mecha Chassis & Radiator Renderer
 * GPU Optimization: Eliminated shadowBlur — replaced with layered alpha strokes/fills.
 */
(function (root, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else {
        root.WindowsSentinelChassisRenderer = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {

    class WindowsSentinelChassisRenderer {
        static draw(ctx, fx, fy, s, shockOffsetY, isRunning, isAwake, sleepProgress, netSpeed, frostBlue, armorBorderColor, now) {
            // 1. Radial Ambient Halo
            ctx.save();
            const haloAlpha = (0.22 * isAwake + 0.06 * sleepProgress);
            const halo = ctx.createRadialGradient(fx(50), fy(52 + shockOffsetY), 8 * s, fx(50), fy(52 + shockOffsetY), 48 * s);
            halo.addColorStop(0, `rgba(56, 189, 248, ${haloAlpha})`);
            halo.addColorStop(0.6, `rgba(37, 99, 235, ${0.08 * isAwake + 0.02 * sleepProgress})`);
            halo.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(fx(50), fy(52 + shockOffsetY), 48 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 2. Mecha Angular Armor Silhouette
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(fx(50), fy(12 + shockOffsetY));
            ctx.lineTo(fx(74), fy(16 + shockOffsetY));
            ctx.lineTo(fx(88), fy(34 + shockOffsetY));
            ctx.lineTo(fx(80), fy(68 + shockOffsetY));
            ctx.lineTo(fx(50), fy(94 + shockOffsetY));
            ctx.lineTo(fx(20), fy(68 + shockOffsetY));
            ctx.lineTo(fx(12), fy(34 + shockOffsetY));
            ctx.lineTo(fx(26), fy(16 + shockOffsetY));
            ctx.closePath();

            const mechaGrad = ctx.createLinearGradient(fx(50), fy(12), fx(50), fy(94));
            mechaGrad.addColorStop(0, "#111827");
            mechaGrad.addColorStop(0.5, "#081426");
            mechaGrad.addColorStop(1, "#030814");
            ctx.fillStyle = mechaGrad;
            ctx.fill();

            // Armor Contour Stroke — layered glow instead of shadowBlur
            // Layer 1: wide soft outer glow
            const glowAlpha = 0.28 * isAwake + 0.10 * sleepProgress;
            ctx.strokeStyle = armorBorderColor.replace("rgb(", "rgba(").replace(")", `, ${glowAlpha})`);
            ctx.lineWidth = 6.5 * s;
            ctx.stroke();
            // Layer 2: mid crisp stroke
            ctx.strokeStyle = armorBorderColor.replace("rgb(", "rgba(").replace(")", `, ${0.55 * isAwake + 0.20 * sleepProgress})`);
            ctx.lineWidth = 3.5 * s;
            ctx.stroke();
            // Layer 3: sharp bright core
            ctx.strokeStyle = armorBorderColor;
            ctx.lineWidth = 1.4 * s;
            ctx.stroke();

            // Mecha Cheek Cowlings (Cobalt & Ice Blue)
            ctx.fillStyle = `rgba(37, 99, 235, ${0.45 * isAwake + 0.15 * sleepProgress})`;
            ctx.beginPath();
            ctx.moveTo(fx(12), fy(34 + shockOffsetY));
            ctx.lineTo(fx(32), fy(48 + shockOffsetY));
            ctx.lineTo(fx(30), fy(76 + shockOffsetY));
            ctx.lineTo(fx(20), fy(68 + shockOffsetY));
            ctx.closePath();
            ctx.moveTo(fx(88), fy(34 + shockOffsetY));
            ctx.lineTo(fx(68), fy(48 + shockOffsetY));
            ctx.lineTo(fx(70), fy(76 + shockOffsetY));
            ctx.lineTo(fx(80), fy(68 + shockOffsetY));
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // 3. Cheek Telemetry Glyphs (3 Slanted Chevrons) — layered fills instead of shadowBlur
            const kbps = (netSpeed || 0) / 1024;
            const level = isRunning ? (kbps > 2000 ? 3 : (kbps > 400 ? 2 : (kbps > 50 ? 1 : 0))) : 0;

            ctx.save();
            for (let i = 0; i < 3; i++) {
                const isActive = i < level && isAwake > 0.3;
                const glyphAlpha = (isActive ? 0.95 : 0.15) * isAwake + 0.05 * sleepProgress;

                // Outer soft glow layer (replaces shadowBlur)
                if (isActive && isAwake > 0.2) {
                    ctx.fillStyle = `rgba(56, 189, 248, ${0.30 * isAwake})`;
                    ctx.beginPath();
                    ctx.moveTo(fx(18.5 + i * 1.5), fy(34.3 + i * 5.2 + shockOffsetY));
                    ctx.lineTo(fx(24.2 + i * 1.5), fy(34.3 + i * 5.2 + shockOffsetY));
                    ctx.lineTo(fx(22.7 + i * 1.5), fy(37.8 + i * 5.2 + shockOffsetY));
                    ctx.lineTo(fx(17.0 + i * 1.5), fy(37.8 + i * 5.2 + shockOffsetY));
                    ctx.closePath();
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(fx(81.5 - i * 1.5), fy(34.3 + i * 5.2 + shockOffsetY));
                    ctx.lineTo(fx(76.0 - i * 1.5), fy(34.3 + i * 5.2 + shockOffsetY));
                    ctx.lineTo(fx(77.5 - i * 1.5), fy(37.8 + i * 5.2 + shockOffsetY));
                    ctx.lineTo(fx(83.2 - i * 1.5), fy(37.8 + i * 5.2 + shockOffsetY));
                    ctx.closePath();
                    ctx.fill();
                }

                // Core fill
                ctx.fillStyle = isActive ? `rgba(56, 189, 248, ${glyphAlpha})` : `rgba(255, 255, 255, ${glyphAlpha})`;
                ctx.beginPath();
                ctx.moveTo(fx(19 + i * 1.5), fy(35 + i * 5.2 + shockOffsetY));
                ctx.lineTo(fx(23.5 + i * 1.5), fy(35 + i * 5.2 + shockOffsetY));
                ctx.lineTo(fx(22 + i * 1.5), fy(37.2 + i * 5.2 + shockOffsetY));
                ctx.lineTo(fx(17.5 + i * 1.5), fy(37.2 + i * 5.2 + shockOffsetY));
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(fx(81 - i * 1.5), fy(35 + i * 5.2 + shockOffsetY));
                ctx.lineTo(fx(76.5 - i * 1.5), fy(35 + i * 5.2 + shockOffsetY));
                ctx.lineTo(fx(78 - i * 1.5), fy(37.2 + i * 5.2 + shockOffsetY));
                ctx.lineTo(fx(82.5 - i * 1.5), fy(37.2 + i * 5.2 + shockOffsetY));
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            // 4. Armor Seam Lines & Hex Bolts
            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 0.9 * s;
            ctx.beginPath();
            ctx.moveTo(fx(32), fy(22 + shockOffsetY));
            ctx.lineTo(fx(50), fy(25 + shockOffsetY));
            ctx.lineTo(fx(68), fy(22 + shockOffsetY));
            ctx.stroke();

            const drawHexBolt = (bx, by) => {
                ctx.save();
                ctx.fillStyle = "#334155";
                ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                ctx.lineWidth = 0.6 * s;
                ctx.beginPath();
                ctx.arc(fx(bx), fy(by + shockOffsetY), 1.1 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            };
            drawHexBolt(24, 24);
            drawHexBolt(76, 24);
            drawHexBolt(22, 49);
            drawHexBolt(78, 49);
            drawHexBolt(50, 90);
            ctx.restore();
        }
    }

    return WindowsSentinelChassisRenderer;
}));
