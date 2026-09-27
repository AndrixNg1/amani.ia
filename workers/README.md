# Workers

This directory reserves background processing responsibilities for [data-engine](data-engine/README.md) and [document-processing](document-processing/README.md).

Both directories are documentation placeholders. No worker application, package manifest, runtime, queue library, environment loader, development command, or tests exist. Workers are not included in the current root npm workspace patterns.

The intended relationship is backend-owned, organization-scoped work submitted by Plugin APIs, with Redis available as local infrastructure for future queue tooling. Jobs and storage access must preserve and validate organization and user permissions as described in the [authorization requirements](../docs/architecture/authorization.md). No producer or consumer integration is implemented.
