# Establish native executable identity

Identify executable architecture, hash, source revision, compiler, SDK and symbol files. Check loader errors and dependent-library paths before investigating application logic. For macOS, inspect available LLDB commands and existing grants; granting accessibility or screen recording is unrelated to ordinary symbol inspection and must not be assumed necessary.

Prefer an owned local reproduction. Launch and attach have different ownership: closing an attachment must not implicitly terminate a user's existing process. Break at a concrete failing boundary, inspect stack and arguments, and correlate the observation with logs or persisted state.

For crashes, retain the original crash report and symbol identity. Static analysis or disassembly can generate hypotheses but must not be presented as runtime proof. Test the repaired final binary and record its hash, not merely the source tree that was intended to produce it.
