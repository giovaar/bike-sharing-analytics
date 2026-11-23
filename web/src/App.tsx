import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { aggregate, filterHours, hourKey, hourProfile, summarize } from './data';
import type { DataSet, Filters, Hour } from './data';
import { loadData, loadScenarios } from './load';
import type { DashboardData } from './load';
import { absoluteErrors, temperatureBand } from './analytics';
import type { Scenario } from './analytics';
import './style.css';

const sections = [
  { id: 'resumen', label: 'Resumen general', icon: 'grid' },
  { id: 'demanda', label: 'Demanda temporal', icon: 'trend' },
  { id: 'usuarios', label: 'Tipos de usuario', icon: 'users' },
  { id: 'clima', label: 'Clima y demanda', icon: 'weather' },
  { id: 'calidad', label: 'Calidad de datos', icon: 'quality' },
  { id: 'ml', label: 'Machine Learning', icon: 'model' },
  { id: 'historico', label: 'Explorador histórico', icon: 'history' },
] as const;
type Section = typeof sections[number]['id'];
type IconName = typeof sections[number]['icon'] | 'bike' | 'calendar' | 'clock' | 'pin' | 'reset';
const paths: Record<IconName, React.ReactNode> = {
  weather: <><path d="M5 17h13a3 3 0 000-6h-1a5 5 0 00-9-2 4 4 0 00-3 8z"/><path d="M6 3v2M2 6l2 1"/></>,
  quality: <><path d="M12 3l8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6z"/><path d="m8 12 3 3 5-6"/></>,
  model: <><circle cx="5" cy="17" r="2"/><circle cx="10" cy="8" r="2"/><circle cx="18" cy="12" r="2"/><path d="m6 15 3-5m3-1 4 2"/></>,
  history: <><path d="M3 11a9 9 0 119 10m-9-10V6m0 5h5"/><path d="M12 7v5l4 2"/></>,
  bike: <><circle cx="5" cy="16" r="3.5"/><circle cx="19" cy="16" r="3.5"/><path d="M5 16l4-8 5 8H5m9 0 3-9h2m-10 1H7m9 2 3 6"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  trend: <path d="M3 18l6-6 4 3 7-8m-5 0h5v5"/>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 015-5h2a5 5 0 015 5v2m2-15a3 3 0 010 6m4 9v-2a5 5 0 00-3-4"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  pin: <><path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1114 0z"/><circle cx="12" cy="10" r="2"/></>,
  reset: <path d="M3 10a9 9 0 111 7m-1-7V5m0 5h5"/>,
};
function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const number = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('es-PA', { style: 'percent', maximumFractionDigits: 1 });
const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function shortDate(value: string) {
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return day ? day + ' ' + months[Number(month) - 1] : months[Number(month) - 1] + ' ' + year.slice(2);
}
const fmt = (n: number | null | undefined) => n == null ? '—' : number.format(n);
const initialFilters = ([start, end]: [string, string]): Filters => ({ start, end, workingday: '', weather: '' });
const colors = { total: '#087865', casual: '#df733e', registered: '#087865' };
const reduceMotionTooltip = { isAnimationActive: false, contentStyle: { borderRadius: 10, borderColor: '#dbe7e3' } };

function Sidebar({ section }: { section: Section }) {
  return <aside className="sidebar">
    <a className="brand" href="#resumen"><span className="brand-icon"><Icon name="bike"/></span><span>Bike Sharing<span className="brand-sub">Analytics</span></span></a>
    <nav aria-label="Secciones del dashboard">
      {sections.map(item => <a key={item.id} href={'#' + item.id} aria-current={item.id === section ? 'page' : undefined}><Icon name={item.icon}/><span>{item.label}</span></a>)}
    </nav>
    <div className="sidebar-foot"><Icon name="pin"/><div>Washington D. C.<small>Capital Bikeshare · 2011–2012</small></div></div>
  </aside>;
}

