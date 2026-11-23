import type { Hour } from './data.ts';

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('El informe tiene un formato inválido.');
  return value as Record<string, unknown>;
}
function collection<T>(value: unknown, parse: (entry: unknown) => T): T[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Faltan datos del informe.');
  return value.map(parse);
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Falta una etiqueta del informe.');
  return value;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('El informe contiene un número inválido.');
  return value;
}
function count(value: unknown): number {
  const result = finite(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('El informe contiene un conteo inválido.');
  return result;
}
function readPeriod(value: unknown) {
  const item = record(value);
  return { startDate: text(item.startDate), endDate: text(item.endDate), records: count(item.records) };
}
function readRegression(value: unknown) {
  const item = record(value);
  return { model: text(item.model), testR2: finite(item.testR2), testMae: finite(item.testMae), testRmse: finite(item.testRmse) };
}
export function parseReports(quality: unknown, evaluation: unknown, rows: readonly Hour[]) {
  const qualityInput = record(quality);
  const coverage = record(qualityInput.coverage);
  const months = collection(coverage.months, entry => {
    const item = record(entry);
    const month = text(item.month);
    const expected = count(item.expectedHours);
    const observed = count(item.observedHours);
    const missing = count(item.missingHours);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || observed + missing !== expected) throw new Error('Cobertura mensual inválida.');
    return { month, expected, observed, missing };
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  if (months.length !== counts.size || months.some((month, index) => (index && month.month <= months[index - 1].month)
    || month.observed !== counts.get(month.month))
    || months.reduce((sum, month) => sum + month.expected, 0) !== coverage.expectedHours
    || months.reduce((sum, month) => sum + month.missing, 0) !== coverage.missingHours) {
    throw new Error('La cobertura mensual no coincide con las observaciones.');
  }
  const checks = Object.entries(record(qualityInput.validations)).map(([key, status]) => {
    if (status !== 'passed') throw new Error('El dataset contiene comprobaciones pendientes.');
    return key;
  });
  const input = record(evaluation);
  const academic = record(input.academic);
  const temporal = record(input.temporal);
  const units = record(input.units);
  if (units.r2 !== 'dimensionless' || units.mae !== 'rentals/hour' || units.rmse !== 'rentals/hour'
    || units.accuracy !== 'fraction' || temporal.weatherSource !== 'observed' || academic.classificationStratified !== true) {
    throw new Error('Las unidades o el método de evaluación no son compatibles.');
  }
  const train = readPeriod(temporal.train);
  const test = readPeriod(temporal.test);
  const trainRecords = count(academic.trainRecords);
  const testRecords = count(academic.testRecords);
  const sourceStart = text(academic.datasetStartDate);
  const sourceEnd = text(academic.datasetEndDate);
  if (train.endDate >= test.startDate || train.startDate !== sourceStart || test.endDate !== sourceEnd
    || trainRecords + testRecords !== rows.length || train.records + test.records !== rows.length
    || rows.filter(row => row.date >= test.startDate && row.date <= test.endDate).length !== test.records) {
    throw new Error('Los periodos de evaluación no concuerdan con los registros.');
  }
  return {
    quality: { months, checks, expected: count(coverage.expectedHours), missing: count(coverage.missingHours) },
    academic: {
      sourceStart, sourceEnd, trainRecords, testRecords, seed: count(academic.seed),
      regression: collection(academic.regression, entry => ({ ...readRegression(entry), trainR2: finite(record(entry).trainR2) })),
      classification: collection(academic.classification, entry => {
        const item = record(entry);
        return { model: text(item.model), train: finite(item.trainAccuracy), test: finite(item.testAccuracy) };
      }),
    },
    temporal: { train, test, regression: collection(temporal.regression, readRegression) },
  };
}

export function temperatureBand(row: Hour) {
  return Math.min(Math.floor(row.temperatureNormalized * 10), 9);
}

export interface Scenario {
  date: string;
  hour: number;
  actual: number;
  randomForest: number;
  reference: number;
}

export function readScenarios(text: string, rows: readonly Hour[], test: { startDate: string; endDate: string; records: number }): Scenario[] {
  const [header, ...lines] = text.trimEnd().split(/\r?\n/);
  if (header !== 'date,hour,actual,randomForest,reference' || lines.length !== test.records) {
    throw new Error('El archivo de escenarios no contiene el periodo de prueba completo.');
  }
  const keyOf = (day: string, hour: number) => day + '-' + String(hour).padStart(2, '0');
  const observed = new Map(rows.filter(row => row.date >= test.startDate && row.date <= test.endDate)
    .map(row => [keyOf(row.date, row.hour), row.total]));
  if (observed.size !== test.records) throw new Error('El periodo de prueba no coincide con los datos.');
  let previous = '';
  return lines.map(line => {
    const [date, hourText, actualText, forestText, referenceText, ...extra] = line.split(',');
    const [hour, actual, randomForest, reference] = [hourText, actualText, forestText, referenceText].map(Number);
    const key = keyOf(date, hour);
    if (extra.length || ![hourText, actualText, forestText, referenceText].every(value => /^\d+(?:\.\d+)?$/.test(value))
      || !Number.isInteger(hour) || ![actual, randomForest, reference].every(Number.isFinite)
      || key <= previous || observed.get(key) !== actual) {
      throw new Error('Se encontró un escenario inválido o sin observación correspondiente.');
    }
    previous = key;
    return { date, hour, actual, randomForest, reference };
  });
}

export function absoluteErrors(scenario: Scenario) {
  return { forest: Math.abs(scenario.randomForest - scenario.actual), reference: Math.abs(scenario.reference - scenario.actual) };
}
