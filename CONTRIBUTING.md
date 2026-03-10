# Contributing to gt-plugin-passage

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/cellar-door-dev/gt-plugin-passage
cd gt-plugin-passage
npm install
npm test
```

## Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

## Code Style

- TypeScript strict mode
- ESM-only (no CommonJS in source)
- No em dashes in documentation or copy
- Apache-2.0 license headers are not required in source files

## Pull Requests

1. Fork the repo and create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass (`npm test`)
4. Keep PRs focused on a single change
5. Write clear commit messages

## Architecture

The package has four modules:

- **depart.ts** - Polecat departure and crew transfer ceremonies
- **entry.ts** - Cross-town entry and policy presets
- **passport.ts** - Agent departure history (passport chain)
- **bead.ts** - Bead attachment serialization helpers

Each module has a corresponding test file in `src/__tests__/`.

## Gas Town Context

If you are not familiar with Gas Town, read the README for an overview of the concepts (Polecats, Rigs, Towns, Beads, etc.). The key insight is that Polecats are ephemeral workers while EXIT markers give them portable lifecycle records.
