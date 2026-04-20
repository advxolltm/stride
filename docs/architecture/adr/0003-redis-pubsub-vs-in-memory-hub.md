# ADR-0003: Redis Pub/Sub vs. In-Memory Hub for WebSocket Fan-Out

## Status

Accepted

## Context

Real-time task, chat, and whiteboard events need to reach all connected clients for a project.
An in-memory hub is sufficient for a single process, but it ties correctness to one API
instance and complicates later horizontal scaling. The repository already provisions Redis in
Docker Compose, but the current branch does not yet use it from application code.

## Decision

Use Redis pub/sub as the event fan-out backbone for the planned WebSocket layer instead of a
process-local in-memory hub.
