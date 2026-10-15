import { useRef, useEffect, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Crosshair, Trash2 } from 'lucide-react';

export interface GeoPoint {
  lat: number | null;
  lng: number | null;
  radius: number;
}

interface LocationMapPickerProps {
  center: GeoPoint;
  onCenterChange: (center: GeoPoint) => void;
}

const CENTER_COLOR = '#2563eb';
const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357];
const DEFAULT_ZOOM = 15;

function createCenterIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="${CENTER_COLOR}"/>
        <circle cx="16" cy="16" r="8" fill="white" opacity="0.9"/>
        <text x="16" y="20" text-anchor="middle" font-size="10" font-weight="bold" fill="${CENTER_COLOR}">S</text>
      </svg>
    </div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });
}

export function LocationMapPicker({ center, onCenterChange }: LocationMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const clearVisuals = useCallback(() => {
    if (markerRef.current) { mapInstance.current?.removeLayer(markerRef.current); markerRef.current = null; }
    if (circleRef.current) { mapInstance.current?.removeLayer(circleRef.current); circleRef.current = null; }
  }, []);

  const placeMarker = useCallback((lat: number, lng: number, radius: number) => {
    if (!mapInstance.current) return;
    clearVisuals();
    markerRef.current = L.marker([lat, lng], { icon: createCenterIcon() }).addTo(mapInstance.current);
    circleRef.current = L.circle([lat, lng], {
      radius,
      color: CENTER_COLOR,
      fillColor: CENTER_COLOR,
      fillOpacity: 0.10,
      weight: 3,
    }).addTo(mapInstance.current);
  }, [clearVisuals]);

  const applyPoint = useCallback((lat: number | null, lng: number | null) => {
    onCenterChange({ lat, lng, radius: center.radius });
    if (lat !== null && lng !== null) placeMarker(lat, lng, center.radius); else clearVisuals();
  }, [center.radius, onCenterChange, placeMarker, clearVisuals]);

  const commitCoords = useCallback((lat: number | null, lng: number | null) => {
    if (lat !== null && lng !== null) mapInstance.current?.setView([lat, lng]);
    applyPoint(lat, lng);
  }, [applyPoint]);

  const [latText, setLatText] = useState(center.lat !== null ? String(center.lat) : '');
  const [lngText, setLngText] = useState(center.lng !== null ? String(center.lng) : '');

  useEffect(() => {
    setLatText(prev => {
      if (center.lat === null) return '';
      const n = Number(prev);
      return Number.isFinite(n) && n === center.lat ? prev : String(center.lat);
    });
  }, [center.lat]);

  useEffect(() => {
    setLngText(prev => {
      if (center.lng === null) return '';
      const n = Number(prev);
      return Number.isFinite(n) && n === center.lng ? prev : String(center.lng);
    });
  }, [center.lng]);

  const onLatInput = (val: string) => {
    setLatText(val);
    const n = Number(val);
    if (val.trim() === '') commitCoords(null, center.lng);
    else if (Number.isFinite(n)) commitCoords(n, center.lng);
  };

  const onLngInput = (val: string) => {
    setLngText(val);
    const n = Number(val);
    if (val.trim() === '') commitCoords(center.lat, null);
    else if (Number.isFinite(n)) commitCoords(center.lat, n);
  };

  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(map);

    mapInstance.current = map;

    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      window.clearTimeout(invalidateTimer);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const handler = (e: L.LeafletMouseEvent) => applyPoint(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [applyPoint]);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (center.lat !== null && center.lng !== null) {
      placeMarker(center.lat, center.lng, center.radius);
    } else {
      clearVisuals();
    }
  }, [center.lat, center.lng, center.radius, placeMarker, clearVisuals]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        mapInstance.current?.setView([lat, lng], 16);
        applyPoint(lat, lng);
        setGettingLocation(false);
      },
      () => { setGettingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleUseMyLocation}
          disabled={gettingLocation}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-blue-500 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-600 transition-all disabled:opacity-50"
        >
          {gettingLocation ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Crosshair size={14} />
          )}
          موقعي الحالي
        </button>
        <button
          onClick={() => applyPoint(null, null)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <Trash2 size={14} />
          مسح
        </button>
      </div>

      <div
        ref={mapRef}
        className="w-full h-[350px] rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 z-0"
        style={{ direction: 'ltr' }}
      />

      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{ borderColor: `${CENTER_COLOR}33`, backgroundColor: `${CENTER_COLOR}08` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CENTER_COLOR }} />
          <span className="text-xs font-black" style={{ color: CENTER_COLOR }}>
            مركز السكن
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-300 mb-1">خط العرض (Latitude)</label>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={latText}
              onChange={e => onLatInput(e.target.value)}
              placeholder="30.044400"
              className="w-full px-3 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:border-blue-300 dark:text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-300 mb-1">خط الطول (Longitude)</label>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={lngText}
              onChange={e => onLngInput(e.target.value)}
              placeholder="31.235700"
              className="w-full px-3 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:border-blue-300 dark:text-white font-mono"
            />
          </div>
        </div>

        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300">
          {center.lat === null || center.lng === null
            ? 'اكتب إحداثيات السكن يدويًا بالأعلى، أو اضغط على الخريطة لتحديد المركز.'
            : 'يمكنك تعديل الإحداثيات يدويًا من الحقلين، أو بالنقر على الخريطة.'}
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1">
              <MapPin size={11} />
              قطر نطاق السكن (نصف القطر بالمتر)
            </label>
            <span className="text-xs font-black" style={{ color: CENTER_COLOR }}>
              {center.radius} م
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={500}
            step={5}
            value={center.radius}
            onChange={e => onCenterChange({ ...center, radius: Number(e.target.value) })}
            className="w-full accent-current"
            style={{ accentColor: CENTER_COLOR }}
          />
          <div className="flex justify-between text-[9px] font-bold text-slate-300 dark:text-slate-400">
            <span>10 م</span>
            <span>500 م</span>
          </div>
        </div>
      </div>
    </div>
  );
}
