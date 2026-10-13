import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import DeviceTutorial from "../components/DeviceTutorial";
import { getDeviceTutorialSeen, saveDeviceTutorialSeen } from "../services/storage";

const DeviceTutorialContext = createContext(null);

export function DeviceTutorialProvider({ enabled, children }) {
    const [visible, setVisible] = useState(false);
    const dismissedThisSession = useRef(false);

    useEffect(() => {
        let active = true;
        if (!enabled) {
            setVisible(false);
            return;
        }
        if (dismissedThisSession.current) return;
        getDeviceTutorialSeen().catch(() => false).then((seen) => {
            if (active && !seen && !dismissedThisSession.current) setVisible(true);
        });
        return () => { active = false; };
    }, [enabled]);

    const openTutorial = useCallback(() => {
        if (enabled) setVisible(true);
    }, [enabled]);

    const closeTutorial = useCallback(() => {
        dismissedThisSession.current = true;
        setVisible(false);
        // A failed local write should never prevent leaving the guide.
        saveDeviceTutorialSeen().catch(() => {});
    }, []);

    return (
        <DeviceTutorialContext.Provider value={{ openTutorial }}>
            {children}
            {enabled && visible ? <DeviceTutorial onClose={closeTutorial} /> : null}
        </DeviceTutorialContext.Provider>
    );
}

export function useDeviceTutorial() {
    return useContext(DeviceTutorialContext);
}
