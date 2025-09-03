// containers/InteractiveMapModalContainer.js
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { WebView } from "react-native-webview";
import InteractiveMapModalScreen from "../screens/InteractiveMapModalScreen";
import { LanguageContext } from "../translations/language";
import { t } from "../translations/translation";
import { buildLeafletHtml } from "../utils/buildLeafletHtml";

export default function InteractiveMapModalContainer({ visible, onClose, userCoords, datasets }) {
  const { lang } = useContext(LanguageContext);

  // i18n labels (stable object for screen)
  const mapLabels = useMemo(() => ({
    title: t("map.title"),
    a11yClose: t("map.a11yClose"),
    loading: t("map.loading"),
    layers: {
      rain: t("map.layers.rain"),
      pm25: t("map.layers.pm25"),
      wind: t("map.layers.wind"),
      temp: t("map.layers.temp"),
      humidity: t("map.layers.humidity"),
    },
    a11yLayer: {
      rain: t("map.a11yLayer.rain"),
      pm25: t("map.a11yLayer.pm25"),
      wind: t("map.a11yLayer.wind"),
      temp: t("map.a11yLayer.temp"),
      humidity: t("map.a11yLayer.humidity"),
    },
    html: {
      youAreHere: t("map.html.youAreHere"),
      legend: {
        rain: t("map.html.legend.rain"),
        high: t("map.html.legend.high"),
        moderate: t("map.html.legend.moderate"),
        low: t("map.html.legend.low"),
        pm25: t("map.html.legend.pm25"),
        wind: t("map.html.legend.wind"),
        temp: t("map.html.legend.temp"),
        humidity: t("map.html.legend.humidity"),
        chipPm25: t("map.html.legend.chipPm25"),
        chipWind: t("map.html.legend.chipWind"),
        chipTemp: t("map.html.legend.chipTemp"),
        chipHumidity: t("map.html.legend.chipHumidity"),
      },
      popup: {
        location: t("map.html.popup.location"),
        station: t("map.html.popup.station"),
        region: t("map.html.popup.region"),
        rainfall: t("map.html.popup.rainfall"),
        last1h: t("map.html.popup.last1h"),
        floodRisk: t("map.html.popup.floodRisk"),
        pm25: t("map.html.popup.pm25"),
        windSpeed: t("map.html.popup.windSpeed"),
        temperature: t("map.html.popup.temperature"),
        humidity: t("map.html.popup.humidity"),
        na: t("map.html.popup.na"),
      },
      units: {
        mm: t("map.html.units.mm"),
        kn: t("map.html.units.kn"),
        c: t("map.html.units.c"),
        percent: t("map.html.units.percent"),
      },
    },
  }), [lang]);

  const [activeLayer, setActiveLayer] = useState("rain");
  const [webviewReady, setWebviewReady] = useState(false);
  const [openSeq, setOpenSeq] = useState(0);
  const [html, setHtml] = useState("");
  const [ready, setReady] = useState(false);
  const webViewRef = useRef(null);
  const frozenRef = useRef({ userCoords: null, datasets: null });

  // (re)build HTML only when opening (and when lang changes)
  useEffect(() => {
    if (!visible) { setWebviewReady(false); return; }

    const uc = userCoords || { latitude: 1.3521, longitude: 103.8198 };
    frozenRef.current = { userCoords: uc, datasets };

    const htmlOnce = buildLeafletHtml({
      userCoords: uc,
      datasets,
      labels: mapLabels.html,
      startLayer: "rain",
    });
    setHtml(htmlOnce);

    const hasData =
      (datasets?.rain?.stations?.length ?? 0) ||
      (datasets?.pm25?.length ?? 0) ||
      (datasets?.wind?.length ?? 0) ||
      (datasets?.temp?.length ?? 0) ||
      (datasets?.humidity?.length ?? 0);

    setReady(!!hasData);
    setOpenSeq((n) => n + 1);
    setWebviewReady(false);
  }, [visible, lang]); // re-key on language switch too

  // unique key per open to force one WebView mount per open
  const webviewKey = useMemo(() => {
    const uc = frozenRef.current.userCoords || userCoords || { latitude: 1.3521, longitude: 103.8198 };
    const lat = uc?.latitude?.toFixed(2) || "1.35";
    const lng = uc?.longitude?.toFixed(2) || "103.82";
    return `map-open-${openSeq}-${lat}-${lng}`;
  }, [openSeq, userCoords]);

  // layer switch without reload
  useEffect(() => {
    if (visible && webviewReady && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.updateLayer && window.updateLayer('${activeLayer}'); true;`
      );
    }
  }, [activeLayer, visible, webviewReady]);

  return (
    <InteractiveMapModalScreen
      visible={visible}
      onClose={onClose}
      labels={mapLabels}
      // webview
      WebViewComponent={WebView}
      webviewKey={webviewKey}
      html={html}
      ready={ready}
      webviewRef={webViewRef}
      onWVLoadEnd={() => setWebviewReady(true)}
      onWVLoadStart={() => setWebviewReady(false)}
      // filters
      activeLayer={activeLayer}
      setActiveLayer={setActiveLayer}
    />
  );
}
