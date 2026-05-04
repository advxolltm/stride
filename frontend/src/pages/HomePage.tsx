import { Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import { EmptyProjectsState } from '../components/main/EmptyProjectsState'
import { MainPageCard } from '../components/main/MainPageCard'
import { MainPageHeader } from '../components/main/MainPageHeader'
import { MainPageLayout } from '../components/main/MainPageLayout'
import type { AppLayoutOutletContext } from '../layouts/AppLayout'
import { useKeyboardGridNavigation } from '../shared/hooks/useKeyboardGridNavigation'
import { useGetProjectsQuery } from '../store/features/project/project.api'

export function HomePage() {
    const { t } = useTranslation('project')
    const { openCreateProjectDialog } =
        useOutletContext<AppLayoutOutletContext>()
    const { data: projects = [], isLoading } = useGetProjectsQuery()
    const hasProjects = projects.length > 0
    const keyboardNavigation = useKeyboardGridNavigation<HTMLAnchorElement>({
        itemCount: projects.length,
        getColumnCount: () => {
            if (window.matchMedia('(min-width: 1024px)').matches) {
                return 4
            }

            if (window.matchMedia('(min-width: 640px)').matches) {
                return 2
            }

            return 1
        },
    })

    const handleCreateProject = () => {
        openCreateProjectDialog()
    }

    return (
        <MainPageLayout>
            <div className="flex-1 overflow-y-auto px-8 py-8">
                <MainPageHeader
                    title={t('home.title')}
                    description={t('home.description')}
                    onCreateProject={
                        hasProjects ? handleCreateProject : undefined
                    }
                />

                {isLoading ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <Spinner
                            type="wave"
                            className="block h-10 w-10 text-[var(--accent)]"
                            size="sm"
                        />
                    </div>
                ) : hasProjects ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {projects.map((project, index) => {
                            const itemProps =
                                keyboardNavigation.getItemProps(index)

                            return (
                                <MainPageCard
                                    key={project.id}
                                    project={project}
                                    href={`/project/${project.id.toString()}`}
                                    linkRef={itemProps.itemRef}
                                    tabIndex={itemProps.tabIndex}
                                    onFocus={itemProps.onFocus}
                                    onKeyDown={itemProps.onKeyDown}
                                />
                            )
                        })}
                    </div>
                ) : (
                    <EmptyProjectsState onCreateProject={handleCreateProject} />
                )}
            </div>
        </MainPageLayout>
    )
}
