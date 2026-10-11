# Use dynamic instrumentation for a specific question

Use Frida only on an authorized target when direct tracing is needed to distinguish a hypothesis. Confirm the installed Frida version, target architecture and local device or process inventory through its actual help and documented API. Availability differs by platform and deployment; do not claim an attachment from a successful import.

Choose a bounded observation such as function arguments, return values or call timing. Avoid replacing functions or writing memory when read-only instrumentation answers the question. Instrumentation itself can change timing and behavior, so compare the original reproduction with the instrumented run.

Retain target identity and sanitized observations. Dispose the script and owned session after the measurement without killing an attached foreign process. Treat a permission failure as an access issue and try a less invasive local reproduction before requesting new grants.
