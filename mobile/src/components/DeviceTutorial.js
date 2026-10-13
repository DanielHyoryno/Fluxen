import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMessages } from "../constants/messages";
import { formatValue, t, useLocale } from "../services/i18n";
import { colors, floatingTabBarStyle } from "../theme/tokens";
import { AddDeviceForm, BleConnectionCard, BleDeviceItem, BleProvisionForm, BleScanPanel,
    DeviceCategoryCard, DeviceScanCard, DeviceSectionSwitch, DeviceTokenCard } from "./DeviceSetupPanels";
import HomeDeviceReading from "./HomeDeviceReading";
import MetricGrid from "./MetricGrid";
import TabIcon from "./TabIcon";
import deviceStyles from "../screens/Devices/styles";
import bleStyles from "../screens/BLEScan/styles";
import homeStyles from "../screens/Home/styles";

const steps = [
    { title: "tutorialScanTitle", body: "tutorialScanBody" },
    { title: "tutorialCodeTitle", body: "tutorialCodeBody" },
    { title: "tutorialAddTitle", body: "tutorialAddBody" },
    { title: "tutorialTokenTitle", body: "tutorialTokenBody" },
    { title: "tutorialWifiTitle", body: "tutorialWifiBody" },
    { title: "tutorialMonitorTitle", body: "tutorialMonitorBody" },
];

function ExampleNavigation({ active }) {
    const tabs = [
        ["home-outline", "home"],
        ["water-outline", "devices"],
        ["bluetooth-outline", "bluetooth"],
        ["person-outline", "profile"],
    ];
    return (
        <View style={[floatingTabBarStyle(393), styles.exampleNavigation]}>
            <View style={styles.exampleNavigationItems}>
            {tabs.map(([icon, id]) => (
                <View key={id} style={styles.exampleTab}>
                    <TabIcon name={active === id ? icon.replace("-outline", "") : icon} focused={active === id} />
                </View>
            ))}
            </View>
        </View>
    );
}

function TutorialExample({ step, messages }) {
    const code = "BV-ESP32-01";
    const device = { id: "AA:BB:CC:DD:EE:01", name: "WaterMeter-ESP32", rssi: -45 };
    const isDevices = step === 0 || step === 2;
    const pageStyles = isDevices ? deviceStyles : step === 5 ? homeStyles : bleStyles;
    const title = isDevices ? messages.devices.pageTitle : step === 5 ? messages.home.pageTitle : t("BLE Provisioning");
    const subtitle = isDevices ? messages.devices.pageSubtitle : step === 5 ? messages.home.subtitle : t("Scan and configure nearby WaterMeter ESP32 devices");
    return (
        <View testID="iot-tutorial-preview" style={styles.example} pointerEvents="none"
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.exampleCaption}>{t("tutorialExample")}</Text>
            {step === 3 ? <View style={[deviceStyles.modalBackdrop, styles.tokenBackdrop]}>
                <DeviceTokenCard messages={messages} token="•••• •••• •••• ••••" />
            </View> : <>
            <View style={styles.exampleBody}>
                <View style={pageStyles.header}>
                    <View style={isDevices ? deviceStyles.headerTitleBlock : null}>
                    <Text style={pageStyles.title}>{title}</Text>
                    <Text style={pageStyles.subtitle}>{subtitle}</Text>
                    </View>
                </View>
                {isDevices ? <>
                    <DeviceScanCard messages={messages} />
                    <DeviceSectionSwitch messages={messages} activeSection={step === 2 ? "manage" : "list"} />
                    {step === 2 ? <>
                        <DeviceCategoryCard messages={messages} />
                        <AddDeviceForm messages={messages} deviceCode={code} readOnly />
                    </> : null}
                </> : null}
                {step === 1 ? <>
                    <BleScanPanel permissionGranted><BleDeviceItem item={device} /></BleScanPanel>
                    <BleConnectionCard connectedDevice={device} />
                    <BleProvisionForm deviceCode={code} codeOnly readOnly />
                </> : null}
                {step === 4 ? <>
                    <BleConnectionCard connectedDevice={device} />
                    <BleProvisionForm deviceCode={code} wifiSsid="Wi-Fi" wifiPassword="example123"
                        serverUrl="https://fluxen.onrender.com" apiToken={t("tutorialAutoFilled")}
                        canSendConfig readOnly />
                </> : null}
                {step === 5 ? <>
                    <MetricGrid accent items={[
                        { label: messages.home.totalUsage, value: `${formatValue(12.35, 3)} L` },
                        { label: messages.home.onlineOffline, value: "1 / 0" },
                    ]} />
                    <View style={homeStyles.card}>
                        <Text style={homeStyles.cardTitle}>{messages.home.deviceStatus}</Text>
                        <View style={homeStyles.deviceRow}>
                            <HomeDeviceReading item={{ device_name: "WaterMeter-ESP32", device_code: code, online: true, usageLiters: 12.35 }} />
                        </View>
                    </View>
                </> : null}
            </View>
            <ExampleNavigation active={isDevices ? "devices" : step === 5 ? "home" : "bluetooth"} />
            </>}
        </View>
    );
}

