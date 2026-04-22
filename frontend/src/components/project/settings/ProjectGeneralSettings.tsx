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
                    status: 'active',
                },
            }).unwrap()
            toast.success(t('generalSettings.saveSuccess'))
            setIsEditing(false)
        } catch {
            toast.danger(t('generalSettings.saveError'))
        }
    }

    return (
        <div className="flex flex-col gap-8 p-2">
            <div className="flex items-center justify-between">
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
                <div className="space-y-5">
                    <div>
                        <p
                            className="mb-1 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.projectName')}
                        </p>
                        <p className="text-sm">{name}</p>
                    </div>

                    <div>
                        <p
                            className="mb-1 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.projectDescription')}
                        </p>
                        <p className="text-sm leading-relaxed">{description}</p>
                    </div>

                    <div>
                        <p
                            className="mb-1 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.createdBy')}
                        </p>
                        <p className="text-sm">{createdByDisplay}</p>
                    </div>

                    <div>
                        <p
                            className="mb-1 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.createdAt')}
                        </p>
                        <p className="text-sm">{formattedCreatedAt}</p>
                    </div>

                    <div>
                        <p
                            className="mb-1 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.updatedAt')}
                        </p>
                        <p className="text-sm">{formattedUpdatedAt}</p>
                    </div>

                    {isOwner && (
                        <>
                            <ProjectGeneralSettingsDelete project={project} />
                        </>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
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
                        <TextArea variant="secondary" rows={3} />
                        <FieldError />
                    </TextField>

                    <TextField isDisabled className="w-full">
                        <Label>{t('generalSettings.createdBy')}</Label>
                        <Input variant="secondary" value={createdByDisplay} />
                        <FieldError />
                    </TextField>

                    <TextField isDisabled className="w-full">
                        <Label>{t('generalSettings.createdAt')}</Label>
                        <Input variant="secondary" value={formattedCreatedAt} />
                        <FieldError />
                    </TextField>

                    <TextField isDisabled className="w-full">
                        <Label>{t('generalSettings.updatedAt')}</Label>
                        <Input variant="secondary" value={formattedUpdatedAt} />
                        <FieldError />
                    </TextField>

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
