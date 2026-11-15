# Contributing to STRIDE

Thanks for taking the time to contribute. This guide explains how we work, so your change can be reviewed and merged quickly.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Git workflow](#git-workflow)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [Code style and checks](#code-style-and-checks)
- [Adding a language](#adding-a-language)

## Ways to contribute

- **Report a bug** or **request a feature**: open an issue using one of the templates.
- **Fix something**: comment on the issue first so nobody does the same work twice. Issues labelled `good first issue` are a good place to start.
- **Large changes** (new modules, schema changes, new dependencies): open an issue to discuss the approach before writing code. Architectural decisions are recorded as ADRs in [`docs/architecture/adr/`](docs/architecture/adr/).

## Development setup

Requirements: Docker with Compose v2. Node 24 and Go 1.26 are only needed if you run tools outside Docker.

```bash
git clone https://github.com/advxolltm/stride.git && cd stride
cp .env.example .env
./stride devrun
```

The app runs at http://localhost:8080. See the [README](README.md#quick-start) for the development login, and [`START_UP_GUIDE.md`](START_UP_GUIDE.md) and [`backend/README.md`](backend/README.md) for details.

## Git workflow

We use [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) with two long-lived branches:

| Branch | Purpose | Who merges into it |
| --- | --- | --- |
| `main` | Production. Every commit on `main` is a released, deployable state and is tagged `vX.Y.Z`. | `release/*` and `hotfix/*` only |
| `develop` | Integration branch for the next release. Default branch on GitHub. | all other branches |

Nobody pushes to `main` or `develop` directly. Every change goes through a pull request.

```text
feat/*, fix/*, ...  ──squash──▶  develop  ──release/x.y.z──▶  main (tag vX.Y.Z)
                                    ▲                           │
                                    └──────── back-merge ───────┤
                                                                │
                                             hotfix/* ◀─────────┘
```

### 1. Create a branch from the latest `develop`

```bash
git switch develop
git pull
git switch -c feat/123-task-due-date-filter
```

Branch names follow `<type>/<issue-number>-<short-description>`, in lowercase with hyphens. Leave out the issue number if there is no issue.

| Type | Branch from | Merge into | Use for |
| --- | --- | --- | --- |
| `feat/` | `develop` | `develop` | new functionality |
| `fix/` | `develop` | `develop` | bug fixes that can wait for the next release |
| `docs/` | `develop` | `develop` | documentation only |
| `i18n/` | `develop` | `develop` | translations |
| `refactor/` | `develop` | `develop` | code changes that do not change behaviour |
| `test/` | `develop` | `develop` | adding or fixing tests |
| `chore/` | `develop` | `develop` | build, CI, dependencies, tooling |
| `release/` | `develop` | `main`, then back into `develop` | preparing a release, e.g. `release/1.2.0` |
| `hotfix/` | `main` | `main`, then back into `develop` | urgent production fixes, e.g. `hotfix/1.2.1-login-crash` |

External contributors: fork the repository, create the branch in your fork, and open the pull request against `advxolltm/stride:develop`. Please do not open pull requests from your fork's `main` or `develop`. Use a branch as described above.

### 2. Keep the branch small and up to date

- One branch = one issue = one pull request. Split unrelated changes into separate pull requests.
- Rebase onto `develop` instead of merging `develop` into your branch:

  ```bash
  git fetch origin
  git rebase origin/develop
  git push --force-with-lease
  ```

### 3. Open a pull request

Push the branch and open a pull request into `develop`. Fill in the template. Open it as a **draft** if it is not ready for review yet.

### 4. Review and merge

- At least **one approval** from a maintainer is required.
- All checks must pass and all review conversations must be resolved.
- Pull requests into `develop` are merged with **Squash and merge**. The pull request title becomes the commit message, so it must follow the commit message format below.
- The branch is deleted after merging.

### Releases (maintainers)

```bash
git switch develop && git pull
git switch -c release/1.2.0
# bump versions, update changelog, fix release blockers only
git push -u origin release/1.2.0
```

1. Open a pull request `release/1.2.0` → `main` and merge it with **Create a merge commit** (never squash, otherwise `main` and `develop` drift apart).
2. Tag the merge commit on `main`:

   ```bash
   git switch main && git pull
   git tag -a v1.2.0 -m "v1.2.0"
   git push origin v1.2.0
   ```

3. Merge `main` back into `develop` with a pull request `main` → `develop` (**Create a merge commit**).

### Hotfixes (maintainers)

Same as a release, but the branch starts from `main`:

```bash
git switch main && git pull
git switch -c hotfix/1.2.1-login-crash
```

Merge into `main` with **Create a merge commit**, tag `v1.2.1`, then merge `main` back into `develop`.

We use [Semantic Versioning](https://semver.org/): `MAJOR` for breaking changes (API, database migrations that need manual steps, configuration), `MINOR` for new features, `PATCH` for fixes.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <short summary in imperative mood>

<optional body: what and why, not how>

<optional footer: Closes #123>
```

Types: `feat`, `fix`, `docs`, `i18n`, `refactor`, `test`, `perf`, `chore`, `ci`.
Scopes are optional, e.g. `backend`, `frontend`, `scheduler`, `whiteboard`, `chat`.

Examples:

```text
feat(tasks): filter board by due date
fix(chat): keep scroll position after loading older messages
i18n: add Italian translation
docs: describe production TLS setup
```

- Keep the summary under 72 characters, without a trailing period.
- Reference issues with `Closes #123` (or `Refs #123` if the issue stays open).

## Pull requests

A pull request is ready for review when:

- it solves one issue and links it (`Closes #123`);
- it includes tests for new behaviour or bug fixes;
- all checks below pass locally;
- the UI is translated: every new user-facing string exists in **all** locales under `frontend/src/i18n/locales/`;
- docs are updated when behaviour, configuration or the API change (regenerate OpenAPI after changing handlers, see [`backend/README.md`](backend/README.md#generate-openapi--swagger-documentation));
- UI changes include a screenshot or short GIF.

## Code style and checks

CI runs on our GitLab instance. Pull requests on GitHub are **not** checked automatically, so please run the checks yourself before opening one.

Everything at once (Docker required):

```bash
./stride test
```

Frontend (`frontend/`):

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run e2e        # Playwright, needs the dev stack running
```

Formatting is done by Prettier (`prettier.config.cjs`): 4 spaces, single quotes, no semicolons.

Backend (`backend/`):

```bash
gofmt -l .
golangci-lint run
govulncheck ./...
go test -count=1 -p 1 ./...   # starts PostgreSQL via Testcontainers
```

## Adding a language

Translations live in `frontend/src/i18n/locales/<code>/`. Use the [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) code, e.g. `it`.

1. Copy the English folder: `frontend/src/i18n/locales/en/` → `frontend/src/i18n/locales/<code>/`.
2. Translate the **values** only. Do not change keys.
   - Keep placeholders such as `{{count}}` and `{{name}}` exactly as they are.
   - Provide every plural form the language needs (`_one`, `_other`, and `_few`/`_many` where applicable). See the [i18next plural docs](https://www.i18next.com/translation-function/plurals).
3. Register the language in `frontend/src/i18n/index.ts`: import the five namespace files and add a `<code>: { ... }` entry to `resources`.
4. Add an `<option value="<code>">` to `frontend/src/components/layout/LanguageSwitcher.tsx`.
5. Run `npm run typecheck` and `npm run build`, start the app, switch to the new language and check the main pages.

**Steps 3 and 4 are required.** Without them the new files are never loaded and the language does not show up in the app.

Known limitation: the in-app guide (`InfoModal.tsx` and `frontend/public/infoguide/`) only exists in English and German, and falls back to English for other languages.

Name the branch `i18n/<code>-translation` and the pull request `i18n: add <Language> translation`.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
