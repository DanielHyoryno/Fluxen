// Presentation only: both the live screens and the guide use these panels.
// Bluetooth, API requests and form validation stay in the screen containers.
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import CategoryDropdown from "./CategoryDropdown";
import { t } from "../services/i18n";
import deviceStyles from "../screens/Devices/styles";
import bleStyles from "../screens/BLEScan/styles";

export function DeviceScanCard({ messages, onScan }) {
    return <View style={deviceStyles.scanHeroCard}>
        <View style={deviceStyles.scanHeroTextWrap}>
            <Text style={deviceStyles.scanHeroTitle}>{messages.devices.prepareDeviceTitle}</Text>
            <Text style={deviceStyles.scanHeroSubtitle}>{messages.devices.prepareDeviceSubtitle}</Text>
        </View>
        <Pressable style={deviceStyles.scanHeroButton} onPress={onScan}>
            <Text style={deviceStyles.scanHeroButtonText}>{messages.devices.scanBle}</Text>
        </Pressable>
    </View>;
}

export function DeviceSectionSwitch({ messages, activeSection, onChange }) {
    return <View style={deviceStyles.sectionSwitchWrap}>
        {["list", "manage"].map((section) => <Pressable key={section}
            style={[deviceStyles.sectionSwitchButton, activeSection === section && deviceStyles.sectionSwitchButtonActive]}
            onPress={() => onChange?.(section)}>
            <Text style={[deviceStyles.sectionSwitchText, activeSection === section && deviceStyles.sectionSwitchTextActive]}>
                {section === "list" ? messages.devices.listTab : messages.devices.manageTab}
            </Text>
        </Pressable>)}
    </View>;
}

export function DeviceCategoryCard({ messages, onManage }) {
    return <View style={deviceStyles.categoryBox}>
        <Text style={deviceStyles.createTitle}>{messages.devices.categoryTitle}</Text>
        <Text style={deviceStyles.categoryHelpText}>{messages.devices.categoryHelp}</Text>
        <Pressable style={deviceStyles.manageCategoryButton} onPress={onManage}>
            <Text style={deviceStyles.manageCategoryButtonText}>{messages.devices.manageCategory}</Text>
        </Pressable>
    </View>;
}

export function AddDeviceForm({ messages, deviceCode = "", deviceName = "", location = "", categories = [],
    selectedCategoryId = null, fieldErrors = {}, creating = false, newToken, onCodeChange, onNameChange,
    onLocationChange, onCategoryChange, onCreate, onShowToken, readOnly = false }) {
    return <View style={deviceStyles.createBox}>
        <Text style={deviceStyles.createTitle}>{messages.devices.addDeviceTitle}</Text>
        {[
            ["deviceCode", deviceCode, onCodeChange, messages.devices.deviceCodePlaceholder],
            ["deviceName", deviceName, onNameChange, messages.devices.deviceNamePlaceholder],
            ["location", location, onLocationChange, messages.devices.locationPlaceholder],
        ].map(([key, value, onChangeText, placeholder]) => <View key={key}>
            <TextInput style={[deviceStyles.input, fieldErrors[key] && deviceStyles.inputError]}
                value={value} onChangeText={onChangeText} placeholder={placeholder}
                placeholderTextColor="#8aa0b8" editable={!readOnly}
                {...(key === "deviceCode" ? { autoCapitalize: "characters" } : {})} />
            {fieldErrors[key] ? <Text style={deviceStyles.fieldError}>{fieldErrors[key]}</Text> : null}
        </View>)}
        <Text style={deviceStyles.categoryLabel}>{messages.devices.assignCategory}</Text>
        <CategoryDropdown categories={categories} value={selectedCategoryId} onChange={onCategoryChange}
            emptyLabel={messages.devices.uncategorized} label={messages.devices.assignCategory} />
        <Pressable style={deviceStyles.primaryButton} onPress={onCreate} disabled={creating}>
            {creating ? <ActivityIndicator color="#fff" /> : <Text style={deviceStyles.primaryText}>{messages.devices.createDevice}</Text>}
        </Pressable>
        {newToken ? <>
            <Text style={deviceStyles.meta}>{messages.devices.newTokenHint}</Text>
            <Pressable style={deviceStyles.showTokenButton} onPress={onShowToken}>
                <Text style={deviceStyles.showTokenButtonText}>{messages.devices.showApiToken}</Text>
            </Pressable>
        </> : null}
    </View>;
}

