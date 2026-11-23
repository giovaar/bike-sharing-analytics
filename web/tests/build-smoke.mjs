import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { once } from 'node:events';

const base = '/bike-sharing-analytics/';
const allowed = ['evaluations.json', 'historical-scenarios.csv', 'hourly.csv', 'manifest.json', 'quality.json'];
const files = new Map(await Promise.all(
  ['index.html', 'THIRD_PARTY_NOTICES.txt', ...(await readdir('dist/assets')).map(name => 'assets/' + name), ...allowed.map(name => 'data/' + name)]
    .map(async name => [name, await readFile('dist/' + name)]),
));
assert.deepEqual((await readdir('dist/data')).sort(), allowed);
assert.deepEqual((await readdir('dist')).sort(), ['THIRD_PARTY_NOTICES.txt', 'assets', 'data', 'index.html']);
const server = createServer((request, response) => {
  const file = (request.url ?? '').slice(base.length) || 'index.html';
  const content = request.url?.startsWith(base) && files.get(file);
  response.writeHead(content ? 200 : 404).end(content || undefined);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const url = 'http://127.0.0.1:' + server.address().port + base;
  const index = await fetch(url);
  assert.equal(index.status, 200);
  const notices = await fetch(new URL('THIRD_PARTY_NOTICES.txt', url));
  assert.equal(notices.status, 200);
  assert.deepEqual(Buffer.from(await notices.arrayBuffer()), await readFile('public/THIRD_PARTY_NOTICES.txt'));
  const assets = [...(await index.text()).matchAll(/(?:src|href)="((?:\.\/|\/bike-sharing-analytics\/)assets\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(assets.length >= 2);
  for (const asset of assets) assert.equal((await fetch(new URL(asset, url))).status, 200);
  for (const file of allowed) {
    const result = await fetch(new URL('data/' + file, url));
    assert.equal(result.status, 200);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), await readFile('public/data/' + file));
  }
  console.log('Static subpath verified: index, ' + assets.length + ' entry assets and five data files.');
} finally {
  server.close();
}
