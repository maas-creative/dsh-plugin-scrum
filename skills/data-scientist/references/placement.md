# Keep artifacts reproducible and identifiable

Respect the project's existing directory conventions and the user's specified output location. If none exists, create a small analysis directory containing code, parameters, source references and a results subdirectory. Avoid reorganizing unrelated files.

Keep raw sources immutable or retain a verified original. Separate source data, derived data, analysis code and final deliverables by purpose. Record file names, source URLs or identifiers, retrieval times, license/access restrictions, schema and checksums where useful. Never publish private data or credentials as part of a reproducibility bundle.

Use names that identify the question, period or version. Record the command, environment and parameters that produced each final output. Temporary caches and exploratory intermediates must not be mistaken for validated results. Re-running an analysis should not silently overwrite the only original data or a previously approved deliverable.

Provide the requested file formats and inspect them in the intended viewer. Verify that figure references, links and accompanying tables resolve from the delivered location. A local path mentioned in prose is not proof the artifact exists.

The final handoff should state which outputs are validated, how to reproduce key results, and which limitations remain. Preserve historical and submission records when updating a project's analysis. Cleanup may remove owned temporary work after its evidence is retained, but must not delete other projects' files.
