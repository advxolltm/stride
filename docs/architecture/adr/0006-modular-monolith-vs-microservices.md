# ADR-0006: Modular Monolith vs. Microservices

## Status

Accepted

## Context

STRIDE is deployed as a single Docker Compose stack,
and must stay understandable to reviewers without operational indirection. The domain is broad,
but the implementation pace and codebase both point toward one deployable backend with
clear module boundaries.

## Decision

Adopt a modular monolith as the primary architecture and add an event-driven real-time layer
inside that monolith instead of splitting the system into independently deployed microservices.
