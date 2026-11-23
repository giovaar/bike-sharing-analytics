import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { aggregate, filterHours, hourKey, hourProfile, isDate, parseHourly, summarize, validateData } from '../src/data.ts';

const read = name => readFileSync(new URL('../public/data/' + name, import.meta.url), 'utf8');
const csv = read('hourly.csv');
const manifest = JSON.parse(read('manifest.json'));
const quality = JSON.parse(read('quality.json'));
const evaluations = JSON.parse(read('evaluations.json'));
const { rows } = validateData(csv, manifest, quality, evaluations);
const all = { start: '2011-01-01', end: '2012-12-31', workingday: '', weather: '' };

test('verifies the audited export, contract version and all public payload hashes', () => {
  assert.equal(manifest.schemaVersion, '1.0.0');
  assert.equal(createHash('sha256').update(read('manifest.json')).digest('hex'),
    '5667df5bbc961860355bc2e86f11007ac0b7faa48cbf16f7713f8477d1a557c8');
  for (const name of ['hourly.csv', 'quality.json', 'evaluations.json']) {
    assert.equal(createHash('sha256').update(read(name)).digest('hex'), manifest.outputsSha256[name]);
  }
  assert.throws(() => validateData(csv, { ...manifest, schemaVersion: '2.0.0' }, quality, evaluations), /contrato/);
  assert.throws(() => validateData(csv, manifest, { coverage: { ...quality.coverage, observedHours: 0 } }, evaluations), /cobertura/);
});

test('KPIs agree with the historical total and use observed hours', () => {
  const stats = summarize(rows);
  assert.equal(stats.total, 3292679);
  assert.equal(stats.count, 17379);
  assert.equal(stats.mean, stats.total / 17379);
  assert.equal(stats.peak.total, 977);
  assert.equal(stats.casual, 620017);
  assert.equal(stats.registered, 2672662);
  assert.equal(stats.registeredShare, stats.registered / stats.total);
  assert.equal(quality.coverage.missingHours, 165);
});

test('global filters intersect inclusively and preserve the original timestamp', () => {
  const result = filterHours(rows, { ...all, start: '2012-02-29', end: '2012-02-29', workingday: '1', weather: '2' });
  assert.ok(result.length > 0);
  assert.equal(result.length, rows.filter(row => row.date === '2012-02-29' && row.workingday === 1 && row.weather === 2).length);
  assert.ok(result.every(row => row.date === '2012-02-29' && row.workingday === 1 && row.weather === 2));
  assert.equal(filterHours(rows, { ...all, weather: '4' }).length, 3);
  assert.equal(filterHours(rows, { ...all, start: '2011-01-01', end: '2011-01-01', workingday: '1' }).length, 0);
  assert.equal(hourKey({ hour: 0 }), '00:00');
  assert.equal(isDate('2012-02-29'), true);
  assert.equal(isDate('2011-02-29'), false);
});

test('aggregation reconciles counts, component totals and weighted means', () => {
  const months = aggregate(rows, row => row.date.slice(0, 7));
  assert.equal(months.length, 24);
  assert.equal(months[0].key, '2011-01');
  assert.equal(months.reduce((sum, month) => sum + month.total, 0), 3292679);
  assert.equal(months.reduce((sum, month) => sum + month.count, 0), 17379);
  for (const month of months) {
    assert.equal(month.casual + month.registered, month.total);
    assert.equal(month.mean, month.total / month.count);
  }
});

test('hour profiles represent missing groups as null and keep observed zeros', () => {
  const profile = hourProfile([{ ...rows[0], casual: 0, registered: 0, total: 0 }]);
  assert.equal(profile.length, 24);
  assert.equal(profile[0].count, 1);
  assert.equal(profile[0].mean, 0);
  assert.equal(profile[1].count, 0);
  assert.equal(profile[1].mean, null);
  assert.equal(summarize([]).mean, null);
  assert.equal(summarize([]).registeredShare, null);
});

test('rejects inconsistent components, duplicate timestamps and invalid hours', () => {
  const [header, first] = csv.split('\n');
  assert.ok(rows.every(row => row.casual + row.registered === row.total));
  assert.throws(() => parseHourly(header + '\n' + first.replace(/,\d+$/, ',999999'), allRange()), /inconsistente/);
  assert.throws(() => parseHourly(header + '\n' + first + '\n' + first, allRange()), /inconsistente/);
  assert.throws(() => parseHourly(header + '\n' + first.replace(/^([^,]+),\d+,/, '$1,24,'), allRange()), /inconsistente/);
});
function allRange() {
  return [all.start, all.end];
}
