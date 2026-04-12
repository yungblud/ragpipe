# Lessons

## 2026-04-11

- When planning MVP infrastructure work, prefer the simplest viable persistence/search strategy unless the user explicitly asks for the production-grade or extension-backed path.
- For local-first plugins, avoid introducing runtime extension setup complexity into the first implementation pass when a simpler in-process approach can validate the API and workflow.
- For native Node dependencies in published plugins, resolve the module from the plugin package itself instead of the consumer app `cwd`; `cwd`-based loading breaks pnpm layouts and native bindings.
