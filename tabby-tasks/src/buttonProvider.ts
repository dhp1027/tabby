import { Injectable } from '@angular/core'
import { AppService, ToolbarButton, ToolbarButtonProvider } from 'tabby-core'

import { TasksTabComponent } from './components/tasksTab.component'

@Injectable()
export class TasksButtonProvider extends ToolbarButtonProvider {
    constructor (private app: AppService) {
        super()
    }

    provide (): ToolbarButton[] {
        return [{
            icon: require('./icons/list-check.svg'),
            title: 'Tasks',
            weight: 9,
            click: (): void => { this.open() },
        }]
    }

    open (): TasksTabComponent {
        const existing = this.app.tabs.find(tab => tab instanceof TasksTabComponent) as TasksTabComponent | undefined
        if (existing) {
            this.app.selectTab(existing)
            return existing
        }
        return this.app.openNewTabRaw({ type: TasksTabComponent })
    }
}
