// utils/buildLeafletHtml.js
export function buildLeafletHtml({ userCoords, datasets, labels, startLayer = "rain" }) {
  const packaged = {
    activeLayer: startLayer,
    user: { lat: userCoords.latitude, lng: userCoords.longitude },
    rain: (datasets?.rain?.stations || []).map((s) => ({
      lat: s?.location?.latitude,
      lng: s?.location?.longitude,
      name: s?.name,
      rainfall: s?.rainfall,
      lastHour: s?.lastHour,
      coverageMin: s?.lastHourCoverageMin,
    })),
    pm25: (datasets?.pm25 || []).map((x) => ({
      lat: x?.location?.latitude,
      lng: x?.location?.longitude,
      name: x?.name,
      value: x?.value,
    })),
    wind: (datasets?.wind || []).map((x) => ({
      lat: x?.location?.latitude,
      lng: x?.location?.longitude,
      name: x?.name,
      speed: x?.speed,
      direction: x?.direction,
    })),
    temp: (datasets?.temp || []).map((x) => ({
      lat: x?.location?.latitude,
      lng: x?.location?.longitude,
      name: x?.name,
      value: x?.value,
    })),
    humidity: (datasets?.humidity || []).map((x) => ({
      lat: x?.location?.latitude,
      lng: x?.location?.longitude,
      name: x?.name,
      value: x?.value,
    })),
  };

  const dataStr   = JSON.stringify(packaged).replace(/<\/script>/g, "<\\/script>");
  const labelsStr = JSON.stringify(labels).replace(/<\/script>/g, "<\\/script>");

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html, body, #map { height:100%; margin:0; }
  .legend { position:absolute; bottom:80px; left:0; background:#fff; padding:6px 8px; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,.2); font:12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; min-width:140px; z-index:1000; }
  .legend div { margin:2px 0; white-space:nowrap; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; }
  .chip { display:flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:50%; border:2px solid rgba(0,0,0,.25); box-shadow:0 1px 3px rgba(0,0,0,.25); font:800 11px/1.05 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.35); }
  .chip.pm25 { background:#FF9800; } .chip.wind { background:#9C27B0; } .chip.temp { background:#F44336; } .chip.humidity { background:#009688; }
  .leaflet-popup-content { margin:8px 12px; font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .leaflet-popup-content b { font-weight:800; }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const APP_DATA=${dataStr};
  const LABELS=${labelsStr};
  let map, currentMarkers=[];

  function initMap(){
    if(map)return;
    map=L.map('map',{zoomControl:true}).setView([APP_DATA.user.lat,APP_DATA.user.lng],13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    const userIcon=L.icon({iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34]});
    L.marker([APP_DATA.user.lat,APP_DATA.user.lng],{icon:userIcon}).addTo(map).bindPopup(LABELS.youAreHere);
    updateLayer(APP_DATA.activeLayer);
  }

  function estimateFloodRisk(rainfall,lastHour){
    if((rainfall??0)>10||(lastHour??0)>30)return 'High';
    if((rainfall??0)>5||(lastHour??0)>15)return 'Moderate';
    return 'Low';
  }
  function riskColor(risk){ if(risk==='High')return '#EF4444'; if(risk==='Moderate')return '#F59E0B'; return '#10B981'; }

  function clearMarkers(){ currentMarkers.forEach(m=>map.removeLayer(m)); currentMarkers=[]; }
  function addChip({lat,lng,label,popupTitle,popupLines,klass,inlineBg}){
    if(!(lat&&lng))return null;
    const html='<div class="chip '+klass+'" style="'+(inlineBg?('background:'+inlineBg+';'):'')+'">'+label+'</div>';
    const icon=L.divIcon({html,className:'',iconSize:[40,40],iconAnchor:[20,20],popupAnchor:[0,-20]});
    const m=L.marker([lat,lng],{icon}).addTo(map);
    const content='<b>'+(popupTitle||LABELS.popup.location)+'</b><br/>'+(popupLines||[]).join('<br/>');
    m.bindPopup(content); return m;
  }

  function updateLegend(layer){
    const existing=document.querySelector('.legend-control'); if(existing)existing.remove();
    const legend=L.control({position:'bottomleft'});
    legend.onAdd=function(){
      const div=L.DomUtil.create('div','legend legend-control');
      if(layer==='rain'){ div.innerHTML='<strong>'+LABELS.legend.rain+'</strong>'
        +'<div><span class="dot" style="background:#EF4444"></span>'+LABELS.legend.high+'</div>'
        +'<div><span class="dot" style="background:#F59E0B"></span>'+LABELS.legend.moderate+'</div>'
        +'<div><span class="dot" style="background:#10B981"></span>'+LABELS.legend.low+'</div>'; }
      else if(layer==='pm25'){ div.innerHTML='<strong>'+LABELS.legend.pm25+'</strong><div>'+LABELS.legend.chipPm25+'</div>'; }
      else if(layer==='wind'){ div.innerHTML='<strong>'+LABELS.legend.wind+'</strong><div>'+LABELS.legend.chipWind+'</div>'; }
      else if(layer==='temp'){ div.innerHTML='<strong>'+LABELS.legend.temp+'</strong><div>'+LABELS.legend.chipTemp+'</div>'; }
      else if(layer==='humidity'){ div.innerHTML='<strong>'+LABELS.legend.humidity+'</strong><div>'+LABELS.legend.chipHumidity+'</div>'; }
      return div;
    };
    legend.addTo(map);
  }

  function updateLayer(layerName){
    if(!map)return;
    clearMarkers(); updateLegend(layerName);
    if(layerName==='rain'){
      (APP_DATA.rain||[]).forEach(p=>{
        if(!(p&&p.lat&&p.lng))return;
        const risk=estimateFloodRisk(p.rainfall,p.lastHour);
        const color=riskColor(risk);
        const nowVal=(p.rainfall!=null)?(Math.round(p.rainfall)+' '+LABELS.units.mm):'-';
        const hourVal=(p.lastHour!=null)?(p.lastHour+' '+LABELS.units.mm):LABELS.popup.na;
        const m=addChip({lat:p.lat,lng:p.lng,label:nowVal,klass:'rain',inlineBg:color,
          popupTitle:(p.name||LABELS.popup.station),
          popupLines:[
            (p.rainfall!=null?(LABELS.popup.rainfall+': '+p.rainfall+' '+LABELS.units.mm):(LABELS.popup.rainfall+': '+LABELS.popup.na)),
            (LABELS.popup.last1h+': '+hourVal),
            (LABELS.popup.floodRisk+': '+risk),
          ],
        }); if(m)currentMarkers.push(m);
      });
    } else if(layerName==='pm25'){
      (APP_DATA.pm25||[]).forEach(p=>{
        const v=(p.value!=null)?Math.round(p.value):null;
        const m=addChip({lat:p.lat,lng:p.lng,klass:'pm25',label:(v!=null?(v+' µg'):'-'),
          popupTitle:(p.name||LABELS.popup.region),
          popupLines:[(v!=null?(LABELS.popup.pm25+': '+v+' µg/m³'):(LABELS.popup.pm25+': '+LABELS.popup.na))],
        }); if(m)currentMarkers.push(m);
      });
    } else if(layerName==='wind'){
      (APP_DATA.wind||[]).forEach(p=>{
        const sp=(p.speed!=null?Math.round(p.speed):null);
        const m=addChip({lat:p.lat,lng:p.lng,klass:'wind',label:(sp!=null?(sp+' '+LABELS.units.kn):'-'),
          popupTitle:(p.name||LABELS.popup.station),
          popupLines:[(sp!=null?(LABELS.popup.windSpeed+': '+sp+' '+LABELS.units.kn):(LABELS.popup.windSpeed+': '+LABELS.popup.na))+(p.direction?(' ('+p.direction+')'):'')],
        }); if(m)currentMarkers.push(m);
      });
    } else if(layerName==='temp'){
      (APP_DATA.temp||[]).forEach(p=>{
        const t=(p.value!=null)?Math.round(p.value):null;
        const m=addChip({lat:p.lat,lng:p.lng,klass:'temp',label:(t!=null?(t+' '+LABELS.units.c):'-'),
          popupTitle:(p.name||LABELS.popup.station),
          popupLines:[(t!=null?(LABELS.popup.temperature+': '+t+' '+LABELS.units.c):(LABELS.popup.temperature+': '+LABELS.popup.na))],
        }); if(m)currentMarkers.push(m);
      });
    } else if(layerName==='humidity'){
      (APP_DATA.humidity||[]).forEach(p=>{
        const h=(p.value!=null)?Math.round(p.value):null;
        const m=addChip({lat:p.lat,lng:p.lng,klass:'humidity',label:(h!=null?(h+' '+LABELS.units.percent):'-'),
          popupTitle:(p.name||LABELS.popup.station),
          popupLines:[(h!=null?(LABELS.popup.humidity+': '+h+' '+LABELS.units.percent):(LABELS.popup.humidity+': '+LABELS.popup.na))],
        }); if(m)currentMarkers.push(m);
      });
    }
  }

  window.addEventListener('load', initMap);
  window.updateLayer=updateLayer;
</script></body></html>`;
}
