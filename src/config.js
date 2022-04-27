import {readFileSync} from 'fs';
import {DEFAULT_MOVEMENT_TICK_INTERVAL} from './constants.js';

function tryRead(path, parse, message) {
    try {
        return parse(readFileSync(path).toString());
    } catch {
        console.warn(message);
    }
}

function getConfig() {
    const args = process.argv.slice(2);
    const config = {debug: false, reportPath: undefined, firebaseConfig: undefined};

    for (const arg of args) {
        if (arg === '--debug') config.debug = true;
        else throw new Error(`Unknown command line option: ${arg}`);
    }

    config.reportPath = tryRead(
        'reportPath.txt',
        string => string.trim(),
        'Could not open "reportPath.txt" file. /report command will not work.',
    );

    config.firebaseConfig = tryRead(
        'firebase.json',
        string => JSON.parse(string),
        `Could not open "firebase.json" file. Config will remain constant with no admins, bans, or mutes, and movement tick interval at ${DEFAULT_MOVEMENT_TICK_INTERVAL}ms.`,
    );

    return config;
}

export const CONFIG = getConfig();
