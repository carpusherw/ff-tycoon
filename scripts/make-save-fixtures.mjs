// Writes the golden save fixtures for the current save version: `npm run save-fixtures`.
// The scripted runs live in `save-fixtures.ts`; Vite loads them (and the rules they import) as TypeScript.
// Fixtures are frozen once committed, so this refuses to touch a version folder that already exists.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => (await runnerImport(join(root, path), { configFile: false, logLevel: 'error' })).module;

const { CURRENT_SAVE_VERSION } = await load('src/app/migrations.ts');
const { buildSaveFixtures } = await load('scripts/save-fixtures.ts');

const dir = join(root, 'src/app/__fixtures__/saves', `v${CURRENT_SAVE_VERSION}`);
if (existsSync(dir)) {
  console.error(`${dir} already exists. Fixtures are frozen: bump CURRENT_SAVE_VERSION for a new folder.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
for (const [name, state] of Object.entries(buildSaveFixtures())) {
  if (state.version !== CURRENT_SAVE_VERSION) throw new Error(`${name} is at version ${state.version}`);
  const file = join(dir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`${file}: day ${state.day}`);
}
