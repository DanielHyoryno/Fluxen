import { useContext } from "react";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

export default function usePageInsets() {
    const insets = useContext(SafeAreaInsetsContext) || { top: 0, bottom: 0 };
    return { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 };
}
