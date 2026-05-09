import {
    Button,
    FieldError,
    Input,
    Label,
    Modal,
    TextArea,
    TextField,
} from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../shared/utils/api/errors'
import { useUpdateProjectMutation } from '../../store/features/project/project.api'
import type { Project } from '../../store/features/project/project.types'

interface EditProjectDialogProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    project: Project
}

export function EditProjectDialog({
    isOpen,
    setIsOpen,
    project,
}: Readonly<EditProjectDialogProps>) {
    const { t } = useTranslation(['project', 'common'])
    const [updateProject, { isLoading: isUpdatingProject }] =
        useUpdateProjectMutation()
    const [name, setName] = useState(project.name)
    const [description, setDescription] = useState(project.description || '')
    const [submitError, setSubmitError] = useState<string | null>(null)

    const resetForm = () => {
        setName(project.name)
        setDescription(project.description || '')
        setSubmitError(null)
    }

    const handleOpenChange = (open: boolean) => {
        if (open) {
            resetForm()
        }

        setIsOpen(open)

        if (!open) {
            resetForm()
        }
    }

    const handleUpdateProject = async () => {
        setSubmitError(null)

        try {
            await updateProject({
                projectId: project.id,
                body: {
                    name: name.trim(),
                    description: description.trim(),
                },
            }).unwrap()

            handleOpenChange(false)
        } catch (error) {
            setSubmitError(
                getApiErrorMessage(
                    error,
                    'Unable to update the project right now.',
                ),
            )
        }
    }

    const isUpdateDisabled =
        !name.trim() ||
        (name.trim() === project.name &&
            description.trim() === (project.description || ''))

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog>
                    <Modal.CloseTrigger />

                    <Modal.Header>
                        <Modal.Heading>{t('editDialog.title')}</Modal.Heading>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="flex flex-col gap-4 p-1">
                            <p className="text-muted text-sm">
                                {t('editDialog.description')}
                            </p>

                            <TextField
                                value={name}
                                onChange={setName}
                                className="w-full"
                            >
                                <Label>{t('editDialog.fields.title')}</Label>
                                <Input
                                    variant="secondary"
                                    placeholder={t(
                                        'editDialog.placeholders.title',
                                    )}
                                />
                                <FieldError />
                            </TextField>

                            <TextField
                                value={description}
                                onChange={setDescription}
                                className="w-full"
                            >
                                <Label>
                                    {t('editDialog.fields.description')}
                                </Label>
                                <TextArea
                                    variant="secondary"
                                    rows={4}
                                    placeholder={t(
                                        'editDialog.placeholders.description',
                                    )}
                                />
                                <FieldError />
                            </TextField>

                            {submitError && (
                                <p className="text-sm text-red-500">
                                    {submitError}
                                </p>
                            )}
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button
                            variant="outline"
                            onPress={() => handleOpenChange(false)}
                        >
                            {t('common:actions.cancel')}
                        </Button>

                        <Button
                            variant="primary"
                            onPress={handleUpdateProject}
                            isDisabled={isUpdateDisabled || isUpdatingProject}
                            isPending={isUpdatingProject}
                        >
                            {t('editDialog.actions.save')}
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    )
}
