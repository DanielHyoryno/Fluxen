import { Text, View } from "react-native";
import { formatValue, t } from "../services/i18n";
import StatusBadge from "./StatusBadge";
import styles from "../screens/Home/styles";

export default function HomeDeviceReading({ item }) {
    return <>
        <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{item.device_name}</Text>
            <Text style={styles.deviceMeta}>{t("Code:")} {item.device_code}</Text>
            <View style={{ marginTop: 6 }}><StatusBadge online={item.online} /></View>
        </View>
        <Text style={styles.deviceUsage}>{formatValue(item.usageLiters, 3)} L</Text>
    </>;
}
