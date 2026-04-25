import { Injectable, NgZone } from '@angular/core'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'

import { DevTask, TaskChecklistItem, TaskList, TaskProject, TaskStatus, TaskStore } from '../api'

const DEFAULT_PROJECT_TITLE = 'Current Workspace'
const DEFAULT_LIST_TITLE = 'Inbox'

@Injectable({ providedIn: 'root' })
export class TasksStoreService {
    private store = new BehaviorSubject<TaskStore>(this.createDefaultStore())
    private ready = new BehaviorSubject<boolean>(false)
    private requestNewTask = new Subject<void>()
    private pendingNewTaskRequest = false

    get store$ (): Observable<TaskStore> { return this.store }
    get ready$ (): Observable<boolean> { return this.ready }
    get requestNewTask$ (): Observable<void> { return this.requestNewTask }

    constructor (private zone: NgZone) {
        this.init()
    }

    getSnapshot (): TaskStore {
        return this.store.value
    }

    signalNewTaskRequest (): void {
        this.pendingNewTaskRequest = true
        this.requestNewTask.next()
    }

    consumePendingNewTaskRequest (): boolean {
        const pending = this.pendingNewTaskRequest
        this.pendingNewTaskRequest = false
        return pending
    }

    async ensureReady (): Promise<void> {
        if (this.ready.value) {
            return
        }

        await new Promise<void>(resolve => {
            const subscription = this.ready$.subscribe(value => {
                if (value) {
                    subscription.unsubscribe()
                    resolve()
                }
            })
        })
    }

    async createProject (title = DEFAULT_PROJECT_TITLE): Promise<TaskProject> {
        await this.ensureReady()
        const now = this.now()
        const project: TaskProject = {
            id: uuidv4(),
            title,
            createdAt: now,
            updatedAt: now,
        }
        const store = this.cloneStore()
        store.projects ??= []
        store.projects.push(project)
        this.commit(store)
        return project
    }

    async createList (projectId: string, title = DEFAULT_LIST_TITLE, description = ''): Promise<TaskList> {
        await this.ensureReady()
        const now = this.now()
        const list: TaskList = {
            id: uuidv4(),
            projectId,
            title,
            description,
            createdAt: now,
            updatedAt: now,
        }
        const store = this.cloneStore()
        store.projects ??= []
        store.lists.push(list)
        this.commit(store)
        return list
    }

    async updateList (listId: string, patch: Partial<Pick<TaskList, 'title' | 'description'>>): Promise<void> {
        await this.ensureReady()
        const store = this.cloneStore()
        const list = store.lists.find(x => x.id === listId)
        if (!list) {
            return
        }
        Object.assign(list, patch, { updatedAt: this.now() })
        this.commit(store)
    }

    async deleteList (listId: string): Promise<void> {
        await this.ensureReady()
        const store = this.cloneStore()
        store.lists = store.lists.filter(x => x.id !== listId)
        store.tasks = store.tasks.filter(x => x.listId !== listId)
        if (!store.lists.length) {
            const projectId = store.projects?.[0]?.id ?? uuidv4()
            store.projects ??= []
            if (!store.projects.length) {
                store.projects.push({
                    id: projectId,
                    title: DEFAULT_PROJECT_TITLE,
                    createdAt: this.now(),
                    updatedAt: this.now(),
                })
            }
            store.lists.push({
                id: uuidv4(),
                projectId,
                title: DEFAULT_LIST_TITLE,
                description: '',
                createdAt: this.now(),
                updatedAt: this.now(),
            })
        }
        this.commit(store)
    }

    async createTask (listId: string): Promise<DevTask> {
        await this.ensureReady()
        const now = this.now()
        const task: DevTask = {
            id: uuidv4(),
            listId,
            title: 'New Task',
            status: 'todo',
            priority: 'medium',
            summary: '',
            goal: '',
            acceptanceCriteria: [''],
            checklist: [],
            notes: '',
            nextAction: '',
            conversationSummary: '',
            relatedFiles: [],
            blockers: [],
            createdAt: now,
            updatedAt: now,
        }
        const store = this.cloneStore()
        store.tasks.unshift(task)
        this.commit(store)
        return task
    }

