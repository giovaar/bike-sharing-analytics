import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateData, aggregate, filterHours } from '../src/data.ts';
import { parseReports, readScenarios, absoluteErrors, temperatureBand } from '../src/analytics.ts';

const read = name => readFileSync(new URL('../public/data/' + name, import.meta.url), 'utf8');
const quality = JSON.parse(read('quality.json'));
const evaluations = JSON.parse(read('evaluations.json'));
const { rows, range } = validateData(read('hourly.csv'), JSON.parse(read('manifest.json')), quality, evaluations);
const reports = parseReports(quality, evaluations, rows);
const scenarios = read('historical-scenarios.csv');

test('climate groups preserve observed denominators and the rare condition sample', () => {
  const groups = aggregate(rows, row => String(row.weather));
  assert.equal(groups.find(row => row.key === '4').count, 3);
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), 17379);
  assert.ok(groups.every(group => group.mean === group.total / group.count));
  assert.equal(temperatureBand({ temperatureNormalized: 1 }), 9);
  assert.equal(temperatureBand({ temperatureNormalized: 0 }), 0);
  const climate = filterHours(rows, { start: range[0], end: range[1], weather: '4', workingday: '' });
  assert.equal(climate.length, 3);
});

test('quality reconciles 24 monthly groups and rejects inconsistent monthly counts', () => {
  assert.equal(reports.quality.months.length, 24);
  assert.equal(reports.quality.expected, 17544);
  assert.equal(reports.quality.missing, 165);
  assert.equal(reports.quality.checks.length, 6);
  const broken = structuredClone(quality);
  broken.coverage.months[0].observedHours--;
  broken.coverage.months[0].missingHours++;
  assert.throws(() => parseReports(broken, evaluations, rows), /mensual/);
});

test('fixed evaluations preserve methodologies, units and values despite exploratory filters', () => {
  const narrowed = filterHours(rows, { start: '2011-01-01', end: '2011-01-01', workingday: '1', weather: '' });
  assert.equal(narrowed.length, 0);
  assert.equal(reports.academic.testRecords, 3476);
  assert.equal(reports.temporal.test.records, 2168);
  assert.equal(reports.academic.classification[0].test, 0.880897583429229);
  assert.equal(reports.temporal.regression[0].testR2, 0.8720785243692502);
  assert.equal(reports.academic.regression[0].testR2, 0.9448309495522738);
});

test('all historical scenarios match canonical observations and reproduce Phase 2A errors', () => {
  const entries = readScenarios(scenarios, rows, reports.temporal.test);
  assert.equal(entries.length, 2168);
  assert.equal(new Set(entries.map(entry => entry.date + '/' + entry.hour)).size, 2168);
  assert.equal(entries[0].date, '2012-10-01');
  assert.equal(entries.at(-1).date, '2012-12-31');
  for (const [index, key] of ['forest', 'reference'].entries()) {
    const errors = entries.map(entry => absoluteErrors(entry)[key]);
    const mae = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length);
    assert.ok(Math.abs(mae - reports.temporal.regression[index].testMae) < 1e-10);
    assert.ok(Math.abs(rmse - reports.temporal.regression[index].testRmse) < 1e-10);
  }
  assert.throws(() => readScenarios(scenarios.replace('2012-10-01,0,', '2012-10-01,25,'), rows, reports.temporal.test), /inválido/);
});

test('public payload contains only audited historical data', () => {
  for (const name of ['hourly.csv', 'quality.json', 'evaluations.json', 'manifest.json', 'historical-scenarios.csv']) {
    assert.doesNotMatch(read(name), /\b[A-Za-z]:[\\/]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  }
});
