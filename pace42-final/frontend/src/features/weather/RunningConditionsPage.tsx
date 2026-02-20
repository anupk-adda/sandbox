import { useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCcw } from 'lucide-react';
import { authService } from '../../services/authService';
import type { WeatherPayload } from '../../services/chatService';
import { RunningConditionsWidget } from './RunningConditionsWidget';
import type { HourlyWeather } from './weatherUtils';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';

type FetchState = 'idle' | 'loading' | 'error' | 'success';

const mapPayloadToHourly = (payload?: WeatherPayload): HourlyWeather[] => {
  if (!payload?.hours) return [];
  return payload.hours.map((hour) => ({
    time: hour.time,
    temperatureC: hour.details?.temperature,
    humidity: hour.details?.humidity,
    windKph: hour.details?.wind_speed,
    precipProbability: hour.details?.precip_prob,
    precipitationMm: hour.details?.precipitation,
    lightningProbability: undefined,
  }));
};

export default function RunningConditionsPage() {
  const [status, setStatus] = useState<FetchState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<WeatherPayload | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const hourly = useMemo(() => mapPayloadToHourly(payload || undefined), [payload]);

  const fetchConditions = async (latitude: number, longitude: number) => {
    const token = authService.getAuthToken();
    if (!token) {
      setErrorMessage('Please sign in to view running conditions.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: 'running conditions',
          location: { latitude, longitude },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.detail || 'Unable to fetch running conditions.');
      }

      const data = (await response.json()) as { weather?: WeatherPayload };
      setPayload(data.weather || null);
      setStatus('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch running conditions.');
      setStatus('error');
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Location services are unavailable in this browser.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(location);
        fetchConditions(location.latitude, location.longitude);
      },
      () => {
        setErrorMessage('Please enable location access to load running conditions.');
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0C0F] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-white/40 font-mono">
              Running Conditions
            </div>
            <h1 className="text-3xl font-display font-semibold mt-2">
              Today’s Weather for Running
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={requestLocation}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white hover:border-white/30 transition"
            >
              <MapPin className="w-4 h-4" />
              Update location
            </button>
            <button
              onClick={() => coords && fetchConditions(coords.latitude, coords.longitude)}
              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 hover:text-white transition"
              disabled={!coords || status === 'loading'}
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {status === 'error' && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <RunningConditionsWidget
          hourly={hourly}
          locationLabel={payload?.location_label || 'Near you'}
        />
      </div>
    </div>
  );
}
