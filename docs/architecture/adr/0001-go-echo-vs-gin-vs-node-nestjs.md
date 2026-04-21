# ADR-0001: Go + Echo vs. Gin vs. Node/NestJS

## Status

Accepted

## Context

STRIDE must run as a self-hostable Docker Compose stack, stay operable by a five-person team, and support real-time and scheduling features without forcing a complex
service mesh. The current repository already uses Go and Echo for the implemented backend
subset.

The main alternatives were:

- Gin: also lightweight and fast, but not materially simpler than Echo for this project.
- Node/NestJS: strong developer ergonomics and large ecosystem, but higher runtime footprint
  and a more complex asynchronous execution model for a team already using TypeScript in the
  frontend.

## Decision

Use Go as the backend language and Echo as the HTTP framework for the STRIDE modular
application.
