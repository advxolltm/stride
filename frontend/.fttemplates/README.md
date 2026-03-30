# FT Templates Quick Guide

This project uses folder templates in `.fttemplates` to scaffold common files.

## Available Templates

- `CompTSTemplate`
  - Generates a component file: `[FTName].tsx`
  - Generates a barrel export: `index.ts`
- `FuncTSTemplate`
  - Generates a function file: `[FTName].tsx`
  - Generates a test file: `[FTName].test.tsx` (currently empty)
  - Generates a barrel export: `index.ts`

## How To Use

1. In VS Code, run your File Templates command (from your template extension).
2. Choose one of the templates from `.fttemplates`.
3. Enter `FTName` when prompted.
4. Select the target folder where files should be created.

## Naming Rules Used In Templates

- `[FTName]`: used in filenames
- `<FTName | capitalize>`: PascalCase symbol names
- `<FTName | camelcase>`: camelCase symbol names

Example input:

- `FTName = user-service`

Typical output:

- file name: `user-service.tsx`
- capitalize token: `UserService`
- camelcase token: `userService`

## Notes

- Keep `index.ts` files, they provide clean imports.
- Fill in generated TODO sections (types, params, return type).
- Add test content in `[FTName].test.tsx` after generation.
