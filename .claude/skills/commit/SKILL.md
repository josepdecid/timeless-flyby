---
name: commit
description: Create git commits in this repo following Conventional Commits with the project's defined scopes. Use whenever the user asks to commit, write a commit message, or "commit and push".
---

# Commit with Conventional Commits

## Procedure

1. Inspect what is being committed:
   - `git status --short`
   - `git diff` and `git diff --staged`
   - `git log --oneline -10` to match recent style
2. If the changes cover unrelated concerns, propose splitting them into separate commits (stage with
   `git add <paths>`). Otherwise stage what the user asked for. Never stage `node_modules/`, `dist/` or
   `*.local` files; they are gitignored and must stay out.
3. Before committing code changes (anything outside docs), run `npm test` and `npm run check`. If either
   fails, stop and report it instead of committing.
4. Choose a **type** and **scope** from the tables below, then write the message.
5. Commit with a heredoc so the body keeps its formatting:
   ```sh
   git commit -F - <<'EOF'
   type(scope): subject

   Body.
   EOF
   ```
6. Push only if the user asked. If the current branch has no upstream yet, use `git push -u origin <branch>`.
   Never force-push unless the user explicitly asks.

## Message format

```
<type>(<scope>): <subject>

[body]

[footer(s)]
```

- **Subject**: imperative mood ("add", not "added"/"adds"), lowercase first letter, no trailing period, at
  most 72 characters including the prefix.
- **Body** (optional, recommended for non-trivial changes): wrap at 72 columns and explain *what* and *why*,
  not how. Use `-` bullets for several distinct points.
- **Breaking changes**: add `!` after the scope (`feat(storage)!: …`) and a `BREAKING CHANGE: <what breaks
  and how to migrate>` footer. In this app that mostly means changing the localStorage format (`tf:*:v1`
  keys) without a migration, which wipes users' saved activities and settings.
- **Issue references**: put them in a footer, e.g. `Closes #12`.

## Types

| Type       | Use for                                                               |
|------------|-----------------------------------------------------------------------|
| `feat`     | A user-visible feature or capability                                  |
| `fix`      | A bug fix (wrong output, crash, broken UI behaviour)                  |
| `perf`     | Faster or lighter with no behaviour change                            |
| `refactor` | Code restructuring with no behaviour change                           |
| `style`    | Visual styling only (CSS, spacing, colours) with no logic change      |
| `test`     | Adding or fixing tests only                                           |
| `docs`     | README or code comments only                                          |
| `build`    | Vite/TS/Svelte config, `package.json` scripts, dependency changes     |
| `ci`       | CI workflows (e.g. `.github/workflows/`)                              |
| `chore`    | Repo housekeeping that fits nothing else (`.gitignore`, `.claude/`)   |
| `revert`   | Reverting an earlier commit (subject: `revert: <original subject>`)   |

## Scopes

Pick the scope that owns the change's main purpose. The scope is optional: leave it out when a change
genuinely spans several areas (e.g. `feat: add lap-based comparison`) or for repo-wide `build`/`chore`/`docs`.
Use one scope only; never combine them as `(map,charts)`.

### Domain logic (`src/lib/`)

| Scope      | Covers                                                                                           |
|------------|--------------------------------------------------------------------------------------------------|
| `parse`    | `src/lib/parse/*`: GPX, TCX and FIT parsing, XML helpers, point cleaning, accepted extensions     |
| `align`    | `align.ts`, `motion.ts`, `geo.ts`: reference route, common-section detection, start-pass choice, projection, moving detection, geodesy |
| `analysis` | `analysis.ts`: timelines, gap/ahead series, metrics, splits computation, segment deltas, replay state |
| `state`    | `state.svelte.ts`, `view.svelte.ts`: app store, derived comparison, view helpers, file loading     |
| `storage`  | `storage.ts`: localStorage encoding, keys, quota handling, persistence                            |
| `format`   | `format.ts`: units, pace/speed, durations, distance and date formatting, sport defaults           |
| `samples`  | `synth.ts`, `scripts/make-samples.mjs`, `public/samples/*`: synthetic tracks and bundled demo files |
| `strava`   | `strava.ts`, `StravaLink.svelte`: Strava activity-link parsing and the GPX export shortcut        |
| `i18n`     | `i18n.svelte.ts`, `src/lib/i18n/*`: locale detection and switching, translated UI text per language |

### UI (`src/components/`, `src/App.svelte`, `src/app.css`)

| Scope      | Covers                                                                                    |
|------------|-------------------------------------------------------------------------------------------|
| `map`      | `MapView.svelte`: Leaflet map, tiles, colour modes, start/finish flags, markers, follow   |
| `charts`   | `Chart.svelte`, `ChartsPanel.svelte`, `Legend.svelte`: uPlot charts, gap and metric charts, tooltips, sync |
| `replay`   | `ReplayBar.svelte`, `Leaderboard.svelte`: playback controls, speed, keyboard, live standings |
| `splits`   | `SplitsTable.svelte`: split table UI                                                      |
| `segments` | `SegmentsTable.svelte`: custom segments tab (create, edit, delete, per-segment times)     |
| `tracks`   | `TrackList.svelte`: activity list, rename, include/exclude, reference, pass select        |
| `settings` | `SettingsPanel.svelte`, `SettingsDialog.svelte`: time mode, speed mode, section reset, units and theme modal |
| `theme`    | `app.css`, `colors.ts`, `Icon.svelte`: design tokens, light/dark mode, palettes, icons    |
| `ui`       | `App.svelte`, `Brand.svelte`, `Welcome.svelte`, `Notices.svelte`, `index.html`, `main.ts`, `scripts/make-og.mjs`, `scripts/og/*`: layout, header, tabs, drag-and-drop, welcome screen, notices, SEO/social meta and preview card |

### Tooling

| Scope   | Covers                                                                    |
|---------|---------------------------------------------------------------------------|
| `deps`  | Adding, removing or upgrading dependencies (`package.json` + lockfile)     |
| `skills`| `.claude/skills/*`: Claude Code skills for this repo                       |

### Choosing between scopes

- Tests take the scope of the code they test: `test(align): cover loop with two start passes`.
- A logic change plus the UI that exposes it takes the logic's scope when that is the substance
  (`fix(align): …` even if `TrackList` changed too); take the UI scope when the UI is the point.
- Splits: computation changes are `analysis`; table UI changes are `splits`.
- Colour palette values are `theme`; how the map uses them is `map`.
- Dependency upgrades: `build(deps): bump leaflet to 1.9.5`.

When a new module or component is added that fits no scope above, add a row here in the same commit.

## Examples

```
feat(map): colour route by fastest athlete per stretch
fix(align): ignore warm-up that runs down the course before the start
perf(analysis): reuse distance grid across metric series
fix(parse): read FIT sport from the session message
feat(storage)!: switch activities to v2 delta encoding

BREAKING CHANGE: activities saved with tf:activities:v1 are no longer
read; users must re-add their files.
test(parse): add TCX file without heart-rate extension
build(deps): bump uplot to 1.6.33
style(theme): raise contrast of muted text in dark mode
docs: explain moving-time detection in README
chore(skills): add commit skill
```
