# ADR-0008: Goroutine Split for Real-Time Workers

## Status

Accepted

## Context

The backend has long-lived WebSocket connections, Redis subscriptions, notification stream
reads, whiteboard live updates, cursor presence, and a whiteboard persistence flusher. Running
all of that in request handlers would block HTTP workers and make disconnect handling brittle.

## Decision

Split real-time work into bounded goroutines with explicit ownership.

- One project hub goroutine per active project Redis subscription.
- Three goroutines per task or chat socket: client disconnect reader, ping loop, filtered
  hub-to-socket forwarder.
- Four goroutines per whiteboard element socket: ping loop, hub forwarder, client reader, and
  live-update coalescer.
- Three goroutines per whiteboard cursor socket: cursor reader, snapshot writer, ping loop.
- One cursor hub goroutine per active project, owning cursor maps through channels.
- One process-level whiteboard flusher goroutine, stopped by SIGINT or SIGTERM context.
- Notification sockets keep one blocking `XREAD` loop plus one disconnect reader goroutine.

Shared mutable state must stay inside hub owners or behind mutexes. Every goroutine must stop
through connection close, context cancellation, or hub detach. Slow subscribers are evicted
instead of blocking project broadcast.

## Consequences

This keeps hot paths simple and avoids global locks, but connection count directly affects
goroutine count. Load testing must include many connected users, reconnect bursts, and slow
clients.
