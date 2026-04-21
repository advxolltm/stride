| Field     | Value                                  |
| --------- | -------------------------------------- |
| Document  | Architecture Document                  |
| Project   | STRIDE                                 |
| Version   | 1.0.0                                  |
| Date      | 2026-04-16                             |
| Author    | Ilia Krylov                            |
| Reviewers | A. Fares, B. Komar, O. Fares, P. Bezak |
| Status    | Draft                                  |

## 1. Introduction and Goals

STRIDE is a self-hostable workspace for software teams. System combines project management,
Kanban task board, project chat, collaborative whiteboard, and automated task scheduling in one
Docker Compose stack.

Main functional scope:

- user registration and login with JWT-based session handling
- project creation, membership management, and Owner or Member roles
- task CRUD and Kanban workflow with enforced state machine
- real-time chat, task updates, and whiteboard collaboration
- scheduler proposals based on skill tags, member load, deadlines, and manual confirmation

Key stakeholders and expectations:

| Stakeholder | Expectation                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| Team Member | One workspace for tasks, chat, and whiteboard with predictable permissions.                            |
| Team Lead   | Clear project flow, valid task transitions, and scheduler proposals that can be reviewed before apply. |
| Maintainer  | Simple code structure, explicit decisions, and manageable operational complexity.                      |

Top quality goals:

| Priority | Goal            | Meaning                                                                |
| -------- | --------------- | ---------------------------------------------------------------------- |
| 1        | Maintainability | Clear module boundaries and simple deployment model.                   |
| 2        | Deployability   | Full stack starts with one Docker Compose command.                     |
| 3        | Security        | Authenticated access, role checks, and safe secret handling.           |
| 4        | Reliability     | Real-time collaboration survives disconnects and service restarts.     |
| 5        | Responsiveness  | Task moves, chat messages, and whiteboard updates feel near real time. |

## 2. Constraints

| Constraint                            | Impact on architecture                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| Docker Compose only                   | Favors few deployable services and simple runtime topology. |
| MIT-licensed product                  | Encourages permissive open-source dependencies.             |
| Human confirmation gate for scheduler | Scheduler may propose changes, not auto-apply them.         |

## 3. Context and Scope

STRIDE sits between users and their project data. Runtime scope stays inside browser, reverse
proxy, API, PostgreSQL, and Redis. System has no mandatory external runtime systems.

External actors and interfaces:

| Actor or System | Interface                                                    |
| --------------- | ------------------------------------------------------------ |
| Team Member     | Uses browser UI over HTTP or HTTPS and WebSocket or WSS.     |
| Team Lead       | Uses browser UI over HTTP or HTTPS and WebSocket or WSS.     |
| IT Specialist   | Deploys, configures, and operates stack with Docker Compose. |

Out of scope:

- native mobile apps
- video or audio calls
- email notifications
- third-party calendar integrations
- external identity providers
- Kubernetes deployment manifests
- plugin marketplace
- offline or PWA mode
- AI-generated planning or analytics

```mermaid
flowchart LR
    member["Team Member"]
    lead["Team Lead"]
    operator["IT Specialist"]

    subgraph stride["STRIDE"]
        system["Unified workspace\nTasks, chat, whiteboard, scheduler"]
    end

    member -->|Browser| system
    lead -->|Browser| system
    operator -->|Deploy and operate| system
```

## 4. Solution Strategy

Core solution ideas:

- Modular application for business logic, packaged as one Go backend service
- React single-page application for workspace UI
- REST API for CRUD and command flows
- WebSocket channels for real-time task, chat, and whiteboard events
- PostgreSQL as durable system of record
- Redis pub/sub for event fan-out across connected clients
- Nginx as single browser entry point
- Scheduler produces proposals from constraints, then waits for human confirmation

Technology summary:

| Concern                      | Choice                                 |
| ---------------------------- | -------------------------------------- |
| Frontend                     | React, TypeScript, Vite, Redux Toolkit |
| Backend                      | Go, Echo                               |
| Persistent storage           | PostgreSQL                             |
| Real-time transport backbone | WebSocket plus Redis pub or sub        |
| Reverse proxy                | Nginx                                  |
| Packaging                    | Docker Compose                         |

## 5. Building Block View

Static structure has two levels: deployment containers and internal application modules.

```mermaid
flowchart LR
    browser["Browser"] --> nginx["Nginx"]
    nginx --> spa["React SPA"]
    nginx --> api["Go Echo API"]
    api --> db["PostgreSQL"]
    api --> redis["Redis"]
```

Internal structure:

