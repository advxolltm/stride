import { Button, Modal } from '@heroui/react'
import { CircleQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type InfoIconProps = {
  onPress: () => void;
};

export function InfoIcon({onPress}: InfoIconProps) {
    const { t } = useTranslation('common')

    return (
        <Button
            aria-label={t('notification.ariaLabel')}
            variant="ghost"
            isIconOnly
            className="relative transition-all"
			onPress={onPress}
        >
            <CircleQuestionMark className="h-5 w-5" />
        </Button>
    )
}