export function DeviceTokenCard({ messages, token, onProvision, onCopy, onClose }) {
    return <View testID="device-token-card" style={deviceStyles.modalCard}>
        <View style={deviceStyles.modalHeader}>
            <Text style={deviceStyles.modalTitle}>{messages.devices.tokenTitle}</Text>
            <Pressable style={deviceStyles.closeDialogButton} onPress={onClose}
                accessibilityRole="button" accessibilityLabel={messages.devices.tokenClose}>
                <Text style={deviceStyles.closeDialogButtonText} accessible={false}>×</Text>
            </Pressable>
        </View>
        <Text style={deviceStyles.modalSubtitle}>{messages.devices.tokenSubtitle}</Text>
        <View style={deviceStyles.tokenBox}><Text style={deviceStyles.tokenValue} selectable>{token}</Text></View>
        <Pressable style={deviceStyles.copyTokenButton} onPress={onCopy} accessibilityRole="button">
            <Text style={deviceStyles.copyTokenButtonText}>{messages.auth.copyToken || t("Copy Token")}</Text>
        </Pressable>
        <View style={deviceStyles.modalActions}>
            <Pressable style={deviceStyles.provisionTokenButton} onPress={onProvision} accessibilityRole="button">
                <Text style={deviceStyles.provisionTokenButtonText}>{messages.devices.provisionViaBle}</Text>
            </Pressable>
        </View>
    </View>;
}

export function BleDeviceItem({ item, onPress, connecting }) {
    return <Pressable style={bleStyles.card} onPress={() => onPress?.(item)} disabled={connecting}>
        <View style={bleStyles.cardHeader}>
            <Text style={bleStyles.deviceName}>{item.name || t("Unknown device")}</Text>
            {connecting ? <ActivityIndicator color="#0f62fe" size="small" /> : null}
        </View>
        <Text style={bleStyles.meta}>ID: {item.id}</Text>
        <Text style={bleStyles.meta}>RSSI: {item.rssi ?? "-"} dBm</Text>
    </Pressable>;
}

export function BleScanPanel({ isScanning, permissionGranted, scanError, onScan, children }) {
    return <View style={bleStyles.card}>
        <Text style={bleStyles.sectionTitle}>{t("Scan for Devices")}</Text>
        <Pressable style={[bleStyles.primaryButton, isScanning && bleStyles.primaryButtonDisabled]}
            onPress={onScan} disabled={isScanning || !permissionGranted}>
            {isScanning ? <ActivityIndicator color="#fff" /> : <Text style={bleStyles.primaryText}>{t("Scan for Devices")}</Text>}
        </Pressable>
        {isScanning ? <Text style={bleStyles.meta}>{t("Scanning... auto-stop in 15 seconds.")}</Text> : null}
        {scanError ? <Text style={bleStyles.error}>{scanError}</Text> : null}
        {children}
    </View>;
}

export function BleConnectionCard({ connectedDevice, onDisconnect }) {
    return <View style={bleStyles.card}>
        <Text style={bleStyles.sectionTitle}>{t("Connection")}</Text>
        <Text style={bleStyles.meta}>{t("Status:")}{"  "}
            {connectedDevice ? t("connectedDevice", { name: connectedDevice.name || connectedDevice.id }) : t("Not connected")}
        </Text>
        {connectedDevice ? <Pressable style={bleStyles.secondaryButton} onPress={onDisconnect}>
            <Text style={bleStyles.secondaryText}>{t("Disconnect")}</Text>
        </Pressable> : null}
    </View>;
}

export function BleProvisionForm({ deviceCode, wifiSsid, wifiPassword, serverUrl, apiToken,
    onSsidChange, onPasswordChange, onServerChange, onTokenChange, canSendConfig, sendingConfig,
    onSend, codeOnly = false, readOnly = false }) {
    return <View style={bleStyles.card}>
        <Text style={bleStyles.sectionTitle}>{t("Provisioning")}</Text>
        <Text style={bleStyles.metaLabel}>{t("Device code")}</Text>
        <View style={bleStyles.readOnlyBox}>
            <Text style={bleStyles.readOnlyText}>{deviceCode || t("Reading...")}</Text>
        </View>
        {!codeOnly ? <>
            {[
                ["WiFi SSID", wifiSsid, onSsidChange, t("Enter WiFi SSID")],
                ["WiFi Password", wifiPassword, onPasswordChange, t("Enter WiFi password")],
                ["Server URL", serverUrl, onServerChange, "http://192.168.1.10:8080"],
                ["API Token", apiToken, onTokenChange, t("Paste device API token")],
            ].map(([label, value, onChangeText, placeholder]) => <View key={label}>
                <Text style={bleStyles.metaLabel}>{t(label)}</Text>
                <TextInput style={bleStyles.input} value={value} onChangeText={onChangeText}
                    placeholder={placeholder} placeholderTextColor="#8aa0b8" autoCapitalize="none"
                    secureTextEntry={label === "WiFi Password"} editable={!readOnly} />
            </View>)}
            <Pressable style={[bleStyles.primaryButton, !canSendConfig && bleStyles.primaryButtonDisabled]}
                onPress={onSend} disabled={!canSendConfig}>
                {sendingConfig ? <ActivityIndicator color="#fff" /> : <Text style={bleStyles.primaryText}>{t("Send Configuration")}</Text>}
            </Pressable>
        </> : null}
    </View>;
}