function FilterBar({ data, value, set, datesOnly = false }: { data: DataSet; value: Filters; set: (filters: Filters) => void; datesOnly?: boolean }) {
  const update = (key: keyof Filters, next: string) => set({ ...value, [key]: next });
  return <form className={datesOnly ? "filters dates-only" : "filters"} aria-label="Filtros de datos" onSubmit={e => e.preventDefault()}>
    <label>Desde<input type="date" min={data.range[0]} max={data.range[1]} value={value.start} onChange={e => update('start', e.target.value)} required/></label>
    <label>Hasta<input type="date" min={data.range[0]} max={data.range[1]} value={value.end} onChange={e => update('end', e.target.value)} required/></label>
    {!datesOnly && <><label>Tipo de día<select value={value.workingday} onChange={e => update('workingday', e.target.value)}>
      <option value="">Todos los días</option><option value="1">Día laborable</option><option value="0">Fin de semana o feriado</option>
    </select></label>
    <label>Condición climática<select value={value.weather} onChange={e => update('weather', e.target.value)}>
      <option value="">Todas las condiciones</option>{Object.entries(data.weatherLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
    </select></label></>}
    <button className="reset" type="button" onClick={() => set(datesOnly ? { ...value, start: data.range[0], end: data.range[1] } : initialFilters(data.range))}><Icon name="reset"/>Restablecer</button>
  </form>;
}

function Metric({ icon, title, value, detail }: { icon: IconName; title: string; value: string; detail: string }) {
  return <article className="metric"><span className="metric-icon"><Icon name={icon}/></span><p>{title}</p><strong>{value}</strong><small>{detail}</small></article>;
}
interface ChartRow { key: string; count: number; value?: number | null; casualMean?: number | null; registeredMean?: number | null }
interface Series { key: 'value' | 'casualMean' | 'registeredMean'; label: string }
function AccessibleTable({ rows, series }: { rows: ChartRow[]; series: Series[] }) {
  const [open, setOpen] = useState(false);
  return <details className="chart-table" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Ver datos en tabla</summary>
    {open && <div className="table-scroll"><table><caption className="sr-only">Valores del gráfico y horas observadas</caption>
      <thead><tr><th scope="col">Periodo</th>{series.map(s => <th key={s.key} scope="col">{s.label}</th>)}<th scope="col">Horas observadas</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.key}</th>{series.map(s => <td key={s.key}>{fmt(row[s.key])}</td>)}<td>{fmt(row.count)}</td></tr>)}</tbody>
    </table></div>}
  </details>;
}
function ChartCard({ title, subtitle, children, rows, series, control }: {
  title: string; subtitle: string; children: React.ReactNode; rows: ChartRow[]; series: Series[]; control?: React.ReactNode;
}) {
  return <article className="chart-card">
    <header className="chart-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{control}</header>
    <div className="plot">{children}</div>
    <AccessibleTable rows={rows} series={series}/>
  </article>;
}
const totalSeries: Series[] = [{ key: 'value', label: 'Alquileres' }];
const userSeries: Series[] = [{ key: 'casualMean', label: 'Casuales' }, { key: 'registeredMean', label: 'Registrados' }];
function TotalChart({ rows, kind, unit = 'Alquileres' }: { rows: ChartRow[]; kind: 'area' | 'bar'; unit?: string }) {
  const x = <XAxis dataKey="key" tickFormatter={shortDate} minTickGap={23} axisLine={false} tickLine={false} tick={{ fill: '#506560', fontSize: 12 }} />;
  const y = <YAxis width={58} tickFormatter={fmt} axisLine={false} tickLine={false} tick={{ fill: '#506560', fontSize: 12 }} />;
  const tooltip = <Tooltip {...reduceMotionTooltip} formatter={value => [fmt(Number(value)), unit]} />;
  const grid = <CartesianGrid vertical={false} stroke="#e5eeeb" strokeDasharray="3 4"/>;
  return <ResponsiveContainer width="100%" height="100%" minWidth={0}>
    {kind === 'area'
      ? <AreaChart data={rows} accessibilityLayer margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs><linearGradient id="rental-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#43c5a6" stopOpacity={0.42}/><stop offset="100%" stopColor="#43c5a6" stopOpacity={0.02}/></linearGradient></defs>
        {grid}{x}{y}{tooltip}<Area type="linear" dataKey="value" stroke={colors.total} strokeWidth={2.5} fill="url(#rental-fill)" isAnimationActive={false} dot={rows.length === 1} connectNulls={false}/>
      </AreaChart>
      : <BarChart data={rows} accessibilityLayer margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {grid}{x}{y}{tooltip}<Bar dataKey="value" fill={colors.total} radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}/>
      </BarChart>}
  </ResponsiveContainer>;
}
function UserChart({ rows, stacked }: { rows: ChartRow[]; stacked: boolean }) {
  const x = <XAxis dataKey="key" minTickGap={22} axisLine={false} tickLine={false} tick={{ fill: '#506560', fontSize: 12 }}/>;
  const y = <YAxis width={48} tickFormatter={fmt} axisLine={false} tickLine={false} tick={{ fill: '#506560', fontSize: 12 }}/>;
  const grid = <CartesianGrid vertical={false} stroke="#e5eeeb" strokeDasharray="3 4"/>;
  const tooltip = <Tooltip {...reduceMotionTooltip} formatter={(value, name) => [fmt(Number(value)), String(name)]}/>;
  return <>
    <div className="legend"><span><i className="casual-dot"/>Casuales</span><span><i className="registered-dot"/>Registrados</span></div>
    <ResponsiveContainer width="100%" height="88%" minWidth={0}>
      {stacked
        ? <BarChart data={rows} accessibilityLayer>{grid}{x}{y}{tooltip}
          <Bar dataKey="registeredMean" name="Registrados" stackId="users" fill={colors.registered} maxBarSize={31} isAnimationActive={false}/>
          <Bar dataKey="casualMean" name="Casuales" stackId="users" fill={colors.casual} radius={[4, 4, 0, 0]} isAnimationActive={false}/>
        </BarChart>
        : <LineChart data={rows} accessibilityLayer>{grid}{x}{y}{tooltip}
          <Line dataKey="registeredMean" name="Registrados" stroke={colors.registered} strokeWidth={2.5} dot={false} isAnimationActive={false}/>
          <Line dataKey="casualMean" name="Casuales" stroke={colors.casual} strokeWidth={2.5} strokeDasharray="6 4" dot={false} isAnimationActive={false}/>
        </LineChart>}
    </ResponsiveContainer>
  </>;
}

