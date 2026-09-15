"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const nest = (0, child_process_1.spawn)('nest', ['start', '--watch'], {
    stdio: 'inherit',
    env: {
        ...process.env,
        PORT: process.env.PORT ?? '3008',
    },
});
const shutdown = (exitCode = 0) => {
    if (!nest.killed) {
        nest.kill('SIGTERM');
    }
    process.exit(exitCode);
};
process.on('SIGINT', () => {
    shutdown(0);
});
process.on('SIGTERM', () => {
    shutdown(0);
});
nest.on('exit', (code, signal) => {
    const exitCode = code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
    shutdown(exitCode);
});
//# sourceMappingURL=dev.js.map