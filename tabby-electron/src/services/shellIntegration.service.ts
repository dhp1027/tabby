import * as path from 'path'
import * as fs from 'mz/fs'
import { exec } from 'mz/child_process'
import { Injectable } from '@angular/core'
import { HostAppService, Platform } from 'tabby-core'
import { ElectronService } from '../services/electron.service'

let windowsNativeRegistry: any | null = null
try {
    windowsNativeRegistry = require('windows-native-registry') // eslint-disable-line
} catch (error) {
    console.warn('windows-native-registry is unavailable, Windows registry integration will be limited', error)
}

@Injectable({ providedIn: 'root' })
export class ShellIntegrationService {
    private automatorWorkflows = ['Open Tabby here.workflow', 'Paste path into Tabby.workflow']
    private automatorWorkflowsLocation: string
    private automatorWorkflowsDestination: string
    private registryKeys = [
        {
            path: 'Software\\Classes\\Directory\\Background\\shell\\Tabby',
            value: 'Open Tabby here',
            command: 'open "%V"',
        },
        {
            path: 'SOFTWARE\\Classes\\Directory\\shell\\Tabby',
            value: 'Open Tabby here',
            command: 'open "%V"',
        },
        {
            path: 'Software\\Classes\\*\\shell\\Tabby',
            value: 'Paste path into Tabby',
            command: 'paste "%V"',
        },
    ]

    private constructor (
        private electron: ElectronService,
        private hostApp: HostAppService,
    ) {
        if (this.hostApp.platform === Platform.macOS) {
            this.automatorWorkflowsLocation = path.join(
                path.dirname(path.dirname(this.electron.app.getPath('exe'))),
                'Resources',
                'extras',
                'automator-workflows',
            )
            this.automatorWorkflowsDestination = path.join(process.env.HOME!, 'Library', 'Services')
        }
        this.updatePaths()
    }

    async isInstalled (): Promise<boolean> {
        if (this.hostApp.platform === Platform.macOS) {
            return fs.exists(path.join(this.automatorWorkflowsDestination, this.automatorWorkflows[0]))
        } else if (this.hostApp.platform === Platform.Windows) {
            if (!windowsNativeRegistry) {
                return false
            }
            return !!windowsNativeRegistry.getRegistryKey(windowsNativeRegistry.HK.CU, this.registryKeys[0].path)
        }
        return true
    }

    async install (): Promise<void> {
        const exe: string = process.env.PORTABLE_EXECUTABLE_FILE ?? this.electron.app.getPath('exe')
        if (this.hostApp.platform === Platform.macOS) {
            for (const wf of this.automatorWorkflows) {
                await exec(`cp -r "${this.automatorWorkflowsLocation}/${wf}" "${this.automatorWorkflowsDestination}"`)
            }
        } else if (this.hostApp.platform === Platform.Windows) {
            if (!windowsNativeRegistry) {
                return
            }
            for (const registryKey of this.registryKeys) {
                windowsNativeRegistry.createRegistryKey(windowsNativeRegistry.HK.CU, registryKey.path)
                windowsNativeRegistry.createRegistryKey(windowsNativeRegistry.HK.CU, registryKey.path + '\\command')
                windowsNativeRegistry.setRegistryValue(windowsNativeRegistry.HK.CU, registryKey.path, '', windowsNativeRegistry.REG.SZ, registryKey.value)
                windowsNativeRegistry.setRegistryValue(windowsNativeRegistry.HK.CU, registryKey.path, 'Icon', windowsNativeRegistry.REG.SZ, exe)
                windowsNativeRegistry.setRegistryValue(windowsNativeRegistry.HK.CU, registryKey.path + '\\command', '', windowsNativeRegistry.REG.SZ, exe + ' ' + registryKey.command)
            }

            if (windowsNativeRegistry.getRegistryKey(windowsNativeRegistry.HK.CU, 'Software\\Classes\\Directory\\Background\\shell\\Open Tabby here')) {
                windowsNativeRegistry.deleteRegistryKey(windowsNativeRegistry.HK.CU, 'Software\\Classes\\Directory\\Background\\shell\\Open Tabby here')
            }
            if (windowsNativeRegistry.getRegistryKey(windowsNativeRegistry.HK.CU, 'Software\\Classes\\*\\shell\\Paste path into Tabby')) {
                windowsNativeRegistry.deleteRegistryKey(windowsNativeRegistry.HK.CU, 'Software\\Classes\\*\\shell\\Paste path into Tabby')
            }
        }
    }

    async remove (): Promise<void> {
        if (this.hostApp.platform === Platform.macOS) {
            for (const wf of this.automatorWorkflows) {
                await exec(`rm -rf "${this.automatorWorkflowsDestination}/${wf}"`)
            }
        } else if (this.hostApp.platform === Platform.Windows) {
            if (!windowsNativeRegistry) {
                return
            }
            for (const registryKey of this.registryKeys) {
                windowsNativeRegistry.deleteRegistryKey(windowsNativeRegistry.HK.CU, registryKey.path)
            }
        }
    }

    private async updatePaths (): Promise<void> {
        // Update paths in case of an update
        if (this.hostApp.platform === Platform.Windows) {
            if (await this.isInstalled()) {
                await this.install()
            }
        }
    }
}
