# ADR-0005: sqlc vs. GORM vs. raw database/sql

## Status

Accepted

## Context

The contract targets sqlc, while the current repository uses GORM for the implemented user and
schema-access code. GORM accelerated early delivery, but it hides generated SQL and makes it
harder to reason about query plans, explicit joins, and repository contracts as the domain
grows.

## Decision

Standardize the target architecture on sqlc for new persistence modules and treat the existing
GORM code as transitional technical debt to be refactored incrementally.
