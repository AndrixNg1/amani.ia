# Gateway infrastructure placeholder

This directory reserves edge deployment configuration such as TLS termination, reverse proxy rules and network routing. It currently contains no executable configuration and no selected proxy technology. It is distinct from the implemented NestJS scaffold in [apps/gateway](../../apps/gateway/README.md), whose development port is `4000`.

There are no environment variables, development commands or tests for this directory yet. Run and validate the NestJS gateway through its application README. Dependency containers are described in [infrastructure](../README.md); Compose does not start an edge proxy.

Future edge infrastructure will route browser requests to the API gateway and keep Plugin APIs internal. It must not replace authorization inside each backend service. TLS, origin policy, trusted forwarding headers, rate limits and production ingress remain deployment decisions to implement and test.
