# Integration tests

Status: documentation placeholder; this directory contains no executable tests.

## Purpose and responsibilities

Verify real interactions among the gateway, Core API, orchestrator, Plugin APIs, and local infrastructure once those integrations exist. Cover service errors, scoped storage behavior, and authorization across boundaries. Use isolated infrastructure and synthetic organization data.

## Technology, environment, and commands

No runner, dependencies, environment variables, or command has been configured. Tooling and fixture setup remain to be selected when the relevant behavior is implemented. There is no workspace command for this directory, and current root test commands do not establish coverage of these scenarios.

## Relationship to existing tests

Backend workspaces contain their own NestJS starter unit and end-to-end tests. Those tests do not replace this intended repository-wide suite. See the [testing overview](../README.md) for the current scope and the [architecture overview](../../docs/architecture/README.md) for implementation gaps.
