# Module Federation Vite React DOM optimizer reproduction

Minimal reproduction for mixed Vite dependency-optimizer generations with:

- the `@module-federation/vite` artifact from PR #964
- `@module-federation/enhanced@2.8.0`
- a workspace package resolved from source through its `development` export
- an RTK Query store and a direct `react-redux` import in the exposed graph
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

The PR-specific retained-generation control keeps Module Federation enabled but disables only the discarded-generation simulator:

```bash
pnpm repro:retained-generation
```

This also renders successfully. It demonstrates both sides of the regression:

- PR #964 works when its initial React DOM selectors are retained;
- the original mismatch returns when that initial generation is discarded and Vite falls back to runtime discovery.

## Why the small config probe exists

PR #964 adds direct and nested React DOM subpath selectors to Vite's initial `optimizeDeps.include` list. That fixes the original small fixture when the initial generation completes normally.

The larger application still fails because an earlier dependency update throws while reading `browserHash`. The complete initial generation, including the selectors added by PR #964, is then absent from the published optimizer metadata. Vite subsequently rediscovers `react-dom` and `react-dom/client` in separate runtime generations.

The `repro:simulate-discarded-initial-react-dom-generation` plugin models only that discarded state by removing the direct and nested React DOM subpath entries from the resolved initial list. It does not exclude, alias, mock, or replace React DOM. Vite still discovers and optimizes the modules normally at runtime.

This is test instrumentation, not a proposed application configuration or workaround. The negative control demonstrates that the same runtime discovery remains coherent without Module Federation.

The fixture also keeps the relevant package-resolution shape from the larger
application. `@repro/development-library` declares
`exports["."].development`, while Vite resolves
`['development', 'module', 'browser', 'default']`. Testing that conditional
export in isolation did not reproduce the failure, so it is represented here
as part of the graph rather than claimed as the root cause.

## Install the PR artifact explicitly

The lockfile pins the artifact published for PR #964:

```bash
pnpm add -D https://pkg.pr.new/@module-federation/vite@964
```
