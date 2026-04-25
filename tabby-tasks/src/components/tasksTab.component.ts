import { Component, Injector } from '@angular/core'
import { BaseTabComponent } from 'tabby-core'

import { DevTask, TaskList, TaskPriority, TaskStatus, TaskStore } from '../api'
import { TasksStoreService } from '../services/tasksStore.service'

type TaskFilter = 'all' | 'todo' | 'in_progress' | 'blocked' | 'done'
type TaskView = 'list' | 'board'

@Component({
    selector: 'tasks-tab',
    templateUrl: './tasksTab.component.pug',
    styleUrls: ['./tasksTab.component.scss'],
})
export class TasksTabComponent extends BaseTabComponent {
    TaskStatuses: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done', 'cancelled']
    TaskPriorities: TaskPriority[] = ['low', 'medium', 'high']
    filters: TaskFilter[] = ['all', 'todo', 'in_progress', 'blocked', 'done']
    view: TaskView = 'list'
    filter: TaskFilter = 'all'
    searchQuery = ''
    store: TaskStore = { lists: [], tasks: [] }
    selectedListId = ''
    activeTreeMode: 'my' | 'blocked' | 'completed' | 'list' = 'my'
    selectedTaskId = ''
    drawerOpen = false
    editingListTitle = false
    editingListTitleDraft = ''

    constructor (
        private tasksStore: TasksStoreService,
        injector: Injector,
    ) {
        super(injector)
        this.setTitle('Tasks')

        this.subscribeUntilDestroyed(this.tasksStore.store$, store => {
            this.store = store
            this.ensureSelection()
        })

        this.subscribeUntilDestroyed(this.tasksStore.requestNewTask$, async () => {
            await this.createTask()
        })
    }

    get lists (): TaskList[] {
        return this.store.lists
    }

    get selectedList (): TaskList | undefined {
        return this.store.lists.find(x => x.id === this.selectedListId)
    }

    get selectedTask (): DevTask | undefined {
        return this.store.tasks.find(x => x.id === this.selectedTaskId)
    }

    get visibleTasks (): DevTask[] {
        let tasks = [...this.store.tasks]
        if (this.activeTreeMode === 'my') {
            tasks = tasks.filter(x => x.status !== 'done' && x.status !== 'cancelled')
        } else if (this.activeTreeMode === 'blocked') {
            tasks = tasks.filter(x => x.status === 'blocked')
        } else if (this.activeTreeMode === 'completed') {
            tasks = tasks.filter(x => x.status === 'done')
        } else {
            tasks = tasks.filter(x => x.listId === this.selectedListId)
        }

        if (this.filter !== 'all') {
            tasks = tasks.filter(x => x.status === this.filter)
        }

        if (this.searchQuery.trim()) {
            const query = this.searchQuery.trim().toLowerCase()
            tasks = tasks.filter(task =>
                task.title.toLowerCase().includes(query) ||
                task.summary.toLowerCase().includes(query) ||
                task.goal.toLowerCase().includes(query) ||
                task.nextAction.toLowerCase().includes(query),
            )
        }

        return tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }

    get boardColumns (): { key: TaskFilter, title: string, tasks: DevTask[] }[] {
        const statuses: TaskFilter[] = ['todo', 'in_progress', 'blocked', 'done']
        return statuses.map(status => ({
            key: status,
            title: this.statusLabel(status),
            tasks: this.visibleTasks.filter(task => task.status === status),
        }))
    }

    async ngOnInit (): Promise<void> {
        await this.tasksStore.ensureReady()
        this.ensureSelection()
        if (this.tasksStore.consumePendingNewTaskRequest()) {
            await this.createTask()
        }
    }

    async createList (): Promise<void> {
        const projectId = this.store.projects?.[0]?.id ?? (await this.tasksStore.createProject()).id
        const list = await this.tasksStore.createList(projectId, 'New List')
        this.selectedListId = list.id
        this.activeTreeMode = 'list'
        this.selectedTaskId = ''
        this.drawerOpen = false
    }

    async renameSelectedList (): Promise<void> {
        this.startEditingSelectedList()
    }

    async deleteSelectedList (): Promise<void> {
        if (!this.selectedList) {
            return
        }
        const confirmed = confirm(`Delete list "${this.selectedList.title}" and all its tasks?`)
        if (!confirmed) {
            return
        }
        await this.tasksStore.deleteList(this.selectedList.id)
        this.selectedTaskId = ''
        this.drawerOpen = false
    }

    async createTask (): Promise<void> {
        if (!this.selectedListId) {
            return
        }
        this.activeTreeMode = 'list'
        const task = await this.tasksStore.createTask(this.selectedListId)
        this.openTask(task.id)
    }

    async duplicateTask (): Promise<void> {
        if (!this.selectedTaskId) {
            return
        }
        const task = await this.tasksStore.duplicateTask(this.selectedTaskId)
        if (task) {
            this.openTask(task.id)
        }
    }

    async saveTask (): Promise<void> {
        if (!this.selectedTask) {
            return
        }
        this.cleanupStringArrays(this.selectedTask)
        await this.tasksStore.upsertTask(this.selectedTask)
    }