function Overview({ rows }: { rows: Hour[] }) {
  const stats = summarize(rows);
  const monthly = aggregate(rows, row => row.date.slice(0, 7)).map(item => ({ ...item, value: item.total }));
  const profile = hourProfile(rows).map(item => ({ ...item, value: item.mean }));
  return <>
    <div className="metrics">
      <Metric icon="bike" title="Alquileres observados" value={fmt(stats.total)} detail="Durante el periodo seleccionado"/>
      <Metric icon="trend" title="Promedio por hora" value={fmt(stats.mean)} detail="Alquileres por hora observada"/>
      <Metric icon="clock" title="Pico horario" value={fmt(stats.peak?.total)} detail={stats.peak ? stats.peak.date + ' · ' + hourKey(stats.peak) : 'Sin datos'}/>
      <Metric icon="calendar" title="Horas observadas" value={fmt(stats.count)} detail="Registros en la selección"/>
    </div>
    <div className="chart-grid overview-charts">
      <ChartCard title="Alquileres por mes" subtitle="Total de alquileres observados" rows={monthly} series={totalSeries}><TotalChart rows={monthly} kind="area"/></ChartCard>
      <ChartCard title="Perfil horario" subtitle="Alquileres por hora observada" rows={profile} series={totalSeries}><TotalChart rows={profile} kind="bar"/></ChartCard>
    </div>
  </>;
}


function DemandHeatmap({ rows }: { rows: Hour[] }) {
  const values = new Map(aggregate(rows, row => row.weekday + '/' + hourKey(row)).map(group => [group.key, group]));
  const days = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']] as const;
  const hours = hourProfile([]).map(group => group.key);
  const highest = Math.max(1, ...[...values.values()].map(group => group.mean));
  return <article className="chart-card heatmap-card">
    <header className="chart-header"><div><h2>Demanda por día y hora</h2><p>Alquileres por hora observada. El guion indica que no hay observaciones.</p></div></header>
    <div className="heatmap-scroll" tabIndex={0} role="region" aria-label="Mapa de calor desplazable">
      <table className="heatmap"><caption className="sr-only">Promedio y cantidad de observaciones por día de la semana y hora</caption>
        <thead><tr><th scope="col">Día</th>{hours.map(hour => <th key={hour} scope="col">{hour.slice(0, 2)}</th>)}</tr></thead>
        <tbody>{days.map(([day, label]) => <tr key={day}><th scope="row">{label}</th>{hours.map(hour => {
          const group = values.get(day + '/' + hour);
          const shade = group ? Math.round(96 - (group.mean / highest) * 26) : undefined;
          return <td key={hour} title={group ? fmt(group.mean) + ' alquileres por hora · ' + fmt(group.count) + ' horas observadas' : 'Sin observaciones'}
            style={shade == null ? undefined : { background: 'hsl(161 44% ' + shade + '%)', color: '#12322c' }}>
            {group ? fmt(Math.round(group.mean)) : '—'}<span className="sr-only">{group ? ', ' + fmt(group.count) + ' horas observadas' : ' Sin observaciones'}</span>
          </td>;
        })}</tr>)}</tbody>
      </table>
    </div>
  </article>;
}

