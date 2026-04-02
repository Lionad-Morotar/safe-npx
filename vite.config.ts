import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['child_process', 'fs', 'path', 'os', 'http', 'https', 'url', 'util', 'stream', 'zlib'],
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
    minify: false,
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
