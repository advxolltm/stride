# ADR-0010: Whiteboard Framework Decision

## Status

Accepted

## Context

STRIDE needs a project whiteboard integrated with tasks, chat, permissions, templates, remote
cursors, REST snapshots, WebSocket live updates, and backend persistence.

Main requirement: choose the most customizable framework for STRIDE, not the framework with the
most built-in features.

Alternatives:

| Framework         | Strengths                                                                   | Weaknesses for STRIDE                                    |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| Excalidraw        | React component, imperative API, customizable menus, typed JSON scene data. | STRIDE must own persistence and sync.                    |
| tldraw            | Very extensible editor model and custom shapes.                             | Larger integration surface and own store model.          |
| Fabric.js         | Low-level canvas object control.                                            | Too much editor UI and collaboration code must be built. |
| Konva             | Good React canvas primitives.                                               | Toolkit, not full whiteboard framework.                  |
| Raw Canvas or SVG | Maximum control.                                                            | Rebuilds whole editor stack.                             |
| Miro SDK          | Mature whiteboard ecosystem.                                                | External platform dependency; not self-hostable.         |

## Decision

Use Excalidraw as the STRIDE whiteboard framework.

Reasons:

- Best customization fit: Excalidraw gives finished whiteboard UX while STRIDE owns surrounding
  panels, templates, task links, permissions, and layout.
- Element data is JSON-compatible, so backend can persist it in PostgreSQL and merge Redis
  pending operations.
- Imperative API supports STRIDE actions: insert task regions, focus linked areas, apply remote
  scene updates, and preserve viewport.
- Real-time sync stays product-owned through REST, WebSocket, Redis, and PostgreSQL.

Do not use Excalidraw's default collaboration server as STRIDE architecture. STRIDE owns
authentication, project authorization, persistence, and WebSocket protocol.

## Consequences

Positive:

- Less editor code than Fabric.js, Konva, or raw Canvas.
- More product customization than hosted whiteboard SDKs.
- Good fit with React, RTK Query, HeroUI, and current route layout.

Negative:

- STRIDE must maintain mapping between Excalidraw element IDs and backend element IDs.
- Concurrent edit model remains last-write-wins plus rollback, not OT or CRDT.

Rules:

- Use Excalidraw APIs before patching library behavior.
- Reconsider this decision only if STRIDE needs custom shape semantics that Excalidraw cannot
  support cleanly.
