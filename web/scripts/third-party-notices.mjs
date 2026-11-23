import { readFile, readdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const entries = ['Third-party notices for the Bike Sharing Analytics web application.',
  'The following notices are from the installed runtime dependency tree.'];
for (const [path, pkg] of Object.entries(lock.packages).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
  if (!path || pkg.dev) continue;
  const names = (await readdir(path)).filter(name => /^(licen[sc]e|copying|notice)([.-]|$)/i.test(name)).sort();
  assert.ok(names.length > 0, 'Missing license notice for ' + path);
  for (const name of names) {
    const text = (await readFile(path + '/' + name, 'utf8')).replace(/\r\n/g, '\n').trim();
    entries.push('--- ' + path.split('node_modules/').at(-1) + '@' + pkg.version + ' (' + pkg.license + ') · ' + name + ' ---', text);
  }
}
const result = entries.join('\n\n') + '\n';
const path = 'public/THIRD_PARTY_NOTICES.txt';
if (process.argv.includes('--check')) {
  assert.equal(await readFile(path, 'utf8'), result, 'Regenerate third-party notices after changing dependencies.');
  console.log('Third-party notices match the locked runtime dependency tree.');
} else {
  await writeFile(path, result, { encoding: 'utf8', flag: 'wx' });
}