| Building block                | Responsibility                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Frontend pages and components | Workspace screens, navigation, Kanban UI, chat UI, whiteboard UI, scheduler review UI.    |
| Frontend store                | Shared API state, view state, and real-time event handling.                               |
| API routes                    | HTTP endpoints for auth, users, projects, tasks, chat, whiteboard, and scheduler actions. |
| Domain services               | Business rules, task state machine, membership rules, scheduler orchestration.            |
| Persistence layer             | Go stores, models, SQL migrations, PostgreSQL access.                                     |
| Real-time hub                 | Project-scoped WebSocket sessions and Redis-backed event distribution.                    |

Logical modules:

| Module                  | Main responsibility                                                         |
| ----------------------- | --------------------------------------------------------------------------- |
| Auth and User           | Registration, login, profile updates, password changes, session validation. |
| Projects and Membership | Project lifecycle, invitations, roles, join flows.                          |
| Tasks and Kanban        | Task CRUD, assignment, ordering, and enforced state transitions.            |
| Chat                    | Project-scoped messages and history.                                        |
| Whiteboard              | Canvas state, drawing elements, and presets.                                |
| Scheduler               | Constraint solving, proposal generation, review, and apply flow.            |

Codebase structure already follows layered split in backend (`routes`, `services`, `db`, `models`)
and feature-oriented split in frontend (`pages`, `components`, `store`, `shared`).

## 6. Runtime View

Important runtime scenarios:

**Login**

```mermaid
sequenceDiagram
    participant Browser
    participant Nginx
    participant API
    participant AuthService
    participant UserStore
    participant DB as PostgreSQL

    Browser->>Nginx: POST /api/v1/auth/login
    Nginx->>API: Forward request
    API->>AuthService: Authenticate user
    AuthService->>UserStore: Load user by email
    UserStore->>DB: SELECT user
    DB-->>UserStore: User row
    AuthService-->>API: Signed JWT
    API-->>Browser: Set JWT cookie
```

**Real-time collaboration flow**

Same event path used for task moves, chat messages, and whiteboard updates.

```mermaid
sequenceDiagram
    participant ClientA
    participant API
    participant Domain
    participant DB as PostgreSQL
    participant Redis
    participant Hub as WebSocket Hub
    participant ClientB

    ClientA->>API: Change task or send message or update canvas
    API->>Domain: Validate and persist
    Domain->>DB: Write authoritative state
    Domain->>Redis: Publish project event
    Redis-->>Hub: Deliver event
    Hub-->>ClientB: Push update
```

**Scheduler proposal flow**

```mermaid
sequenceDiagram
    participant Lead
    participant API
    participant Scheduler
    participant DB as PostgreSQL
    participant Solver

    Lead->>API: Request schedule proposal
    API->>Scheduler: Build problem
    Scheduler->>DB: Load tasks, skills, load, deadlines
    Scheduler->>Solver: Solve constraints
    Solver-->>Scheduler: Proposal set
    Scheduler-->>Lead: Reviewable proposal
    Lead->>API: Confirm selected proposal
    API->>DB: Apply confirmed changes
```

## 7. Deployment View

STRIDE runs as one Docker Compose stack.

```mermaid
flowchart LR
    browser["Browser"] --> web["web\nNginx"]

    subgraph stack["Docker Compose"]
        web --> front["frontserver\nVite"]
        web --> back["backserver\nGo Echo API"]
        back  ---  pgvol["db\nPostgreSQL"]
        back  ---  redisvol["Redis"]
    end
```

Service mapping:

| Service       | Purpose                               | Dev mapping                        | Prod mapping                         |
| ------------- | ------------------------------------- | ---------------------------------- | ------------------------------------ |
| `web`         | Browser entry point and reverse proxy | internal `8080` -> external `8080` | internal `80` -> external `443 + 80` |
| `frontserver` | SPA runtime                           | internal `3000` -> external `-`    | internal `3000` -> external `-`      |
| `backserver`  | REST API and WebSocket endpoint       | internal `8000` -> external `8000` | internal `8000` -> external `-`      |
| `db`          | durable relational storage            | internal `5432` -> external `5432` | internal `5432` -> external `-`      |
| `redis`       | pub/sub and transient state           | internal `6379` -> external `6379` | internal `6379` -> external `-`      |

Deployment principles:

- start stack with one Docker Compose command
- keep secrets in environment variables
- keep PostgreSQL and Redis state in named volumes
- expose one browser-facing entry point through Nginx

## 8. Crosscutting Concepts

