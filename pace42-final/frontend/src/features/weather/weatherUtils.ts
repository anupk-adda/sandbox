export type HourlyWeather = {
  time: string;
  timestamp?: string;
  temperatureC?: number;
  humidity?: number;
  windKph?: number;
  precipProbability?: number;
  precipitationMm?: number;
  lightningProbability?: number;
};

export type ConditionBucket = 'GOOD' | 'FAIR' | 'POOR';

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const normalizePercent = (value?: number): number | null => {
  if (value === undefined || value === null || !Number.isFinite(value)) return null;
  if (value <= 1) return clamp(value * 100, 0, 100) / 100;
  return clamp(value, 0, 100) / 100;
};

export const hourHasSignal = (hour: HourlyWeather): boolean => {
  return [
    hour.temperatureC,
    hour.humidity,
    hour.windKph,
    hour.precipProbability,
    hour.precipitationMm,
    hour.lightningProbability,
  ].some((value) => value !== undefined && value !== null && Number.isFinite(value));
};

export const computeConditionScore = (hour: HourlyWeather): number => {
  let score = 90;

  const precipProb = normalizePercent(hour.precipProbability);
  const humidity = normalizePercent(hour.humidity);
  const lightning = normalizePercent(hour.lightningProbability);
  const temp = hour.temperatureC;
  const precipMm = hour.precipitationMm;

  const tempGood = temp !== undefined && temp >= 10 && temp <= 22;
  const tempFair = temp !== undefined && temp >= 23 && temp <= 30;
  const tempPoor = temp !== undefined && temp > 30;
  const tempCold = temp !== undefined && temp < 10;

  const rainProbFair = precipProb !== null && precipProb >= 0.3 && precipProb <= 0.6;
  const rainProbPoor = precipProb !== null && precipProb > 0.6;

  const lightRain = precipMm !== undefined && precipMm !== null && precipMm >= 0.2 && precipMm < 2;
  const heavyRain = precipMm !== undefined && precipMm !== null && precipMm >= 2;

  const humidityFair = humidity !== null && humidity >= 0.75 && humidity <= 0.85;
  const humidityPoor = humidity !== null && humidity > 0.85;

  const lightningPoor = lightning !== null && lightning >= 0.1;
  const heatIndexHigh =
    temp !== undefined &&
    humidity !== null &&
    temp >= 30 &&
    humidity >= 0.7;

  if (tempGood) score -= 0;
  if (tempFair) score -= 20;
  if (tempPoor) score -= 45;
  if (tempCold) score -= 20;

  if (rainProbFair) score -= 15;
  if (rainProbPoor) score -= 35;

  if (lightRain) score -= 10;
  if (heavyRain) score -= 25;

  if (humidityFair) score -= 10;
  if (humidityPoor) score -= 25;

  if (lightningPoor) score -= 50;
  if (heatIndexHigh) score -= 20;

  const hasPoorCondition = Boolean(
    tempPoor || rainProbPoor || lightningPoor || heavyRain || heatIndexHigh
  );
  const hasFairCondition = Boolean(
    tempFair || tempCold || rainProbFair || lightRain || humidityFair
  );

  if (hasPoorCondition) {
    score = Math.min(score, 40);
  } else if (hasFairCondition) {
    score = Math.min(score, 60);
  } else {
    score = Math.max(score, 75);
  }

  return clamp(Math.round(score));
};

export const bucket = (score: number): ConditionBucket => {
  if (score >= 70) return 'GOOD';
  if (score >= 45) return 'FAIR';
  return 'POOR';
};

const bucketLabel = (bucketType: ConditionBucket): string => {
  switch (bucketType) {
    case 'GOOD':
      return 'good';
    case 'FAIR':
      return 'fair';
    default:
      return 'poor';
  }
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const summaryGenerator = (
  hours: Array<{ time: string; score: number; bucket: ConditionBucket }>
): string => {
  if (!hours.length) {
    return 'Running conditions data is unavailable right now.';
  }

  const counts = hours.reduce(
    (acc, hour) => {
      acc[hour.bucket] += 1;
      return acc;
    },
    { GOOD: 0, FAIR: 0, POOR: 0 } as Record<ConditionBucket, number>
  );

  const modeBucket: ConditionBucket =
    counts.GOOD >= counts.FAIR && counts.GOOD >= counts.POOR
      ? 'GOOD'
      : counts.FAIR >= counts.POOR
        ? 'FAIR'
        : 'POOR';

  const worstBucket: ConditionBucket = counts.POOR > 0 ? 'POOR' : counts.FAIR > 0 ? 'FAIR' : 'GOOD';

  let bestWindow = hours[0];
  let bestWindowScore = -Infinity;
  let bestWindowLabel = hours[0].time;

  for (let i = 0; i < hours.length - 1; i += 1) {
    const avg = (hours[i].score + hours[i + 1].score) / 2;
    if (avg > bestWindowScore) {
      bestWindowScore = avg;
      bestWindow = hours[i];
      bestWindowLabel = `${hours[i].time}–${hours[i + 1].time}`;
    }
  }

  const overall = bucketLabel(modeBucket);
  const worst = bucketLabel(worstBucket);
  const bestWindowText = hours.length > 1 ? bestWindowLabel : bestWindow.time;

  return `${capitalize(overall)} conditions are expected overall with ${worst} spells possible; best 2-hour window is ${bestWindowText}.`;
};

export const formatHourLabel = (label: string): string => {
  if (!label) return '--';
  return label.replace(':00', '').replace(/\s?AM/i, 'a').replace(/\s?PM/i, 'p');
};
