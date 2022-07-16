import {createServer} from 'minecraft-protocol';
import {packets} from './packets.js';
import {SERVER_OPTIONS, SPAWN_PITCH, SPAWN_YAW, VERSION} from './constants.js';
import {HANDLERS} from './handlers.js';
import {banKick, broadcast, clearHighlightInterval, getRandomSpawn, teleport, welcomeText} from './helper.js';
import {admins, bans, defaultChatToggle, serverFullMessage, startFirestoreListeners} from './firebase.js';
import {CONFIG} from './config.js';
import {emojiFormat} from './emojiFormat.js';

const server = createServer(SERVER_OPTIONS);

console.log(`Starting ${VERSION} server on ${SERVER_OPTIONS.host}:${SERVER_OPTIONS.port}...`);
startFirestoreListeners(server);

server.on('login', function (client) {
    const numPlayers = Object.keys(server.clients).length;
    if (numPlayers > server.maxPlayers && !admins.has(client.uuid)) {
        client.end(serverFullMessage);
        return;
    }

    if (client.uuid in bans) {
        banKick(client, bans[client.uuid]);
        return;
    }

    console.log(`${client.username} has entered the library (${numPlayers}/${server.maxPlayers}).`);

    const spawn = getRandomSpawn();
    client.__state = {
        position: {...spawn, yaw: SPAWN_YAW, pitch: SPAWN_PITCH, onGround: true},
        tpConfirmed: true,
        players: true,
        nearbyClients: new Set(),
        chat: defaultChatToggle,
        recentChats: [],
        chatColors: true,
        ready: false,
    };

    packets.initClient(client);

    teleport(client, {...spawn, yaw: SPAWN_YAW, pitch: SPAWN_PITCH});

    broadcast(server.clients, 'playerInfo', [true, [client]], client.id);
    packets.playerInfo(client, true, Object.values(server.clients));

    client.on('packet', CONFIG.debug
        ? (packet, meta) => {
            console.log(`${client.username} -> ${meta.name}: ${JSON.stringify(packet)}`);
            HANDLERS[meta.name]?.(server, client, packet);
        }
        : (packet, meta) => HANDLERS[meta.name]?.(server, client, packet));
    client.on('error', error => console.error('Client encountered error:', error));
    client.on('end', () => {
        clearHighlightInterval(client);
        broadcast(server.clients, 'playerInfo', [false, [client]]);
        broadcast(server.clients, 'destroyPlayer', [client.id]);
        broadcast(server.clients, 'chat', [emojiFormat(`${admins.has(client.uuid) ? '🟪' : '⬛'}${client.username}🟨 has left the library.`)]);
        console.log(`${client.username} has left the library (${Object.keys(server.clients).length}/${server.maxPlayers}).`);
    });

    client.__state.ready = true;

    broadcast(server.clients, 'chat', [emojiFormat(`${admins.has(client.uuid) ? '🟪' : '⬛'}${client.username}🟨 has entered the library.`)]);
    welcomeText(client);
});