| Concept         | Rule                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Authentication  | JWT-based session token in secure, HTTP-only cookie.                                                                |
| Authorization   | Project roles are Owner and Member; non-auth endpoints require authentication.                                      |
| API style       | REST endpoints return JSON; API contract documented with OpenAPI.                                                   |
| Persistence     | PostgreSQL is single source of truth; schema managed by migrations.                                                 |
| Real-time sync  | WebSocket sessions grouped by project scope; Redis distributes events; clients reconnect with exponential back-off. |
| Task workflow   | Valid task transitions follow Backlog -> In Progress -> Review -> Done.                                             |
| Scheduler       | Constraint solver proposes assignments; user reviews and confirms before apply.                                     |
| Whiteboard sync | Collaborative canvas uses project-scoped event distribution and task-region links.                                  |
| Error handling  | API returns consistent error payloads; request logging and health checks support operations.                        |
| Security checks | Dependency and static checks belong in build pipeline.                                                              |

## 9. Architectural Decisions

Major decisions:

| Decision                          | Reason                                                                         | Reference                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Go plus Echo for backend          | Small runtime, explicit structure, simple deployment.                          | [ADR-0001](adr/0001-go-echo-vs-gin-vs-node-nestjs.md)        |
| PostgreSQL as durable store       | Strong relational model for users, projects, tasks, chat, and whiteboard data. | [ADR-0002](adr/0002-postgresql-as-sole-source-of-truth.md)   |
| Redis for event fan-out           | Supports project-scoped real-time collaboration.                               | [ADR-0003](adr/0003-redis-pubsub-vs-in-memory-hub.md)        |
| WebSocket transport in Go backend | Keeps collaboration close to domain logic.                                     | [ADR-0004](adr/0004-coder-websocket-vs-gorilla-vs-nhooyr.md) |
| Store layer over relational DB    | Keeps persistence separate from handlers and services.                         | [ADR-0005](adr/0005-sqlc-vs-gorm-vs-raw-database-sql.md)     |
| Modular monolith                  | Fits product scope and deployment constraints better than microservices.       | [ADR-0006](adr/0006-modular-monolith-vs-microservices.md)    |

## 10. Quality Requirements

Quality tree:

- performance
- security
- reliability
- maintainability
- portability
- usability

Key scenarios:

| Quality         | Scenario                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Performance     | When team member moves task, sends chat message, or draws on whiteboard, other connected clients receive update near real time. |
| Security        | When client calls non-auth endpoint, request is accepted only with valid authentication and role checks.                        |
| Reliability     | When WebSocket connection drops, frontend shows reconnecting state and retries with exponential back-off.                       |
| Maintainability | When change is merged, code passes lint and tests and major architecture changes have explicit rationale.                       |
| Portability     | System runs in latest stable Chrome and Firefox and starts through Docker Compose on clean host.                                |
| Usability       | Daily work for task tracking, messaging, and sketching happens in one project workspace without tool switching.                 |

## 11. Risks and Technical Debt

| Item                                        | Impact                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Migration lifecycle must stay forward-only  | Destructive rollback on startup or shutdown can destroy persistent data.               |
| Access-control checks must stay centralized | Scattered or missing authorization rules create inconsistent protection.               |
| Real-time reconnect storms                  | Large reconnect bursts can overload API and Redis if back-off is weak.                 |
| Scheduler complexity                        | Constraint rules can become hard to explain if proposal output is not transparent.     |
| Whiteboard conflict handling                | Last-write-wins is simple but can overwrite simultaneous edits on same element.        |
| OpenAPI contract drift                      | API documentation can diverge from endpoints if not generated or reviewed in pipeline. |
| Deployment drift                            | Nginx, backend, frontend, and Compose settings must stay aligned across environments.  |
| Test environment fragility                  | Weak integration setup reduces confidence in runtime behavior.                         |

## 12. Glossary

| Term            | Meaning                                                        |
| --------------- | -------------------------------------------------------------- |
| ADR             | Architecture Decision Record.                                  |
| API             | Application Programming Interface.                             |
| JWT             | JSON Web Token.                                                |
| RBAC            | Role-Based Access Control.                                     |
| REST            | HTTP-based resource interface.                                 |
| SPA             | Single-Page Application.                                       |
| WebSocket       | Persistent bidirectional browser-server connection.            |
| Redis pub/sub   | Message distribution mechanism for real-time events.           |
| State machine   | Rule set that defines valid task status transitions.           |
| CSP             | Constraint Satisfaction Problem used by scheduler.             |
| OpenAPI         | Machine-readable API contract.                                 |
| Last-write-wins | Conflict rule where newest accepted update replaces older one. |
