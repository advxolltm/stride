# ADR-0002: PostgreSQL as Sole Source of Truth

## Status

Accepted

## Context

The domain includes users, projects, memberships, chat messages, tasks, assignments,
whiteboards, and future scheduling proposals. These objects are relational, consistency
critical, and frequently queried together. Running multiple durable datastores would increase
operational cost and migration complexity for limited team capacity.

## Decision

Use PostgreSQL as the only durable system of record for MVP data. Redis is allowed only for
ephemeral concerns such as pub/sub and short-lived cache state.
