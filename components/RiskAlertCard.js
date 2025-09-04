// components/RiskAlertCard.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../translations/translation";
import i18n from "../translations/translation";

function formatFancyDate(dt) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat(i18n.locale || undefined, {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dt);
  } catch {
    return dt.toDateString();
  }
}
function formatAgo(dt) {
  if (!dt) return "";
  const diffMs = Date.now() - dt.getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  try {
    const rtf = new Intl.RelativeTimeFormat(i18n.locale || undefined, {
      numeric: "auto",
    });
    if (sec < 60) return t("time.justNow");
    const min = Math.floor(sec / 60);
    if (min < 60) return rtf.format(-min, "minute");
    const hr = Math.floor(min / 60);
    if (hr < 24) return rtf.format(-hr, "hour");
    const day = Math.floor(hr / 24);
    return rtf.format(-day, "day");
  } catch {
    if (sec < 60) return t("time.justNow");
    const min = Math.floor(sec / 60);
    if (min < 60) return t("time.minAgo", { count: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return t("time.hrAgo", { count: hr });
    const day = Math.floor(hr / 24);
    return t("time.dayAgo", { count: day });
  }
}

export default function RiskAlertCard({ variant, title, whenISO, areasText }) {
  const dt = whenISO ? new Date(whenISO) : null;
  const palette =
    variant === "red"
      ? { wrap: styles.alertRed, icon: "warning", iconColor: "#fff", text: styles.alertTextLight }
      : variant === "orange"
      ? { wrap: styles.alertOrange, icon: "warning-outline", iconColor: "#111827", text: styles.alertTextDark }
      : { wrap: styles.alertGreen, icon: "checkmark-circle", iconColor: "#064e3b", text: styles.alertTextDark };

  const isFlashFlood = title.includes("Flash Flood Warning");
  return (
    <View style={[styles.alertCard, palette.wrap]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={palette.icon} size={18} color={palette.iconColor} style={{ marginRight: 6 }} />
        <Text style={[styles.alertTitle, palette.text, isFlashFlood && styles.alertTitleBig]}>{title}</Text>
        {isFlashFlood && <Ionicons name={palette.icon} size={18} color={palette.iconColor} style={{ marginLeft: 6 }} />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 4 }}>
        <Ionicons name="calendar-outline" size={14} color={palette.iconColor} style={{ marginRight: 4 }} />
        <Text style={[styles.alertMeta, palette.text, styles.alertSpaced]}>{formatFancyDate(dt)} • {formatAgo(dt)}</Text>
      </View>
      {!!areasText && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
          <Ionicons name="location-outline" size={14} color={palette.iconColor} style={{ marginRight: 4 }} />
          <Text style={[styles.alertMeta, palette.text, styles.alertSpaced]} numberOfLines={2} textAlign="center">
            {areasText}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  alertCard: { borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8, marginBottom: 8 },
  alertRed: { backgroundColor: "#ef4444" },
  alertOrange: { backgroundColor: "#f59e0b" },
  alertGreen: { backgroundColor: "#d1fae5" },
  alertTitle: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  alertTitleBig: { fontSize: 18, letterSpacing: 0.4 },
  alertMeta: { marginTop: 4, fontSize: 13, fontWeight: "600" },
  alertSpaced: { letterSpacing: 0.4 },
  alertTextLight: { color: "#fff" },
  alertTextDark: { color: "#111827" },
});
