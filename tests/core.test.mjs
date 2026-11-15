import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('.');
const scratch = path.join(root, '.test-output');
await import('node:fs/promises').then(fs => fs.mkdir(scratch,{recursive:true}));
async function files(dir,prefix='') { const output={}; for (const name of (await readdir(dir)).sort()) { const rel=prefix+name, location=path.join(dir,name); if ((await stat(location)).isDirectory()) Object.assign(output,await files(location,rel+'/')); else output[rel]=(await readFile(location)).toString('base64'); } return output; }
test('Node entrypoint builds identical output twice without network or dependencies', async () => {
  const first=await mkdtemp(path.join(scratch,'build-a-')), second=await mkdtemp(path.join(scratch,'build-b-'));
  const run = output => execFileSync(process.execPath,['main.ts'],{cwd:root,env:{PATH:process.env.PATH,MAKEFUN_BOT_DIR:root,MAKEFUN_OUTPUT_DIR:output},encoding:'utf8',timeout:10000});
  assert.equal(run(first), run(second));
  assert.deepEqual(await files(first),await files(second));
  const manifest=JSON.parse(await readFile(path.join(first,'manifest.json'),'utf8'));
  assert.equal(manifest.entry,'index.html'); assert.ok(manifest.files.length>=6);
  for (const file of manifest.files) { assert.ok(file.bytes>0); assert.match(file.sha256,/^[0-9a-f]{64}$/); }
});
test('All runtime imports point to shipped local assets', async () => {
  const html=await readFile('web/index.html','utf8'), js=await readFile('web/game.js','utf8'), css=await readFile('web/styles.css','utf8');
  assert.doesNotMatch(html, /(?:src|href)=["']https?:/); assert.doesNotMatch(css,/@import/);
  assert.match(js,/from '\.\/vendor\/three.module.js'/);
  assert.match(await readFile('web/vendor/three.module.js','utf8'),/from '\.\/three.core.js'/);
});
