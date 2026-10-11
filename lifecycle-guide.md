# Scrum lifecycle

The package entry is `lifecycle-entry.mjs`. It loads the selected release without replacing the original installation. Package updates use archive integrity, identity checks, a startup journal and atomic pointers. A failed activation restores the previous pointer. A running process lease defers activation; dependencies must match the installed package, otherwise a package-manager installation is required.

## Observe the current installation

Use the read-only native tool `scrum_lifecycle_status`, or the UI command `/scrum-lifecycle`, to inspect the loaded version, onboarding marker, init-deep state, stored startup diagnostics and update state. Slash commands are host commands, not shell executables. Provider/model catalog presence is availability metadata, not proof that every model is authenticated or executable.

`/scrum-onboard` redisplays guidance once in the current session. Automatic guidance applies to eligible interactive fresh root sessions; headless, resumed, child and initial-human-request paths do not consume a first-run marker. Startup notices enter the SDK receive queue rather than preceding the initial system message in a persisted history.

## Project analysis

`/scrum-init-deep status` reports eligibility. Available decisions are `run`, `skip`, `never-project`, and `never-global`; `snapshot local` or `snapshot committed` records completed analysis. Persisted `.omo/init-deep.json` is a compatibility path, not an OMO runtime import. The independent advisor checks repository identity, inherited AGENTS instructions, excluded directories and bounded coverage before proposing analysis. A proposal is not completed analysis.

## Release feed

Set `lifecycle.update.sourceDir` to an owned directory containing a tarball made with `npm pack --ignore-scripts` and a `releases.json` feed. Each selected `channels.latest` descriptor requires package name, version, tarball filename, `sha512-` base64 integrity, license and provenance. Provenance must include a source description plus either a 40-character source commit or `sourceIntegrity` equal to the archive integrity.

Current Scrum releases declare `AGPL-3.0-only` and must contain the root `LICENSE`. Historical `SEE LICENSE IN ...` descriptors remain supported for migration, with a safe relative license-file path. A release's manifest and descriptor must agree. Package scripts are not executed during staging or activation.

`/scrum-update check` inspects the selected channel; `stage` prepares an available unpinned release for the next process start. `autoUpdate` controls startup staging, while `pinned` keeps checks observational. Existing user data and original source remain outside staged updates. Check the resulting state rather than treating a queued update as an activated release.

## Telemetry and verification

No external telemetry transport is configured by default. Explicit opt-outs and compatibility environment flags are retained. Daily claims, bounded transport shutdown and data minimization are enforced independently of model execution.

Run the standard `npm test` suite for update integrity, rollback, running-process deferral, executable permissions, symlink identity and legacy-to-AGPL migration. Native DSH standalone and both Dashboard/Scrum installation orders are checked separately in release acceptance. See [NOTICE.md](NOTICE.md) for licensing scope.