function Demand({ rows }: { rows: Hour[] }) {
  const [grain, setGrain] = useState<'day' | 'month'>('day');
  const timeline = aggregate(rows, row => grain === 'day' ? row.date : row.date.slice(0, 7)).map(item => ({ ...item, value: item.total }));
  const profile = hourProfile(rows).map(item => ({ ...item, value: item.mean }));
  return <><div className="chart-grid">
    <ChartCard title="Evolución de la demanda" subtitle="Total de alquileres por periodo" rows={timeline} series={totalSeries}
      control={<label className="inline-filter">Granularidad<select value={grain} onChange={e => setGrain(e.target.value === 'month' ? 'month' : 'day')}><option value="day">Diaria</option><option value="month">Mensual</option></select></label>}>
      <TotalChart rows={timeline} kind="area"/>
    </ChartCard>
    <ChartCard title="Demanda por hora del día" subtitle="Alquileres por hora observada" rows={profile} series={totalSeries}><TotalChart rows={profile} kind="bar"/></ChartCard>
  </div><DemandHeatmap rows={rows}/></>;
}

function Users({ rows }: { rows: Hour[] }) {
  const stats = summarize(rows);
  const profile = hourProfile(rows);
  return <>
    <div className="metrics user-metrics">
      <Metric icon="users" title="Alquileres casuales" value={fmt(stats.casual)} detail="Durante el periodo seleccionado"/>
      <Metric icon="bike" title="Alquileres registrados" value={fmt(stats.registered)} detail="Durante el periodo seleccionado"/>
      <Metric icon="trend" title="Participación registrada" value={stats.registeredShare == null ? '—' : percent.format(stats.registeredShare)} detail="Proporción del total de alquileres"/>
    </div>
    <div className="chart-grid">
      <ChartCard title="Composición por hora" subtitle="Promedio de alquileres por hora observada" rows={profile} series={userSeries}><UserChart rows={profile} stacked/></ChartCard>
      <ChartCard title="Perfil de cada grupo" subtitle="Promedio de alquileres por hora observada" rows={profile} series={userSeries}><UserChart rows={profile} stacked={false}/></ChartCard>
    </div>
  </>;
}


const weatherNames: Record<string, string> = { '1': 'Despejado', '2': 'Neblina', '3': 'Lluvia ligera', '4': 'Tiempo severo' };
const hourUnits = 'Alquileres por hora observada';

function Climate({ rows, labels }: { rows: Hour[]; labels: Record<string, string> }) {
  const weather = aggregate(rows, row => String(row.weather));
  const temperature = aggregate(rows, row => String(temperatureBand(row))).map(group => {
    const lower = Number(group.key) / 10;
    return { ...group, key: lower.toFixed(1) + '–' + (lower + 0.1).toFixed(1), value: group.mean };
  });
  const groups = weather.map(group => ({ ...group, key: weatherNames[group.key], value: group.mean }));
  return <>
    <div className="chart-grid">
      <ChartCard title="Demanda por condición climática" subtitle={hourUnits} rows={groups} series={totalSeries}>
        <TotalChart rows={groups} kind="bar"/>
      </ChartCard>
      <ChartCard title="Temperatura y demanda" subtitle="Media por intervalo de temperatura normalizada (0–1)" rows={temperature} series={totalSeries}>
        <TotalChart rows={temperature} kind="bar"/>
      </ChartCard>
    </div>
    <article className="chart-card report-card">
      <header className="chart-header"><div><h2>Muestra por condición</h2><p>Las categorías con pocas observaciones ofrecen evidencia limitada.</p></div></header>
      <table className="report-table"><caption className="sr-only">Horas observadas y demanda media por condición</caption>
        <thead><tr><th scope="col">Condición</th><th scope="col">Horas</th><th scope="col">Alquileres/h</th></tr></thead>
        <tbody>{weather.map(group => <tr key={group.key}><th scope="row">{labels[group.key]}</th><td>{fmt(group.count)}</td><td>{fmt(group.mean)}</td></tr>)}</tbody>
      </table>
    </article>
  </>;
}

