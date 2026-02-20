import type { RunSample } from './runAnalysisUtils';

const buildWave = (index: number, base: number, amplitude: number, period: number) =>
  base + Math.sin(index / period) * amplitude;

export const buildMockRunSamples = (totalMinutes = 48, points = 120): RunSample[] => {
  const samples: RunSample[] = [];
  const start = new Date();
  const secondsPerPoint = (totalMinutes * 60) / points;
  let distanceKm = 0;

  for (let i = 0; i < points; i += 1) {
    const timestamp = new Date(start.getTime() + i * secondsPerPoint * 1000).toISOString();
    const pace = buildWave(i, 5.2, 0.45, 10);
    distanceKm += secondsPerPoint / 60 / pace;

    samples.push({
      timestamp,
      distanceKm: Number(distanceKm.toFixed(2)),
      metrics: {
        heartRate: buildWave(i, 148, 10, 8) + (i > points * 0.7 ? 6 : 0),
        pace,
        cadence: buildWave(i, 170, 6, 6),
        elevation: buildWave(i, 32, 8, 12),
        power: buildWave(i, 210, 20, 7),
        groundContactTime: buildWave(i, 260, 15, 9),
        lapAvgPace: buildWave(i, 5.15, 0.35, 14),
        strideLength: buildWave(i, 1.05, 0.08, 11),
      },
    });
  }

  return samples;
};
