using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Threading;

namespace SentinelDesktop.Controls;

public class LiveMascotControl : Control
{
    public static readonly StyledProperty<bool> IsConnectedProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsConnected));

    public static readonly StyledProperty<bool> IsConnectingProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsConnecting));

    public static readonly StyledProperty<bool> IsTunModeProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsTunMode), true);

    public static readonly StyledProperty<bool> IsSystemProxyProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsSystemProxy), false);

    public bool IsConnected
    {
        get => GetValue(IsConnectedProperty);
        set => SetValue(IsConnectedProperty, value);
    }

    public bool IsConnecting
    {
        get => GetValue(IsConnectingProperty);
        set => SetValue(IsConnectingProperty, value);
    }

    public bool IsTunMode
    {
        get => GetValue(IsTunModeProperty);
        set => SetValue(IsTunModeProperty, value);
    }

    public bool IsSystemProxy
    {
        get => GetValue(IsSystemProxyProperty);
        set => SetValue(IsSystemProxyProperty, value);
    }

    private readonly DispatcherTimer _timer;
    private double _time;
    private Point _targetGaze = new(0, 0);
    private Point _currentGaze = new(0, 0);
    private double _eyeOpenness = 1.0;
    private double _blinkTimer = 0;
    private double _shockProgress = 0;
    private bool _isShocking = false;

    public event Action? MascotClicked;

    public LiveMascotControl()
    {
        ClipToBounds = false;
        Cursor = new Cursor(StandardCursorType.Hand);

        _timer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(16) // ~60 FPS
        };
        _timer.Tick += (s, e) =>
        {
            _time += 0.025;
            UpdateAnimation();
            InvalidateVisual();
        };
        _timer.Start();

        PointerMoved += OnPointerMoved;
        PointerExited += (s, e) => _targetGaze = new Point(0, 0);
        PointerPressed += OnPointerPressed;
    }

    private void OnPointerMoved(object? sender, PointerEventArgs e)
    {
        var pos = e.GetPosition(this);
        var cx = Bounds.Width / 2.0;
        var cy = Bounds.Height / 2.0;
        if (cx > 0 && cy > 0)
        {
            var gx = Math.Clamp((pos.X - cx) / cx, -1.0, 1.0);
            var gy = Math.Clamp((pos.Y - cy) / cy, -1.0, 1.0);
            _targetGaze = new Point(gx, gy);
        }
    }

    private void OnPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        _isShocking = true;
        _shockProgress = 0;
        MascotClicked?.Invoke();
    }

    private void UpdateAnimation()
    {
        _currentGaze = new Point(
            _currentGaze.X + (_targetGaze.X - _currentGaze.X) * 0.15,
            _currentGaze.Y + (_targetGaze.Y - _currentGaze.Y) * 0.15
        );

        _blinkTimer += 0.025;
        if (_blinkTimer > 3.2)
        {
            var blinkPhase = (_blinkTimer - 3.2) * 6.0;
            if (blinkPhase < Math.PI)
            {
                _eyeOpenness = Math.Max(0.06, Math.Cos(blinkPhase));
            }
            else
            {
                _eyeOpenness = 1.0;
                _blinkTimer = 0;
            }
        }

        if (_isShocking)
        {
            _shockProgress += 0.045;
            if (_shockProgress >= 1.0)
            {
                _isShocking = false;
                _shockProgress = 0;
            }
        }
    }

    public override void Render(DrawingContext dc)
    {
        base.Render(dc);

        var w = Bounds.Width;
        var h = Bounds.Height;
        if (w <= 0 || h <= 0) return;

        var s = (Math.Min(w, h) * 0.88) / 100.0;

        // 1. STATE-DEPENDENT DYNAMICS & COLOR THEMES
        Color activeColor;
        Color secondaryColor;
        double speedMult;
        double floatHeight;
        int activeChevrons;

        if (IsConnecting)
        {
            // Amber Pulse for Handshake
            activeColor = Color.FromRgb(245, 158, 11);
            secondaryColor = Color.FromRgb(251, 191, 36);
            speedMult = 3.5;
            floatHeight = 3.0;
            activeChevrons = (int)(_time * 6) % 4;
        }
        else if (IsConnected)
        {
            if (IsTunMode)
            {
                // TUN Mode: Laser Frost Cyan (Overclock High Bandwidth)
                activeColor = Color.FromRgb(34, 211, 238);
                secondaryColor = Color.FromRgb(6, 182, 212);
                speedMult = 2.5;
                floatHeight = 4.0;
                activeChevrons = 3;
            }
            else
            {
                // System Proxy Mode: Emerald Shield Green (Stealth Routing)
                activeColor = Color.FromRgb(52, 211, 153);
                secondaryColor = Color.FromRgb(16, 185, 129);
                speedMult = 1.6;
                floatHeight = 2.8;
                activeChevrons = 2;
            }
        }
        else
        {
            // Disconnected: Deep Cyber Violet (Standby Mode)
            activeColor = Color.FromRgb(167, 139, 250);
            secondaryColor = Color.FromRgb(139, 92, 246);
            speedMult = 0.8;
            floatHeight = 1.8;
            activeChevrons = 0;
        }

        var floatY = Math.Sin(_time * 2.2 * (IsConnected ? 1.2 : 0.8)) * floatHeight;

        double Fx(double x) => (x - 50.0) * s + w / 2.0;
        double Fy(double y) => (y - 50.0) * s + h / 2.0 + floatY;

        var center = new Point(w / 2.0, h / 2.0 + floatY);

        // 2. AMBIENT RADIAL HALO
        var haloRadius = 50.0 * s;
        var haloBrush = new RadialGradientBrush
        {
            Center = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            GradientOrigin = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            RadiusX = new RelativeScalar(0.5, RelativeUnit.Relative),
            RadiusY = new RelativeScalar(0.5, RelativeUnit.Relative),
            GradientStops =
            {
                new GradientStop(Color.FromArgb(IsConnected ? (byte)75 : (byte)40, activeColor.R, activeColor.G, activeColor.B), 0),
                new GradientStop(Color.FromArgb(18, secondaryColor.R, secondaryColor.G, secondaryColor.B), 0.6),
                new GradientStop(Color.FromArgb(0, 0, 0, 0), 1.0)
            }
        };
        dc.DrawEllipse(haloBrush, null, center, haloRadius, haloRadius);

        // 3. ORBITAL NEON ROTATING DASHED RINGS (Speed and radius react to mode)
        var r1 = 44.0 * s;
        var r2 = 49.0 * s;

        var ring1Pen = new Pen(new SolidColorBrush(Color.FromArgb(120, activeColor.R, activeColor.G, activeColor.B)), 1.6 * s,
            new DashStyle(new double[] { 16, 8, 30, 8 }, _time * speedMult));
        dc.DrawEllipse(null, ring1Pen, center, r1, r1);

        var ring2Pen = new Pen(new SolidColorBrush(Color.FromArgb(100, secondaryColor.R, secondaryColor.G, secondaryColor.B)), 2.0 * s,
            new DashStyle(new double[] { 24, 12, 60, 12 }, -_time * speedMult * 0.8));
        dc.DrawEllipse(null, ring2Pen, center, r2, r2);

        // Shock EMP wave
        if (_isShocking)
        {
            var shockR = 25.0 * s + _shockProgress * 48.0 * s;
            var shockAlpha = (byte)(255 * (1.0 - _shockProgress));
            var shockPen = new Pen(new SolidColorBrush(Color.FromArgb(shockAlpha, activeColor.R, activeColor.G, activeColor.B)), (3.5 - _shockProgress * 2.5) * s);
            dc.DrawEllipse(null, shockPen, center, shockR, shockR);
        }

        // 4. COOLANT TUBES (СВО Liquid Tubes)
        var outerTubePen = new Pen(new SolidColorBrush(Color.FromArgb(240, 15, 23, 42)), 4.4 * s);
        var leftTube = new StreamGeometry();
        using (var ctx = leftTube.Open())
        {
            ctx.BeginFigure(new Point(Fx(20), Fy(6)), false);
            ctx.CubicBezierTo(new Point(Fx(10), Fy(12)), new Point(Fx(34), Fy(22)), new Point(Fx(44), Fy(18)));
        }
        dc.DrawGeometry(null, outerTubePen, leftTube);

        var rightTube = new StreamGeometry();
        using (var ctx = rightTube.Open())
        {
            ctx.BeginFigure(new Point(Fx(80), Fy(6)), false);
            ctx.CubicBezierTo(new Point(Fx(90), Fy(12)), new Point(Fx(66), Fy(22)), new Point(Fx(56), Fy(18)));
        }
        dc.DrawGeometry(null, outerTubePen, rightTube);

        // Flowing Neon Liquid Core
        var innerTubePen = new Pen(new SolidColorBrush(activeColor), 2.2 * s);
        dc.DrawGeometry(null, innerTubePen, leftTube);
        dc.DrawGeometry(null, innerTubePen, rightTube);

        // 5. MECHA CROWN INTAKE HORNS
        var hornBrush = new SolidColorBrush(Color.FromRgb(30, 41, 59));
        var hornPen = new Pen(new SolidColorBrush(Color.FromArgb(200, activeColor.R, activeColor.G, activeColor.B)), 1.3 * s);

        var leftHorn = new StreamGeometry();
        using (var ctx = leftHorn.Open())
        {
            ctx.BeginFigure(new Point(Fx(24), Fy(24)), true);
            ctx.LineTo(new Point(Fx(20), Fy(6)));
            ctx.LineTo(new Point(Fx(32), Fy(14)));
        }
        dc.DrawGeometry(hornBrush, hornPen, leftHorn);

        var rightHorn = new StreamGeometry();
        using (var ctx = rightHorn.Open())
        {
            ctx.BeginFigure(new Point(Fx(76), Fy(24)), true);
            ctx.LineTo(new Point(Fx(80), Fy(6)));
            ctx.LineTo(new Point(Fx(68), Fy(14)));
        }
        dc.DrawGeometry(hornBrush, hornPen, rightHorn);

        // Radiator Fin Tips Beacons
        dc.DrawEllipse(new SolidColorBrush(activeColor), null, new Point(Fx(20), Fy(6)), 2.5 * s, 2.5 * s);
        dc.DrawEllipse(new SolidColorBrush(activeColor), null, new Point(Fx(80), Fy(6)), 2.5 * s, 2.5 * s);

        // 6. TITANIUM MECHA CHASSIS SILHOUETTE
        var mechaGeom = new StreamGeometry();
        using (var ctx = mechaGeom.Open())
        {
            ctx.BeginFigure(new Point(Fx(50), Fy(12)), true);
            ctx.LineTo(new Point(Fx(74), Fy(16)));
            ctx.LineTo(new Point(Fx(88), Fy(34)));
            ctx.LineTo(new Point(Fx(80), Fy(68)));
            ctx.LineTo(new Point(Fx(50), Fy(94)));
            ctx.LineTo(new Point(Fx(20), Fy(68)));
            ctx.LineTo(new Point(Fx(12), Fy(34)));
            ctx.LineTo(new Point(Fx(26), Fy(16)));
        }

        var armorGrad = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(0.5, 0, RelativeUnit.Relative),
            EndPoint = new RelativePoint(0.5, 1, RelativeUnit.Relative),
            GradientStops =
            {
                new GradientStop(Color.FromRgb(17, 24, 39), 0),
                new GradientStop(Color.FromRgb(8, 20, 38), 0.5),
                new GradientStop(Color.FromRgb(3, 8, 20), 1.0)
            }
        };
        var armorPen = new Pen(new SolidColorBrush(Color.FromArgb(230, activeColor.R, activeColor.G, activeColor.B)), 3.2 * s);
        dc.DrawGeometry(armorGrad, armorPen, mechaGeom);

        // 7. CHEEK COWLINGS
        var cheekColor = IsConnected && !IsTunMode ? Color.FromArgb(100, 16, 185, 129) : Color.FromArgb(100, 37, 99, 235);
        var cheekBrush = new SolidColorBrush(cheekColor);
        var cheekPen = new Pen(new SolidColorBrush(Color.FromArgb(120, activeColor.R, activeColor.G, activeColor.B)), 1.0 * s);

        var leftCheek = new StreamGeometry();
        using (var ctx = leftCheek.Open())
        {
            ctx.BeginFigure(new Point(Fx(12), Fy(34)), true);
            ctx.LineTo(new Point(Fx(32), Fy(48)));
            ctx.LineTo(new Point(Fx(30), Fy(76)));
            ctx.LineTo(new Point(Fx(20), Fy(68)));
        }
        dc.DrawGeometry(cheekBrush, cheekPen, leftCheek);

        var rightCheek = new StreamGeometry();
        using (var ctx = rightCheek.Open())
        {
            ctx.BeginFigure(new Point(Fx(88), Fy(34)), true);
            ctx.LineTo(new Point(Fx(68), Fy(48)));
            ctx.LineTo(new Point(Fx(70), Fy(76)));
            ctx.LineTo(new Point(Fx(80), Fy(68)));
        }
        dc.DrawGeometry(cheekBrush, cheekPen, rightCheek);

        // 8. CHEEK TELEMETRY GLYPHS (3 Slanted Chevrons)
        for (int i = 0; i < 3; i++)
        {
            var isChevronActive = i < activeChevrons;
            var glyphBrush = new SolidColorBrush(isChevronActive ? activeColor : Color.FromArgb(40, 148, 163, 184));

            var leftChevron = new StreamGeometry();
            using (var ctx = leftChevron.Open())
            {
                ctx.BeginFigure(new Point(Fx(19 + i * 1.5), Fy(35 + i * 5.2)), true);
                ctx.LineTo(new Point(Fx(23.5 + i * 1.5), Fy(35 + i * 5.2)));
                ctx.LineTo(new Point(Fx(22 + i * 1.5), Fy(37.2 + i * 5.2)));
                ctx.LineTo(new Point(Fx(17.5 + i * 1.5), Fy(37.2 + i * 5.2)));
            }
            dc.DrawGeometry(glyphBrush, null, leftChevron);

            var rightChevron = new StreamGeometry();
            using (var ctx = rightChevron.Open())
            {
                ctx.BeginFigure(new Point(Fx(81 - i * 1.5), Fy(35 + i * 5.2)), true);
                ctx.LineTo(new Point(Fx(76.5 - i * 1.5), Fy(35 + i * 5.2)));
                ctx.LineTo(new Point(Fx(78 - i * 1.5), Fy(37.2 + i * 5.2)));
                ctx.LineTo(new Point(Fx(82.5 - i * 1.5), Fy(37.2 + i * 5.2)));
            }
            dc.DrawGeometry(glyphBrush, null, rightChevron);
        }

        // 9. VISOR GLASS SCREEN INSET
        var visorGeom = new StreamGeometry();
        using (var ctx = visorGeom.Open())
        {
            ctx.BeginFigure(new Point(Fx(26), Fy(29)), true);
            ctx.LineTo(new Point(Fx(74), Fy(29)));
            ctx.LineTo(new Point(Fx(74), Fy(47)));
            ctx.LineTo(new Point(Fx(50), Fy(53)));
            ctx.LineTo(new Point(Fx(26), Fy(47)));
        }
        dc.DrawGeometry(new SolidColorBrush(Color.FromArgb(200, 2, 6, 23)), null, visorGeom);

        // 10. 4-QUADRANT WINDOWS CYBER VISOR EYES
        var gazeOffX = _currentGaze.X * 3.5 * s;
        var gazeOffY = _currentGaze.Y * 2.5 * s;
        var eyeH = Math.Max(0.6, 3.5 * s * _eyeOpenness);

        var eyeBrush = new SolidColorBrush(activeColor);

        if (_eyeOpenness > 0.18)
        {
            // Left Quad-Segment Eye (Windows Logo Tiles)
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(28) + gazeOffX, Fy(33) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(36) + gazeOffX, Fy(33) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(28) + gazeOffX, Fy(38) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(36) + gazeOffX, Fy(38) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);

            // Right Quad-Segment Eye (Windows Logo Tiles)
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(57) + gazeOffX, Fy(33) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(65) + gazeOffX, Fy(33) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(57) + gazeOffX, Fy(38) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);
            dc.DrawRectangle(eyeBrush, null, new Rect(Fx(65) + gazeOffX, Fy(38) + gazeOffY, 6.5 * s, eyeH), 1.0 * s, 1.0 * s);
        }
        else
        {
            // Sleep Slits
            var slitPen = new Pen(eyeBrush, 2.0 * s);
            dc.DrawLine(slitPen, new Point(Fx(28) + gazeOffX, Fy(37) + gazeOffY), new Point(Fx(43) + gazeOffX, Fy(37) + gazeOffY));
            dc.DrawLine(slitPen, new Point(Fx(57) + gazeOffX, Fy(37) + gazeOffY), new Point(Fx(72) + gazeOffX, Fy(37) + gazeOffY));
        }

        // 11. OVERCLOCK QUANTUM DIAMOND ARC REACTOR
        var breathPulse = (Math.Sin(_time * (IsConnected ? 5.0 : 2.5)) + 1.0) / 2.0;

        // Titanium Magnetic Clamps
        var clampBrush = new SolidColorBrush(Color.FromRgb(30, 41, 59));
        dc.DrawRectangle(clampBrush, null, new Rect(Fx(46), Fy(41), 8 * s, 3.5 * s));
        dc.DrawRectangle(clampBrush, null, new Rect(Fx(46), Fy(80), 8 * s, 3.5 * s));

        // Razor-Sharp Outer Diamond
        var outerDiamond = new StreamGeometry();
        using (var ctx = outerDiamond.Open())
        {
            ctx.BeginFigure(new Point(Fx(50), Fy(44)), true);
            ctx.LineTo(new Point(Fx(64), Fy(58)));
            ctx.LineTo(new Point(Fx(50), Fy(80)));
            ctx.LineTo(new Point(Fx(36), Fy(58)));
        }
        var outerDiamondBrush = new SolidColorBrush(secondaryColor);
        dc.DrawGeometry(outerDiamondBrush, new Pen(new SolidColorBrush(Color.FromArgb(160, 255, 255, 255)), 1.2 * s), outerDiamond);

        // Inner Overclock Spark (Amber / Gold / Emerald)
        var innerDiamond = new StreamGeometry();
        using (var ctx = innerDiamond.Open())
        {
            ctx.BeginFigure(new Point(Fx(50), Fy(50)), true);
            ctx.LineTo(new Point(Fx(58), Fy(58)));
            ctx.LineTo(new Point(Fx(50), Fy(73)));
            ctx.LineTo(new Point(Fx(42), Fy(58)));
        }
        var innerSparkColor = IsConnected
            ? (IsTunMode ? Color.FromRgb(245, 158, 11) : Color.FromRgb(16, 185, 129))
            : Color.FromRgb(192, 132, 252);
        dc.DrawGeometry(new SolidColorBrush(innerSparkColor), null, innerDiamond);

        // White Singularity Heart
        var heartDiamond = new StreamGeometry();
        using (var ctx = heartDiamond.Open())
        {
            ctx.BeginFigure(new Point(Fx(50), Fy(54)), true);
            ctx.LineTo(new Point(Fx(54), Fy(58)));
            ctx.LineTo(new Point(Fx(50), Fy(64)));
            ctx.LineTo(new Point(Fx(46), Fy(58)));
        }
        dc.DrawGeometry(new SolidColorBrush(Color.FromArgb((byte)(200 + breathPulse * 55), 255, 255, 255)), null, heartDiamond);
    }
}
