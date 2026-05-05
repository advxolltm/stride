import { CheckSquare, Lightbulb, MessageCircle } from 'lucide-react'
import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBadge } from '../../../shared/components'
import { useKeyboardGridNavigation } from '../../../shared/hooks/useKeyboardGridNavigation'
import { useParams } from 'react-router'
import ProjectSpaceCard from './ProjectSpaceCard'

interface SpaceItem {
    key: string
    route: string
    icon: JSX.Element
}

export function ProjectSpacesGrid() {
    const { projectId } = useParams()
    const { t } = useTranslation('project')

    const spaces: SpaceItem[] = [
        {
            key: 'whiteboard',
            route: 'whiteboard',
            icon: <IconBadge color="purple" icon={Lightbulb} />,
        },
        {
            key: 'tasks',
            route: 'tasks',
            icon: <IconBadge color="yellow" icon={CheckSquare} />,
        },
        {
            key: 'chat',
            route: 'chat',
            icon: <IconBadge color="green" icon={MessageCircle} />,
        },
    ]
    const keyboardNavigation = useKeyboardGridNavigation<HTMLAnchorElement>({
        itemCount: spaces.length,
        getColumnCount: () => {
            if (window.matchMedia('(min-width: 1024px)').matches) {
                return 3
            }

            if (window.matchMedia('(min-width: 640px)').matches) {
                return 2
            }

            return 1
        },
    })

    return (
        <div>
            <h2 className="mb-4 text-xl font-medium">{t('spaces.title')}</h2>

            <div className="max-w-5xl">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {spaces.map((space, index) => {
                        const itemProps = keyboardNavigation.getItemProps(index)

                        return (
                            <ProjectSpaceCard
                                key={space.key}
                                title={t(`spaces.${space.key}`)}
                                description={t(
                                    `spaces.${space.key}Description`,
                                )}
                                icon={space.icon}
                                href={`/project/${projectId}/${space.route}`}
                                linkRef={itemProps.itemRef}
                                tabIndex={itemProps.tabIndex}
                                onFocus={itemProps.onFocus}
                                onKeyDown={itemProps.onKeyDown}
                            />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
