import { Alert, Button } from '@heroui/react'
import type { ComponentProps, ReactNode } from 'react'

interface ProjectSettingsActionAlertProps {
    title: ReactNode
    description: ReactNode
    actionLabel: ReactNode
    actionIcon: ReactNode
    onAction: () => void
    alertStatus?: ComponentProps<typeof Alert>['status']
    buttonVariant?: 'outline' | 'danger-soft'
}

export function ProjectSettingsActionAlert({
    title,
    description,
    actionLabel,
    actionIcon,
    onAction,
    alertStatus,
    buttonVariant = 'outline',
}: Readonly<ProjectSettingsActionAlertProps>) {
    return (
        <div className="border-t pt-6">
            <Alert
                status={alertStatus}
                className="flex flex-col items-start gap-2 rounded-xl border sm:flex-row sm:items-center sm:gap-4"
            >
                <Alert.Indicator />
                <Alert.Content>
                    <Alert.Title>{title}</Alert.Title>
                    <Alert.Description>{description}</Alert.Description>
                </Alert.Content>
                <Button
                    variant={buttonVariant}
                    size="sm"
                    onPress={onAction}
                    className="shrink-0 sm:ml-auto"
                >
                    {actionIcon}
                    {actionLabel}
                </Button>
            </Alert>
        </div>
    )
}
