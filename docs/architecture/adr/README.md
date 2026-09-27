# Architecture decision records

No ADR files existed in this directory when the repository setup documentation was prepared. There is no prior ADR history to rewrite or mark as accepted.

The [architecture overview](../README.md) describes current code and intended boundaries. The [authorization requirements](../authorization.md) document constraints for future implementation; they do not claim that authentication or tenant guards already exist.

For future decisions, add a new numbered Markdown record with a title, date, status, context, decision or proposal, consequences, and implementation status. Distinguish a proposed approach from an accepted decision and from shipped code. When a decision changes, add a new record and link the superseded one so that the original history remains readable.

Pending details include service authentication, permission propagation and revocation, storage enforcement, queue tooling, and shared package APIs. No choice among those mechanisms is made by the current placeholders.
