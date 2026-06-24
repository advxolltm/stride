# ADR-0007: Redis Streams for User Notifications

## Status

Accepted

## Context

Notifications are user-scoped, short-lived, and need replay after a browser reconnects. They
must support snapshot delivery, live delivery, mark-as-read, and delete without adding another
durable database table. PostgreSQL remains the source of truth for core domain data; Redis is
already required for real-time fan-out and transient collaboration state.

Redis pub/sub is not enough for notifications because disconnected clients miss messages. A SQL
notification table would be more durable, but adds migrations, cleanup policy, and query paths
for data that the product treats as transient.

## Decision

Use one Redis Stream per user for notifications.

- Stream key: `notifications:user:{userID}`.
- Max stream length: `100`.
- TTL: `30 days`.
- Append notification changes with `XADD`.
- Read snapshots with `XRANGE`.
- Push live WebSocket updates with blocking `XREAD`.
- Delete notification entries with `XDEL`.
- Collapse repeated entries by notification ID so mark-as-read appends a new state instead of
  mutating old stream entries.

## Consequences

Redis restart is acceptable only if Redis persistence is enabled. Notifications are transient;
they are not audit records. Notification code must not store business-critical state only in
Redis Streams.
