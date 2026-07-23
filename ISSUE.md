The reproduction and commands below were verified locally.

## Description

During a cold Vite dev-server start, `@module-federation/vite@1.19.1` can serve `react-dom` and `react-dom/client` from different dependency-optimizer generations.

The browser receives a `react-dom.js` module that does not export Vite's generated private binding `t`, followed by a `react-dom_client.js` module that imports that binding. The page then fails with:

```text
The requested module '/node_modules/.vite/deps/react-dom.js?v=<hash>'
does not provide an export named 't'
```

## Minimal reproduction

https://github.com/francesc79/module-federation-vite-react-dom-repro

## Reproduction

```bash
git clone https://github.com/francesc79/module-federation-vite-react-dom-repro.git
cd module-federation-vite-react-dom-repro
corepack enable
pnpm install
pnpm repro
```

`pnpm repro` starts Chrome before Vite binds its port, clears only Vite's dependency cache, captures the first React DOM optimizer responses, and exits with code 1 when the mismatch is reproduced.

Expected diagnostic output:

```text
react-dom.js exports 't': false
react-dom_client.js imports 't': true
REPRODUCED: mixed React DOM optimizer generations were served.
```

## Negative control

```bash
pnpm repro:control
```

The control uses the same source, startup ordering, Vite version, cold cache, and browser polling, but disables only the Module Federation plugin. It renders successfully and exits with code 0.

## Expected behavior

Vite should never serve a `react-dom/client` optimized entry whose generated imports are incompatible with the `react-dom` module already served to the same browser module graph.

## Versions

```text
Node.js 24.15.0
pnpm 11.1.1
@module-federation/vite 1.19.1
@module-federation/enhanced 2.8.0
Vite 8.0.16
React 19.2.7
React DOM 19.2.7
```

## Notes on the deterministic trigger

The original application produced the late `react-dom/client` discovery naturally while its larger expose graph was still being scanned.

The minimal reproduction contains a small Vite config probe that removes only `react-dom/*` from the resolved initial `optimizeDeps.include` list. It does not exclude or replace the modules. This preserves normal runtime discovery while making the problematic optimizer-wave ordering deterministic. It is test instrumentation, not a proposed workaround.
