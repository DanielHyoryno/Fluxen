import { useEffect, useRef, useState } from "react";

const COOLDOWN_MS = 60_000;

export default function useOtpResendCooldown() {
    const deadline = useRef(0);
    const [expiresAt, setExpiresAt] = useState(0);
    const [seconds, setSeconds] = useState(0);

    function startCooldown() {
        const nextDeadline = Date.now() + COOLDOWN_MS;
        deadline.current = nextDeadline;
        setSeconds(COOLDOWN_MS / 1000);
        setExpiresAt(nextDeadline);
    }

    function resend(action) {
        if (Date.now() < deadline.current) return;
        startCooldown();
        return action();
    }

    useEffect(() => {
        if (!expiresAt) return;
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
            setSeconds(remaining);
            if (!remaining) setExpiresAt(0);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [expiresAt]);

    return { seconds, startCooldown, resend };
}
