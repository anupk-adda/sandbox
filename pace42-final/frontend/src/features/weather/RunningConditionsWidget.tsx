import { memo, useMemo } from 'react';
import { CloudRain, CloudLightning } from 'lucide-react';
import {
  bucket,
  computeConditionScore,
  formatHourLabel,
  hourHasSignal,
  summaryGenerator,
  type HourlyWeather,
  type ConditionBucket,
} from './weatherUtils';
import './RunningConditionsWidget.css';

type RunningConditionsWidgetProps = {
  hourly: HourlyWeather[];
  locationLabel: string;
  hoursToShow?: number;
};

type ConditionPoint = {
  time: string;
  score: number;
  bucket: ConditionBucket;
  hasSignal: boolean;
  icon?: 'rain' | 'lightning';
  details: HourlyWeather;
};

const DEFAULT_HOURS = 12;

export const RunningConditionsWidget = memo(
  ({ hourly, locationLabel, hoursToShow = DEFAULT_HOURS }: RunningConditionsWidgetProps) => {
    const points = useMemo<ConditionPoint[]>(() => {
      const trimmed = hourly.slice(0, hoursToShow);
      return trimmed.map((hour) => {
        const hasSignal = hourHasSignal(hour);
        const score = hasSignal ? computeConditionScore(hour) : 0;
        const bucketType = bucket(score);

        const precipProb = hour.precipProbability ?? 0;
        const precipMm = hour.precipitationMm ?? 0;
        const lightningProb = hour.lightningProbability ?? 0;

        const rainTrigger = (precipProb >= 30 || precipMm >= 0.2) && hasSignal;
        const lightningTrigger = lightningProb >= 10 && hasSignal;

        return {
          time: hour.time,
          score,
          bucket: bucketType,
          hasSignal,
          icon: lightningTrigger ? 'lightning' : rainTrigger ? 'rain' : undefined,
          details: hour,
        };
      });
    }, [hourly, hoursToShow]);

    const hasData = points.some((point) => point.hasSignal);
    const summary = hasData
      ? summaryGenerator(points.map((point) => ({
          time: point.time,
          score: point.score,
          bucket: point.bucket,
        })))
      : 'Running conditions data is unavailable right now.';

    const fallbackBars = Array.from({ length: hoursToShow }).map((_, index) => ({
      id: `fallback-${index}`,
    }));

    return (
      <div className="running-conditions">
        <div className="running-conditions__header">
          <div>
            <div className="running-conditions__title">Running Conditions</div>
            <div className="running-conditions__subtitle">{locationLabel}</div>
          </div>
          <span className={`running-conditions__badge running-conditions__badge--${hasData ? 'live' : 'muted'}`}>
            {hasData ? 'Next 12h' : 'Data unavailable'}
          </span>
        </div>

        <div className="running-conditions__summary">{summary}</div>

        <div className={`running-conditions__bars ${hasData ? '' : 'running-conditions__bars--empty'}`}>
          {hasData
            ? points.map((point, index) => (
                <div key={`${point.time}-${index}`} className="running-conditions__bar">
                  <div className="running-conditions__bar-track">
                    <div
                      className={`running-conditions__bar-fill running-conditions__bar-fill--${point.bucket.toLowerCase()}`}
                      style={{ height: `${Math.max(14, point.score)}%` }}
                    />
                  </div>
                  <div className="running-conditions__bar-meta">
                    <span className="running-conditions__bar-time">{formatHourLabel(point.time)}</span>
                    {point.icon === 'rain' && (
                      <CloudRain className="running-conditions__bar-icon" />
                    )}
                    {point.icon === 'lightning' && (
                      <CloudLightning className="running-conditions__bar-icon running-conditions__bar-icon--alert" />
                    )}
                  </div>
                  <div className="running-conditions__tooltip">
                    <div className="running-conditions__tooltip-title">
                      {point.time} — {point.bucket}
                    </div>
                    <div className="running-conditions__tooltip-body">
                      {point.details.temperatureC !== undefined && (
                        <div>Temp: {Math.round(point.details.temperatureC)}°C</div>
                      )}
                      {point.details.humidity !== undefined && (
                        <div>Humidity: {Math.round(point.details.humidity)}%</div>
                      )}
                      {point.details.windKph !== undefined && (
                        <div>Wind: {Math.round(point.details.windKph)} kph</div>
                      )}
                      {point.details.precipProbability !== undefined && (
                        <div>Precip: {Math.round(point.details.precipProbability)}%</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            : fallbackBars.map((item) => (
                <div key={item.id} className="running-conditions__bar running-conditions__bar--ghost">
                  <div className="running-conditions__bar-track">
                    <div className="running-conditions__bar-fill running-conditions__bar-fill--ghost" />
                  </div>
                  <div className="running-conditions__bar-meta">
                    <span className="running-conditions__bar-time">--</span>
                  </div>
                </div>
              ))}
        </div>

        <div className="running-conditions__legend">
          <span className="running-conditions__legend-item">
            <span className="running-conditions__legend-swatch running-conditions__legend-swatch--good" />
            Good
          </span>
          <span className="running-conditions__legend-item">
            <span className="running-conditions__legend-swatch running-conditions__legend-swatch--fair" />
            Fair
          </span>
          <span className="running-conditions__legend-item">
            <span className="running-conditions__legend-swatch running-conditions__legend-swatch--poor" />
            Poor
          </span>
        </div>
      </div>
    );
  }
);

RunningConditionsWidget.displayName = 'RunningConditionsWidget';
