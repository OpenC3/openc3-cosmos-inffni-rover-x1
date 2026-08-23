import { defineConfig } from 'vite'
import VitePluginStyleInject from 'vite-plugin-style-inject'
import vue from '@vitejs/plugin-vue'

const DEFAULT_EXTENSIONS = ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']

export default defineConfig({
  build: {
    outDir: 'tools/widgets/Robotdog2dWidget',
    emptyOutDir: true,
    // Required: WidgetModel#deploy reads <widget>.umd.min.js.map unconditionally
    sourcemap: true,
    lib: {
      entry: './src/Robotdog2dWidget.vue',
      name: 'Robotdog2dWidget',
      fileName: (format, entryName) => `${entryName}.${format}.min.js`,
      formats: ['umd'],
    },
    rollupOptions: {
      // Provided by the COSMOS frontend at runtime. This widget is pure SVG so
      // nothing else needs bundling.
      external: ['single-spa', 'vue', 'pinia', 'vue-router', 'vuetify'],
    },
  },
  plugins: [vue(), VitePluginStyleInject()],
  resolve: {
    extensions: [...DEFAULT_EXTENSIONS, '.vue'],
  },
})
