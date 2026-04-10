import { useState } from 'react'
import { Sidebar } from './SideBar'

interface MainPageLayoutProps {
    children: React.ReactNode
}

export function MainPageLayout({ children }: MainPageLayoutProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <div className="flex h-[calc(100svh-3.5rem)] w-full overflow-hidden">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((prev) => !prev)}
            />

            <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
                {children}
            </div>
        </div>
    )
}