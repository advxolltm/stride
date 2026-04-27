import { useParams } from 'react-router-dom'
import { WhiteboardCanvas } from '../components/project/space/whiteboard/WhiteboardCanvas'

export function WhiteboardPage() {
    const { projectId } = useParams()

    if (!projectId) {
        return null
    }

    return <WhiteboardCanvas projectId={projectId} />
}
