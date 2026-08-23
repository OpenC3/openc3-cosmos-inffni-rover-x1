import { defineConfig } from 'vite'
import VitePluginStyleInject from 'vite-plugin-style-inject'
import vue from '@vitejs/plugin-vue'

const DEFAULT_EXTENSIONS = ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']

export default defineConfig({
  build: {
    outDir: 'tools/widgets/RobotdogWidget',
    emptyOutDir: true,
    // Required: WidgetModel#deploy reads <widget>.umd.min.js.map unconditionally
    sourcemap: true,
    lib: {
      entry: './src/RobotdogWidget.vue',
      name: 'RobotdogWidget',
      fileName: (format, entryName) => `${entryName}.${format}.min.js`,
      formats: ['umd'],
    },
    rollupOptions: {
      // These are provided by the COSMOS frontend at runtime.
      // three.js is intentionally NOT external so it gets bundled.
      external: ['single-spa', 'vue', 'pinia', 'vue-router', 'vuetify'],
    },
  },
  plugins: [vue(), VitePluginStyleInject()],
  resolve: {
    extensions: [...DEFAULT_EXTENSIONS, '.vue'],
  },
})