const checkLabels: Record<string, string> = {
  calendarConsistency: 'Consistencia de fechas y calendario',
  categoricalCodes: 'Códigos categóricos válidos',
  completeCalendarDates: 'Fechas de calendario completas',
  schemaAndTypes: 'Esquema y tipos de datos',
  uniqueTimestampsAndIds: 'Fechas, horas e identificadores únicos',
  userCountsSumToTotal: 'Casuales y registrados suman el total',
};
function Quality({ data, filters }: { data: DashboardData; filters: Filters }) {
  const start = filters.start.slice(0, 7), end = filters.end.slice(0, 7);
  const months = data.reports.quality.months.filter(month => month.month >= start && month.month <= end);
  const points = months.map(month => ({ key: month.month, value: month.missing, count: month.observed }));
  return <>
    <div className="metrics user-metrics">
      <Metric icon="calendar" title="Horas esperadas" value={fmt(data.reports.quality.expected)} detail="Calendario completo, 2011–2012"/>
      <Metric icon="clock" title="Horas observadas" value={fmt(data.rows.length)} detail="Dataset completo, 2011–2012"/>
      <Metric icon="grid" title="Horas sin registro" value={fmt(data.missingHours)} detail="Dataset completo, 2011–2012"/>
    </div>
    <div className="chart-grid">
      <ChartCard title="Horas sin registro por mes" subtitle="Meses completos que coinciden con el intervalo de fechas" rows={points}
        series={[{ key: 'value', label: 'Horas sin registro' }]}><TotalChart rows={points} kind="bar" unit="Horas sin registro"/></ChartCard>
      <article className="chart-card">
        <header className="chart-header"><div><h2>Validaciones del dataset</h2><p>Comprobaciones del exportador para los dos años.</p></div></header>
        <ul className="checks">{data.reports.quality.checks.map(key => <li key={key}><span aria-hidden="true">✓</span>{checkLabels[key] ?? key}</li>)}</ul>
      </article>
    </div>
    <article className="chart-card report-card">
      <header className="chart-header"><div><h2>Cobertura mensual</h2><p>Se muestran meses completos, independientemente del clima y del tipo de día.</p></div></header>
      <table className="report-table"><caption className="sr-only">Horas esperadas, observadas y sin registro por mes</caption>
        <thead><tr><th scope="col">Mes</th><th scope="col">Esperadas</th><th scope="col">Observadas</th><th scope="col">Sin registro</th></tr></thead>
        <tbody>{months.map(month => <tr key={month.month}><th scope="row">{month.month}</th><td>{fmt(month.expected)}</td><td>{fmt(month.observed)}</td><td>{fmt(month.missing)}</td></tr>)}</tbody>
      </table>
    </article>
  </>;
}
const score = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 4, minimumFractionDigits: 2 });
function RegressionTable({ rows, academic = false }: { rows: DashboardData['reports']['temporal']['regression']; academic?: boolean }) {
  return <div className="table-scroll horizontal-table" tabIndex={0} role="region" aria-label="Tabla desplazable de regresión">
    <table className="report-table"><caption className="sr-only">Métricas de regresión</caption>
      <thead><tr><th scope="col">Modelo</th>{academic && <th scope="col">R² entr.</th>}<th scope="col">R² prueba</th><th scope="col">MAE</th><th scope="col">RMSE</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.model}>
        <th scope="row">{row.model === 'Hourly mean by working day' ? 'Media histórica por hora y tipo de día' : row.model}</th>
        {academic && <td>{'trainR2' in row && typeof row.trainR2 === 'number' ? score.format(row.trainR2) : '—'}</td>}
        <td>{score.format(row.testR2)}</td><td>{score.format(row.testMae)}</td><td>{score.format(row.testRmse)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function Evaluation({ data }: { data: DashboardData }) {
  const { academic, temporal } = data.reports;
  return <>
    <article className="chart-card report-card">
      <header className="chart-header"><div><h2>Evaluación temporal · Fase 2A</h2>
        <p>Comparación de regresión con clima observado, sobre las mismas {fmt(temporal.test.records)} horas.</p></div></header>
      <dl className="study-details"><div><dt>Entrenamiento</dt><dd>{temporal.train.startDate} al {temporal.train.endDate} · {fmt(temporal.train.records)} horas</dd></div>
        <div><dt>Prueba</dt><dd>{temporal.test.startDate} al {temporal.test.endDate} · {fmt(temporal.test.records)} horas</dd></div></dl>
      <RegressionTable rows={temporal.regression}/>
      <p className="panel-note">R² es adimensional. MAE y RMSE se expresan en alquileres por hora.</p>
    </article>
    <article className="chart-card report-card">
      <header className="chart-header"><div><h2>Evaluación académica reproducida · Fase 1B</h2>
        <p>División aleatoria 80/20 con semilla {academic.seed} y estratificación en clasificación. Datos de {academic.sourceStart} a {academic.sourceEnd}.</p></div></header>
      <p className="panel-note">{fmt(academic.trainRecords)} horas de entrenamiento y {fmt(academic.testRecords)} de prueba. Las dos evaluaciones usan conjuntos de prueba distintos.</p>
      <h3>Clasificación</h3>
      <table className="report-table"><caption className="sr-only">Exactitud en clasificación por modelo</caption>
        <thead><tr><th scope="col">Modelo</th><th scope="col">Exactitud entr.</th><th scope="col">Exactitud prueba</th></tr></thead>
        <tbody>{academic.classification.map(row => <tr key={row.model}><th scope="row">{row.model}</th><td>{percent.format(row.train)}</td><td>{percent.format(row.test)}</td></tr>)}</tbody>
      </table>
      <h3>Regresión</h3>
      <RegressionTable rows={academic.regression} academic/>
      <p className="panel-note">R² es adimensional. MAE y RMSE de prueba se expresan en alquileres por hora.</p>
    </article>
  </>;
}

function Explorer({ data }: { data: DashboardData }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [date, setDate] = useState('');
  const [hour, setHour] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadScenarios(data, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setScenarios(result);
        setDate(result[0].date);
        setHour(result[0].hour);
      }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudieron leer los escenarios.');
    });
    return () => controller.abort();
  }, [data, attempt]);
  if (error) return <article className="notice" role="alert"><h2>No se pudieron cargar los escenarios</h2><p>{error}</p>
    <button type="button" className="reset" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Reintentar</button></article>;
  if (!scenarios.length) return <article className="notice" role="status">Cargando escenarios históricos…</article>;
  const dates = [...new Set(scenarios.map(item => item.date))];
  const day = scenarios.filter(item => item.date === date);
  const selected = day.find(item => item.hour === hour);
  const errors = selected && absoluteErrors(selected);
  return <article className="chart-card report-card">
    <header className="chart-header"><div><h2>Observación y estimaciones</h2><p>{fmt(scenarios.length)} horas disponibles del último trimestre de 2012.</p></div></header>
    <div className="scenario-controls">
      <label>Fecha histórica<select value={date} onChange={e => {
        const nextDate = e.target.value;
        const nextDay = scenarios.filter(item => item.date === nextDate);
        setDate(nextDate);
        if (!nextDay.some(item => item.hour === hour)) setHour(nextDay[0].hour);
      }}>{dates.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Hora observada<select value={hour} onChange={e => setHour(Number(e.target.value))}>
        {day.map(item => <option key={item.hour} value={item.hour}>{hourKey(item)}</option>)}</select></label>
    </div>
    {selected && errors ? <div aria-live="polite">
      <p className="observed-reading">Valor observado <strong>{fmt(selected.actual)}</strong> alquileres en la hora</p>
      <table className="report-table"><caption className="sr-only">Estimaciones y errores absolutos para la hora seleccionada</caption>
        <thead><tr><th scope="col">Modelo</th><th scope="col">Estimación</th><th scope="col">Error absoluto</th></tr></thead>
        <tbody><tr><th scope="row">Random Forest</th><td>{score.format(selected.randomForest)}</td><td>{score.format(errors.forest)}</td></tr>
          <tr><th scope="row">Media histórica</th><td>{score.format(selected.reference)}</td><td>{score.format(errors.reference)}</td></tr>
        </tbody></table>
    </div> : <p role="status">Sin observación para la fecha y hora seleccionadas.</p>}
    <p className="panel-note">Las estimaciones fueron calculadas durante la evaluación temporal con clima observado. Las horas sin registro quedan fuera del selector.</p>
  </article>;
}

