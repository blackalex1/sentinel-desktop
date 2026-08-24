using System;
using System.Windows.Input;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Threading;

namespace SentinelDesktop.Controls;

/// <summary>
/// Animated mascot control.
///
/// Cache strategy (3 levels):
///   L1 – static fields: colors/brushes that NEVER change (armor gradient, visor fill, etc.)
///   L2 – geometry cache: StreamGeometry objects + scale-dependent pen widths, rebuilt ONLY when Bounds change
///   L3 – state cache: brushes / pens that depend on IsConnected / IsConnecting / IsTunMode, rebuilt ONLY on state change
///   Per-frame: only 2 Pen + 2 DashStyle for animated rings + 1 SolidColorBrush for pulsing heart
/// </summary>
public class LiveMascotControl : Control
{
    // ── Avalonia Properties ────────────────────────────────────────────
    public static readonly StyledProperty<bool> IsConnectedProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsConnected));

    public static readonly StyledProperty<bool> IsConnectingProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsConnecting));

    public static readonly StyledProperty<bool> IsTunModeProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsTunMode), true);

    public static readonly StyledProperty<bool> IsSystemProxyProperty =
        AvaloniaProperty.Register<LiveMascotControl, bool>(nameof(IsSystemProxy), false);

    public static readonly StyledProperty<ICommand?> CommandProperty =
        AvaloniaProperty.Register<LiveMascotControl, ICommand?>(nameof(Command));

    public ICommand? Command
    {
        get => GetValue(CommandProperty);
        set => SetValue(CommandProperty, value);
    }

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

    // ── Animation state ────────────────────────────────────────────────
    private readonly DispatcherTimer _timer;
    private double _time;
    private Point _targetGaze;
    private Point _currentGaze;
    private double _eyeOpenness = 1.0;
    private double _blinkTimer;
    private double _shockProgress;
    private bool _isShocking;

    public event Action? MascotClicked;

    // ── L1: STATIC — never change ──────────────────────────────────────
    // DashStyle double[] arrays (reused every frame, no re-allocation of inner array)
    private static readonly double[] Ring1Pattern = { 16, 8, 30, 8 };
    private static readonly double[] Ring2Pattern = { 24, 12, 60, 12 };

    // Brushes whose colors never vary
    private static readonly SolidColorBrush HornFillBrush      = new(Color.FromRgb(30, 41, 59));
    private static readonly SolidColorBrush ClampFillBrush     = new(Color.FromRgb(30, 41, 59));
    private static readonly SolidColorBrush VisorFillBrush     = new(Color.FromArgb(200, 2, 6, 23));
    private static readonly SolidColorBrush InactiveGlyphBrush = new(Color.FromArgb(40, 148, 163, 184));

    // Armor gradient never changes
    private static readonly LinearGradientBrush ArmorGrad = new()
    {
        StartPoint = new RelativePoint(0.5, 0, RelativeUnit.Relative),
        EndPoint   = new RelativePoint(0.5, 1, RelativeUnit.Relative),
        GradientStops =
        {
            new GradientStop(Color.FromRgb(17, 24, 39), 0.0),
            new GradientStop(Color.FromRgb(8,  20, 38), 0.5),
            new GradientStop(Color.FromRgb(3,   8, 20), 1.0),
        }
    };

    // ── L2: GEOMETRY CACHE — rebuilt only when Bounds change ──────────
    private Size   _cachedSize;
    private double _s; // scale factor

    private StreamGeometry? _mechaGeom;
    private StreamGeometry? _visorGeom;
    private StreamGeometry? _leftHorn,  _rightHorn;
    private StreamGeometry? _leftCheek, _rightCheek;
    private StreamGeometry? _leftTube,  _rightTube;
    private StreamGeometry? _outerDiamond, _innerDiamond, _heartDiamond;
    // _chevrons[0..2] = left, _chevrons[3..5] = right
    private StreamGeometry[]? _chevrons;

    // Pre-computed scale-dependent positions / sizes / rects
    private double _haloRadius;
    private double _ringR1, _ringR2;
    private double _eyeRectW;
    private double _eyeSlitY;
    private double _hornTipR;
    private Point  _leftHornTip, _rightHornTip;
    private Rect   _clamp1Rect, _clamp2Rect;

    // Scale-dependent pens (color never changes, only width)
    private Pen? _outerTubePen;

    // ── L3: STATE CACHE — rebuilt only when connection state changes ───
    private bool _stateCacheValid;

    private Color  _activeColor, _secondaryColor;
    private double _speedMult, _floatHeight;
    private int    _maxActiveChevrons;

    // State-dependent brushes & pens
    private SolidColorBrush?    _eyeBrush;
    private SolidColorBrush?    _ring1Brush, _ring2Brush;
    private double              _ring1Width, _ring2Width;
    private RadialGradientBrush? _haloBrush;
    private Pen?                _armorPen;
    private Pen?                _hornPen;
    private SolidColorBrush?    _cheekBrush;
    private Pen?                _cheekPen;
    private SolidColorBrush?    _outerDiamondBrush;
    private Pen?                _outerDiamondPen;
    private SolidColorBrush?    _innerSparkBrush;
    private Pen?                _innerTubePen;
    private SolidColorBrush?    _hornTipBrush;
    private Pen?                _slitPen;

    // ── Constructor ───────────────────────────────────────────────────
    public LiveMascotControl()
    {
        ClipToBounds = false;
        Cursor = new Cursor(StandardCursorType.Hand);

        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(33) };
        _timer.Tick += (_, _) =>
        {
            if (!IsEffectivelyVisible) return;
            _time += 0.033;
            UpdateAnimation();
            InvalidateVisual();
        };

        PointerMoved   += OnPointerMoved;
        PointerExited  += (_, _) => _targetGaze = default;
        PointerPressed += OnPointerPressed;
    }

    // ── Lifetime ──────────────────────────────────────────────────────
    protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
    {
        base.OnAttachedToVisualTree(e);
        if (IsEffectivelyVisible) _timer.Start();
    }

    protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
    {
        base.OnDetachedFromVisualTree(e);
        _timer.Stop();
    }

    protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
    {
        base.OnPropertyChanged(change);

        if (change.Property == Visual.IsVisibleProperty)
        {
            if (IsEffectivelyVisible && VisualRoot != null) _timer.Start();
            else _timer.Stop();
        }

        // Invalidate state cache on connection property changes
        if (change.Property == IsConnectedProperty  ||
            change.Property == IsConnectingProperty ||
            change.Property == IsTunModeProperty    ||
            change.Property == IsSystemProxyProperty)
        {
            _stateCacheValid = false;
        }
    }

    // ── Input ─────────────────────────────────────────────────────────
    private void OnPointerMoved(object? sender, PointerEventArgs e)
    {
        var pos = e.GetPosition(this);
        var cx = Bounds.Width  / 2.0;
        var cy = Bounds.Height / 2.0;
        if (cx > 0 && cy > 0)
            _targetGaze = new Point(
                Math.Clamp((pos.X - cx) / cx, -1.0, 1.0),
                Math.Clamp((pos.Y - cy) / cy, -1.0, 1.0));
    }

    private void OnPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        _isShocking    = true;
        _shockProgress = 0;
        MascotClicked?.Invoke();
        if (Command?.CanExecute(null) == true) Command.Execute(null);
    }

    // ── Animation update (zero allocations) ──────────────────────────
    private void UpdateAnimation()
    {
        _currentGaze = new Point(
            _currentGaze.X + (_targetGaze.X - _currentGaze.X) * 0.15,
            _currentGaze.Y + (_targetGaze.Y - _currentGaze.Y) * 0.15);

        _blinkTimer += 0.025;
        if (_blinkTimer > 3.2)
        {
            var blinkPhase = (_blinkTimer - 3.2) * 6.0;
            if (blinkPhase < Math.PI)
                _eyeOpenness = Math.Max(0.06, Math.Cos(blinkPhase));
            else
            {
                _eyeOpenness = 1.0;
                _blinkTimer  = 0;
            }
        }

        if (_isShocking)
        {
            _shockProgress += 0.045;
            if (_shockProgress >= 1.0) { _isShocking = false; _shockProgress = 0; }
        }
    }

    // ── L2 Cache builder ──────────────────────────────────────────────
    private void RebuildGeometryCache(double w, double h)
    {
        _cachedSize = new Size(w, h);
        _s = (Math.Min(w, h) * 0.88) / 100.0;
        var s = _s;

        // Coordinate helpers WITHOUT floatY — applied via PushTransform in Render
        double Fx(double x) => (x - 50.0) * s + w / 2.0;
        double Fy(double y) => (y - 50.0) * s + h / 2.0;

        // ── Mecha chassis ──
        _mechaGeom = new StreamGeometry();
        using (var ctx = _mechaGeom.Open())
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

        // ── Visor ──
        _visorGeom = new StreamGeometry();
        using (var ctx = _visorGeom.Open())
        {
            ctx.BeginFigure(new Point(Fx(26), Fy(29)), true);
            ctx.LineTo(new Point(Fx(74), Fy(29)));
            ctx.LineTo(new Point(Fx(74), Fy(47)));
            ctx.LineTo(new Point(Fx(50), Fy(53)));
            ctx.LineTo(new Point(Fx(26), Fy(47)));
        }

        // ── Intake horns ──
        _leftHorn = new StreamGeometry();
        using (var ctx = _leftHorn.Open())
        {
            ctx.BeginFigure(new Point(Fx(24), Fy(24)), true);
            ctx.LineTo(new Point(Fx(20), Fy(6)));
            ctx.LineTo(new Point(Fx(32), Fy(14)));
        }

        _rightHorn = new StreamGeometry();
        using (var ctx = _rightHorn.Open())
        {
            ctx.BeginFigure(new Point(Fx(76), Fy(24)), true);
            ctx.LineTo(new Point(Fx(80), Fy(6)));
            ctx.LineTo(new Point(Fx(68), Fy(14)));
        }

        // ── Cheek cowlings ──
        _leftCheek = new StreamGeometry();
        using (var ctx = _leftCheek.Open())
        {
            ctx.BeginFigure(new Point(Fx(12), Fy(34)), true);
            ctx.LineTo(new Point(Fx(32), Fy(48)));
            ctx.LineTo(new Point(Fx(30), Fy(76)));
            ctx.LineTo(new Point(Fx(20), Fy(68)));
        }

        _rightCheek = new StreamGeometry();
        using (var ctx = _rightCheek.Open())
        {
            ctx.BeginFigure(new Point(Fx(88), Fy(34)), true);
            ctx.LineTo(new Point(Fx(68), Fy(48)));
            ctx.LineTo(new Point(Fx(70), Fy(76)));
            ctx.LineTo(new Point(Fx(80), Fy(68)));
        }

        // ── Coolant tubes ──
        _leftTube = new StreamGeometry();
        using (var ctx = _leftTube.Open())
        {
            ctx.BeginFigure(new Point(Fx(20), Fy(6)), false);
            ctx.CubicBezierTo(new Point(Fx(10), Fy(12)), new Point(Fx(34), Fy(22)), new Point(Fx(44), Fy(18)));
        }

        _rightTube = new StreamGeometry();
        using (var ctx = _rightTube.Open())
        {
            ctx.BeginFigure(new Point(Fx(80), Fy(6)), false);
            ctx.CubicBezierTo(new Point(Fx(90), Fy(12)), new Point(Fx(66), Fy(22)), new Point(Fx(56), Fy(18)));
        }

        // ── Arc-reactor diamonds ──
        _outerDiamond = new StreamGeometry();
        using (var ctx = _outerDiamond.Open())
        {
            ctx.BeginFigure(new Point(Fx(50), Fy(44)), true);
            ctx.LineTo(new Point(Fx(64), Fy(58)));
            ctx.LineTo(new Point(Fx(50), Fy(80)));
            ctx.LineTo(new Point(Fx(36), Fy(58)));
        }

        _innerDiamond = new StreamGeometry();
        using (var ctx = _innerDiamond.Open())
        {
            ctx.BeginFigure(new Point(Fx(50), Fy(50)), true);
            ctx.LineTo(new Point(Fx(58), Fy(58)));
            ctx.LineTo(new Point(Fx(50), Fy(73)));
            ctx.LineTo(new Point(Fx(42), Fy(58)));
        }

        _heartDiamond = new StreamGeometry();
        using (var ctx = _heartDiamond.Open())
        {
            ctx.BeginFigure(new Point(Fx(50), Fy(54)), true);
            ctx.LineTo(new Point(Fx(54), Fy(58)));
            ctx.LineTo(new Point(Fx(50), Fy(64)));
            ctx.LineTo(new Point(Fx(46), Fy(58)));
        }

        // ── Chevrons: [0..2] = left, [3..5] = right ──
        _chevrons = new StreamGeometry[6];
        for (int i = 0; i < 3; i++)
        {
            var lc = new StreamGeometry();
            using (var ctx = lc.Open())
            {
                ctx.BeginFigure(new Point(Fx(19 + i * 1.5),   Fy(35 + i * 5.2)),   true);
                ctx.LineTo(new Point(Fx(23.5 + i * 1.5), Fy(35 + i * 5.2)));
                ctx.LineTo(new Point(Fx(22 + i * 1.5),   Fy(37.2 + i * 5.2)));
                ctx.LineTo(new Point(Fx(17.5 + i * 1.5), Fy(37.2 + i * 5.2)));
            }
            _chevrons[i] = lc;

            var rc = new StreamGeometry();
            using (var ctx = rc.Open())
            {
                ctx.BeginFigure(new Point(Fx(81 - i * 1.5),   Fy(35 + i * 5.2)),   true);
                ctx.LineTo(new Point(Fx(76.5 - i * 1.5), Fy(35 + i * 5.2)));
                ctx.LineTo(new Point(Fx(78 - i * 1.5),   Fy(37.2 + i * 5.2)));
                ctx.LineTo(new Point(Fx(82.5 - i * 1.5), Fy(37.2 + i * 5.2)));
            }
            _chevrons[3 + i] = rc;
        }

        // ── Pre-computed positions & sizes ──
        _haloRadius   = 50.0 * s;
        _ringR1       = 44.0 * s;
        _ringR2       = 49.0 * s;
        _eyeRectW     = 6.5 * s;
        _eyeSlitY     = Fy(37); // base Y without floatY
        _hornTipR     = 2.5 * s;
        _leftHornTip  = new Point(Fx(20), Fy(6));
        _rightHornTip = new Point(Fx(80), Fy(6));
        _clamp1Rect   = new Rect(Fx(46), Fy(41), 8 * s, 3.5 * s);
        _clamp2Rect   = new Rect(Fx(46), Fy(80), 8 * s, 3.5 * s);

        // Outer tube pen — color never changes, only width depends on scale
        _outerTubePen = new Pen(new SolidColorBrush(Color.FromArgb(240, 15, 23, 42)), 4.4 * s);

        // Force state-cache rebuild because pen widths depend on s
        _stateCacheValid = false;
    }

    // ── L3 Cache builder ──────────────────────────────────────────────
    private void RebuildStateCache()
    {
        _stateCacheValid = true;

        Color activeColor, secondaryColor;
        double speedMult, floatHeight;
        int maxChevrons;

        if (IsConnecting)
        {
            activeColor    = Color.FromRgb(245, 158, 11);
            secondaryColor = Color.FromRgb(251, 191, 36);
            speedMult      = 3.5;
            floatHeight    = 3.0;
            maxChevrons    = 3; // actual count animates per-frame via _time
        }
        else if (IsConnected)
        {
            if (IsTunMode)
            {
                activeColor    = Color.FromRgb(34, 211, 238);
                secondaryColor = Color.FromRgb(6,  182, 212);
                speedMult      = 2.5;
                floatHeight    = 4.0;
                maxChevrons    = 3;
            }
            else
            {
                activeColor    = Color.FromRgb(52, 211, 153);
                secondaryColor = Color.FromRgb(16, 185, 129);
                speedMult      = 1.6;
                floatHeight    = 2.8;
                maxChevrons    = 2;
            }
        }
        else
        {
            activeColor    = Color.FromRgb(167, 139, 250);
            secondaryColor = Color.FromRgb(139, 92,  246);
            speedMult      = 0.8;
            floatHeight    = 1.8;
            maxChevrons    = 0;
        }

        _activeColor       = activeColor;
        _secondaryColor    = secondaryColor;
        _speedMult         = speedMult;
        _floatHeight       = floatHeight;
        _maxActiveChevrons = maxChevrons;

        var s = _s;

        _eyeBrush          = new SolidColorBrush(activeColor);
        _hornTipBrush      = new SolidColorBrush(activeColor);
        _ring1Brush        = new SolidColorBrush(Color.FromArgb(120, activeColor.R, activeColor.G, activeColor.B));
        _ring2Brush        = new SolidColorBrush(Color.FromArgb(100, secondaryColor.R, secondaryColor.G, secondaryColor.B));
        _ring1Width        = 1.6 * s;
        _ring2Width        = 2.0 * s;
        _outerDiamondBrush = new SolidColorBrush(secondaryColor);

        _armorPen        = new Pen(new SolidColorBrush(Color.FromArgb(230, activeColor.R, activeColor.G, activeColor.B)), 3.2 * s);
        _hornPen         = new Pen(new SolidColorBrush(Color.FromArgb(200, activeColor.R, activeColor.G, activeColor.B)), 1.3 * s);
        _cheekPen        = new Pen(new SolidColorBrush(Color.FromArgb(120, activeColor.R, activeColor.G, activeColor.B)), 1.0 * s);
        _outerDiamondPen = new Pen(new SolidColorBrush(Color.FromArgb(160, 255, 255, 255)), 1.2 * s);
        _innerTubePen    = new Pen(new SolidColorBrush(activeColor), 2.2 * s);
        _slitPen         = new Pen(new SolidColorBrush(activeColor), 2.0 * s);

        var cheekColor = IsConnected && !IsTunMode
            ? Color.FromArgb(100, 16, 185, 129)
            : Color.FromArgb(100, 37, 99,  235);
        _cheekBrush = new SolidColorBrush(cheekColor);

        var innerSparkColor = IsConnected
            ? (IsTunMode ? Color.FromRgb(245, 158, 11) : Color.FromRgb(16, 185, 129))
            : Color.FromRgb(192, 132, 252);
        _innerSparkBrush = new SolidColorBrush(innerSparkColor);

        // Halo RadialGradientBrush (expensive — rebuilt only on state change)
        byte haloAlpha = IsConnected ? (byte)75 : (byte)40;
        _haloBrush = new RadialGradientBrush
        {
            Center         = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            GradientOrigin = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            RadiusX        = new RelativeScalar(0.5, RelativeUnit.Relative),
            RadiusY        = new RelativeScalar(0.5, RelativeUnit.Relative),
            GradientStops  =
            {
                new GradientStop(Color.FromArgb(haloAlpha, activeColor.R, activeColor.G, activeColor.B), 0.0),
                new GradientStop(Color.FromArgb(18, secondaryColor.R, secondaryColor.G, secondaryColor.B), 0.6),
                new GradientStop(Color.FromArgb(0, 0, 0, 0), 1.0),
            }
        };
    }

    // ── Render ────────────────────────────────────────────────────────
    public override void Render(DrawingContext dc)
    {
        base.Render(dc);

        var w = Bounds.Width;
        var h = Bounds.Height;
        if (w <= 0 || h <= 0) return;

        // L2: rebuild geometry cache if bounds changed
        var currentSize = new Size(w, h);
        if (currentSize != _cachedSize || _mechaGeom == null)
            RebuildGeometryCache(w, h);

        // L3: rebuild state cache if connection state changed
        if (!_stateCacheValid || _eyeBrush == null)
            RebuildStateCache();

        var s      = _s;
        var floatY = Math.Sin(_time * 2.2 * (IsConnected ? 1.2 : 0.8)) * _floatHeight;
        var center = new Point(w / 2.0, h / 2.0 + floatY);

        // Fast arithmetic helpers for per-frame eye/gaze positions (zero allocation)
        double Fx(double x) => (x - 50.0) * s + w / 2.0;
        double Fy(double y) => (y - 50.0) * s + h / 2.0 + floatY;

        // ── 2. AMBIENT RADIAL HALO ──
        dc.DrawEllipse(_haloBrush!, null, center, _haloRadius, _haloRadius);

        // ── 3. ORBITAL NEON ROTATING DASHED RINGS ──
        // Per-frame: only 2 Pen + 2 DashStyle (brush and width are L3-cached)
        var ring1Pen = new Pen(_ring1Brush, _ring1Width, new DashStyle(Ring1Pattern, _time * _speedMult));
        dc.DrawEllipse(null, ring1Pen, center, _ringR1, _ringR1);

        var ring2Pen = new Pen(_ring2Brush, _ring2Width, new DashStyle(Ring2Pattern, -_time * _speedMult * 0.8));
        dc.DrawEllipse(null, ring2Pen, center, _ringR2, _ringR2);

        // ── Shock EMP wave (transient — allocation only while clicking) ──
        if (_isShocking)
        {
            var shockR     = 25.0 * s + _shockProgress * 48.0 * s;
            var shockAlpha = (byte)(255 * (1.0 - _shockProgress));
            var shockPen   = new Pen(
                new SolidColorBrush(Color.FromArgb(shockAlpha, _activeColor.R, _activeColor.G, _activeColor.B)),
                (3.5 - _shockProgress * 2.5) * s);
            dc.DrawEllipse(null, shockPen, center, shockR, shockR);
        }

        // ── All cached geometry drawn inside a floatY translate transform ──
        // Geometries were built WITHOUT floatY; the transform supplies it so we
        // never need to rebuild them just because _time changed.
        using (dc.PushTransform(Matrix.CreateTranslation(0, floatY)))
        {
            // ── 4. COOLANT TUBES ──
            dc.DrawGeometry(null,          _outerTubePen!, _leftTube!);
            dc.DrawGeometry(null,          _outerTubePen!, _rightTube!);
            dc.DrawGeometry(null,          _innerTubePen!, _leftTube!);
            dc.DrawGeometry(null,          _innerTubePen!, _rightTube!);

            // ── 5. MECHA CROWN INTAKE HORNS ──
            dc.DrawGeometry(HornFillBrush, _hornPen!, _leftHorn!);
            dc.DrawGeometry(HornFillBrush, _hornPen!, _rightHorn!);

            // Radiator fin tip beacons (pre-computed positions, transform applies floatY)
            dc.DrawEllipse(_hornTipBrush!, null, _leftHornTip,  _hornTipR, _hornTipR);
            dc.DrawEllipse(_hornTipBrush!, null, _rightHornTip, _hornTipR, _hornTipR);

            // ── 6. TITANIUM MECHA CHASSIS SILHOUETTE ──
            dc.DrawGeometry(ArmorGrad, _armorPen!, _mechaGeom!);

            // ── 7. CHEEK COWLINGS ──
            dc.DrawGeometry(_cheekBrush!, _cheekPen!, _leftCheek!);
            dc.DrawGeometry(_cheekBrush!, _cheekPen!, _rightCheek!);

            // ── 8. CHEEK TELEMETRY GLYPHS ──
            var activeChevrons = IsConnecting ? (int)(_time * 6) % 4 : _maxActiveChevrons;
            for (int i = 0; i < 3; i++)
            {
                var glyphBrush = i < activeChevrons ? _eyeBrush! : InactiveGlyphBrush;
                dc.DrawGeometry(glyphBrush, null, _chevrons![i]);
                dc.DrawGeometry(glyphBrush, null, _chevrons![3 + i]);
            }

            // ── 9. VISOR GLASS SCREEN INSET ──
            dc.DrawGeometry(VisorFillBrush, null, _visorGeom!);

            // ── 11. OVERCLOCK QUANTUM DIAMOND ARC REACTOR ──
            dc.DrawRectangle(ClampFillBrush,     null,             _clamp1Rect);
            dc.DrawRectangle(ClampFillBrush,     null,             _clamp2Rect);
            dc.DrawGeometry(_outerDiamondBrush!, _outerDiamondPen!, _outerDiamond!);
            dc.DrawGeometry(_innerSparkBrush!,   null,              _innerDiamond!);

            // Pulsing heart: only alpha changes per-frame → 1 SolidColorBrush per frame
            var breathPulse = (Math.Sin(_time * (IsConnected ? 5.0 : 2.5)) + 1.0) / 2.0;
            var heartAlpha  = (byte)(200 + breathPulse * 55);
            dc.DrawGeometry(new SolidColorBrush(Color.FromArgb(heartAlpha, 255, 255, 255)), null, _heartDiamond!);
        }

        // ── 10. 4-QUADRANT WINDOWS CYBER VISOR EYES ──
        // Drawn outside PushTransform: Fy() already adds floatY to get correct screen Y
        var gazeOffX = _currentGaze.X * 3.5 * s;
        var gazeOffY = _currentGaze.Y * 2.5 * s;
        var eyeH     = Math.Max(0.6, 3.5 * s * _eyeOpenness);

        if (_eyeOpenness > 0.18)
        {
            // Left eye — Windows logo quad tiles
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(28) + gazeOffX, Fy(33) + gazeOffY, _eyeRectW, eyeH), s, s);
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(36) + gazeOffX, Fy(33) + gazeOffY, _eyeRectW, eyeH), s, s);
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(28) + gazeOffX, Fy(38) + gazeOffY, _eyeRectW, eyeH), s, s);
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(36) + gazeOffX, Fy(38) + gazeOffY, _eyeRectW, eyeH), s, s);

            // Right eye — Windows logo quad tiles
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(57) + gazeOffX, Fy(33) + gazeOffY, _eyeRectW, eyeH), s, s);
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(65) + gazeOffX, Fy(33) + gazeOffY, _eyeRectW, eyeH), s, s);
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(57) + gazeOffX, Fy(38) + gazeOffY, _eyeRectW, eyeH), s, s);
            dc.DrawRectangle(_eyeBrush!, null, new Rect(Fx(65) + gazeOffX, Fy(38) + gazeOffY, _eyeRectW, eyeH), s, s);
        }
        else
        {
            // Sleep slits (pen cached in L3)
            var slitY = _eyeSlitY + gazeOffY + floatY;
            dc.DrawLine(_slitPen!, new Point(Fx(28) + gazeOffX, slitY), new Point(Fx(43) + gazeOffX, slitY));
            dc.DrawLine(_slitPen!, new Point(Fx(57) + gazeOffX, slitY), new Point(Fx(72) + gazeOffX, slitY));
        }
    }
}
