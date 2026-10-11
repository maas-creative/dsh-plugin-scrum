# Debug the built Go program

Record the Go version, module graph, build flags, executable path and source revision. Check whether the failure is a compile error, process crash, data race or behavior defect before choosing a debugger. For concurrency failures, a representative race-enabled test can provide evidence, but it does not cover paths that were never executed.

If Delve is installed, inspect its version and local help for the applicable launch or attach mode and DAP support. Do not assume every Delve build accepts the same command or target architecture. Verify that the binary contains suitable debug information and that source paths map to the running build.

Preserve owned process boundaries and system permissions. Capture goroutine and stack evidence around the failing transition. Confirm the final repair using normal build settings as well as the diagnostic configuration; altered optimization and scheduling can change the observed behavior.