function activeSection(): Section {
  return sections.find(item => '#' + item.id === window.location.hash)?.id ?? 'resumen';
}
const titles: Record<Section, [string, string]> = {
  resumen: ['Resumen general', 'Explora dos años de viajes en el sistema de bicicletas compartidas de Washington D. C.'],
  demanda: ['Demanda temporal', 'Examina cómo cambian los alquileres a lo largo del periodo y de las horas del día.'],
  usuarios: ['Casuales vs. registrados', 'Compara los alquileres de usuarios casuales y registrados por hora del día.'],
  clima: ['Clima y demanda', 'Explora la demanda media por condición climática y temperatura observada.'],
  calidad: ['Calidad de datos', 'Consulta la cobertura horaria y las comprobaciones del conjunto histórico.'],
  ml: ['Machine Learning', 'Compara los resultados reproducidos con dos metodologías de evaluación.'],
  historico: ['Explorador histórico', 'Consulta estimaciones ya calculadas para horas observadas de octubre a diciembre de 2012.'],
};

export default function App() {
  const [section, setSection] = useState(activeSection);
  const [data, setData] = useState<DashboardData>();
  const [filters, setFilters] = useState<Filters>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const change = () => {
      if (window.location.hash !== '#contenido') setSection(activeSection());
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setData(result);
        setFilters(initialFilters(result.range));
      }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Error al leer los datos.');
    });
    return () => controller.abort();
  }, [attempt]);
  const validDates = Boolean(data && filters && filters.start >= data.range[0] && filters.end <= data.range[1] && filters.start <= filters.end);
  const rows = useMemo(() => data && filters && validDates ? filterHours(data.rows, filters) : [], [data, filters, validDates]);

  const exploratory = section !== 'ml' && section !== 'historico';

  return <>
    <a className="skip" href="#contenido">Saltar al contenido</a>
    <Sidebar section={section}/>
    <main id="contenido" tabIndex={-1}>
      <header className="page-header"><div><div className="location"><Icon name="pin"/>Washington D. C. · Capital Bikeshare</div><h1>{titles[section][0]}</h1><p>{titles[section][1]}</p></div><span className="period"><Icon name="calendar"/>2011–2012</span></header>
      {error ? <div className="notice" role="alert"><h2>No pudimos cargar los datos</h2><p>{error}</p><button className="reset" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Reintentar</button></div>
        : !data || !filters ? <div className="notice" role="status">Cargando los datos históricos…</div>
        : <>
          {exploratory && <FilterBar data={data} value={filters} set={setFilters} datesOnly={section === 'calidad'}/>}
          {exploratory && section !== 'calidad' && <p className="sr-only" role="status">{validDates ? fmt(rows.length) + ' horas observadas en la selección.' : 'Intervalo de fechas inválido.'}</p>}
          {section === 'ml' ? <Evaluation data={data}/> : section === 'historico' ? <Explorer data={data}/> : !validDates ? <div className="notice"><h2>Revisa el intervalo de fechas</h2><p>Selecciona fechas entre 2011 y 2012. La fecha inicial debe ser anterior o igual a la final.</p></div>
            : section === 'calidad' ? <Quality data={data} filters={filters}/>
            : !rows.length ? <div className="notice"><h2>Sin observaciones</h2><p>Prueba con otro intervalo, tipo de día o condición climática.</p></div>
            : section === 'resumen' ? <Overview rows={rows}/>
            : section === 'demanda' ? <Demand rows={rows}/>
            : section === 'clima' ? <Climate rows={rows} labels={data.weatherLabels}/>
            : <Users rows={rows}/>}
          <footer className="content-footer"><span>Las medias utilizan horas observadas. El dataset tiene {fmt(data.missingHours)} horas de calendario sin registro.</span><a href="https://archive.ics.uci.edu/dataset/275/bike-sharing-dataset">Fuente: UCI Bike Sharing</a></footer>
        </>}
    </main>
  </>;
}
