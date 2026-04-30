import { Button } from '@heroui/react'
import { Link } from 'react-router-dom'

export function WhiteboardPage() {
    return (
        <div className="mt-4 flex flex-col gap-4 px-5">
            <h1>This is a white board</h1>
            <Link to="test">
                <Button>Go to whiteboard test page</Button>
            </Link>
        </div>
    )
}
