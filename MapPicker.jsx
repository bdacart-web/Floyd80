import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

export default function MapPicker({ disabled, value, onChange, reveal, guesses = [], answer }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const layersRef = useRef([]);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    mapRef.current = L.map(el.current, { worldCopyJump: true, minZoom: 1 }).setView([20, 0], 1.5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap contributors"
    }).addTo(mapRef.current);
    mapRef.current.on("click", (e) => {
      if (!disabled && !reveal) onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    setTimeout(() => mapRef.current?.invalidateSize(), 50);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (value) {
      if (!markerRef.current) markerRef.current = L.marker([value.lat, value.lng]).addTo(mapRef.current);
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value]);

  useEffect(() => {
    if (!mapRef.current) return;
    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];
    if (!reveal || !answer) return;

    const bounds = [];
    const answerMarker = L.circleMarker([answer.lat, answer.lng], {
      radius: 10, color: "#0a7a3b", fillColor: "#2ecc71", fillOpacity: 1, weight: 3
    }).addTo(mapRef.current).bindPopup(answer.name);
    layersRef.current.push(answerMarker);
    bounds.push([answer.lat, answer.lng]);

    guesses.forEach((g) => {
      if (typeof g.lat !== "number" || typeof g.lng !== "number") return;
      const marker = L.circleMarker([g.lat, g.lng], {
        radius: 7, color: "#9a3412", fillColor: "#fb923c", fillOpacity: .9, weight: 2
      }).addTo(mapRef.current).bindPopup(`${g.playerName}: ${Math.round(g.distanceMiles).toLocaleString()} miles`);
      const line = L.polyline([[g.lat, g.lng], [answer.lat, answer.lng]], {
        color: "#64748b", weight: 2, opacity: .7, dashArray: "5 7"
      }).addTo(mapRef.current);
      layersRef.current.push(marker, line);
      bounds.push([g.lat, g.lng]);
    });
    if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [35, 35] });
  }, [reveal, guesses, answer]);

  return <div ref={el} className="map" aria-label="Interactive world map" />;
}
