import * as path from 'path'
import { Injectable } from '@angular/core'
import { HostAppService, Platform } from 'tabby-core'

import { ShellProvider, Shell } from 'tabby-local'

let windowsNativeRegistry: any | null = null
try {
    windowsNativeRegistry = require('windows-native-registry') // eslint-disable-line
} catch (error) {
    console.warn('windows-native-registry is unavailable, Cygwin auto-detection will be limited', error)
}

/** @hidden */
@Injectable()
export class Cygwin32ShellProvider extends ShellProvider {
    constructor (
        private hostApp: HostAppService,
    ) {
        super()
    }

    async provide (): Promise<Shell[]> {
        if (this.hostApp.platform !== Platform.Windows) {
            return []
        }
        if (!windowsNativeRegistry) {
            return []
        }

        const cygwinPath = windowsNativeRegistry.getRegistryValue(windowsNativeRegistry.HK.LM, 'Software\\WOW6432Node\\Cygwin\\setup', 'rootdir')

        if (!cygwinPath) {
            return []
        }

        return [{
            id: 'cygwin32',
            name: 'Cygwin (32 bit)',
            command: path.join(cygwinPath, 'bin', 'bash.exe'),
            args: ['--login', '-i'],
            icon: require('../icons/cygwin.svg'),
            env: {
                TERM: 'cygwin',
            },
        }]
    }
}
