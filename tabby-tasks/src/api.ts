export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface TaskChecklistItem {
    id: string
    text: string
    done: boolean
}

export interface TaskProject {
    id: string
    title: string
    createdAt: string
    updatedAt: string
}

export interface TaskList {
    id: string
    projectId: string
    title: string
    description: string
    createdAt: string
    updatedAt: string
}

export interface DevTask {
    id: string
    listId: string
    title: string
    status: TaskStatus
    priority: TaskPriority
    summary: string
    goal: string
    acceptanceCriteria: string[]
    checklist: TaskChecklistItem[]
    notes: string
    nextAction: string
    conversationSummary: string
    relatedFiles: string[]
    blockers: string[]
    createdAt: string
    updatedAt: string
}

export interface TaskStore {
    projects?: TaskProject[]
    lists: TaskList[]
    tasks: DevTask[]
}
