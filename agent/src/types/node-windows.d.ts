declare module 'node-windows' {
  export interface EnvVar {
    name: string;
    value: string;
  }

  export interface ServiceOptions {
    name: string;
    description?: string;
    script: string;
    nodeOptions?: string[];
    env?: EnvVar | EnvVar[];
    workingDirectory?: string;
    allowServiceLogon?: boolean;
    stopparentfirst?: boolean;
    wait?: number;
    grow?: number;
    maxRestarts?: number;
    abortOnError?: boolean;
  }

  export class Service {
    constructor(opts: ServiceOptions);
    install(): void;
    uninstall(): void;
    start(): void;
    stop(): void;
    restart(): void;
    on(event: 'install' | 'alreadyinstalled' | 'uninstall' | 'start' | 'stop' | 'invalidinstallation', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
    on(event: string, cb: (...args: unknown[]) => void): this;
    exists: boolean;
  }

  export class EventLogger {
    constructor(source: string);
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  }
}
