import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';

const withoutFederation = process.env.NO_FEDERATION === 'true';

/**
 * Deterministic race amplifier.
 *
 * Module Federation adds react-dom and its public subpaths to Vite's initial
 * optimizeDeps list. The production failure happens when react-dom is
 * published first and react-dom/client is discovered in a later optimizer
 * generation. Removing only the subpaths from the resolved initial list
 * reproduces that observed ordering without invalidating or excluding them:
 * Vite still discovers and optimizes react-dom/client normally at runtime.
 */
const forceLateReactDomSubpathDiscovery = (): Plugin => ({
  name: 'repro:force-late-react-dom-subpath-discovery',
  configResolved(config: ResolvedConfig) {
    const environments = [
      config.optimizeDeps,
      config.environments?.client?.optimizeDeps,
    ].filter(options => options !== undefined);

    for (const optimizeDeps of environments) {
      optimizeDeps.include = optimizeDeps.include?.filter(dependency => !dependency.startsWith('react-dom/'));
    }
  },
});

export default defineConfig({
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
          react: { singleton: true },
          'react-dom': { singleton: true },
        },
        runtime: 'enhanced',
        shareStrategy: 'version-first',
        dev: true,
      }),
    forceLateReactDomSubpathDiscovery(),
  ].filter((plugin): plugin is Plugin => Boolean(plugin)),
});
