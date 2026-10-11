# Debug the actual Node process

Inspect the Node executable, version, package entry point, arguments, working directory and environment. Reproduce using the same loader, module format and dependency tree. Distinguish transpiled or bundled output from the preferred source. Use source maps only after checking they correspond to the running build.

For an owned reproduction, use the installed Node inspector options shown by node --help and keep the inspector bound to a controlled local interface. An inspector endpoint is not a DAP endpoint; a compatible adapter is needed to expose DAP. Observe exceptions, asynchronous task ordering, event-loop state and actual loaded paths.

Preserve process ownership and existing inspector settings. Do not expose a debugging port publicly or attach to a foreign process without authorization. Verify the repair under the ordinary launch command after debugging so inspector timing does not conceal a race.
