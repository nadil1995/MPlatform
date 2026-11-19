import { defineConfig } from 'tsup'

// One build, three entrypoints (apps/api/Dockerfile): api, worker, migrator.
export default defineConfig({
  entry: ['src/server.ts', 'src/worker.ts', 'src/migrate.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  clean: true,
  // Workspace packages ship TypeScript source, so bundle them in.
  noExternal: ['@thaala/shared'],
})
