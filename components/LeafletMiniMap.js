/**
 * components/LeafletMiniMap.js — Embedded Leaflet map in a React Native WebView
 *
 * Purpose
 * - Render a small interactive map (via Leaflet.js) centered at given lat/lng.
 * - Display a single marker at the coordinates with a "You are here" popup.
 *
 * Key Behaviours
 * - Injects Leaflet HTML/JS directly into a WebView.
 * - Zoom control hidden for a cleaner mini-map look.
 * - Uses OpenStreetMap tiles with zoom up to 19.
 *
 * Exports
 * - Default React component <LeafletMiniMap lat lng/>.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LeafletMiniMap({ lat, lng }) {
  const html = `
    <!DOCTYPE html><html><head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <style>html,body,#map{height:100%;margin:0}.leaflet-control-zoom{display:none}</style>
    </head><body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        (function(){
          var map=L.map('map',{zoomControl:false}).setView([${lat},${lng}],15);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
          L.marker([${lat},${lng}]).addTo(map).bindPopup('You are here');
        })();
      </script>
    </body></html>`;
  return (
    <View style={styles.mapShellInner}>
      <WebView
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        source={{ html }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  mapShellInner: { height: 220, width: "100%" },
});
