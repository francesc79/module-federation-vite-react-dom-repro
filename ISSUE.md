The reproduction and commands below were verified locally.

## Description

During a cold Vite dev-server start, the artifact from PR #964 can still serve `react-dom` and `react-dom/client` from different dependency-optimizer generations when the initial generation containing the PR's nested selectors is discarded.

The exposed graph includes a workspace package selected through
`exports["."].development`, an RTK Query store, and a direct `react-redux`
import. The `development` condition is also present in Vite's
`resolve.conditions`; it was tested separately and is not by itself a
sufficient trigger.

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

`pnpm repro` starts Chrome before Vite binds its port, clears only Vite's dependency cache, simulates the discarded initial React DOM generation observed in the larger application, captures the first React DOM optimizer responses, and exits with code 1 when the mismatch is reproduced.

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

The PR-specific retained-generation control keeps Module Federation enabled and disables only the discarded-generation simulator:

```bash
pnpm repro:retained-generation
```

It also renders successfully, confirming that PR #964 handles the case only while its initial selectors remain in the published optimizer generation.

## Expected behavior

Vite should never serve a `react-dom/client` optimized entry whose generated imports are incompatible with the `react-dom` module already served to the same browser module graph.

## Versions

```text
Node.js 24.15.0
pnpm 11.1.1
@module-federation/vite PR #964 artifact
@module-federation/enhanced 2.8.0
Vite 8.0.16
React 19.2.7
React DOM 19.2.7
```

## Notes on the deterministic trigger

The original application first reports an optimizer update failure while reading `browserHash`. Its resulting optimizer metadata no longer contains the direct or nested React DOM selectors added by PR #964. Vite then rediscovers `react-dom` and `react-dom/client` in separate runtime generations.

The minimal reproduction contains a small Vite config probe that removes only the direct and nested React DOM subpath entries belonging to that discarded initial generation. It does not exclude, alias, mock, or replace the modules. This preserves normal runtime discovery while making the problematic optimizer-wave ordering deterministic. It is test instrumentation, not a proposed workaround or application configuration.
