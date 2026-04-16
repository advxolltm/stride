# ADR-0004: coder/websocket vs. gorilla/websocket vs. nhooyr/websocket

## Status

Accepted

## Context

STRIDE needs a Go WebSocket library that fits a modern context-aware API, integrates cleanly
with Echo, and does not depend on an abandoned ecosystem. gorilla/websocket is widely known,
but its surrounding project history is less attractive for a greenfield 2026 codebase.

## Decision

Adopt coder/websocket for the planned real-time transport layer.