    async upsertTask (task: DevTask): Promise<void> {
        await this.ensureReady()
        const store = this.cloneStore()
        const index = store.tasks.findIndex(x => x.id === task.id)
        task.updatedAt = this.now()
        if (index >= 0) {
            store.tasks[index] = task
        } else {
            store.tasks.unshift(task)
        }
        this.commit(store)
    }

    async updateTaskStatus (taskId: string, status: TaskStatus): Promise<void> {
        await this.ensureReady()
        const store = this.cloneStore()
        const task = store.tasks.find(x => x.id === taskId)
        if (!task) {
            return
        }
        task.status = status
        task.updatedAt = this.now()
        this.commit(store)
    }

    async deleteTask (taskId: string): Promise<void> {
        await this.ensureReady()
        const store = this.cloneStore()
        store.tasks = store.tasks.filter(x => x.id !== taskId)
        this.commit(store)
    }

    async duplicateTask (taskId: string): Promise<DevTask | null> {
        await this.ensureReady()
        const source = this.cloneStore().tasks.find(x => x.id === taskId)
        if (!source) {
            return null
        }
        const now = this.now()
        const task: DevTask = {
            ...source,
            id: uuidv4(),
            title: `${source.title} Copy`,
            status: 'todo',
            checklist: source.checklist.map(item => ({
                ...item,
                id: uuidv4(),
                done: false,
            })),
            createdAt: now,
            updatedAt: now,
        }
        const store = this.cloneStore()
        store.tasks.unshift(task)
        this.commit(store)
        return task
    }

    newChecklistItem (text = ''): TaskChecklistItem {
        return {
            id: uuidv4(),
            text,
            done: false,
        }
    }

    private async init (): Promise<void> {
        try {
            const filePath = this.getStorePath()
            await fs.mkdir(path.dirname(filePath), { recursive: true })
            const content = await fs.readFile(filePath, 'utf8').catch(() => '')
            if (!content) {
                const defaults = this.createDefaultStore()
                await this.saveStore(defaults)
                this.zone.run(() => {
                    this.store.next(defaults)
                    this.ready.next(true)
                })
                return
            }
            const parsed = JSON.parse(content) as TaskStore
            const normalized = this.normalizeStore(parsed)
            this.zone.run(() => {
                this.store.next(normalized)
                this.ready.next(true)
            })
        } catch (error) {
            console.error('Failed to initialize tasks store', error)
            const defaults = this.createDefaultStore()
            this.zone.run(() => {
                this.store.next(defaults)
                this.ready.next(true)
            })
        }
    }

    private commit (store: TaskStore): void {
        this.zone.run(() => {
            this.store.next(store)
        })
        void this.saveStore(store)
    }

    private async saveStore (store: TaskStore): Promise<void> {
        const filePath = this.getStorePath()
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf8')
    }

    private getStorePath (): string {
        const configDir = process.env.TABBY_CONFIG_DIRECTORY
        if (configDir) {
            return path.join(configDir, 'tasks.json')
        }
        const appData = process.env.APPDATA || process.cwd()
        return path.join(appData, 'tabby', 'tasks.json')
    }

    private createDefaultStore (): TaskStore {
        const now = this.now()
        const projectId = uuidv4()
        const epicId = uuidv4()
        return {
            projects: [
                {
                    id: projectId,
                    title: DEFAULT_PROJECT_TITLE,
                    createdAt: now,
                    updatedAt: now,
                },
            ],
            lists: [
                {
                    id: epicId,
                    projectId,
                    title: DEFAULT_LIST_TITLE,
                    description: '',
                    createdAt: now,
                    updatedAt: now,
                },
            ],
            tasks: [],
        }
    }

    private normalizeStore (store: TaskStore): TaskStore {
        if (!(store as any).lists?.length && (store as any).epics?.length) {
            ;(store as any).lists = (store as any).epics
            delete (store as any).epics
        }
        if (!store.lists?.length) {
            return this.createDefaultStore()
        }
        store.projects ??= []
        store.tasks ??= []
        store.tasks = store.tasks.map(task => ({
            ...task,
            listId: (task as any).listId ?? (task as any).epicId ?? store.lists[0].id,
        }))
        return store
    }

    private cloneStore (): TaskStore {
        return JSON.parse(JSON.stringify(this.store.value)) as TaskStore
    }

    private now (): string {
        return new Date().toISOString()
    }
}
