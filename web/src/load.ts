import { parseReports, readScenarios } from './analytics';
import { validateData } from './data';

async function fetchFile(name: string, signal: AbortSignal) {
  const response = await fetch(import.meta.env.BASE_URL + 'data/' + name, { signal });
  if (!response.ok) throw new Error('No se pudo cargar ' + name + ' (' + response.status + ').');
  return response.text();
}

export async function loadData(signal: AbortSignal) {
  const [hourly, manifest, quality, evaluations] = await Promise.all(
    ['hourly.csv', 'manifest.json', 'quality.json', 'evaluations.json'].map(name => fetchFile(name, signal)),
  );
  const qualityData: unknown = JSON.parse(quality);
  const evaluationData: unknown = JSON.parse(evaluations);
  const dataset = validateData(hourly, JSON.parse(manifest), qualityData, evaluationData);
  return { ...dataset, reports: parseReports(qualityData, evaluationData, dataset.rows) };
}

export type DashboardData = Awaited<ReturnType<typeof loadData>>;

export async function loadScenarios(data: DashboardData, signal: AbortSignal) {
  return readScenarios(await fetchFile('historical-scenarios.csv', signal), data.rows, data.reports.temporal.test);
}
