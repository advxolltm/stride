import { Breadcrumbs, Skeleton } from '@heroui/react'
import { Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useGetProjectByIdQuery } from '../../store/features/project/project.api'

export function AppBreadcrumb() {
    const { t } = useTranslation()
    const { projectId } = useParams()
    const location = useLocation()
    const { data: project, isLoading } = useGetProjectByIdQuery(
        projectId ?? '',
        {
            skip: !projectId,
        },
    )

    if (!projectId) {
        return null
    }

    const path = location.pathname
    const isTasks = path.endsWith('/tasks')
    const isChat = path.endsWith('/chat')
    const isWhiteboard = path.endsWith('/whiteboard')

    const tailLabel = isTasks
        ? t('project:spaces.tasks')
        : isChat
          ? t('project:spaces.chat')
          : isWhiteboard
            ? t('project:spaces.whiteboard')
            : null

    const projectHref = `/project/${projectId}`
    const overviewHref = '/'
    const tailHref = isTasks
        ? `${projectHref}/tasks`
        : isChat
          ? `${projectHref}/chat`
          : isWhiteboard
            ? `${projectHref}/whiteboard`
            : null

    const overviewIsCurrent = path === overviewHref
    const projectIsCurrent = path === projectHref
    const tailIsCurrent = Boolean(tailLabel)

    return (
        <div className="border-default-200 border-b px-6 py-3">
            <Breadcrumbs className="text-sm">
                <Breadcrumbs.Item>
                    <Link
                        to={overviewHref}
                        aria-current={overviewIsCurrent ? 'page' : undefined}
                        className="flex flex-row items-center gap-1"
                    >
                        <Home size={14} />
                        {t('common:navigation.overview')}
                    </Link>
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    {project ? (
                        <Link
                            to={projectHref}
                            aria-current={
                                projectIsCurrent ? 'page' : undefined
                            }
                        >
                            {project.name}
                        </Link>
                    ) : (
                        <span aria-busy={isLoading} className="inline-flex">
                            <Skeleton className="h-4 w-28 rounded-lg" />
                        </span>
                    )}
                </Breadcrumbs.Item>
                {tailLabel && tailHref && (
                    <Breadcrumbs.Item>
                        <Link
                            to={tailHref}
                            aria-current={tailIsCurrent ? 'page' : undefined}
                        >
                            {tailLabel}
                        </Link>
                    </Breadcrumbs.Item>
                )}
            </Breadcrumbs>
        </div>
    )
}
