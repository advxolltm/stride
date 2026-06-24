import { Spinner } from '@heroui/react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import { EmptyProjectsState } from '../components/main/EmptyProjectsState'
import { MainPageCard } from '../components/main/MainPageCard'
import { MainPageHeader } from '../components/main/MainPageHeader'
import { MainPageLayout } from '../components/main/MainPageLayout'
import type { AppLayoutOutletContext } from '../layouts/AppLayout'
import { useAppSelector } from '../shared/hooks/redux'
import { useKeyboardGridNavigation } from '../shared/hooks/useKeyboardGridNavigation'
import { useGetProjectsQuery } from '../store/features/project/project.api'
import { selectUserId } from '../store/userSlice'

export function HomePage() {
    const { t } = useTranslation('project')
    const { openCreateProjectDialog } =
        useOutletContext<AppLayoutOutletContext>()
    const { data: projects = [], isLoading } = useGetProjectsQuery()
    const userId = useAppSelector(selectUserId)
    const hasProjects = projects.length > 0
    const projectsGridRef = useRef<HTMLDivElement>(null)

    const keyboardNavigation = useKeyboardGridNavigation<HTMLAnchorElement>({
        itemCount: projects.length,
        getColumnCount: () => {
            const grid = projectsGridRef.current
            if (!grid) return 1
            return window.getComputedStyle(grid).gridTemplateColumns.split(' ')
                .length
        },
    })

    return (
        <MainPageLayout>
            <div className="app-scrollbar flex-1 overflow-y-auto px-8 py-8">
                <MainPageHeader
                    title={t('home.title')}
                    description={t('home.description')}
                    onCreateProject={
                        hasProjects ? openCreateProjectDialog : undefined
                    }
                />

                {isLoading ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <Spinner
                            className="block h-10 w-10 text-(--accent)"
                            size="sm"
                        />
                    </div>
                ) : hasProjects ? (
                    <div
                        ref={projectsGridRef}
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    >
                        {projects.map((project, index) => {
                            const itemProps =
                                keyboardNavigation.getItemProps(index)

                            return (
                                <MainPageCard
                                    key={project.id}
                                    project={project}
                                    href={`/project/${project.id.toString()}`}
                                    isOwner={
                                        project.creator?.id === userId
                                    }
                                    linkRef={itemProps.itemRef}
                                    tabIndex={itemProps.tabIndex}
                                    onFocus={itemProps.onFocus}
                                    onKeyDown={itemProps.onKeyDown}
                                />
                            )
                        })}
                    </div>
                ) : (
                    <EmptyProjectsState
                        onCreateProject={openCreateProjectDialog}
                    />
                )}
            </div>
        </MainPageLayout>
    )
}
