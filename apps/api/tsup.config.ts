import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Bundle the TypeScript-source workspace package; keep npm deps external.
  noExternal: ['@reliefmesh/shared'],
});
