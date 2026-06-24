# ADR-0004: coder/websocket vs. gorilla/websocket vs. nhooyr/websocket

## Status

Superseded by [ADR-0009](0009-gorilla-websocket-and-redis-project-hub.md)

## Context

STRIDE needs a Go WebSocket library that fits a modern context-aware API, integrates cleanly
with Echo, and does not depend on an abandoned ecosystem. gorilla/websocket is widely known,
but its surrounding project history is less attractive for a greenfield 2026 codebase.

## Decision

Do not use this decision for new implementation work. The current backend uses
gorilla/websocket and the active WebSocket architecture is documented in ADR-0009.
