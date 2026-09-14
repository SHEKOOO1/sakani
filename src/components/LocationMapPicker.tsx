import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Trash2, LogIn, LogOut, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocationPoint {
  lat: number | null;
  lng: number | null;
  radius: number;
}

interface LocationMapPickerProps {
  entry: LocationPoint;
  exit: LocationPoint;
  onEntryChange: (point: LocationPoint) => void;
  onExitChange: (point: LocationPoint) => void;
}

type PickerMode = 'entry' | 'exit';

const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357];
const DEFAULT_ZOOM = 13;

const ENTRY_COLOR = '#10b981';
const EXIT_COLOR = '#ef4444';

function createCustomIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      position: relative;
      width: 32px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="8" fill="white" opacity="0.9"/>
        <text x="16" y="20" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${label}</text>
      </svg>
    </div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });
}

export function LocationMapPicker({ entry, exit, onEntryChange, onExitChange }: LocationMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const entryMarkerRef = useRef<L.Marker | null>(null);
  const entryCircleRef = useRef<L.Circle | null>(null);
  const exitMarkerRef = useRef<L.Marker | null>(null);
  const exitCircleRef = useRef<L.Circle | null>(null);
  const [mode, setMode] = useState<PickerMode>('entry');
  const [gettingLocation, setGettingLocation] = useState(false);

  const clearEntryVisuals = useCallback(() => {
    if (entryMarkerRef.current) {
      mapInstance.current?.removeLayer(entryMarkerRef.current);
      entryMarkerRef.current = null;
    }
    if (entryCircleRef.current) {
      mapInstance.current?.removeLayer(entryCircleRef.current);
      entryCircleRef.current = null;
    }
  }, []);

  const clearExitVisuals = useCallback(() => {
    if (exitMarkerRef.current) {
      mapInstance.current?.removeLayer(exitMarkerRef.current);
      exitMarkerRef.current = null;
    }
    if (exitCircleRef.current) {
      mapInstance.current?.removeLayer(exitCircleRef.current);
      exitCircleRef.current = null;
    }
  }, []);

  const placeEntryMarker = useCallback((lat: number, lng: number, radius: number) => {
    if (!mapInstance.current) return;
    clearEntryVisuals();
    const marker = L.marker([lat, lng], { icon: createCustomIcon(ENTRY_COLOR, 'D') }).addTo(mapInstance.current);
    const circle = L.circle([lat, lng], {
      radius,
      color: ENTRY_COLOR,
      fillColor: ENTRY_COLOR,
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '6 4',
    }).addTo(mapInstance.current);
    entryMarkerRef.current = marker;
    entryCircleRef.current = circle;
  }, [clearEntryVisuals]);

  const placeExitMarker = useCallback((lat: number, lng: number, radius: number) => {
    if (!mapInstance.current) return;
    clearExitVisuals();
    const marker = L.marker([lat, lng], { icon: createCustomIcon(EXIT_COLOR, 'X') }).addTo(mapInstance.current);
    const circle = L.circle([lat, lng], {
      radius,
      color: EXIT_COLOR,
      fillColor: EXIT_COLOR,
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '6 4',
    }).addTo(mapInstance.current);
    exitMarkerRef.current = marker;
    exitCircleRef.current = circle;
  }, [clearExitVisuals]);

  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
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

    map.on('click', function handler(e: L.LeafletMouseEvent) {
      const { lat, lng } = e.latlng;
      if (mode === 'entry') {
        onEntryChange({ lat, lng, radius: entry.radius });
        placeEntryMarker(lat, lng, entry.radius);
      } else {
        onExitChange({ lat, lng, radius: exit.radius });
        placeExitMarker(lat, lng, exit.radius);
      }
    });

    return () => {
      map.off('click');
    };
  }, [mode, entry.radius, exit.radius, onEntryChange, onExitChange, placeEntryMarker, placeExitMarker]);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (entry.lat !== null && entry.lng !== null) {
      placeEntryMarker(entry.lat, entry.lng, entry.radius);
    } else {
      clearEntryVisuals();
    }
  }, [entry.lat, entry.lng, entry.radius, placeEntryMarker, clearEntryVisuals]);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (exit.lat !== null && exit.lng !== null) {
      placeExitMarker(exit.lat, exit.lng, exit.radius);
    } else {
      clearExitVisuals();
    }
  }, [exit.lat, exit.lng, exit.radius, placeExitMarker, clearExitVisuals]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (mapInstance.current) {
          mapInstance.current.setView([lat, lng], 16);
        }
        if (mode === 'entry') {
          onEntryChange({ lat, lng, radius: entry.radius });
          placeEntryMarker(lat, lng, entry.radius);
        } else {
          onExitChange({ lat, lng, radius: exit.radius });
          placeExitMarker(lat, lng, exit.radius);
        }
        setGettingLocation(false);
      },
      () => { setGettingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const activePoint = mode === 'entry' ? entry : exit;
  const setActivePoint = mode === 'entry' ? onEntryChange : onExitChange;
  const color = mode === 'entry' ? ENTRY_COLOR : EXIT_COLOR;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setMode('entry')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            mode === 'entry'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <LogIn size={14} />
          نقطة الدخول
        </button>
        <button
          onClick={() => setMode('exit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            mode === 'exit'
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <LogOut size={14} />
          نقطة الخروج
        </button>
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
          onClick={() => {
            if (mode === 'entry') {
              onEntryChange({ lat: null, lng: null, radius: entry.radius });
              clearEntryVisuals();
            } else {
              onExitChange({ lat: null, lng: null, radius: exit.radius });
              clearExitVisuals();
            }
          }}
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

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border p-4 space-y-3"
          style={{ borderColor: `${color}33`, backgroundColor: `${color}08` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-black" style={{ color }}>
                {mode === 'entry' ? 'نقطة الدخول' : 'نقطة الخروج'}
              </span>
            </div>
            {activePoint.lat !== null && activePoint.lng !== null && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 font-mono">
                {activePoint.lat.toFixed(6)}, {activePoint.lng.toFixed(6)}
              </span>
            )}
          </div>

          {activePoint.lat === null && (
            <p className="text-[11px] text-slate-400 dark:text-slate-300 font-bold">
              اضغط على الخريطة لتحديد النقطة
            </p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1">
                <MapPin size={11} />
                نصف القطر (قطر الدائرة)
              </label>
              <span className="text-xs font-black" style={{ color }}>
                {activePoint.radius} م
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={5}
              value={activePoint.radius}
              onChange={e => setActivePoint({ ...activePoint, radius: Number(e.target.value) })}
              className="w-full accent-current"
              style={{ accentColor: color }}
            />
            <div className="flex justify-between text-[9px] font-bold text-slate-300 dark:text-slate-400">
              <span>10 م</span>
              <span>500 م</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 p-3">
          <div className="flex items-center gap-2 mb-1">
            <LogIn size={12} className="text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">الدخول</span>
          </div>
          {entry.lat !== null ? (
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300 font-mono">
              {entry.lat.toFixed(4)}, {entry.lng!.toFixed(4)} — {entry.radius}م
            </p>
          ) : (
            <p className="text-[10px] font-bold text-slate-300 dark:text-slate-400">غير محدد</p>
          )}
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 p-3">
          <div className="flex items-center gap-2 mb-1">
            <LogOut size={12} className="text-red-500" />
            <span className="text-[10px] font-black text-red-600 dark:text-red-400">الخروج</span>
          </div>
          {exit.lat !== null ? (
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300 font-mono">
              {exit.lat.toFixed(4)}, {exit.lng!.toFixed(4)} — {exit.radius}م
            </p>
          ) : (
            <p className="text-[10px] font-bold text-slate-300 dark:text-slate-400">غير محدد</p>
          )}
        </div>
      </div>
    </div>
  );
}
