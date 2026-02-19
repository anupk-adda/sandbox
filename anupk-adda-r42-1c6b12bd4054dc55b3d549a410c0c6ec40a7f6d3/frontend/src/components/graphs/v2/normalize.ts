export type NormalizedResult = {
  values: number[];
  min: number;
  max: number;
  isFlat: boolean;
};

const isPaceUnit = (unit?: string): boolean => {
  if (!unit) return false;
  return /min\/km|pace/i.test(unit);
};

export const normalizeRelative = (
  values: number[],
  unit?: string
): NormalizedResult => {
  if (!values || values.length === 0) {
    return { values: [], min: 0, max: 0, isFlat: true };
  }

  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (min === max) {
    return {
      values: new Array(values.length).fill(50),
      min,
      max,
      isFlat: true,
    };
  }

  const pace = isPaceUnit(unit);
  const range = max - min;
  const normalized = values.map((value) => {
    const ratio = ((value - min) / range) * 100;
    return pace ? 100 - ratio : ratio;
  });

  return { values: normalized, min, max, isFlat: false };
};
