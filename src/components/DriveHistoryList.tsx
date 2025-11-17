// components/DriveHistoryList.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* -----------------------------
   TYPES
------------------------------ */
export type DriveSession = {
  id: number;
  start_time?: string;
  end_time?: string;
  total_km?: number;
  meta_data?: any;
};

type Props = {
  apiBase: string;
  show: boolean;
  onSelectSession: (id: number) => void;
  showToast?: (m: string, t?: "info" | "success" | "error") => void;
};

/* -----------------------------
   EMPTY COMPONENT
------------------------------ */
const EmptySessions = () => (
  <Text
    style={{
      color: "#888",
      textAlign: "center",
      marginTop: 10,
      fontSize: 14,
    }}
  >
    No sessions available for selected date.
  </Text>
);

/* -----------------------------
   MERGED DriveHistoryItem
------------------------------ */
const DriveHistoryItem = ({
  item,
  expanded,
  onExpand,
  onSelectSession,
}: {
  item: DriveSession;
  expanded: boolean;
  onExpand: () => void;
  onSelectSession: (id: number) => void;
}) => {
  const displayLabel = item.start_time
    ? new Date(item.start_time).toLocaleTimeString()
    : "Session";

  return (
    <View style={{ marginBottom: 10 }}>
      <TouchableOpacity
        style={{
          padding: 12,
          backgroundColor: "#fff",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: expanded ? "#007bff" : "#ddd",
        }}
        onPress={onExpand}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600", fontSize: 15 }}>{displayLabel}</Text>
          <Text style={{ fontSize: 14 }}>{item.total_km ?? "--"} km</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View
          style={{
            marginTop: 8,
            padding: 10,
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
          }}
        >
          <Text>
            Start:{" "}
            {item.start_time
              ? new Date(item.start_time).toLocaleString()
              : "--"}
          </Text>
          <Text>
            End:{" "}
            {item.end_time ? new Date(item.end_time).toLocaleString() : "--"}
          </Text>
          <Text>Distance: {item.total_km ?? "--"} km</Text>

          <View
            style={{
              flexDirection: "row",
              marginTop: 10,
              justifyContent: "space-between",
            }}
          >
            <TouchableOpacity
              onPress={() => onSelectSession(item.id)}
              style={{
                padding: 8,
                backgroundColor: "#007bff",
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff" }}>Show on Map</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onSelectSession(item.id)}
              style={{
                padding: 8,
                backgroundColor: "#28a745",
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff" }}>Highlight</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

/* -----------------------------
   MAIN COMPONENT
------------------------------ */
const DriveHistoryList: React.FC<Props> = ({
  apiBase,
  show,
  onSelectSession,
  showToast,
}) => {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DriveSession[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* FETCH SESSIONS */
  const fetchSessions = useCallback(
    async (d: Date) => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem("accessToken");
        const dateStr = d.toISOString().split("T")[0];

        const res = await axios.get(`${apiBase}/drive/by-date`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          params: { date: dateStr },
        });

        const sessionsData = res.data?.sessions ?? res.data ?? [];
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      } catch (err) {
        console.warn("Fetch Sessions error:", err);
        showToast?.("Failed to load sessions", "error");
        setSessions([]);
      } finally {
        setLoading(false);
      }
    },
    [apiBase, showToast]
  );

  /* TRIGGER LOAD WHEN MENU OPENS */
  useEffect(() => {
    if (show) fetchSessions(date);
  }, [show, date, fetchSessions]);

  /* DATE CHANGED */
  const onChangeDate = (_: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  return (
    <View style={{ padding: 12, width: "100%" }}>
      {/* DATE PICKER BUTTON */}
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        style={{
          marginBottom: 12,
          padding: 10,
          backgroundColor: "#fff",
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#ddd",
        }}
      >
        <Text style={{ fontSize: 14 }}>
          Select Date: {date.toLocaleDateString()}
        </Text>
      </TouchableOpacity>

      {/* DATE PICKER */}
      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeDate}
        />
      )}

      {/* LOADING */}
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <DriveHistoryItem
              item={item}
              expanded={expandedId === item.id}
              onExpand={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              onSelectSession={onSelectSession}
            />
          )}
          ListEmptyComponent={<EmptySessions />}
          style={{ maxHeight: 330 }}
        />
      )}
    </View>
  );
};

export default DriveHistoryList;
