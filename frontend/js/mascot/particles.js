/**
 * Windows Sentinel - Particle & EMP Electric Arc System
 * GPU Optimization: Eliminated shadowBlur — replaced with layered alpha draws.
 */
(function (root, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else {
        root.WindowsSentinelParticles = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {

    class WindowsSentinelParticles {
        constructor() {
            this.shockParticles = [];
            this.electricArcs = [];
        }

        triggerMicroSparks(count = 4) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 15 + Math.random() * 25;
                this.shockParticles.push({
                    x: 50 + (Math.random() - 0.5) * 24,
                    y: 54 + (Math.random() - 0.5) * 24,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.5 + Math.random() * 0.3,
                    size: 1.2 + Math.random() * 1.5,
                    // Store as RGB components to avoid repeated parsing
                    r: Math.random() > 0.5 ? 56 : 37,
                    g: Math.random() > 0.5 ? 189 : 99,
                    b: Math.random() > 0.5 ? 248 : 235,
                });
            }
        }

        triggerShock(centerX = 50, centerY = 56) {
            this.shockParticles = [];
            for (let i = 0; i < 22; i++) {
                const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                const speed = 35 + Math.random() * 55;
                const isCyan = i % 2 === 0;
                this.shockParticles.push({
                    x: centerX, y: centerY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    size: 1.8 + Math.random() * 2.6,
                    r: isCyan ? 56  : 37,
                    g: isCyan ? 189 : 99,
                    b: isCyan ? 248 : 235,
                });
            }

            this.electricArcs = [];
            for (let k = 0; k < 3; k++) {
                this.electricArcs.push({ fromX: 20, fromY: 6, toX: centerX, toY: centerY + 2, life: 0.45, r: 56,  g: 189, b: 248 });
                this.electricArcs.push({ fromX: 80, fromY: 6, toX: centerX, toY: centerY + 2, life: 0.45, r: 37,  g: 99,  b: 235 });
            }
        }

        update(dt) {
            for (let i = this.shockParticles.length - 1; i >= 0; i--) {
                const p = this.shockParticles[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= 1.8 * dt;
                if (p.life <= 0) this.shockParticles.splice(i, 1);
            }

            for (let i = this.electricArcs.length - 1; i >= 0; i--) {
                this.electricArcs[i].life -= 3.0 * dt;
                if (this.electricArcs[i].life <= 0) this.electricArcs.splice(i, 1);
            }
        }

        draw(ctx, fx, fy, s, shockOffsetY) {
            // Electric Arcs — double stroke instead of shadowBlur
            if (this.electricArcs.length > 0) {
                ctx.save();
                for (const arc of this.electricArcs) {
                    const a = Math.max(0, arc.life);
                    const midX = (arc.fromX + arc.toX) / 2 + (Math.random() - 0.5) * 8;
                    const midY = (arc.fromY + arc.toY) / 2 + (Math.random() - 0.5) * 8;

                    // Outer soft glow stroke
                    ctx.strokeStyle = `rgba(${arc.r}, ${arc.g}, ${arc.b}, ${a * 0.35})`;
                    ctx.lineWidth = 4.5 * s;
                    ctx.globalAlpha = 1.0;
                    ctx.beginPath();
                    ctx.moveTo(fx(arc.fromX), fy(arc.fromY + shockOffsetY));
                    ctx.lineTo(fx(midX), fy(midY + shockOffsetY));
                    ctx.lineTo(fx(arc.toX), fy(arc.toY + shockOffsetY));
                    ctx.stroke();

                    // Bright core stroke
                    ctx.strokeStyle = `rgba(${arc.r}, ${arc.g}, ${arc.b}, ${a * 0.90})`;
                    ctx.lineWidth = 1.4 * s;
                    ctx.beginPath();
                    ctx.moveTo(fx(arc.fromX), fy(arc.fromY + shockOffsetY));
                    ctx.lineTo(fx(midX), fy(midY + shockOffsetY));
                    ctx.lineTo(fx(arc.toX), fy(arc.toY + shockOffsetY));
                    ctx.stroke();
                }
                ctx.restore();
            }

            // Shock Particles — layered circles instead of shadowBlur
            if (this.shockParticles.length > 0) {
                ctx.save();
                ctx.globalAlpha = 1.0;
                for (const p of this.shockParticles) {
                    const a = Math.max(0, p.life);
                    const r = p.size * s;

                    // Outer glow disc
                    ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${a * 0.30})`;
                    ctx.beginPath();
                    ctx.arc(fx(p.x), fy(p.y), r * 2.2, 0, Math.PI * 2);
                    ctx.fill();

                    // Core bright disc
                    ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${a * 0.90})`;
                    ctx.beginPath();
                    ctx.arc(fx(p.x), fy(p.y), r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }
    }

    return WindowsSentinelParticles;
}));