    async deleteTask (): Promise<void> {
        if (!this.selectedTaskId) {
            return
        }
        await this.tasksStore.deleteTask(this.selectedTaskId)
        this.selectedTaskId = ''
        this.drawerOpen = false
    }

    async setTaskStatus (status: TaskStatus): Promise<void> {
        if (!this.selectedTaskId) {
            return
        }
        await this.tasksStore.updateTaskStatus(this.selectedTaskId, status)
    }

    addChecklistItem (): void {
        this.selectedTask?.checklist.push(this.tasksStore.newChecklistItem())
    }

    removeChecklistItem (id: string): void {
        if (!this.selectedTask) {
            return
        }
        this.selectedTask.checklist = this.selectedTask.checklist.filter(x => x.id !== id)
    }

    addAcceptanceCriteria (): void {
        this.selectedTask?.acceptanceCriteria.push('')
    }

    removeAcceptanceCriteria (index: number): void {
        this.selectedTask?.acceptanceCriteria.splice(index, 1)
    }

    addBlocker (): void {
        this.selectedTask?.blockers.push('')
    }

    removeBlocker (index: number): void {
        this.selectedTask?.blockers.splice(index, 1)
    }

    addRelatedFile (): void {
        this.selectedTask?.relatedFiles.push('')
    }

    removeRelatedFile (index: number): void {
        this.selectedTask?.relatedFiles.splice(index, 1)
    }

    selectList (listId: string): void {
        this.selectedListId = listId
        this.activeTreeMode = 'list'
        this.selectedTaskId = ''
        this.drawerOpen = false
    }

    setTreeMode (mode: 'my' | 'blocked' | 'completed'): void {
        this.activeTreeMode = mode
        this.selectedTaskId = ''
        this.drawerOpen = false
    }

    openTask (taskId: string): void {
        this.selectedTaskId = taskId
        this.drawerOpen = true
    }

    startEditingSelectedList (): void {
        if (!this.selectedList || this.activeTreeMode !== 'list') {
            return
        }
        this.editingListTitle = true
        this.editingListTitleDraft = this.selectedList.title
    }

    async commitEditingSelectedList (): Promise<void> {
        if (!this.editingListTitle || !this.selectedList) {
            return
        }

        const title = this.editingListTitleDraft.trim()
        this.editingListTitle = false

        if (!title || title === this.selectedList.title) {
            this.editingListTitleDraft = this.selectedList.title
            return
        }

        await this.tasksStore.updateList(this.selectedList.id, { title })
    }

    cancelEditingSelectedList (): void {
        this.editingListTitle = false
        this.editingListTitleDraft = this.selectedList?.title ?? ''
    }

    closeDrawer (): void {
        this.drawerOpen = false
    }

    taskCountForMode (mode: 'my' | 'blocked' | 'completed'): number {
        if (mode === 'my') {
            return this.store.tasks.filter(x => x.status !== 'done' && x.status !== 'cancelled').length
        }
        if (mode === 'blocked') {
            return this.store.tasks.filter(x => x.status === 'blocked').length
        }
        return this.store.tasks.filter(x => x.status === 'done').length
    }

    taskCountForList (listId: string): number {
        return this.store.tasks.filter(x => x.listId === listId).length
    }

    checklistProgress (task: DevTask): string {
        const done = task.checklist.filter(x => x.done).length
        return `${done}/${task.checklist.length}`
    }

    statusLabel (status: TaskStatus | TaskFilter): string {
        return {
            all: 'All',
            todo: 'Todo',
            in_progress: 'In Progress',
            blocked: 'Blocked',
            done: 'Done',
            cancelled: 'Cancelled',
        }[status]
    }

    priorityLabel (priority: TaskPriority): string {
        return {
            low: 'Low',
            medium: 'Medium',
            high: 'High',
        }[priority]
    }

    buttonsTrackBy (_index: number, item: { id: string }): string {
        return item.id
    }

    stringTrackBy (_index: number, value: string): string {
        return value
    }

    boardColumnTrackBy (_index: number, column: { key: string }): string {
        return column.key
    }

    private ensureSelection (): void {
        this.selectedListId ||= this.store.lists[0]?.id ?? ''
        if (!this.store.lists.find(x => x.id === this.selectedListId)) {
            this.selectedListId = this.store.lists[0]?.id ?? ''
        }
        if (!this.editingListTitle) {
            this.editingListTitleDraft = this.selectedList?.title ?? ''
        }

        if (this.selectedTaskId && !this.store.tasks.find(x => x.id === this.selectedTaskId)) {
            this.selectedTaskId = ''
            this.drawerOpen = false
        }
    }

    private cleanupStringArrays (task: DevTask): void {
        task.acceptanceCriteria = task.acceptanceCriteria.map(x => x.trim()).filter(Boolean)
        task.relatedFiles = task.relatedFiles.map(x => x.trim()).filter(Boolean)
        task.blockers = task.blockers.map(x => x.trim()).filter(Boolean)
        task.checklist = task.checklist.filter(x => x.text.trim()).map(x => ({ ...x, text: x.text.trim() }))
    }
}
