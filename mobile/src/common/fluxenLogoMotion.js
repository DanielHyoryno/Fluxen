export const LOGO_ANIMATION_SPEED = 1.2;
export const LOGO_INTRO_MS = 5000 / LOGO_ANIMATION_SPEED;
export const LOGO_WAVE_MS = 2500 / LOGO_ANIMATION_SPEED;
export const LOGO_DOCK_MS = 750 / LOGO_ANIMATION_SPEED;
export const LOGO_REVEAL_MS = 400 / LOGO_ANIMATION_SPEED;
export const LOGO_FINAL_LEVEL = 795.5;
export const LOGO_VIEWBOX = "340 150 590 950";
export const LOGO_ASPECT_RATIO = 590 / 950;

// Vector outline follows AppLogo/FluxenLogo.png, without its white image background.
export const LOGO_MARK_PATH = [
    "M891 181 H558",
    "C460 181 380 261 380 358",
    "V1056 Q380 1074 398 1074 H540 Q558 1074 558 1056",
    "V773 C558 744 575 722 603 722 H861 V563 H584",
    "Q558 563 558 537 V405 C558 376 580 354 609 354 H891 Z",
].join(" ");

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);
const mix = (from, to, progress) => from + (to - from) * progress;

export function getLogoWaterLevel(elapsedMs, sequence = "intro") {
    if (sequence === "steady" || elapsedMs >= LOGO_INTRO_MS) return LOGO_FINAL_LEVEL;
    const seconds = Math.max(0, elapsedMs) * LOGO_ANIMATION_SPEED / 1000;
    if (seconds <= 0.15) return 1120;
    if (seconds < 2.25) return mix(1120, 220, ease(clamp((seconds - 0.15) / 2.1)));
    if (seconds < 2.6) return 220;
    return mix(220, LOGO_FINAL_LEVEL, ease(clamp((seconds - 2.6) / 2.4)));
}

function closedWave(points, bottom = 1120) {
    return `M${points[0]} ${points.slice(1).map(point => `L${point}`).join(" ")} L940 ${bottom} L330 ${bottom} Z`;
}

export function getLogoWaterFrame(elapsedMs, sequence = "intro") {
    const parsedElapsed = Number(elapsedMs);
    const elapsed = Number.isFinite(parsedElapsed) ? Math.max(0, parsedElapsed) : 0;
    const level = getLogoWaterLevel(elapsed, sequence);
    const phase = (elapsed % LOGO_WAVE_MS) / LOGO_WAVE_MS * Math.PI * 2;
    const frontAt = x => Math.sin((x - 390) * 0.02752 - phase) * 21.1
        + Math.sin((x - 390) * 0.04544 - phase * 2 + 0.7) * 5.47;
    const backAt = x => Math.sin((x - 390) * 0.02304 + phase + 1.25) * 15.625;
    let frontMean = 0;
    let backMean = 0;
    for (let x = 390; x < 546; x++) {
        frontMean += frontAt(x) / 156;
        backMean += backAt(x) / 156;
    }
    const front = [];
    const back = [];
    const rim = [];
    for (let x = 330; x <= 940; x += 10) {
        const y = level + frontAt(x) - frontMean;
        front.push(`${x} ${y.toFixed(2)}`);
        back.push(`${x} ${(level + backAt(x) - backMean - 4.7).toFixed(2)}`);
        rim.unshift(`${x} ${(y + 8.6).toFixed(2)}`);
    }
    return {
        level,
        phase: sequence === "steady" || elapsed >= LOGO_INTRO_MS ? "steady" : "intro",
        front: closedWave(front),
        back: closedWave(back),
        rim: `M${front[0]} ${front.slice(1).map(point => `L${point}`).join(" ")} ${rim.map(point => `L${point}`).join(" ")} Z`,
    };
}
