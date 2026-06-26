# ADR-0009: gorilla/websocket and Redis Project Hub

## Status

Accepted

## Context

The current backend already uses gorilla/websocket with Echo handlers. Real-time events are
project-scoped: tasks, chat, project membership, project settings, and whiteboard persisted
events all publish to the Redis channel named by project ID. Whiteboard cursor presence is
process-local because it is ephemeral and only useful to currently connected users.

The earlier target decision to use coder/websocket no longer matches implementation state.
Changing libraries now would not improve product behavior enough to justify the migration.

## Decision

Keep gorilla/websocket for the current real-time layer.

- Keep WebSocket endpoints under `/api/v1/ws`.
- Authenticate the upgrade with the existing Echo JWT middleware.
- Authorize project sockets with project membership checks before upgrade.
- Publish project events through Redis pub/sub using project ID as channel.
- Use a backend project hub registry so each process opens at most one Redis subscription per
  active project and fans out to local socket subscribers.
- Filter task, chat, project, and whiteboard event types per endpoint before writing to the
  socket.
- Use ping/pong deadlines, read limits, and serialized writes guarded by a mutex.
- Frontend owns reconnect through RTK Query cache lifecycle and exponential back-off with
  jitter.

## Consequences

Redis pub/sub events are not replayable. Clients must refetch authoritative REST state after
reconnect or parse failure. Horizontal backend scaling works for project events as long as every
instance connects to the same Redis. Cursor presence remains local to one backend process unless
a later ADR moves it to Redis.
