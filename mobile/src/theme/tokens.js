export const colors = {
    background: "#f4f8ff",
    surface: "#ffffff",
    surfaceMuted: "#f8faff",
    primary: "#0f62fe",
    primarySoft: "#edf4ff",
    text: "#17324d",
    textMuted: "#55708a",
    border: "#dbe6f5",
    track: "#edf2fa",
    online: "#0a6f2f",
    onlineSoft: "#eaf7ef",
    offline: "#66788a",
    offlineSoft: "#f0f3f6",
    danger: "#a61d1d",
};

export function floatingTabLayout(width, bottomInset = 0) {
    const horizontalInset = Math.max(16, (width - 600) / 2);
    return {
        start: horizontalInset,
        end: horizontalInset,
        bottom: bottomInset + 10,
        height: 56,
    };
}

export function floatingTabBarStyle(width, bottomInset = 0) {
    return {
        position: "absolute",
        ...floatingTabLayout(width, bottomInset),
        borderRadius: 18,
        borderTopWidth: 0,
        backgroundColor: colors.surface,
        shadowColor: "#0d1c2f",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
        paddingTop: 0,
        paddingBottom: 0,
    };
}
