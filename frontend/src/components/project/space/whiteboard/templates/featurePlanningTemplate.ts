import type { WhiteboardTemplateDefinition } from './templateTypes'

export const featurePlanningTemplate: WhiteboardTemplateDefinition = {
    id: 'feature-planning',
    title: 'Feature Planning',
    description:
        'Feature planning flow from problem discovery through scoping, build, and launch readiness.',
    kind: 'mermaid',
    mermaidDefinition: `
flowchart LR

    Problem([Problem Identified]) --> Validated{Validated<br/>with users?}
    Validated -- No --> Research[User Research]
    Research --> Validated
    Validated -- Yes --> Goals[Define Goals<br/>& Success Metrics]

    Goals --> Scoped{Scope<br/>agreed?}
    Scoped -- No --> Brainstorm[Brainstorm<br/>Solutions]
    Brainstorm --> Scoped
    Scoped -- Yes --> Spec[Write Feature<br/>Spec]

    Spec --> Ready{Tech<br/>feasible?}
    Ready -- No --> Technical[Resolve Technical<br/>Blockers]
    Technical --> Ready
    Ready -- Yes --> Build[Build & Test]

    Build --> Risks{Risks<br/>clear?}
    Risks -- Yes --> Launch([Ship Feature])
    Risks -- No --> Mitigate[Mitigate<br/>Risks]
    Mitigate --> Launch

    style Problem fill:#f5f5f5,stroke:#333,color:#333
    style Launch fill:#e8f5e9,stroke:#2e7d32,color:#2e7d32
    style Validated fill:#fff4dd,stroke:#d4a017,color:#b8860b
    style Scoped fill:#fff4dd,stroke:#d4a017,color:#b8860b
    style Ready fill:#fff4dd,stroke:#d4a017,color:#b8860b
    style Risks fill:#fff4dd,stroke:#d4a017,color:#b8860b
    style Research fill:#ffebee,stroke:#c62828,color:#c62828
    style Brainstorm fill:#e8f5e9,stroke:#2e7d32,color:#2e7d32
    style Goals fill:#e1f5fe,stroke:#01579b,color:#01579b
    style Spec fill:#e1f5fe,stroke:#01579b,color:#01579b
    style Build fill:#e1f5fe,stroke:#01579b,color:#01579b
    style Technical fill:#ffebee,stroke:#c62828,color:#c62828
    style Mitigate fill:#fff3e0,stroke:#ef6c00,color:#ef6c00
`.trim(),
}
