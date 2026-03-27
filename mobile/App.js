import "react-native-gesture-handler";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_BAR_HEIGHT = 62;

function StartGate({ onStart }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const blobA = useRef(new Animated.Value(0)).current;
  const blobB = useRef(new Animated.Value(0)).current;
  const hintFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    const bgLoopA = Animated.loop(
      Animated.sequence([
        Animated.timing(blobA, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
        Animated.timing(blobA, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
      ])
    );

    const bgLoopB = Animated.loop(
      Animated.sequence([
        Animated.timing(blobB, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
        Animated.timing(blobB, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
      ])
    );

    bgLoopA.start();
    bgLoopB.start();

    const hintLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintFloat, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
        Animated.timing(hintFloat, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
      ])
    );

    hintLoop.start();

    return () => {
      loop.stop();
      bgLoopA.stop();
      bgLoopB.stop();
      hintLoop.stop();
    };
  }, [fade, rise, pulse, blobA, blobB, hintFloat]);

  const blobATransform = {
    transform: [
      {
        translateX: blobA.interpolate({
          inputRange: [0, 1],
          outputRange: [-14, 14],
        }),
      },
      {
        translateY: blobA.interpolate({
          inputRange: [0, 1],
          outputRange: [10, -10],
        }),
      },
      {
        scale: blobA.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.04],
        }),
      },
    ],
  };

  const blobBTransform = {
    transform: [
      {
        translateX: blobB.interpolate({
          inputRange: [0, 1],
          outputRange: [16, -12],
        }),
      },
      {
        translateY: blobB.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 12],
        }),
      },
      {
        scale: blobB.interpolate({
          inputRange: [0, 1],
          outputRange: [1.03, 0.97],
        }),
      },
    ],
  };

  const hintTransform = {
    transform: [
      {
        translateY: hintFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
      },
    ],
  };

  return (
    <Pressable style={styles.startPage} onPress={onStart}>
      <Animated.View style={[styles.bgBlobA, blobATransform]} />
      <Animated.View style={[styles.bgBlobB, blobBTransform]} />
      <Animated.View style={[styles.bgBlobC, blobATransform]} />
      <Animated.View
        style={{
          opacity: fade,
          transform: [{ translateY: rise }, { scale: pulse }],
          alignItems: "center",
        }}
      >
        <Text style={styles.startTitle}>Water Monitor</Text>
        <Text style={styles.startSubtitle}>IoT Telemetry Dashboard</Text>
      </Animated.View>
      <Animated.View style={[styles.bottomHint, hintTransform]}>
        <Text style={styles.bottomHintText}>Tap anywhere to start</Text>
        <Text style={styles.bottomHintArrow}>↓</Text>
      </Animated.View>
      <StatusBar style="dark" />
    </Pressable>
  );
}

function RootNavigator() {
  const { isBooting, isAuthenticated } = useAuth();

  if (isBooting) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color="#0f62fe" />
      </View>
    );
  }

  function MainTabs() {
    const { width: viewportWidth } = useWindowDimensions();
    const isWeb = Platform.OS === "web";
    const isCompactViewport = viewportWidth <= 520;
    const isDesktopViewport = viewportWidth >= 980;

    const tabBarHorizontalInset = isCompactViewport ? 10 : 14;
    const tabBarBottomInset = isCompactViewport ? 10 : 14;
    const tabBarHeight = isCompactViewport ? 58 : TAB_BAR_HEIGHT;
    const desktopTabBarWidth = Math.min(680, Math.max(440, Math.floor(viewportWidth * 0.62)));

    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: "absolute",
            left: isDesktopViewport && isWeb ? undefined : tabBarHorizontalInset,
            right: isDesktopViewport && isWeb ? undefined : tabBarHorizontalInset,
            width: isDesktopViewport && isWeb ? desktopTabBarWidth : undefined,
            alignSelf: isDesktopViewport && isWeb ? "center" : undefined,
            bottom: tabBarBottomInset,
            height: tabBarHeight,
            borderRadius: 18,
            borderTopWidth: 0,
            backgroundColor: "#ffffff",
            shadowColor: "#0d1c2f",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 14,
            elevation: 8,
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
            width: 32,
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
            const color = focused ? "#0f62fe" : "#67809a";

            return (
              <View
                style={[
                  styles.tabIconWrap,
                  isWeb && isCompactViewport && styles.tabIconWrapWebCompact,
                  !isWeb && styles.tabIconWrapNative,
                ]}
              >
                <Ionicons name={iconName} size={22} color={color} />
              </View>
            );
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

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="DeviceDashboard"
            component={DeviceDashboardScreen}
            options={{ title: "Device Dashboard" }}
          />
          <Stack.Screen name="DeviceEdit" component={DeviceEditScreen} options={{ title: "Edit Device" }} />
          <Stack.Screen name="UsageHistory" component={UsageHistoryScreen} options={{ title: "Usage History" }} />
          <Stack.Screen
            name="UsageLimits"
            component={UsageLimitsScreen}
            options={{ title: "Usage Limits" }}
          />
          <Stack.Screen name="ManageCategory" component={ManageCategoryScreen} options={{ title: "Manage Category" }} />
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
  const [started, setStarted] = useState(false);

  if (!started) {
    return <StartGate onStart={() => setStarted(true)} />;
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f8ff",
  },
  startPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f8ff",
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  bgBlobA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 140,
    backgroundColor: "rgba(66, 133, 244, 0.16)",
    top: -70,
    left: -70,
  },
  bgBlobB: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 150,
    backgroundColor: "rgba(15, 98, 254, 0.11)",
    bottom: -90,
    right: -60,
  },
  bgBlobC: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 80,
    backgroundColor: "rgba(41, 121, 255, 0.12)",
    top: 120,
    right: 40,
  },
  startTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#17324d",
    letterSpacing: 0.2,
  },
  startSubtitle: {
    marginTop: 10,
    marginBottom: 30,
    color: "#4f6982",
    fontSize: 15,
  },
  bottomHint: {
    position: "absolute",
    bottom: 34,
    alignItems: "center",
  },
  bottomHintText: {
    color: "#35506d",
    fontWeight: "700",
    fontSize: 13,
  },
  bottomHintArrow: {
    marginTop: 4,
    color: "#0f62fe",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },
  tabIconWrap: {
    width: 28,
    height: 28,
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
