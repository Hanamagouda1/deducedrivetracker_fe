// HomeScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StatusBar,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Text,
  Switch,
  Platform,
  PermissionsAndroid,
  BackHandler,
} from "react-native";
import MapViewComponent from "../components/MapViewComponent";
import DriveHistoryList from "../components/DriveHistoryList";
import UploadModal from "../components/UploadModal";
import ToastComponent from "../components/ToastComponent";
import useToast from "../utils/useToast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { calculateDistance } from "../utils/distance";
import Geolocation from "@react-native-community/geolocation";
import axios from "axios";
import styles from "../styles/HomeScreen.styles";

const API_BASE = "https://deduce-drive-tracker-be.onrender.com";

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();

  /** Toast */
  const { toast, showToast, fadeAnim } = useToast();

  /** THEME */
  const [isDarkMode, setIsDarkMode] = useState(false);

  const theme = isDarkMode
    ? {
        background: "#121212",
        card: "#1E1E1E",
        text: "#FFFFFF",
        header: "#1F1F1F",
        footer: "#1F1F1F",
        icon: "#FFFFFF",
        buttonStart: "#3BA55D",
        buttonStop: "#D9534F",
        border: "rgba(255,255,255,0.15)",
      }
    : {
        background: "#F4F6FB",
        card: "#FFFFFF",
        text: "#0B1A2B",
        header: "#007AFF",
        footer: "#007AFF",
        icon: "#FFFFFF",
        buttonStart: "#28A745",
        buttonStop: "#DC3545",
        border: "rgba(0,0,0,0.1)",
      };

  /** STATES */
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnim] = useState(() => new Animated.Value(0));
  const [userInfo, setUserInfo] = useState<any>(null);

  const [tracking, setTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const [currentDriveTrack, setCurrentDriveTrack] = useState<any[]>([]);
  const [driveStopped, setDriveStopped] = useState(false);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [todayKm, setTodayKm] = useState("0.0");
  const [totalKm, setTotalKm] = useState("0.0");

  const webRef = useRef<any>(null);

  /** Send data to Map */
  const postToMap = useCallback(
    (obj: any) => {
      if (webRef.current && isMapReady)
        webRef.current.postMessage(JSON.stringify(obj));
    },
    [isMapReady]
  );

  useEffect(() => {
    if (!isMapReady) return;

    postToMap({
      type: "modeChange",
      payload: { isDarkMode },
    });
  }, [isDarkMode, isMapReady, postToMap]);


  /** LOAD USER */
  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await AsyncStorage.getItem("userInfo");
        if (u) {
          setUserInfo(JSON.parse(u));
        } else {
          showToast("Session missing. Login again", "error");
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Login" as never }],
            })
          );
        }
      } catch (err) {
        console.warn(err);
      }
    };
    loadUser();
  }, [navigation, showToast]);

  /** ANDROID BACK BUTTON */
  useEffect(() => {
    const backAction = () => {
      BackHandler.exitApp();
      return true;
    };

    const handler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => handler.remove();
  }, []);

  /** MENU */
  const toggleMenu = () => {
    setMenuVisible((prev) => !prev);
    Animated.timing(menuAnim, {
      toValue: menuVisible ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  /** MAP READY */
  const onMapReady = useCallback(() => setIsMapReady(true), []);

  /** STATS */
  const fetchStats = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const resTotal = await axios.get(`${API_BASE}/drive/total-km`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resToday = await axios.get(`${API_BASE}/drive/today-km`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setTotalKm(String(resTotal.data.total_km ?? 0));
      setTodayKm(String(resToday.data.today_km ?? 0));
    } catch (err) {
      console.warn("stats error:", err);
    }
  }, []);

  useEffect(() => {
    if (userInfo?.employee_id) fetchStats();
  }, [userInfo, fetchStats]);

  /** SELECT SESSION */
  const handleSelectSession = useCallback(
    async (sessionId: number) => {
      try {
        const token = await AsyncStorage.getItem("accessToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const res = await axios.get(
          `${API_BASE}/drive/session/${sessionId}`,
          { headers }
        );

        const data = res.data;

        let points = data.points || data.track_points || null;

        if ((!points || !Array.isArray(points)) && data.meta_data) {
          try {
            const parsed =
              typeof data.meta_data === "string"
                ? JSON.parse(data.meta_data)
                : data.meta_data;
            points =
              parsed.points ||
              parsed.track_points ||
              parsed.path ||
              [];
          } catch {
            points = [];
          }
        }

        const norm = Array.isArray(points)
          ? points
              .map((p: any) => ({
                lat: Number(p.lat ?? p.latitude ?? p[0]),
                lng: Number(p.lng ?? p.longitude ?? p[1]),
              }))
              .filter((x) => !isNaN(x.lat) && !isNaN(x.lng))
          : [];

        if (norm.length === 0) {
          showToast("No track points found", "info");
          return;
        }

        postToMap({ type: "clear" });
        postToMap({
          type: "displayTrack",
          payload: {
            session_id: sessionId,
            points: norm,
            meta: {
              start_time: data.start_time,
              end_time: data.end_time,
              total_km: data.total_km,
            },
            color: "#ff6b00",
          },
        });
      } catch (err) {
        console.warn("session error", err);
        showToast("Failed to fetch session", "error");
      }
    },
    [postToMap, showToast]
  );

  /** LOCATION PERMISSION */
  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }, []);

  /** START TRACKING */
  const startTracking = useCallback(async () => {
    if (tracking) return;

    const ok = await requestLocationPermission();
    if (!ok) {
      showToast("Location permission denied", "error");
      return;
    }

    setCurrentDriveTrack([]);
    setTracking(true);
    setDriveStopped(false);

    showToast("Drive started", "success");

    Geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        };
        setCurrentDriveTrack([loc]);
        postToMap({
          type: "startLive",
          payload: { startLocation: [loc.lat, loc.lng] },
        });
      },
      () => showToast("GPS error", "error"),
      { enableHighAccuracy: true }
    );

    watchIdRef.current = Geolocation.watchPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        };
        setCurrentDriveTrack((prev) => [...prev, p]);
        postToMap({ type: "coord", payload: p });
      },
      () => showToast("GPS error", "error"),
      { enableHighAccuracy: true, distanceFilter: 1 }
    );
  }, [postToMap, requestLocationPermission, tracking, showToast]);

  /** STOP TRACKING */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTracking(false);
    setDriveStopped(true);

    if (currentDriveTrack.length < 2) {
      showToast("Drive too short", "info");
      setCurrentDriveTrack([]);
      setDriveStopped(false);
      return;
    }

    showToast("Drive stopped", "info");
  }, [currentDriveTrack, showToast]);

  /** UPLOAD DRIVE */
  const handleUpload = useCallback(async () => {
    if (currentDriveTrack.length < 2) {
      showToast("Not enough points", "error");
      return;
    }

    setUploading(true);

    try {
      const token = await AsyncStorage.getItem("accessToken");

      const payload = {
        userId: userInfo?.id,
        employeeId: userInfo?.employee_id,
        employeeName: userInfo?.employee_name,
        email: userInfo?.email,
        phone: userInfo?.phone ?? null,

        startTime: currentDriveTrack[0].timestamp,
        endTime: currentDriveTrack[currentDriveTrack.length - 1].timestamp,

        trackPoints: currentDriveTrack.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          timestamp: p.timestamp,
          speed: p.speed ?? null,
          heading: p.heading ?? null,
        })),

        distance: calculateDistance(currentDriveTrack),
      };

      const res = await axios.post(`${API_BASE}/drive/add-point`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.status === 200 || res.status === 201) {
        showToast("Drive uploaded", "success");
        setUploadModalVisible(false);
        setDriveStopped(false);
        setCurrentDriveTrack([]);
        fetchStats();
      } else {
        showToast("Upload failed", "error");
      }
    } catch {
      showToast("Upload error", "error");
    } finally {
      setUploading(false);
    }
  }, [currentDriveTrack, userInfo, fetchStats, showToast]);

  /** LOGOUT */
  const handleLogout = async () => {
    await AsyncStorage.removeItem("accessToken");
    await AsyncStorage.removeItem("userInfo");
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Login" as never }],
      })
    );
  };

  /** MAP MESSAGE */
  const onWebMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "mapReady") setIsMapReady(true);
    } catch {}
  }, []);

  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-250, 0],
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.header, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={toggleMenu}>
          <Image
            source={{
              uri: menuVisible
                ? "https://img.icons8.com/ios-filled/50/ffffff/delete-sign.png"
                : "https://img.icons8.com/ios-filled/50/ffffff/menu--v1.png",
            }}
            style={[styles.icon, { tintColor: theme.icon }]}
          />
        </TouchableOpacity>

        <View style={styles.logoUserContainer}>
          <Image
            source={require("../assets/CompanyLogo.png")}
            style={styles.logo}
          />
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.icon }]}>
              {userInfo?.employee_name || "User"}
            </Text>
            <Text style={[styles.userId, { color: theme.icon }]}>
              {userInfo?.employee_id || "--"}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => setLogoutModalVisible(true)}>
          <Image
            source={{
              uri: "https://img.icons8.com/ios-filled/50/ffffff/logout-rounded.png",
            }}
            style={[styles.icon, { tintColor: theme.icon }]}
          />
        </TouchableOpacity>
      </View>

      {/* MENU */}
      {menuVisible && (
        <Animated.View
          style={{
            position: "absolute",
            top: 80,
            left: 10,
            right: 10,
            backgroundColor: theme.card,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.border,
            zIndex: 90,
            transform: [{ translateY: menuTranslateY }],
          }}
        >
          <Text style={{ fontWeight: "700", color: theme.text }}>
            Drive Statistics
          </Text>
          <Text style={{ color: theme.text }}>Today: {todayKm} km</Text>
          <Text style={{ color: theme.text }}>Total: {totalKm} km</Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <Text style={{ color: theme.text }}>Dark Mode</Text>
            <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
          </View>

          <DriveHistoryList
            apiBase={API_BASE}
            show={menuVisible}
            onSelectSession={handleSelectSession}
            showToast={(m, t) => showToast(m, t)}
          />
        </Animated.View>
      )}

      {/* MAP */}
      <View style={{ flex: 1 }}>
        <MapViewComponent
          refForward={webRef}
          onMapReady={onMapReady}
          onMessage={onWebMessage}
        />
      </View>

      {/* FOOTER */}
      <View
        style={[
          styles.footer,
          { backgroundColor: theme.footer, borderTopColor: theme.border },
        ]}
      >
        {!driveStopped ? (
          <>
            <TouchableOpacity
              onPress={stopTracking}
              disabled={!tracking}
              style={[styles.stopButton, { backgroundColor: theme.buttonStop }]}
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>
                ⏹ Stop
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={startTracking}
              disabled={tracking}
              style={[styles.startButton, { backgroundColor: theme.buttonStart }]}
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>
                {tracking ? "Tracking..." : "▶ Start"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={() => setUploadModalVisible(true)}
            style={[styles.startButton, { backgroundColor: theme.buttonStart }]}
          >
            <Text style={[styles.buttonText, { color: "#fff" }]}>
              📤 Upload Drive
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* TOAST */}
      <ToastComponent toast={toast} fadeAnim={fadeAnim} />

      {/* UPLOAD MODAL */}
      <UploadModal
        visible={uploadModalVisible}
        uploading={uploading}
        theme={{ background: theme.card, text: theme.text }}
        onClose={() => setUploadModalVisible(false)}
        onUpload={handleUpload}
      />

      {/* LOGOUT MODAL */}
      <Modal visible={logoutModalVisible} transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000080",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              padding: 20,
              borderRadius: 12,
              width: "75%",
            }}
          >
            <Text
              style={{ fontWeight: "700", fontSize: 18, color: theme.text }}
            >
              Confirm Logout
            </Text>
            <Text style={{ marginTop: 10, color: theme.text }}>
              Are you sure?
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                marginTop: 20,
              }}
            >
              <TouchableOpacity
                onPress={() => setLogoutModalVisible(false)}
                style={{
                  padding: 10,
                  backgroundColor: "#6c757d",
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogout}
                style={{
                  padding: 10,
                  backgroundColor: "#dc3545",
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff" }}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HomeScreen;
