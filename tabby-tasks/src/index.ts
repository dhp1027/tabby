import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'

import TabbyCorePlugin, { CommandProvider, ToolbarButtonProvider } from 'tabby-core'

import { TasksTabComponent } from './components/tasksTab.component'
import { TasksButtonProvider } from './buttonProvider'
import { TasksCommandProvider } from './commands'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NgbModule,
        TabbyCorePlugin,
    ],
    providers: [
        TasksButtonProvider,
        { provide: ToolbarButtonProvider, useClass: TasksButtonProvider, multi: true },
        { provide: CommandProvider, useClass: TasksCommandProvider, multi: true },
    ],
    declarations: [
        TasksTabComponent,
    ],
})
export default class TasksModule { } // eslint-disable-line @typescript-eslint/no-extraneous-class

export * from './api'
export { TasksTabComponent }
