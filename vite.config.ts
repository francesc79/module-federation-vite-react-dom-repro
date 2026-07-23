import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';

const withoutFederation = process.env.NO_FEDERATION === 'true';
const retainInitialReactDomGeneration = process.env.RETAIN_INITIAL_REACT_DOM_GENERATION === 'true';

/**
 * Deterministic discarded-generation simulator.
 *
 * PR #964 adds direct and nested react-dom subpath selectors to the initial
 * optimizeDeps list. In the original application, an earlier optimizer update
 * fails while reading browserHash and that complete initial generation is
 * discarded. Vite then rediscovers react-dom and react-dom/client in separate
 * runtime generations.
 *
 * The small project cannot naturally reproduce the large development-export
 * graph that causes that earlier failure, so this probe removes only the
 * React DOM entries that belonged to the discarded initial generation. It
 * does not exclude, alias, mock, or replace React DOM. Runtime discovery and
 * optimization remain entirely Vite's normal behavior.
 */
const simulateDiscardedInitialReactDomGeneration = (): Plugin => ({
  name: 'repro:simulate-discarded-initial-react-dom-generation',
  configResolved(config: ResolvedConfig) {
    const environments = [
      config.optimizeDeps,
      config.environments?.client?.optimizeDeps,
    ].filter(options => options !== undefined);

    for (const optimizeDeps of environments) {
      optimizeDeps.include = optimizeDeps.include?.filter(
        dependency => !dependency.startsWith('react-dom/') && !dependency.startsWith('react-dom > react-dom/'),
      );
    }
  },
});

export default defineConfig({
  resolve: {
    conditions: ['development', 'module', 'browser', 'default'],
  },
  plugins: [
    react(),
    !withoutFederation &&
      federation({
        name: 'reproHost',
        manifest: true,
        filename: 'remoteEntry.js',
        exposes: {
          './Exposed': './src/Exposed.tsx',
        },
        shared: {
          '@reduxjs/toolkit': { singleton: true },
          '@repro/development-library': { singleton: true },
          react: { singleton: true },
          'react-dom': { singleton: true },
          'react-redux': { singleton: true },
        },
        runtime: 'enhanced',
        shareStrategy: 'version-first',
        dev: true,
      }),
    !retainInitialReactDomGeneration && simulateDiscardedInitialReactDomGeneration(),
  ].filter((plugin): plugin is Plugin => Boolean(plugin)),
});
