import {
    Button,
    FieldError,
    Input,
    Label,
    Spinner,
    TextArea,
    TextField,
    toast,
} from '@heroui/react'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdateProjectMutation } from '../../../store/features/project/project.api'
import type { Project } from '../../../store/features/project/project.types'
import { ProjectGeneralSettingsArchive } from './ProjectGeneralSettingsArchive'
import { ProjectGeneralSettingsDelete } from './ProjectGeneralSettingsDelete'

interface ProjectGeneralSettingsProps {
    isOwner: boolean
    project: Project
}

export function ProjectGeneralSettings({
    isOwner,
    project,
}: Readonly<ProjectGeneralSettingsProps>) {
    const { t } = useTranslation('project')
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(project.name)
    const [description, setDescription] = useState(project.description || '')
    const [nameError, setNameError] = useState('')

    const [updateProject, { isLoading }] = useUpdateProjectMutation()

    const formattedCreatedAt = new Date(project.createdAt).toLocaleDateString()
    const formattedUpdatedAt = new Date(project.updatedAt).toLocaleDateString()
    const createdByDisplay =
        project.creator.fullName ?? project.creator.username
    const metadataFields = [
        {
            key: 'createdBy',
            label: t('generalSettings.createdBy'),
            value: createdByDisplay,
        },
        {
            key: 'createdAt',
            label: t('generalSettings.createdAt'),
            value: formattedCreatedAt,
        },
        {
            key: 'updatedAt',
            label: t('generalSettings.updatedAt'),
            value: formattedUpdatedAt,
        },
    ]
    const viewFields = [
        {
            key: 'name',
            label: t('generalSettings.projectName'),
            value: name,
            valueClassName: 'text-sm wrap-break-word truncate',
        },
        {
            key: 'description',
            label: t('generalSettings.projectDescription'),
            value: description,
            valueClassName: 'text-sm leading-relaxed truncate',
        },
        ...metadataFields.map((field) => ({
            ...field,
            valueClassName: 'text-sm',
        })),
    ]

    function hasChanges(): boolean {
        return (
            name.trim() !== project.name ||
            description.trim() !== (project.description || '')
        )
    }
    const handleCancel = () => {
        setName(project.name)
        setDescription(project.description || '')
        setNameError('')
        setIsEditing(false)
    }

    const handleSave = async () => {
        if (!name.trim()) {
            setNameError(t('generalSettings.nameRequired'))
            return
        }

        try {
            await updateProject({
                projectId: project.id,
                body: {
                    name: name.trim(),
                    description: description.trim(),
                },
            }).unwrap()
            toast.success(t('generalSettings.saveSuccess'))
            setIsEditing(false)
        } catch {
            toast.danger(t('generalSettings.saveError'))
        }
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-8 p-2">
            <div className="flex shrink-0 items-center justify-between">
                <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--overlay-foreground)' }}
                >
                    {t('generalSettings.title')}
                </h2>

                {isOwner && !isEditing && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => setIsEditing(true)}
                        className="gap-1.5"
                        style={{ color: 'var(--muted)' }}
                    >
                        <Pencil size={13} />
                        {t('generalSettings.edit')}
                    </Button>
                )}
            </div>

            {!isEditing ? (
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 [scrollbar-gutter:auto]">
                    {viewFields.map((field) => (
                        <div key={field.key}>
                            <p
                                className="mb-1 text-xs"
                                style={{ color: 'var(--muted)' }}
                            >
                                {field.label}
                            </p>
                            <p className={field.valueClassName}>
                                {field.value}
                            </p>
                        </div>
                    ))}

                    {isOwner && (
                        <ProjectGeneralSettingsArchive project={project} />
                    )}

                    {isOwner && (
                        <ProjectGeneralSettingsDelete project={project} />
                    )}
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 [scrollbar-gutter:auto]">
                    <TextField
                        value={name}
                        onChange={(val) => {
                            setName(val)
                            if (nameError) setNameError('')
                        }}
                        isInvalid={!!nameError}
                        className="w-full"
                    >
                        <Label>{t('generalSettings.nameLabel')}</Label>
                        <Input variant="secondary" />
                        <FieldError>{nameError}</FieldError>
                    </TextField>

                    <TextField
                        value={description}
                        onChange={setDescription}
                        className="w-full"
                    >
                        <Label>{t('generalSettings.descriptionLabel')}</Label>
                        <TextArea variant="secondary" rows={5} />
                        <FieldError />
                    </TextField>

                    {metadataFields.map((field) => (
                        <TextField
                            key={field.key}
                            isDisabled
                            className="w-full"
                        >
                            <Label>{field.label}</Label>
                            <Input variant="secondary" value={field.value} />
                            <FieldError />
                        </TextField>
                    ))}

                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onPress={handleCancel}
                            isDisabled={isLoading}
                        >
                            {t('generalSettings.cancel')}
                        </Button>

                        <Button
                            variant="primary"
                            size="sm"
                            onPress={handleSave}
                            isPending={isLoading}
                            isDisabled={!hasChanges()}
                        >
                            {isLoading && <Spinner color="current" size="sm" />}
                            {t('generalSettings.save')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
