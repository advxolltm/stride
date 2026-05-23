import type { WhiteboardTemplateDefinition } from './templateTypes'

export const appUserFlowTemplate: WhiteboardTemplateDefinition = {
    id: 'app-user-flow',
    title: 'App User Flow',
    description:
        'Application user journey covering authentication, navigation, and core actions.',
    kind: 'mermaid',
    mermaidDefinition: `
flowchart LR

    Start([App Launch]) --> AuthGate{Authenticated?}
    AuthGate -- No --> Login[Login / Signup]
    AuthGate -- Yes --> Dashboard[Dashboard]
    Login --> Dashboard

    Dashboard --> Feed[Content Feed]
    Dashboard --> Search[Discovery]
    Dashboard --> Create[Creator Studio]
    Dashboard --> Profile[User Account]

    Feed --> PostView[Post Details]
    Search --> PostView
    PostView --> Interact[Like / Comment / Share]

    Create --> Upload[Upload Media]
    Upload --> Feed

    Profile --> Settings[App Settings]
    Settings --> Logout([Logout])
    Logout --> Login

    style Start fill:#f5f5f5,stroke:#333
    style AuthGate fill:#fff4dd,stroke:#d4a017
    style Dashboard fill:#e1f5fe,stroke:#01579b
    style Login fill:#ffebee,stroke:#c62828
    style Logout fill:#ffebee,stroke:#c62828
    style Create fill:#e8f5e9,stroke:#2e7d32
    style Upload fill:#e8f5e9,stroke:#2e7d32
    style Profile fill:#f3e5f5,stroke:#7b1fa2
    style Settings fill:#f3e5f5,stroke:#7b1fa2
    style Feed fill:#e1f5fe,stroke:#01579b
    style PostView fill:#e1f5fe,stroke:#01579b
    style Interact fill:#e1f5fe,stroke:#01579b
    style Search fill:#f5f5f5,stroke:#333
`.trim(),
}
