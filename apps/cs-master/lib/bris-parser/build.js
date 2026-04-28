import * as esbuild from 'esbuild';

const common = {
  entryPoints: ['src/index.js'],
  bundle: true,
  target: 'es2020',
  logLevel: 'info',
};

await Promise.all([
  esbuild.build({
    ...common,
    format: 'iife',
    globalName: 'BrisParser',
    outfile: 'dist/bris-parser.iife.js',
    // 브라우저 번들은 linkedom 같은 Node 전용 모듈을 포함하지 않음 (src가 import하지 않음)
  }),
  esbuild.build({
    ...common,
    format: 'esm',
    outfile: 'dist/bris-parser.esm.mjs',
    platform: 'neutral',
  }),
  esbuild.build({
    ...common,
    format: 'cjs',
    outfile: 'dist/bris-parser.cjs',
    platform: 'node',
  }),
]);

console.log('[build] 3 bundles generated in dist/');
