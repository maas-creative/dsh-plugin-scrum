# Trace a bundled JavaScript executable to its source

Record the application version, executable hash, bundle entry point and packaging format. Determine which JavaScript runtime and native modules are actually used. A wrapper's version may differ from the bundled runtime. Inspect the project's build manifest and preferred source before making a patch to generated output.

Verify source-map identity if using maps to interpret stack traces. Compare loaded module paths with the packaged files. When reproducing outside the bundle, preserve relevant environment, native dependency and filesystem assumptions; otherwise a successful isolated run may not reproduce the defect.

Repair the preferred source and rebuild through the documented process. Check that the resulting package contains the change and required notices. Avoid editing an installed application in place without a backup and authorized deployment scope. Re-test the final packaged entry point.
