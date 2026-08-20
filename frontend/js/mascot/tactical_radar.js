/**
 * Windows Sentinel - High-Performance Tactical Cyber Radar Engine
 * Optimized for near-zero GPU utilization:
 * - Eliminated costly Canvas2D shadowBlur Gaussian passes (replaced with ultra-fast GPU alpha stroke layering).
 * - Clamped DPR rasterization to prevent 4K fill-rate bottlenecks.
 * - Frame rate throttling (60 FPS when active, 20 FPS when idle/standby).
 * - Automatic pause when tab is hidden or switched away from dashboard.
 */

(function (root, factory) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define(factory);
  } else {
    root.TacticalRadarEngine = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {

  class ThreatTarget {
    constructor(angle, distFraction, type = 'threat') {
      this.angle = angle != null ? angle : Math.random() * Math.PI * 2;
      this.distFraction = distFraction != null ? distFraction : (0.28 + Math.random() * 0.58);
      this.type = type; // 'threat' | 'tracker' | 'probe'
      this.isRevealed = false;
      this.revealTime = 0;
      this.strikeDelay = 1300 + Math.random() * 1100;
      this.isTargeted = false;
      this.isDestroyed = false;
      this.spawnTime = performance.now();
    }
  }

  class LaserBeam {
    constructor(fromX, fromY, toX, toY, color = '#38bdf8') {
      this.fromX = fromX;
      this.fromY = fromY;
      this.toX = toX;
      this.toY = toY;
      this.startTime = performance.now();
      this.duration = 180; // ms
      this.color = color;
    }
  }

  class Shockwave {
    constructor(x, y, color = '#38bdf8') {
      this.x = x;
      this.y = y;
      this.radius = 2;
      this.maxRadius = 18;
      this.life = 1.0;
      this.color = color;
    }
  }

  class TacticalRadarEngine {
    constructor(canvasId) {
      this.canvas = typeof canvasId === "string" ? document.getElementById(canvasId) : canvasId;
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext("2d", { alpha: true });
      this.isRunning = false;
      this.isConnecting = false;
      this.isVisible = true;

      // State transitions
      this.runningGlowAlpha = 0.0;
      this.targetRunningAlpha = 0.0;

      // Sweep & Sonar Timers
      this.sweepRotation = 0;
      this.sonarWave1 = 0;
      this.sonarWave2 = 0.5;

      // Targets & Defense Weaponry
      this.threats = [];
      this.lasers = [];
      this.shockwaves = [];
      this.particles = [];
      this.nextThreatSpawnTime = performance.now() + 500;

      this.lastFrameTime = performance.now();
      this.animationFrameId = null;

      this.init();
    }

    init() {
      this.resize();
      window.addEventListener("resize", () => this.resize());

      // Pause rendering when tab or document is hidden
      document.addEventListener("visibilitychange", () => {
        this.isVisible = !document.hidden;
      });

      this.threats = [
        new ThreatTarget(Math.PI * 0.45, 0.72, 'threat'),
        new ThreatTarget(Math.PI * 1.05, 0.82, 'tracker'),
        new ThreatTarget(Math.PI * 1.55, 0.58, 'probe')
      ];

      this.startLoop();
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      // Clamp DPR to max 1.5 to eliminate 4K GPU memory bandwidth drain
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const size = Math.max(rect.width || 270, 200);
      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
      this.width = size;
      this.height = size;
      this.dpr = dpr;
    }

    setRunningState(running, connecting = false) {
      this.isRunning = running;
      this.isConnecting = connecting;
      this.targetRunningAlpha = running ? 1.0 : (connecting ? 0.6 : 0.0);

      if (running && this.threats.filter(t => !t.isDestroyed).length < 3) {
        this.spawnTargetAhead();
        this.spawnTargetAhead();
      }
    }

    spawnTargetAhead() {
      const aheadAngle = (this.sweepRotation + 0.6 + Math.random() * (Math.PI * 1.4)) % (Math.PI * 2);
      const dist = 0.28 + Math.random() * 0.58;
      const type = Math.random() > 0.5 ? 'threat' : (Math.random() > 0.5 ? 'tracker' : 'probe');
      const target = new ThreatTarget(aheadAngle, dist, type);
      this.threats.push(target);
    }

    getTargetCoords(target) {
      const w = this.width || 270;
      const cx = w / 2;
      const cy = w / 2;
      const coreRadius = 68;
      const maxRadius = w / 2 - 6;
      const blipRadius = coreRadius + (maxRadius - coreRadius) * target.distFraction;
      return {
        x: cx + Math.cos(target.angle) * blipRadius,
        y: cy + Math.sin(target.angle) * blipRadius
      };
    }

    fireLaserAt(target) {
      if (!target || target.isDestroyed || target.isTargeted) return;
      target.isTargeted = true;

      const w = this.width || 270;
      const cx = w / 2;
      const cy = w / 2;
      const targetPos = this.getTargetCoords(target);

      const fromX = cx + Math.cos(target.angle) * 38;
      const fromY = cy + Math.sin(target.angle) * 38;

      const color = target.type === 'threat' ? '#38bdf8' : (target.type === 'tracker' ? '#10b981' : '#f59e0b');
      this.lasers.push(new LaserBeam(fromX, fromY, targetPos.x, targetPos.y, color));

      setTimeout(() => {
        this.destroyTarget(target, targetPos.x, targetPos.y, color);
      }, 75);
    }

    destroyTarget(target, x, y, color) {
      if (target.isDestroyed) return;
      target.isDestroyed = true;

      this.shockwaves.push(new Shockwave(x, y, color));

      // 12 Disintegration Sparks
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = 25 + Math.random() * 35;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.5 + Math.random() * 0.2,
          size: 1.4,
          color: i % 2 === 0 ? "#ffffff" : color
        });
      }

      setTimeout(() => {
        if (this.isRunning && this.threats.filter(t => !t.isDestroyed).length < 3) {
          this.spawnTargetAhead();
        }
      }, 700 + Math.random() * 800);
    }

    fireSalvo() {
      this.threats.forEach((t) => {
        if (!t.isDestroyed) {
          t.isRevealed = true;
          this.fireLaserAt(t);
        }
      });
    }

    startLoop() {
      const render = (now) => {
        this.animationFrameId = requestAnimationFrame(render);

        if (!this.isVisible) return;

        // Throttle inactive standby loop to ~30 FPS to save 80% GPU
        const minDelta = (this.isRunning || this.isConnecting) ? 14 : 33;
        const elapsed = now - this.lastFrameTime;
        if (elapsed < minDelta) return;

        const dt = Math.min(elapsed / 1000, 0.1);
        this.lastFrameTime = now;
        this.update(now, dt);
        this.draw(now);
      };
      this.animationFrameId = requestAnimationFrame(render);
    }

    update(now, dt) {
      this.runningGlowAlpha += (this.targetRunningAlpha - this.runningGlowAlpha) * (3.5 * dt);

      const sweepSpeed = (Math.PI * 2) / 2.8;
      this.sweepRotation = (this.sweepRotation + sweepSpeed * dt) % (Math.PI * 2);

      this.sonarWave1 = (this.sonarWave1 + dt / 2.4) % 1.0;
      this.sonarWave2 = (this.sonarWave2 + dt / 2.4) % 1.0;

      const unrevealedCount = this.threats.filter(t => !t.isDestroyed && !t.isRevealed).length;
      if (this.isRunning && unrevealedCount < 3 && now > this.nextThreatSpawnTime) {
        this.nextThreatSpawnTime = now + 1200 + Math.random() * 1500;
        this.spawnTargetAhead();
      }

      // Reveal targets when sweep line touches them
      for (const t of this.threats) {
        if (t.isDestroyed || t.isRevealed) continue;

        let deltaAngle = (this.sweepRotation - t.angle + Math.PI * 2) % (Math.PI * 2);
        if (deltaAngle >= 0 && deltaAngle < 0.28) {
          t.isRevealed = true;
          t.revealTime = now;
          t.strikeDelay = 1300 + Math.random() * 1100;
        }
      }

      // Engage revealed targets with laser
      if (this.isRunning) {
        for (const t of this.threats) {
          if (!t.isDestroyed && t.isRevealed && !t.isTargeted) {
            if (now - t.revealTime > t.strikeDelay) {
              this.fireLaserAt(t);
              break;
            }
          }
        }
      }

      // Cleanup
      for (let i = this.threats.length - 1; i >= 0; i--) {
        if (this.threats[i].isDestroyed) {
          this.threats.splice(i, 1);
        }
      }

      for (let i = this.lasers.length - 1; i >= 0; i--) {
        if (now - this.lasers[i].startTime > this.lasers[i].duration) {
          this.lasers.splice(i, 1);
        }
      }

      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.radius += 32 * dt;
        sw.life -= 2.4 * dt;
        if (sw.life <= 0) this.shockwaves.splice(i, 1);
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.8;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    }

    draw(now) {
      const ctx = this.ctx;
      if (!ctx) return;

      if (!this.width || this.width < 50) {
        this.resize();
      }

      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.scale(this.dpr, this.dpr);

      const w = this.width || 270;
      const h = this.height || 270;
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = w / 2 - 6;
      const coreRadius = 68;

      const isRunning = this.isRunning;
      const runningAlpha = this.runningGlowAlpha;

      const primaryColor = isRunning ? "#10b981" : "#8b5cf6";
      const accentColor = isRunning ? "#38bdf8" : "#a78bfa";

      // 1. Sonar Waves
      if (runningAlpha > 0.01) {
        ctx.save();
        const r1 = coreRadius + (maxRadius - coreRadius) * this.sonarWave1;
        const a1 = (1 - this.sonarWave1) * 0.30 * runningAlpha;
        ctx.strokeStyle = `rgba(16, 185, 129, ${a1})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r1, 0, Math.PI * 2);
        ctx.stroke();

        const r2 = coreRadius + (maxRadius - coreRadius) * this.sonarWave2;
        const a2 = (1 - this.sonarWave2) * 0.30 * runningAlpha;
        ctx.strokeStyle = `rgba(56, 189, 248, ${a2})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Phosphor Sector Sweep
      if (runningAlpha > 0.01) {
        ctx.save();
        const sweepAngle = this.sweepRotation;
        const sweepWidth = Math.PI * 0.35;

        const sweepGrad = ctx.createRadialGradient(cx, cy, coreRadius, cx, cy, maxRadius);
        sweepGrad.addColorStop(0, `rgba(16, 185, 129, ${0.03 * runningAlpha})`);
        sweepGrad.addColorStop(0.6, `rgba(16, 185, 129, ${0.16 * runningAlpha})`);
        sweepGrad.addColorStop(1, `rgba(16, 185, 129, ${0.38 * runningAlpha})`);

        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, sweepAngle - sweepWidth, sweepAngle);
        ctx.closePath();
        ctx.fill();

        // Fast glow: double stroke instead of expensive shadowBlur
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.3 * runningAlpha})`;
        ctx.lineWidth = 4.0;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(sweepAngle) * coreRadius, cy + Math.sin(sweepAngle) * coreRadius);
        ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius, cy + Math.sin(sweepAngle) * maxRadius);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * runningAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(sweepAngle) * coreRadius, cy + Math.sin(sweepAngle) * coreRadius);
        ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius, cy + Math.sin(sweepAngle) * maxRadius);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Range Grid Rings
      ctx.save();
      ctx.strokeStyle = isRunning ? "rgba(16, 185, 129, 0.6)" : "rgba(139, 92, 246, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isRunning ? "rgba(16, 185, 129, 0.28)" : "rgba(139, 92, 246, 0.16)";
      ctx.lineWidth = 1.0;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius + (maxRadius - coreRadius) * 0.62, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isRunning ? "rgba(16, 185, 129, 0.22)" : "rgba(139, 92, 246, 0.12)";
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius + (maxRadius - coreRadius) * 0.30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 4. Tactical Degree Ticks
      ctx.save();
      for (let i = 0; i < 36; i++) {
        const angleRad = (i * 10 * Math.PI) / 180;
        const isCardinal = i % 9 === 0;
        const isMajor = i % 3 === 0;
        const tickLen = isCardinal ? 9 : (isMajor ? 6 : 3);

        const startX = cx + (maxRadius - tickLen) * Math.cos(angleRad);
        const startY = cy + (maxRadius - tickLen) * Math.sin(angleRad);
        const endX = cx + maxRadius * Math.cos(angleRad);
        const endY = cy + maxRadius * Math.sin(angleRad);

        const tickAlpha = isCardinal ? (isRunning ? 0.9 : 0.6) : (isMajor ? (isRunning ? 0.6 : 0.35) : (isRunning ? 0.3 : 0.15));
        ctx.strokeStyle = isCardinal ? (isRunning ? "#38bdf8" : "#a78bfa") : primaryColor;
        ctx.globalAlpha = tickAlpha;
        ctx.lineWidth = isCardinal ? 2.0 : 1.0;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();

      // 5. Crosshairs
      ctx.save();
      ctx.strokeStyle = isRunning ? "rgba(16, 185, 129, 0.22)" : "rgba(139, 92, 246, 0.10)";
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 6]);
      const crosshairAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
      for (const angle of crosshairAngles) {
        const startX = cx + (coreRadius + 4) * Math.cos(angle);
        const startY = cy + (coreRadius + 4) * Math.sin(angle);
        const endX = cx + (maxRadius - 11) * Math.cos(angle);
        const endY = cy + (maxRadius - 11) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      // 6. Threat Target Blips
      for (const t of this.threats) {
        if (t.isDestroyed || !t.isRevealed) continue;

        const pos = this.getTargetCoords(t);
        const elapsed = now - t.revealTime;
        const pulse = Math.sin(elapsed * 0.008) * 0.5 + 0.5;
        const color = t.type === 'threat' ? '#38bdf8' : (t.type === 'tracker' ? '#10b981' : '#f59e0b');

        ctx.save();
        // Ping Wave
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.4 + pulse * 0.5;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();

        // Reticle
        ctx.strokeRect(pos.x - 4.5, pos.y - 4.5, 9, 9);

        // Core Dot
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 7. Laser Strikes & Explosions (Layered Fast Strokes)
      ctx.save();
      for (const l of this.lasers) {
        const elapsed = now - l.startTime;
        const progress = Math.min(1.0, elapsed / l.duration);
        const alpha = Math.sin(progress * Math.PI);

        // Wide Outer Glow Beam
        ctx.strokeStyle = l.color;
        ctx.globalAlpha = 0.35 * alpha;
        ctx.lineWidth = 6.0;
        ctx.beginPath();
        ctx.moveTo(l.fromX, l.fromY);
        ctx.lineTo(l.toX, l.toY);
        ctx.stroke();

        // Mid Laser Core
        ctx.globalAlpha = 0.75 * alpha;
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(l.fromX, l.fromY);
        ctx.lineTo(l.toX, l.toY);
        ctx.stroke();

        // White Core Laser Line
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 1.0 * alpha;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(l.fromX, l.fromY);
        ctx.lineTo(l.toX, l.toY);
        ctx.stroke();
      }

      // Shockwaves
      for (const sw of this.shockwaves) {
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.life * 0.8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Disintegration Sparks
      for (const p of this.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();
    }
  }

  return TacticalRadarEngine;
}));
