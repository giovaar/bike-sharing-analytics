export interface Hour {
  date: string;
  hour: number;
  weekday: number;
  workingday: number;
  weather: number;
  temperatureNormalized: number;
  casual: number;
  registered: number;
  total: number;
}

export interface Filters {
  start: string;
  end: string;
  workingday: string;
  weather: string;
}

export interface DataSet {
  rows: Hour[];
  range: [string, string];
  weatherLabels: Record<string, string>;
  missingHours: number;
}

export interface Aggregate {
  key: string;
  count: number;
  total: number;
  casual: number;
  registered: number;
  mean: number;
  casualMean: number;
  registeredMean: number;
}

export const fields = [
  'date', 'hour', 'weekday', 'workingday', 'weather', 'temperatureNormalized',
  'casual', 'registered', 'total',
];
const integer = /^(0|[1-9]\d*)$/;
const decimal = /^(0|1)(\.\d+)?$/;

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function parseHourly(text: string, range: [string, string]): Hour[] {
  const [header, ...lines] = text.trimEnd().split(/\r?\n/);
  if (header !== fields.join(',')) throw new Error('Las columnas del CSV no coinciden con el esquema 1.0.0.');
  let previous = '';
  return lines.map((line, index) => {
    const values = line.split(',');
    const date = values[0];
    if (values.length !== fields.length || !isDate(date) || date < range[0] || date > range[1]
      || values.slice(1).some((value, field) => !(field === 4 ? decimal : integer).test(value))) {
      throw new Error('Registro horario inválido en la fila ' + (index + 2) + '.');
    }
    const [hour, weekday, workingday, weather, temperatureNormalized, casual, registered, total] = values.slice(1).map(Number);
    const key = date + String(hour).padStart(2, '0');
    if (hour > 23 || weekday > 6 || workingday > 1 || weather < 1 || weather > 4
      || temperatureNormalized > 1 || ![casual, registered, total].every(Number.isSafeInteger)
      || casual + registered !== total || key <= previous) {
      throw new Error('Fecha, código o conteo inconsistente en la fila ' + (index + 2) + '.');
    }
    previous = key;
    return { date, hour, weekday, workingday, weather, temperatureNormalized, casual, registered, total };
  });
}

export function filterHours(rows: readonly Hour[], filters: Filters): Hour[] {
  return rows.filter(row => row.date >= filters.start && row.date <= filters.end
    && (filters.workingday === '' || String(row.workingday) === filters.workingday)
    && (filters.weather === '' || String(row.weather) === filters.weather));
}

export function summarize(rows: readonly Hour[]) {
  let total = 0;
  let casual = 0;
  let registered = 0;
  let peak: Hour | undefined;
  for (const row of rows) {
    total += row.total;
    casual += row.casual;
    registered += row.registered;
    if (!peak || row.total > peak.total) peak = row;
  }
  return {
    total, casual, registered, peak, count: rows.length,
    mean: rows.length ? total / rows.length : null,
    registeredShare: total ? registered / total : null,
  };
}

export function aggregate(rows: readonly Hour[], keyOf: (row: Hour) => string): Aggregate[] {
  const groups = new Map<string, { count: number; total: number; casual: number; registered: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key) ?? { count: 0, total: 0, casual: 0, registered: 0 };
    group.count++;
    group.total += row.total;
    group.casual += row.casual;
    group.registered += row.registered;
    groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({
    key, ...group, mean: group.total / group.count, casualMean: group.casual / group.count,
    registeredMean: group.registered / group.count,
  }));
}

export function hourKey(row: Pick<Hour, 'hour'>): string {
  return String(row.hour).padStart(2, '0') + ':00';
}

export function hourProfile(rows: readonly Hour[]) {
  const observed = new Map(aggregate(rows, hourKey).map(group => [group.key, group]));
  return Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, '0') + ':00';
    return { key, count: 0, mean: null, casualMean: null, registeredMean: null, ...observed.get(key) };
  });
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Metadatos inválidos.');
  return value as Record<string, unknown>;
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function validateData(text: string, manifest: unknown, quality: unknown, evaluations: unknown): DataSet {
  const metadata = object(manifest);
  const range = metadata.dateRange;
  if (metadata.schemaVersion !== '1.0.0' || metadata.encoding !== 'UTF-8'
    || !Array.isArray(metadata.fieldOrder) || metadata.fieldOrder.join(',') !== fields.join(',')
    || !Array.isArray(range) || range.length !== 2
    || range.some(value => typeof value !== 'string' || !isDate(value)) || range[0] > range[1]) {
    throw new Error('La versión o estructura del contrato de datos no es compatible.');
  }
  const dateRange: [string, string] = [range[0], range[1]];
  const weather = object(object(metadata.codes).weather);
  const weatherLabels: Record<string, string> = {};
  for (const code of ['1', '2', '3', '4']) {
    const label = weather[code];
    if (typeof label !== 'string' || !label.trim()) throw new Error('Faltan etiquetas de clima.');
    weatherLabels[code] = label;
  }
  const coverage = object(object(quality).coverage);
  const studies = object(evaluations);
  const academic = object(studies.academic);
  const temporal = object(studies.temporal);
  if (academic.phase !== '1B' || academic.split !== 'random-80-20' || temporal.phase !== '2A'
    || temporal.split !== 'chronological-holdout' || !Array.isArray(academic.classification)
    || !Array.isArray(academic.regression) || !Array.isArray(temporal.regression)) {
    throw new Error('El archivo de evaluaciones no coincide con el contrato.');
  }
  const rows = parseHourly(text, dateRange);
  if (!nonnegative(coverage.expectedHours) || !nonnegative(coverage.missingHours)
    || coverage.observedHours !== rows.length || coverage.expectedHours - rows.length !== coverage.missingHours
    || coverage.startDate !== range[0] || coverage.endDate !== range[1]) {
    throw new Error('La cobertura declarada no coincide con el archivo de observaciones.');
  }
  return { rows, range: dateRange, weatherLabels, missingHours: coverage.missingHours };
}
