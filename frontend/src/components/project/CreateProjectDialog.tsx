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
import { useCreateProjectMutation } from '../../store/features/project/project.api'
import createProjectSlug from '../../shared/utils/createProjectSlug'

interface CreateProjectDialogProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
}

const EMPTY_FORM = {
    title: '',
    description: '',
}

export function CreateProjectDialog({
    isOpen,
    setIsOpen,
}: Readonly<CreateProjectDialogProps>) {
    const { t } = useTranslation(['project', 'common'])
    const [createProject, { isLoading: isCreatingProject }] =
        useCreateProjectMutation()
    const [title, setTitle] = useState(EMPTY_FORM.title)
    const [description, setDescription] = useState(EMPTY_FORM.description)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const resetForm = () => {
        setTitle(EMPTY_FORM.title)
        setDescription(EMPTY_FORM.description)
        setSubmitError(null)
    }

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)

        if (!open) {
            resetForm()
        }
    }

    const handleCreateProject = async () => {
        setSubmitError(null)

        try {
            await createProject({
                name: title.trim(),
                slug: createProjectSlug(title),
                description: description.trim(),
                status: 'active',
            }).unwrap()

            handleOpenChange(false)
        } catch (error) {
            setSubmitError(
                getApiErrorMessage(
                    error,
                    'Unable to create the project right now.',
                ),
            )
        }
    }

    const isCreateDisabled = !title.trim() || !description.trim()

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog>
                    <Modal.CloseTrigger />

                    <Modal.Header>
                        <Modal.Heading>{t('createDialog.title')}</Modal.Heading>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="flex flex-col gap-4 p-1">
                            <p className="text-sm text-[var(--muted)]">
                                {t('createDialog.description')}
                            </p>

                            <TextField
                                value={title}
                                onChange={setTitle}
                                className="w-full"
                            >
                                <Label>{t('createDialog.fields.title')}</Label>
                                <Input
                                    variant="secondary"
                                    placeholder={t(
                                        'createDialog.placeholders.title',
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
                                    {t('createDialog.fields.description')}
                                </Label>
                                <TextArea
                                    variant="secondary"
                                    rows={4}
                                    placeholder={t(
                                        'createDialog.placeholders.description',
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
                            onPress={handleCreateProject}
                            isDisabled={isCreateDisabled || isCreatingProject}
                            isPending={isCreatingProject}
                        >
                            {t('createDialog.actions.create')}
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    )
}
