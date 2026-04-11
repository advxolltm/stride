interface MainPageLayoutProps {
    children: React.ReactNode
}

export function MainPageLayout({ children }: MainPageLayoutProps) {
    return (
        <div className="flex h-[calc(100svh-3.5rem)] w-full overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
                {children}
            </div>
        </div>
    )
}
