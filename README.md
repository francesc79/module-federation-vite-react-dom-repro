# Module Federation Vite React DOM optimizer reproduction

Minimal reproduction for mixed Vite dependency-optimizer generations with:

- `@module-federation/vite@1.19.1`
- `@module-federation/enhanced@2.8.0`
- `vite@8.0.16`
- `react@19.2.7`
- `react-dom@19.2.7`

## Run

Requirements: Node.js `>=24.15.0`, Corepack, and Chrome/Chromium.

```bash
corepack enable
pnpm install
pnpm repro
```

Set `CHROME_PATH` if Chrome is not installed in a standard Linux location. Alternatively install Playwright Chromium:

```bash
pnpm exec playwright install chromium
```

The failing command exits with code 1 after printing output similar to:

```text
react-dom.js?v=<first-hash>
react-dom.js exports 't': false

react-dom_client.js?v=<second-hash>
react-dom_client.js imports 't': true

REPRODUCED: mixed React DOM optimizer generations were served.
```

The page error is:

```text
The requested module '/node_modules/.vite/deps/react-dom.js?v=<hash>'
does not provide an export named 't'
```

## Control

Run the same source, startup order, Vite version, cold cache, and browser polling without the Module Federation plugin:

```bash
pnpm repro:control
```

The control renders successfully and exits with code 0.

## Why the small config probe exists

The application that exposed the issue naturally produced separate optimizer waves: `react-dom` was published before `react-dom/client`, while Vite's dependency scan was still in progress.

Module Federation adds `react-dom` and its public subpaths to the resolved initial `optimizeDeps.include` list. The small `repro:force-late-react-dom-subpath-discovery` plugin removes only `react-dom/*` from that resolved initial list. It does not exclude, alias, mock, or replace those modules. Vite discovers and optimizes `react-dom/client` normally at runtime.

This is test instrumentation that makes the observed wave ordering deterministic in a tiny repository. It is not a proposed application configuration or workaround. The negative control demonstrates that the same late discovery remains coherent without Module Federation.
