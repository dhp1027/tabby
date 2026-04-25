import { Injectable } from '@angular/core'
import { HostAppService, ConfigService, Platform } from 'tabby-core'

import { Shell } from 'tabby-local'
import { WindowsBaseShellProvider } from './windowsBase'

let windowsNativeRegistry: any | null = null
try {
    windowsNativeRegistry = require('windows-native-registry') // eslint-disable-line
} catch (error) {
    console.warn('windows-native-registry is unavailable, PowerShell Core auto-detection will be limited', error)
}

/** @hidden */
@Injectable()
export class PowerShellCoreShellProvider extends WindowsBaseShellProvider {
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

        const pwshPath = windowsNativeRegistry.getRegistryValue(windowsNativeRegistry.HK.LM, 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\pwsh.exe', '')

        if (!pwshPath) {
            return []
        }

        return [{
            id: 'powershell-core',
            name: 'PowerShell Core',
            command: pwshPath,
            args: ['-nologo'],
            icon: require('../icons/powershell-core.svg'),
            env: this.getEnvironment(),
        }]
    }
}
