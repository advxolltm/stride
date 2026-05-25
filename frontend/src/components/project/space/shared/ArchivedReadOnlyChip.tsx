import { Chip } from '@heroui/react'
import { Archive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ArchivedReadOnlyChip() {
    const { t } = useTranslation('space')

    return (
        <Chip
            size="md"
            variant="soft"
            className="flex shrink-0 flex-row items-center gap-2"
        >
            <Archive size={16} />
            {t('tasks.messages.archivedReadOnly')}
        </Chip>
    )
}
