# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands
- Build: `npm run build`
- Dev mode: `npm run dev` (watches TypeScript)
- Lint: `npm run lint` / `npm run lint:fix`
- Format: `npm run format` / `npm run format:fix`
- Type check: `npm run typecheck`
- Test: `npm run test` / `npm run test:watch`
- Single test: `npx vitest run <test-file-path>`

## Code Style Guidelines
- TypeScript: strict mode, explicit return types, no `any` types
- Arrays: prefer `Array<T>` over `T[]`
- Imports: grouped by type, alphabetical, newlines between groups
- Naming: camelCase for variables/functions, PascalCase for classes
- Files: kebab-case for filenames, PascalCase for React components
- Formatting: Prettier defaults, curly braces required, 2-space indent
- Error handling: try/catch with specific error types, detailed messages
- Equality: strict equality checks (===) preferred over ==
- Terminal UI: uses Ink for React in terminal