export default function DeviceTutorial({ onClose }) {
    const locale = useLocale();
    const messages = getMessages(locale);
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState(0);
    const scroll = useRef(null);
    function goTo(next) {
        setStep(next);
        scroll.current?.scrollTo({ y: 0, animated: false });
    }
    return (
        <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
            <View testID="iot-tutorial" style={[styles.page, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={styles.header}>
                    <Text style={styles.guideTitle}>{t("deviceTutorialTitle")}</Text>
                    <Pressable onPress={onClose} accessibilityRole="button" style={styles.skip}>
                        <Text style={styles.skipText}>{t("tutorialSkip")}</Text>
                    </Pressable>
                </View>
                <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <Text style={styles.stepCount}>{step + 1} / {steps.length}</Text>
                    <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.heading}>{t(steps[step].title)}</Text>
                    <Text style={styles.description}>{t(steps[step].body)}</Text>
                    <TutorialExample step={step} messages={messages} />
                </ScrollView>
                <View style={styles.footer}>
                    {step > 0 ? <Pressable accessibilityRole="button" style={styles.back} onPress={() => goTo(step - 1)}>
                        <Text style={styles.backText}>{t("tutorialBack")}</Text>
                    </Pressable> : null}
                    <Pressable accessibilityRole="button" accessibilityLabel={t(step === steps.length - 1 ? "tutorialDone" : "tutorialNext")}
                        style={styles.next} onPress={() => step === steps.length - 1 ? onClose() : goTo(step + 1)}>
                        <Text style={styles.nextText}>{t(step === steps.length - 1 ? "tutorialDone" : "tutorialNext")}</Text>
                        <Ionicons accessible={false} name={step === steps.length - 1 ? "checkmark" : "arrow-forward"} size={18} color={colors.surface} />
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 8, gap: 8 },
    guideTitle: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    skip: { minHeight: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
    skipText: { color: colors.textMuted, fontSize: 14 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
    stepCount: { color: colors.primary, fontSize: 13, fontWeight: "700", marginBottom: 8 },
    heading: { color: colors.text, fontSize: 24, lineHeight: 31, fontWeight: "800", marginBottom: 10 },
    description: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 20 },
    // Keep the preview at the real screen width: the inner 16px gutter and
    // typography are exactly the ones used by the live screens.
    example: { marginHorizontal: -20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    exampleCaption: { fontSize: 11, color: colors.textMuted, paddingHorizontal: 16, paddingTop: 12, marginBottom: 12 },
    exampleBody: { paddingHorizontal: 16 },
    tokenBackdrop: { flex: undefined, minHeight: 260 },
    exampleNavigation: { position: "relative", start: 0, end: 0, bottom: 0, marginHorizontal: 16, marginTop: 4, marginBottom: 16 },
    exampleNavigationItems: { flex: 1, flexDirection: "row" },
    exampleTab: { flex: 1, height: 56, alignItems: "center", justifyContent: "center" },
    footer: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border },
    back: { flex: 1, minHeight: 48, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    backText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    next: { flex: 1, minHeight: 48, padding: 12, backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8 },
    nextText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
});
