import { format, isValid, parse, parseISO } from 'date-fns';

const DATE_OUTPUT_FORMAT = 'dd MMM';

export const formatPace = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const minutes = Math.floor(value);
  const seconds = Math.round((value - minutes) * 60);
  const paddedSeconds = seconds.toString().padStart(2, '0');
  return `${minutes}:${paddedSeconds}`;
};

export const formatValue = (value: number, unit?: string): string => {
  if (!Number.isFinite(value)) return '-';
  if (!unit) return value.toFixed(1);

  if (/min\/km|pace/i.test(unit)) {
    return formatPace(value);
  }

  if (/bpm|spm/i.test(unit)) {
    return Math.round(value).toString();
  }

  if (/km/i.test(unit)) {
    return value.toFixed(1);
  }

  if (/m\b|meters/i.test(unit)) {
    return Math.round(value).toString();
  }

  return value.toFixed(1);
};

const parseDateLabel = (label: string): Date | null => {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const insideParens = trimmed.match(/\(([^)]+)\)/)?.[1];
  const candidate = (insideParens || trimmed).trim();

  const isoCandidate = candidate.includes('/')
    ? candidate.replaceAll('/', '-')
    : candidate;

  const iso = parseISO(isoCandidate);
  if (isValid(iso)) return iso;

  const now = new Date();
  const formats = ['MMM d', 'MMM dd', 'MMMM d', 'MMMM dd', 'd MMM', 'dd MMM'];
  for (const fmt of formats) {
    const parsed = parse(candidate, fmt, now);
    if (isValid(parsed)) return parsed;
  }

  return null;
};

export const formatDateLabel = (label: string): string => {
  const parsed = parseDateLabel(label);
  if (!parsed) return label;
  return format(parsed, DATE_OUTPUT_FORMAT);
};
