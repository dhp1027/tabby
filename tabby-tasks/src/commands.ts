import { Injectable } from '@angular/core'
import { Command, CommandLocation, CommandProvider } from 'tabby-core'

import { TasksButtonProvider } from './buttonProvider'
import { TasksStoreService } from './services/tasksStore.service'

@Injectable()
export class TasksCommandProvider extends CommandProvider {
    constructor (
        private buttonProvider: TasksButtonProvider,
        private tasksStore: TasksStoreService,
    ) {
        super()
    }

    async provide (): Promise<Command[]> {
        const openTasks = new Command()
        openTasks.id = 'tasks.open'
        openTasks.label = 'Open Tasks'
        openTasks.icon = require('./icons/list-check.svg')
        openTasks.locations = [CommandLocation.StartPage]
        openTasks.run = async () => {
            this.buttonProvider.open()
        }

        const newTask = new Command()
        newTask.id = 'tasks.new'
        newTask.label = 'Tasks: New Task'
        newTask.icon = require('./icons/list-check.svg')
        newTask.run = async () => {
            this.buttonProvider.open()
            this.tasksStore.signalNewTaskRequest()
        }

        return [openTasks, newTask]
    }
}
