import {initializeApp} from 'firebase/app';
import {getFirestore, collection, doc, onSnapshot} from 'firebase/firestore';
import {banKick, movementTick} from './helper.js';
import {DEFAULT_MOVEMENT_TICK_INTERVAL} from './constants.js';
import {CONFIG} from './config.js';

export let admins = new Set();
export let bans = {};
export let mutes = {};
export let serverFullMessage = '§dServer is full!';
export let defaultChatToggle = true;

/*
 * Start Firebase listeners if a config exists. Firebase is used to store and listen for config value changes, which
 * can be used to make changes to the server without restarting it.
 */
export function startFirestoreListeners(server) {
    // If no firebaseConfig is specified, use the default movement ticket interval and don't set up listeners.
    if (!CONFIG.firebaseConfig) {
        setInterval(() => movementTick(server), DEFAULT_MOVEMENT_TICK_INTERVAL);
        return;
    }

    const app = initializeApp(CONFIG.firebaseConfig);
    const firestore = getFirestore(app);

    let movementTickInterval;
    onSnapshot(doc(firestore, 'config', 'config'), snapshot => {
        const {movementDelay, motd, maxPlayers, defaultChatToggle: _defaultChatToggle, serverFullMessage: _serverFullMessage} = snapshot.data();
        if (movementDelay === undefined) throw `Couldn't get movementDelay from firestore.`;
        if (movementTickInterval !== undefined) clearInterval(movementTickInterval);
        console.log(`Updating movement delay to ${movementDelay}ms.`);
        movementTickInterval = setInterval(() => movementTick(server), movementDelay);

        if (motd === undefined) throw `Couldn't get motd from firestore.`;
        console.log(`Updating motd to "${motd}".`);
        server.motd = motd;

        if (maxPlayers === undefined) throw `Couldn't get maxPlayers from firestore.`;
        console.log(`Updating maxPlayers to ${maxPlayers}.`);
        server.maxPlayers = maxPlayers;

        if (_serverFullMessage === undefined) throw `Couldn't get serverFullMessage from firestore.`;
        console.log(`Updating server full message to "${_serverFullMessage}".`);
        serverFullMessage = _serverFullMessage;

        if (defaultChatToggle === undefined) throw `Couldn't get defaultChatToggle from firestore.`;
        console.log(`Updating defaultChatToggle full message to ${defaultChatToggle}.`);
        defaultChatToggle = _defaultChatToggle;
    });

    onSnapshot(collection(firestore, 'admins'), snapshot => {
        const newAdmins = new Set();
        snapshot.forEach(doc => newAdmins.add(doc.data().uuid));
        console.log(`Updating admins to ${JSON.stringify(Array.from(newAdmins))}.`);
        admins = newAdmins;
    });

    onSnapshot(collection(firestore, 'bans'), snapshot => {
        const newBans = {};
        snapshot.forEach(doc => {
            const {uuid, reason} = doc.data();
            newBans[uuid] = reason;
            Object.values(server.clients)
                .filter(client => client.uuid === uuid)
                .forEach(client => banKick(client, reason));
        });
        console.log(`Updating bans to ${JSON.stringify(Object.keys(newBans))}.`);
        bans = newBans;
    });

    onSnapshot(collection(firestore, 'mutes'), snapshot => {
        const newMutes = {};
        snapshot.forEach(doc => {
            const {uuid, reason} = doc.data();
            newMutes[uuid] = reason;
        });
        console.log(`Updating mutes to ${JSON.stringify(Object.keys(newMutes))}.`);
        mutes = newMutes;
    });
}
