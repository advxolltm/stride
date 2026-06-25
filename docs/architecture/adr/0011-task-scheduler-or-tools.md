# ADR-0011: Task Scheduler using Google OR-Tools

## Status

Accepted

## Context

STRIDE implements automatic task-assignment. Due to the inherent combinatorial complexity of the problem-space, it is necessary to use an efficient solution. Additionally, it should be relatively easy to encode further requirements and combinations of requirements as they come up. In literature, this problem is known / can be seen as a **Constraint Satisfaction Problem (CSP)** with **Constraint Programming (CP)** is the standard approach to solving such problems (Source)[https://doi.org/10.1016/S0377-2217(98)00364-6].

## Decision

Implementing such CP-solvers (efficiently) is a huge undertaking, we therefore opted to existing solvers with the requirement that they are battle-tested and well-maintained. The backend is written in Go, however, good and well-maintained CP-solvers do not seem to exist as a useable go-package. Options such as [Centipede](https://github.com/gnboorse/centipede) are not maintained anymore and lack features of other, more sophisticated solvers. We therefore opted to write the task-scheduler in a different language for which a better solver exists. We ultimately chose (Google OR-Tools CP-SAT solver)[https://developers.google.com/optimization/cp/cp_solver] which is a widely used and obviously well-maintained implementation due to its huge corporate backing. (see (GitHub Repository)[https://github.com/google/or-tools])

## Consequences

Positive:

- Using constraint programming is a known approach to solve this kind of problem.
- Using an existing well-maintained, well documented and efficient CP-SAT solver.

Negative:

- Implementation has to be in a completely different language.
- Due to that, the implementation also runs as a separate service which the Go Backend has to communicate with.

Rules:

- The Task-Scheduler is not publicly exposed, only the Go Backend is allowed to send scheduling requests to it.
- Due to the potential space-complexity, both time and memory consumption needs to be limited to reasonable amounts.
