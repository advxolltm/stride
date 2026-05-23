export type { WhiteboardTemplateDefinition } from './templates/templateTypes'
import { appUserFlowTemplate } from './templates/appUserFlowTemplate'
import { brainstormBoardTemplate } from './templates/brainstormBoardTemplate'
import { retrospectiveColumnsTemplate } from './templates/retrospectiveColumnsTemplate'
import { userStoryMappingTemplate } from './templates/userStoryMappingTemplate'

export const whiteboardTemplates = [
    appUserFlowTemplate,
    retrospectiveColumnsTemplate,
    brainstormBoardTemplate,
    userStoryMappingTemplate,
]
