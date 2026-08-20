/**
 * Windows Sentinel - High-Performance PC Mecha Guardian Mascot Engine
 * Optimized for near-zero GPU utilization:
 * - Eliminated costly Canvas2D shadowBlur Gaussian passes (replaced with layered alpha glows).
 * - Clamped DPR to 1.5 max to avoid high-res fill-rate lag.
 * - Throttles standby sleep frame rate to 20-30 FPS.
 * - Auto pauses rendering when tab / document is not visible.
 */

(function (root, factory) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define(factory);
  } else {
    root.WindowsSentinelMascot = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {

  class WindowsSentinelMascot {
    constructor(canvasId, containerId) {
      this.canvas = typeof canvasId === "string" ? document.getElementById(canvasId) : canvasId;
      this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext("2d", { alpha: true });
      this.isRunning = false;
      this.isConnecting = false;
      this.isShocking = false;
      this.shockTimer = 0;
      this.shockDuration = 650;
      this.isVisible = true;

      // Smooth state interpolation
      this.powerProgress = 0.0;
      this.targetPowerProgress = 0.0;
      this.wakeFlash = 0.0;
      this.hoverFactor = 0.0;

      // Sleep Dynamics (1.0 = fully asleep, 0.0 = fully awake)
      this.sleepProgress = 1.0;
      this.targetSleepProgress = 1.0;

      // Eye Dynamics & Blinking
      this.eyeOpenness = 0.0;
      this.eyeTargetOpenness = 0.0;
      this.nextBlinkTime = performance.now() + 3000 + Math.random() * 3000;

      // Interactive Gaze & Head Parallax
      this.gazeX = 0;
      this.gazeY = 0;
      this.targetGazeX = 0;
      this.targetGazeY = 0;
      this.isHovered = false;

      // Telemetry & Bandwidth
      this.cpu = 20;
      this.ramPercent = 35;
      this.netSpeed = 0;

      // Coolant fluid offset
      this.coolantOffset = 0;

      // Particles
      this.particles = [];
      this.electricArcs = [];

      this.lastFrameTime = performance.now();
      this.animationFrameId = null;

      // Color Theme
      this.currentColor = { r: 139, g: 92, b: 246 };
      this.targetColor = { r: 139, g: 92, b: 246 };

      this.init();
    }

    init() {
      this.resize();
      window.addEventListener("resize", () => this.resize());

      document.addEventListener("visibilitychange", () => {
        this.isVisible = !document.hidden;
      });

      window.addEventListener("mousemove", (e) => {
        if (!this.canvas) return;
        if (this.sleepProgress > 0.8 && !this.isHovered) {
          this.targetGazeX = 0;
          this.targetGazeY = 0;
          return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = (e.clientX - centerX) / (window.innerWidth / 2);
        const dy = (e.clientY - centerY) / (window.innerHeight / 2);

        this.targetGazeX = Math.max(-1, Math.min(1, dx * 1.4));
        this.targetGazeY = Math.max(-1, Math.min(1, dy * 1.4));
      });

      window.addEventListener("mouseleave", () => {
        this.targetGazeX = 0;
        this.targetGazeY = 0;
      });

      const trackTarget = this.container || this.canvas;
      if (trackTarget) {
        trackTarget.addEventListener("mouseenter", () => {
          this.isHovered = true;
          if (this.sleepProgress > 0.5) {
            this.eyeTargetOpenness = 0.4;
          }
          this.triggerMicroSparks(4);
        });
        trackTarget.addEventListener("mouseleave", () => {
          this.isHovered = false;
          if (this.sleepProgress > 0.5) {
            this.eyeTargetOpenness = 0.0;
          }
        });
        trackTarget.addEventListener("click", () => {
          this.triggerShock();
        });
      }

      this.startLoop();
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const size = Math.max(rect.width || 136, 100);
      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
      this.width = size;
      this.height = size;
      this.dpr = dpr;
      // Cache static gradients — recreate only on resize
      this._rebuildGradients();
    }

    _rebuildGradients() {
      const ctx = this.ctx;
      if (!ctx || !this.width) return;
      const w = this.width;
      const h = this.height;
      const s = Math.min(w, h) / 100;
      const cx = w / 2;
      const cy = h / 2;
      const fx = (x) => (x - 50) * s + cx;
      const fy = (y) => (y - 50) * s + cy;

      // Armor gradient (static — color stops don't change)
      const ag = ctx.createLinearGradient(fx(50), fy(14), fx(50), fy(94));
      ag.addColorStop(0, "#222f46");
      ag.addColorStop(0.35, "#0f172a");
      ag.addColorStop(1, "#060913");
      this._armorGrad = ag;
    }

    setRunningState(running, connecting = false) {
      this.isRunning = running;
      this.isConnecting = connecting;
      this.targetPowerProgress = running ? 1.0 : (connecting ? 0.5 : 0.0);
      this.targetSleepProgress = (running || connecting) ? 0.0 : 1.0;

      if (running) {
        this.wakeFlash = 1.0;
        this.eyeTargetOpenness = 1.0;
        this.targetColor = { r: 56, g: 189, b: 248 };
        this.triggerMicroSparks(6);
      } else if (connecting) {
        this.wakeFlash = 0.6;
        this.eyeTargetOpenness = 0.9;
        this.targetColor = { r: 245, g: 158, b: 11 };
      } else {
        this.eyeTargetOpenness = 0.0;
        this.targetGazeX = 0;
        this.targetGazeY = 0;
        this.targetColor = { r: 139, g: 92, b: 246 };
      }
    }

    setMetrics(cpu, ramPercent, speedDl, speedUl) {
      this.cpu = cpu || 0;
      this.ramPercent = ramPercent || 0;
      this.netSpeed = (speedDl || 0) + (speedUl || 0);

      if (this.isRunning) {
        if (this.cpu > 85) {
          this.targetColor = { r: 239, g: 68, b: 68 };
        } else {
          this.targetColor = { r: 56, g: 189, b: 248 };
        }
      }
    }

    triggerShock() {
      this.isShocking = true;
      this.shockTimer = performance.now();
      this.triggerShockParticles(50, 50);
    }

    triggerMicroSparks(count = 4) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 16 + Math.random() * 24;
        this.particles.push({
          x: 50 + (Math.random() - 0.5) * 16,
          y: 50 + (Math.random() - 0.5) * 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.45 + Math.random() * 0.25,
          size: 1.2,
          color: this.isRunning ? "#38BDF8" : "#A78BFA"
        });
      }
    }

    triggerShockParticles(centerX = 50, centerY = 50) {
      this.particles = [];
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const speed = 35 + Math.random() * 50;
        this.particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.8,
          size: 1.6,
          color: i % 2 === 0 ? "#38BDF8" : "#8B5CF6"
        });
      }

      this.electricArcs = [];
      for (let k = 0; k < 3; k++) {
        this.electricArcs.push({ fromX: 20, fromY: 8, toX: centerX, toY: centerY, life: 0.4, color: "#38BDF8" });
        this.electricArcs.push({ fromX: 80, fromY: 8, toX: centerX, toY: centerY, life: 0.4, color: "#8B5CF6" });
      }
    }

    startLoop() {
      const render = (now) => {
        this.animationFrameId = requestAnimationFrame(render);

        if (!this.isVisible) return;

        // When sleeping, throttle to 30 FPS to reduce GPU usage
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
      this.powerProgress += (this.targetPowerProgress - this.powerProgress) * (4.0 * dt);
      this.sleepProgress += (this.targetSleepProgress - this.sleepProgress) * (2.8 * dt);

      if (this.wakeFlash > 0) {
        this.wakeFlash = Math.max(0, this.wakeFlash - 2.5 * dt);
      }

      const targetHover = this.isHovered ? 1.0 : 0.0;
      this.hoverFactor += (targetHover - this.hoverFactor) * (6.0 * dt);

      const kbps = this.netSpeed / 1024;
      const flowRate = (0.4 + this.powerProgress * 1.6 + Math.min(kbps / 400, 3.0)) * 2.0 * (1 - this.sleepProgress * 0.8);
      this.coolantOffset = (this.coolantOffset + flowRate * dt) % 1.0;

      const isAwake = 1.0 - this.sleepProgress;
      if (isAwake > 0.4) {
        if (now > this.nextBlinkTime) {
          this.eyeTargetOpenness = 0.08;
          if (now > this.nextBlinkTime + 110) {
            this.eyeTargetOpenness = 1.0;
            this.nextBlinkTime = now + 2800 + Math.random() * 4500;
          }
        }
      } else {
        this.eyeTargetOpenness = this.isHovered ? 0.35 : 0.0;
      }
      this.eyeOpenness += (this.eyeTargetOpenness - this.eyeOpenness) * (9.0 * dt);

      this.gazeX += (this.targetGazeX - this.gazeX) * (6.5 * dt);
      this.gazeY += (this.targetGazeY - this.gazeY) * (6.5 * dt);

      this.currentColor.r += (this.targetColor.r - this.currentColor.r) * (4.5 * dt);
      this.currentColor.g += (this.targetColor.g - this.currentColor.g) * (4.5 * dt);
      this.currentColor.b += (this.targetColor.b - this.currentColor.b) * (4.5 * dt);

      if (this.isShocking && now - this.shockTimer > this.shockDuration) {
        this.isShocking = false;
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.7;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      for (let i = this.electricArcs.length - 1; i >= 0; i--) {
        const a = this.electricArcs[i];
        a.life -= dt * 2.4;
        if (a.life <= 0) this.electricArcs.splice(i, 1);
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

      const w = this.width || 136;
      const h = this.height || 136;
      const s = Math.min(w, h) / 100;
      const cx = w / 2;
      const cy = h / 2;
      const fx = (x) => (x - 50) * s + cx;
      const fy = (y) => (y - 50) * s + cy;

      const isAwake = 1.0 - this.sleepProgress;

      const breatheFreq = 0.0011 * this.sleepProgress + 0.0024 * isAwake + this.powerProgress * 0.001;
      const breatheAmp = (0.8 * this.sleepProgress + 1.5 * isAwake + this.powerProgress * 0.6);
      const breathe = Math.sin(now * breatheFreq) * breatheAmp;

      let shockOffsetY = 0;
      if (this.isShocking) {
        const progress = (now - this.shockTimer) / this.shockDuration;
        shockOffsetY = Math.sin(progress * Math.PI * 4) * (1 - progress) * 4.0;
      }

      const sleepShiftY = this.sleepProgress * 2.0 * s;

      const neonColor = `rgb(${Math.round(this.currentColor.r)}, ${Math.round(this.currentColor.g)}, ${Math.round(this.currentColor.b)})`;

      // 1. Ambient Halo
      ctx.save();
      const haloAlpha = (0.24 * isAwake + 0.08 * this.sleepProgress + this.powerProgress * 0.28 + this.wakeFlash * 0.4);
      const haloGrad = ctx.createRadialGradient(cx, cy + shockOffsetY + sleepShiftY, 4 * s, cx, cy + shockOffsetY + sleepShiftY, 44 * s);
      haloGrad.addColorStop(0, `rgba(${Math.round(this.currentColor.r)}, ${Math.round(this.currentColor.g)}, ${Math.round(this.currentColor.b)}, ${haloAlpha})`);
      haloGrad.addColorStop(0.5, `rgba(37, 99, 235, ${haloAlpha * 0.35})`);
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy + shockOffsetY + sleepShiftY, 44 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Interactive Head Parallax
      ctx.save();
      const headTilt = (this.gazeX * 0.06) * isAwake;
      const headShiftX = (this.gazeX * 2.0 * s) * isAwake;
      const headShiftY = (this.gazeY * 1.4 * s) * isAwake + breathe * 0.2 + sleepShiftY;
      ctx.translate(cx + headShiftX, cy + headShiftY);
      ctx.rotate(headTilt);
      ctx.translate(-cx, -cy);

      // 3. Liquid Cooling Conduits
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 3.8 * s;
      ctx.strokeStyle = "#0b1220";
      ctx.beginPath();
      ctx.moveTo(fx(20), fy(8 + shockOffsetY));
      ctx.bezierCurveTo(fx(10), fy(14 + shockOffsetY), fx(34), fy(24 + shockOffsetY), fx(44), fy(20 + shockOffsetY));
      ctx.moveTo(fx(80), fy(8 + shockOffsetY));
      ctx.bezierCurveTo(fx(90), fy(14 + shockOffsetY), fx(66), fy(24 + shockOffsetY), fx(56), fy(20 + shockOffsetY));
      ctx.stroke();

      // Dual-pass stroke instead of shadowBlur
      ctx.lineWidth = 3.0 * s;
      ctx.strokeStyle = `rgba(${Math.round(this.currentColor.r)}, ${Math.round(this.currentColor.g)}, ${Math.round(this.currentColor.b)}, 0.3)`;
      ctx.stroke();
      ctx.lineWidth = 1.6 * s;
      ctx.strokeStyle = neonColor;
      ctx.stroke();

      // Bubbles
      if (isAwake > 0.2) {
        for (let b = 0; b < 2; b++) {
          const bubbleT = (this.coolantOffset + b / 2) % 1.0;
          const lx = fx(20) + (fx(44) - fx(20)) * bubbleT;
          const ly = fy(8 + shockOffsetY) + (fy(20 + shockOffsetY) - fy(8 + shockOffsetY)) * bubbleT + Math.sin(bubbleT * Math.PI) * 3 * s;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(lx, ly, 1.2 * s, 0, Math.PI * 2);
          ctx.fill();

          const rx = fx(80) + (fx(56) - fx(80)) * bubbleT;
          const ry = fy(8 + shockOffsetY) + (fy(20 + shockOffsetY) - fy(8 + shockOffsetY)) * bubbleT + Math.sin(bubbleT * Math.PI) * 3 * s;
          ctx.beginPath();
          ctx.arc(rx, ry, 1.2 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Radiator Intake Horns
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = neonColor;
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(fx(24), fy(24 + shockOffsetY));
      ctx.lineTo(fx(20), fy(8 + shockOffsetY));
      ctx.lineTo(fx(32), fy(16 + shockOffsetY));
      ctx.closePath();
      ctx.moveTo(fx(76), fy(24 + shockOffsetY));
      ctx.lineTo(fx(80), fy(8 + shockOffsetY));
      ctx.lineTo(fx(68), fy(16 + shockOffsetY));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Antenna Emitters
      ctx.fillStyle = neonColor;
      ctx.beginPath();
      ctx.arc(fx(20), fy(8 + shockOffsetY), 2.4 * s, 0, Math.PI * 2);
      ctx.arc(fx(80), fy(8 + shockOffsetY), 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Titanium Mecha Outer Armor
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(fx(50), fy(14 + shockOffsetY));
      ctx.lineTo(fx(74), fy(18 + shockOffsetY));
      ctx.lineTo(fx(88), fy(36 + shockOffsetY));
      ctx.lineTo(fx(80), fy(70 + shockOffsetY));
      ctx.lineTo(fx(50), fy(94 + shockOffsetY));
      ctx.lineTo(fx(20), fy(70 + shockOffsetY));
      ctx.lineTo(fx(12), fy(36 + shockOffsetY));
      ctx.lineTo(fx(26), fy(18 + shockOffsetY));
      ctx.closePath();

      ctx.fillStyle = this._armorGrad || "#0f172a";
      ctx.fill();

      // Fast layered glow stroke
      ctx.strokeStyle = `rgba(${Math.round(this.currentColor.r)}, ${Math.round(this.currentColor.g)}, ${Math.round(this.currentColor.b)}, 0.35)`;
      ctx.lineWidth = (4.5 + this.powerProgress * 1.5) * s;
      ctx.stroke();
      ctx.strokeStyle = neonColor;
      ctx.lineWidth = (2.2 + this.powerProgress * 0.8) * s;
      ctx.stroke();

      // Cheek Cowlings
      ctx.fillStyle = `rgba(37, 99, 235, ${0.35 + this.powerProgress * 0.4 * isAwake + 0.15 * this.sleepProgress})`;
      ctx.beginPath();
      ctx.moveTo(fx(12), fy(36 + shockOffsetY));
      ctx.lineTo(fx(32), fy(50 + shockOffsetY));
      ctx.lineTo(fx(30), fy(76 + shockOffsetY));
      ctx.lineTo(fx(20), fy(70 + shockOffsetY));
      ctx.closePath();
      ctx.moveTo(fx(88), fy(36 + shockOffsetY));
      ctx.lineTo(fx(68), fy(50 + shockOffsetY));
      ctx.lineTo(fx(70), fy(76 + shockOffsetY));
      ctx.lineTo(fx(80), fy(70 + shockOffsetY));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 5. Visor Screen Inset
      ctx.save();
      ctx.fillStyle = "rgba(2, 6, 23, 0.94)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 1.0 * s;
      ctx.beginPath();
      ctx.moveTo(fx(26), fy(30 + shockOffsetY));
      ctx.lineTo(fx(74), fy(30 + shockOffsetY));
      ctx.lineTo(fx(74), fy(48 + shockOffsetY));
      ctx.lineTo(fx(50), fy(54 + shockOffsetY));
      ctx.lineTo(fx(26), fy(48 + shockOffsetY));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (this.isConnecting) {
        const scanY = fy(30 + shockOffsetY) + ((now * 0.04) % (18 * s));
        const scanGrad = ctx.createLinearGradient(fx(26), scanY, fx(74), scanY);
        scanGrad.addColorStop(0, "rgba(245, 158, 11, 0)");
        scanGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.7)");
        scanGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
        ctx.fillStyle = scanGrad;
        ctx.fillRect(fx(26), scanY - 1.5 * s, 48 * s, 3 * s);
      }
      ctx.restore();

      // 6. Visor Eyes / Sleeping Slits
      const eyeGx = (this.gazeX * 3.0 * s) * isAwake;
      const eyeGy = (this.gazeY * 1.8 * s) * isAwake;
      const aperture = Math.max(0.08, this.eyeOpenness * isAwake);

      ctx.save();
      ctx.fillStyle = neonColor;

      if (aperture > 0.22) {
        // Fast eye glow
        ctx.fillStyle = `rgba(${Math.round(this.currentColor.r)}, ${Math.round(this.currentColor.g)}, ${Math.round(this.currentColor.b)}, 0.4)`;
        ctx.fillRect(fx(28) + eyeGx, fy(33 + shockOffsetY) + eyeGy, 16 * s, 11 * s * aperture);
        ctx.fillRect(fx(56) + eyeGx, fy(33 + shockOffsetY) + eyeGy, 16 * s, 11 * s * aperture);

        ctx.fillStyle = neonColor;
        ctx.fillRect(fx(29) + eyeGx, fy(34 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);
        ctx.fillRect(fx(37) + eyeGx, fy(34 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);
        ctx.fillRect(fx(29) + eyeGx, fy(39 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);
        ctx.fillRect(fx(37) + eyeGx, fy(39 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);

        ctx.fillRect(fx(57) + eyeGx, fy(34 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);
        ctx.fillRect(fx(65) + eyeGx, fy(34 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);
        ctx.fillRect(fx(57) + eyeGx, fy(39 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);
        ctx.fillRect(fx(65) + eyeGx, fy(39 + shockOffsetY) + eyeGy, 5.8 * s, 3.2 * s * aperture);
      } else {
        // ASLEEP: Sleeping Slits
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = (2.2 * this.sleepProgress + 1.2 * isAwake) * s;
        ctx.beginPath();
        ctx.moveTo(fx(28) + eyeGx, fy(38 + shockOffsetY) + eyeGy);
        ctx.quadraticCurveTo(fx(36) + eyeGx, fy(40 + shockOffsetY) + eyeGy, fx(44) + eyeGx, fy(38 + shockOffsetY) + eyeGy);
        ctx.moveTo(fx(56) + eyeGx, fy(38 + shockOffsetY) + eyeGy);
        ctx.quadraticCurveTo(fx(64) + eyeGx, fy(40 + shockOffsetY) + eyeGy, fx(72) + eyeGx, fy(38 + shockOffsetY) + eyeGy);
        ctx.stroke();
      }
      ctx.restore();

      // 7. Quantum Diamond Arc Reactor
      ctx.save();
      const reactorColor = this.isRunning ? (this.cpu > 85 ? "#EF4444" : "#38BDF8") : (this.isConnecting ? "#F59E0B" : "#8B5CF6");
      const corePulse = Math.sin(now * (0.002 * this.sleepProgress + 0.004 * isAwake + this.powerProgress * 0.004)) * 0.5 + 0.5;

      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.rect(fx(46), fy(44 + shockOffsetY), 8 * s, 3.5 * s);
      ctx.rect(fx(46), fy(78 + shockOffsetY), 8 * s, 3.5 * s);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = reactorColor;
      ctx.beginPath();
      ctx.moveTo(fx(50), fy(46 + shockOffsetY));
      ctx.lineTo(fx(63), fy(59 + shockOffsetY));
      ctx.lineTo(fx(50), fy(78 + shockOffsetY));
      ctx.lineTo(fx(37), fy(59 + shockOffsetY));
      ctx.closePath();
      ctx.fill();

      if (isAwake > 0.3) {
        const fluxAngle = now * (0.002 + this.powerProgress * 0.004);
        ctx.save();
        ctx.translate(fx(50), fy(59 + shockOffsetY));
        ctx.rotate(fluxAngle);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        ctx.lineWidth = 1.0 * s;
        ctx.beginPath();
        ctx.arc(0, 0, 7.5 * s, 0, Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = this.isRunning ? "#FFFFFF" : (isAwake > 0.4 ? "#E9D5FF" : "#A78BFA");
      ctx.beginPath();
      ctx.moveTo(fx(50), fy(53 + shockOffsetY));
      ctx.lineTo(fx(55), fy(59 + shockOffsetY));
      ctx.lineTo(fx(50), fy(68 + shockOffsetY));
      ctx.lineTo(fx(45), fy(59 + shockOffsetY));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore(); // End head parallax

      // 8. EMP Sparks & Arcs
      ctx.save();
      for (const p of this.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(fx(p.x), fy(p.y + shockOffsetY), p.size * s, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const arc of this.electricArcs) {
        ctx.strokeStyle = arc.color;
        ctx.globalAlpha = Math.max(0, arc.life * 2.0);
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(fx(arc.fromX), fy(arc.fromY + shockOffsetY));
        const midX = (arc.fromX + arc.toX) / 2 + (Math.random() - 0.5) * 14;
        const midY = (arc.fromY + arc.toY) / 2 + (Math.random() - 0.5) * 14;
        ctx.quadraticCurveTo(fx(midX), fy(midY + shockOffsetY), fx(arc.toX), fy(arc.toY + shockOffsetY));
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();
    }
  }

  return WindowsSentinelMascot;
}));
