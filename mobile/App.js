import "react-native-gesture-handler";
import { t, useLocale } from "./src/services/i18n";
import { useState } from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    useWindowDimensions,
    View,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/Login/LoginScreen";
import RegisterScreen from "./src/screens/Register/RegisterScreen";
import DevicesScreen from "./src/screens/Devices/DevicesScreen";
import DeviceDashboardScreen from "./src/screens/DeviceDashboard/DeviceDashboardScreen";
import DeviceEditScreen from "./src/screens/DeviceEdit/DeviceEditScreen";
import UsageHistoryScreen from "./src/screens/UsageHistory/UsageHistoryScreen";
import UsageLimitsScreen from "./src/screens/UsageLimits/UsageLimitsScreen";
import ManageCategoryScreen from "./src/screens/ManageCategory/ManageCategoryScreen";
import BLEScanScreen from "./src/screens/BLEScan/BLEScanScreen";
import HomeScreen from "./src/screens/Home/HomeScreen";
import ProfileScreen from "./src/screens/Profile/ProfileScreen";
import BillingEstimationScreen from "./src/screens/BillingEstimation/BillingEstimationScreen";
import BillingSettingsScreen from "./src/screens/BillingSettings/BillingSettingsScreen";
import AlertNotificationWatcher from "./src/components/AlertNotificationWatcher";
import { floatingTabLayout } from "./src/theme/tokens";
import TabIcon from "./src/components/TabIcon";
import StartGate from "./src/components/StartGate";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_BAR_HEIGHT = 56;

function MainTabs() {
    useLocale();
    const { width: viewportWidth } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const tabBarHeight = TAB_BAR_HEIGHT;

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: false,
                tabBarAccessibilityLabel: t(route.name === "BLEScan" ? "BLE Provisioning" : route.name),
                tabBarStyle: {
                    position: "absolute",
                    ...floatingTabLayout(viewportWidth, insets.bottom),
                    borderRadius: 18,
                    borderTopWidth: 0,
                    backgroundColor: "#ffffff",
                    shadowColor: "#0d1c2f",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 4,
                    paddingTop: 0,
                    paddingBottom: 0,
                },
                tabBarItemStyle: {
                    height: tabBarHeight,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingTop: 0,
                    paddingBottom: 0,
                    margin: 0,
                },
                tabBarIconStyle: {
                    height: tabBarHeight,
                    width: 28,
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 0,
                    marginBottom: 0,
                },
                tabBarIcon: ({ focused }) => {
                    const iconMap = {
                        Home: "home-outline",
                        Devices: "water-outline",
                        BLEScan: "bluetooth-outline",
                        Profile: "person-outline",
                    };

                    const iconName = focused ? iconMap[route.name].replace("-outline", "") : iconMap[route.name];

                    return <TabIcon name={iconName} focused={focused} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Devices" component={DevicesScreen} />
            <Tab.Screen name="BLEScan" component={BLEScanScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

function RootNavigator() {
    const { isBooting, isAuthenticated } = useAuth();
    if (isBooting) {
        return <View style={styles.loadingPage}><ActivityIndicator size="large" color="#0f62fe" /></View>;
    }
    return (
        <NavigationContainer>
            {isAuthenticated ? (
                <Stack.Navigator>
                    <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
                    <Stack.Screen
                        name="DeviceDashboard"
                        component={DeviceDashboardScreen}
                        options={{ title: t("Device Dashboard") }}
                    />
                    <Stack.Screen name="DeviceEdit" component={DeviceEditScreen} options={{ title: t("Edit Device") }} />
                    <Stack.Screen
                        name="UsageHistory"
                        component={UsageHistoryScreen}
                        options={{ title: t("Usage History") }}
                    />
                    <Stack.Screen
                        name="UsageLimits"
                        component={UsageLimitsScreen}
                        options={{ title: t("Usage Limits") }}
                    />
                    <Stack.Screen
                        name="BillingEstimation"
                        component={BillingEstimationScreen}
                        options={{ title: t("Bill Estimation") }}
                    />
                    <Stack.Screen
                        name="BillingSettings"
                        component={BillingSettingsScreen}
                        options={{ title: t("Manage Water Price") }}
                    />
                    <Stack.Screen
                        name="ManageCategory"
                        component={ManageCategoryScreen}
                        options={{ title: t("Manage Category") }}
                    />
                </Stack.Navigator>
            ) : (
                <Stack.Navigator>
                    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
                </Stack.Navigator>
            )}
            <StatusBar style="dark" />
        </NavigationContainer>
    );
}

export default function App() {
    useLocale();
    const [started, setStarted] = useState(Platform.OS === "web");

    return (
        <SafeAreaProvider>
            <AuthProvider>
                <AlertNotificationWatcher />
                {!started ? <StartGate onStart={() => setStarted(true)} /> : <RootNavigator />}
            </AuthProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loadingPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f4f8ff",
    },
    tabIconWrap: {
        width: 44,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    tabIconWrapNative: {
        transform: [{ translateY: -4 }],
    },
    tabIconWrapWebCompact: {
        transform: [{ translateY: -4 }],
    },
});
