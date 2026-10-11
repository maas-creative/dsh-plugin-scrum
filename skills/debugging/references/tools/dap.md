# Use Debug Adapter Protocol with explicit evidence boundaries

The independent scripts/dap.mjs module exports DapFrameParser, MAX_OUTPUT_BYTES, MAX_ROWS and isTcpAdapterSpec. DapFrameParser.push accepts byte chunks and returns complete decoded messages. It supports fragmented UTF-8 and consecutive frames, consumes malformed JSON, and rejects headers above 8 KiB or frames above 16 MiB. Endpoint classification recognizes a host:digits form; it is not port validation, authorization or a connection operation.

DAP messages use an ASCII Content-Length header and a UTF-8 JSON body. Follow the public specification at https://microsoft.github.io/debug-adapter-protocol/overview. A real client must correlate request_seq, handle events and reverse requests, and apply timeouts, cancellation and owned connection cleanup. Initialize before configuring or launching; inspect returned capabilities instead of assuming support.

After stopped, obtain thread, stack, scope and variable information using current references. References can become invalid after continuing. Closing a launched target differs from disconnecting an attachment. The synthetic fixture-adapter.mjs tests wire framing and programmed replies only; it cannot establish real debugger support or evaluate user code.

The standard native regression uses a prepared Python interpreter with debugpy installed. SCRUM_DEBUG_PYTHON selects that interpreter. The test does not install dependencies or skip missing adapters; it creates an owned temporary program, verifies a breakpoint and a real variable/evaluation result, then closes the launched target and adapter. The verified combination is Python 3.12.12 with debugpy 1.8.22 on macOS. Other debugger runtimes remain separate acceptance gates.
