// Offline, deterministic program/v1 entrypoint. No package installation at grading time.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = process.env.MAKEFUN_BOT_DIR || dirname(fileURLToPath(import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || join(root, 'out'));
const source = join(root, 'web');
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
const files = [];
async function inventory(dir, prefix = '') {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await inventory(join(dir, entry.name), name + '/');
    else {
      const bytes = await readFile(join(dir, entry.name));
      files.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await inventory(source);
// Include the real play-test captures with the static entry for offline review.
await cp(join(root, 'screenshots'), join(output, 'screenshots'), { recursive: true });
await inventory(join(root, 'screenshots'), 'screenshots/');
await writeFile(join(output, 'manifest.json'), JSON.stringify({ title: 'BLACKLINE: Relay Protocol', version: '1.0.0', entry: 'index.html', files }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'ok', entry: 'index.html', files: files.length }));
