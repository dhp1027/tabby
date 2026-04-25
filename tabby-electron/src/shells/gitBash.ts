import * as path from 'path'
import { Injectable } from '@angular/core'
import { Platform, ConfigService, HostAppService } from 'tabby-core'

import { Shell } from 'tabby-local'
import { WindowsBaseShellProvider } from './windowsBase'

let windowsNativeRegistry: any | null = null
try {
    windowsNativeRegistry = require('windows-native-registry') // eslint-disable-line
} catch (error) {
    console.warn('windows-native-registry is unavailable, Git Bash auto-detection will be limited', error)
}

/** @hidden */
@Injectable()
export class GitBashShellProvider extends WindowsBaseShellProvider {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor (
        hostApp: HostAppService,
        config: ConfigService,
    ) {
        super(hostApp, config)
    }

    async provide (): Promise<Shell[]> {
        if (this.hostApp.platform !== Platform.Windows) {
            return []
        }
        if (!windowsNativeRegistry) {
            return []
        }

        let gitBashPath = windowsNativeRegistry.getRegistryValue(windowsNativeRegistry.HK.LM, 'Software\\GitForWindows', 'InstallPath')

        if (!gitBashPath) {
            gitBashPath = windowsNativeRegistry.getRegistryValue(windowsNativeRegistry.HK.CU, 'Software\\GitForWindows', 'InstallPath')
        }

        if (!gitBashPath) {
            return []
        }

        return [{
            id: 'git-bash',
            name: 'Git Bash',
            command: path.join(gitBashPath, 'bin', 'bash.exe'),
            args: ['--login', '-i'],
            icon: require('../icons/git-bash.svg'),
            env: this.getEnvironment(),
        }]
    }
}
