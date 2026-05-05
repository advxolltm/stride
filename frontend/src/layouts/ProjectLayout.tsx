import { skipToken } from '@reduxjs/toolkit/query'
import { Outlet, useParams } from 'react-router-dom'
import { useWatchProjectSocketsQuery } from '../store/features/projectSocket/projectSocket.api'

export default function ProjectLayout() {
    const { projectId } = useParams()

    useWatchProjectSocketsQuery(projectId ?? skipToken)

    return <Outlet />
}
