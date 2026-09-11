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
