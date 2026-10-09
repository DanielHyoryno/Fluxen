import {
    getLogoWaterFrame,
    getLogoWaterLevel,
    LOGO_ANIMATION_SPEED,
    LOGO_DOCK_MS,
    LOGO_FINAL_LEVEL,
    LOGO_INTRO_MS,
    LOGO_REVEAL_MS,
    LOGO_WAVE_MS,
} from "../src/common/fluxenLogoMotion";

test("all splash timings run at twenty percent faster playback", () => {
    expect(LOGO_ANIMATION_SPEED).toBe(1.2);
    expect(LOGO_INTRO_MS * LOGO_ANIMATION_SPEED).toBeCloseTo(5000);
    expect(LOGO_WAVE_MS * LOGO_ANIMATION_SPEED).toBeCloseTo(2500);
    expect(LOGO_DOCK_MS * LOGO_ANIMATION_SPEED).toBeCloseTo(750);
    expect(LOGO_REVEAL_MS * LOGO_ANIMATION_SPEED).toBeCloseTo(400);
});

test("the faster intro preserves the rise and return to the original water level", () => {
    expect(getLogoWaterLevel(0)).toBe(1120);
    expect(getLogoWaterLevel(1250 / LOGO_ANIMATION_SPEED)).toBeLessThan(getLogoWaterLevel(625 / LOGO_ANIMATION_SPEED));
    expect(getLogoWaterLevel(2500 / LOGO_ANIMATION_SPEED)).toBe(220);
    expect(getLogoWaterLevel(3600 / LOGO_ANIMATION_SPEED)).toBeGreaterThan(220);
    expect(getLogoWaterLevel(LOGO_INTRO_MS)).toBe(LOGO_FINAL_LEVEL);
});

test("the loading loop keeps the water level fixed but changes the wave surface", () => {
    const a = getLogoWaterFrame(0, "steady");
    const b = getLogoWaterFrame(625, "steady");
    expect(a.level).toBe(LOGO_FINAL_LEVEL);
    expect(b.level).toBe(LOGO_FINAL_LEVEL);
    expect(a.front).not.toBe(b.front);
    expect(a.back).not.toBe(b.back);
});

test("the wave loop and intro handoff are seamless", () => {
    expect(getLogoWaterFrame(0, "steady")).toEqual(getLogoWaterFrame(LOGO_WAVE_MS, "steady"));
    expect(getLogoWaterFrame(LOGO_INTRO_MS)).toEqual(getLogoWaterFrame(LOGO_INTRO_MS, "steady"));
});

test.each([undefined, NaN, Infinity, -500, 0, 150, 2250, 5000, 100000])("wave geometry stays finite at %s", time => {
    const frame = getLogoWaterFrame(time);
    expect(Number.isFinite(frame.level)).toBe(true);
    for (const path of [frame.front, frame.back, frame.rim]) {
        expect(path).not.toMatch(/NaN|Infinity|undefined/);
        expect(path.startsWith("M")).toBe(true);
        expect(path.endsWith("Z")).toBe(true);
    }
});
