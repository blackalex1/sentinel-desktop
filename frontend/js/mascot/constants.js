/**
 * Windows Sentinel - Constants & Theme Configuration
 */
(function (root, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else {
        root.WindowsSentinelConstants = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {
    return {
        COLORS: {
            FROST_BLUE: "#38BDF8",
            COBALT_BLUE: "#2563EB",
            OVERHEAT: "#EF4444",
            OVERCLOCK_GOLD: "#F59E0B",
            STANDBY_VIOLET: "#8B5CF6",
            STANDBY_MUTED: "#A78BFA",
            BG_DARK: "#030712",
            ARMOR_DARK: "#030814",
            ARMOR_MID: "#081426",
            ARMOR_LIGHT: "#111827",
            TITANIUM: "#1e293b",
            TITANIUM_LIGHT: "#334155"
        },
        TIMINGS: {
            BLINK_MIN: 2800,
            BLINK_MAX: 6500,
            BLINK_DURATION: 120,
            SHOCK_DURATION: 650,
            SLEEP_LERP_SPEED: 3.5,
            COLOR_LERP_SPEED: 4.0,
            GAZE_LERP_SPEED: 6.0
        }
    };
}));
