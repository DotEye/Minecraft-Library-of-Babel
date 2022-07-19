import {BOOKSHELF_COORDINATES, CHAT_HISTORY_LENGTH, NUM_DOUBLE_CHEST_SLOTS} from './constants.js';
import {packets} from './packets.js';
import {broadcast, convertAngle, error, getBookshelfCoordinates, getChunk} from './helper.js';
import {commands} from './commands.js';
import {admins, mutes} from './firebase.js';
import {emojiFormat} from './emojiFormat.js';

const OFFSETS = {
    '+x': [1, 0],
    '-x': [-1, 0],
    '+z': [0, 1],
    '-z': [0, -1],
};

const HORIZONTAL_OFFSET_MULTIPLIERS = {
    '+x': [0, 1],
    '-x': [0, 1],
    '+z': [1, 0],
    '-z': [1, 0],
};

function sendChunks(client, chunkX, chunkZ, direction) {
    const [xOffset, zOffset] = OFFSETS[direction];
    const [horizontalOffsetXMultiplier, horizontalOffsetZMultiplier] = HORIZONTAL_OFFSET_MULTIPLIERS[direction];
    for (let horizontalOffset = -1; horizontalOffset <= 1; ++horizontalOffset) {
        packets.libraryChunk(
            client,
            chunkX + xOffset + horizontalOffset * horizontalOffsetXMultiplier,
            chunkZ + zOffset + horizontalOffset * horizontalOffsetZMultiplier,
        );
    }

    // The chunk's walls are on the + side of the chunk, so when travelling in the - direction, an additional chunk must
    // be sent to prevent visible holes in the walls.
    if (direction.startsWith('-')) packets.libraryChunk(client, chunkX + xOffset * 2, chunkZ + zOffset * 2);
}

function handlePosition(server, client, {x, y, z, yaw, pitch, onGround}) {
    const {tpConfirmed, lastChunk: [lastChunkX, lastChunkZ], position} = client.__state;

    // Until the client has confirmed the teleport, ignore all their position packets.
    if (!tpConfirmed) return;

    if (yaw) yaw = convertAngle(yaw);
    if (pitch) pitch = convertAngle(pitch);

    // If the client's chunk has changed, send them new chunks in the direction they are heading.
    const {chunkX, chunkZ} = getChunk({x, y, z});
    if (chunkX !== lastChunkX || chunkZ !== lastChunkZ) {
        packets.updateViewPosition(client, chunkX, chunkZ);

        if (chunkX > lastChunkX) sendChunks(client, chunkX, chunkZ, '+x');
        else if (chunkX < lastChunkX) sendChunks(client, chunkX, chunkZ, '-x');
        if (chunkZ > lastChunkZ) sendChunks(client, chunkX, chunkZ, '+z');
        else if (chunkZ < lastChunkZ) sendChunks(client, chunkX, chunkZ, '-z');
    }

    client.__state.lastChunk = [chunkX, chunkZ];
    client.__state.position = {x, y, z, yaw: yaw ?? position.yaw, pitch: pitch ?? position.pitch, onGround};
}

function handleLook(server, client, {yaw, pitch, onGround}) {
    yaw = convertAngle(yaw);
    client.__state.position = {...client.__state.position, yaw, pitch, onGround};
}

function handleBlockPlace(server, client, {hand, location}) {
    // The block place packet is sent when the client right-clicks on a block.

    // This packet is sent once for each hand, so ignore anything but the dominant hand.
    if (hand !== 0) return;

    const {chunkX, chunkY, chunkZ} = getChunk(location);
    const coordinates = getBookshelfCoordinates(location);
    if (BOOKSHELF_COORDINATES.includes(coordinates)) {
        const shelf = BOOKSHELF_COORDINATES.indexOf(coordinates);
        client.__state.open_shelf = {chunkX, chunkY, chunkZ, shelf};
        packets.shulkerChooserUI(client, shelf);
    }
}

function handleUseItem(server, client) {
    packets.openBook(client, 0);
}

function handleWindowClick(server, client, {changedSlots}) {
    // We only care about this packet if the user is choosing a shulker.
    if (!client.__state.open_shelf || changedSlots.length === 0) return;
    const [{location}] = changedSlots;
    if (location < 0 || location >= NUM_DOUBLE_CHEST_SLOTS) return;
    const {chunkX, chunkY, chunkZ, shelf} = client.__state.open_shelf;
    delete client.__state.open_shelf;
    packets.bookChooserUI(client, chunkX, chunkY, chunkZ, shelf, location);
}

function handleChat(server, client, {message}) {
    if (message.startsWith('/')) {
        const [command, ...parameters] = message.substring(1).split(' ');
        if (command in commands) commands[command](server, client, parameters);
        else {
            console.log(`${client.username} tried failing command "${message}".`);
            error(client, 'Invalid command. Type /help for a list of commands.');
        }
    } else if (client.__state.chat) {
        if (client.uuid in mutes) {
            const reason = mutes[client.uuid];
            packets.chat(client, emojiFormat('🟥➕You have been muted.' + (reason ? ` ⬜➖Reason: ${reason}.` : '')))
            return;
        }
        console.log(`<${client.username}> ${message}`);
        broadcast(
            Object.fromEntries(Object.entries(server.clients).filter(([, otherClient]) => otherClient.__state?.chat)),
            'chat',
            [emojiFormat(`<${admins.has(client.uuid) ? '🟪' : '⬛'}${client.username}⬜> ${message}`)],
        );
        client.__state.recentChats.push(message);
        if (client.__state.recentChats.length > CHAT_HISTORY_LENGTH) client.__state.recentChats.shift();
    } else {
        packets.chat(client, [
            ...emojiFormat('Chat is currently 🟪➕OFF⬜➖. Type '),
            {color: 'light_purple', text: '/togglechat', bold: true, clickEvent: {action: 'suggest_command', value:'/togglechat'}},
            ...emojiFormat(' to enable it.'),
        ]);
    }
}

function handleTeleportConfirm(server, {__state}) {
    __state.tpConfirmed = true;
}

function handleSettings(server, client, {skinParts, chatColors}) {
    const {__state, id} = client;
    if (skinParts !== __state.skinParts) {
        packets.skinParts(client, id, skinParts);
        __state.nearbyClients.forEach(otherClientId => {
            packets.skinParts(server.clients[otherClientId], id, skinParts);
        });
    }

    __state.chatColors = chatColors;
    __state.skinParts = skinParts;
}

export const HANDLERS = {
    position: handlePosition,
    position_look: handlePosition,
    look: handleLook,
    block_place: handleBlockPlace,
    use_item: handleUseItem,
    window_click: handleWindowClick,
    chat: handleChat,
    teleport_confirm: handleTeleportConfirm,
    settings: handleSettings,
};
