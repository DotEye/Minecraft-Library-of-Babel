import {
    BLOCKS_PER_CHUNK,
    BOOKSHELF_COORDINATES,
    CHARACTERS,
    CLOSE_PLAYER_THRESHOLD,
    DISCORD_SERVER_INVITE_URL,
    EASTER_EGGS,
    LEARN_MORE_URL,
    NEGATIVE_CHUNK_XZ_OFFSET,
    NEGATIVE_CHUNK_Y_OFFSET,
    NUM_CHARACTERS,
    NUM_DOUBLE_CHEST_SLOTS,
    NUM_HORIZONTAL_CHUNKS,
    NUM_PAGES,
    NUM_VERTICAL_CHUNKS,
    SPAWN_OFFSET_X,
    SPAWN_OFFSET_Z,
    SPAWN_Y,
    STRING_LENGTH,
} from './constants.js';
import {packets} from './packets.js';
import {emojiFormat} from './emojiFormat.js';
import {encrypt} from './encryption.js';

const BOOK_MULTIPLIER = BigInt(NUM_PAGES);
const SHULKER_MULTIPLIER = BOOK_MULTIPLIER * BigInt(NUM_DOUBLE_CHEST_SLOTS);
const SHELF_MULTIPLIER = SHULKER_MULTIPLIER * BigInt(NUM_DOUBLE_CHEST_SLOTS);
const CHUNKZ_MULTIPLIER = SHELF_MULTIPLIER * BigInt(BOOKSHELF_COORDINATES.length);
const CHUNKY_MULTIPLIER = CHUNKZ_MULTIPLIER * BigInt(NUM_HORIZONTAL_CHUNKS);
const CHUNKX_MULTIPLIER = CHUNKY_MULTIPLIER * BigInt(NUM_VERTICAL_CHUNKS);

export function getChunk({x, y, z}) {
    return {
        chunkX: Math.floor(x / BLOCKS_PER_CHUNK) + NEGATIVE_CHUNK_XZ_OFFSET,
        chunkY: Math.floor(y / BLOCKS_PER_CHUNK) + NEGATIVE_CHUNK_Y_OFFSET,
        chunkZ: Math.floor(z / BLOCKS_PER_CHUNK) + NEGATIVE_CHUNK_XZ_OFFSET,
    };
}

export function getChunkRoot({chunkX, chunkY, chunkZ}) {
    return {
        x: (chunkX - NEGATIVE_CHUNK_XZ_OFFSET) * BLOCKS_PER_CHUNK,
        y: (chunkY - NEGATIVE_CHUNK_Y_OFFSET) * BLOCKS_PER_CHUNK,
        z: (chunkZ - NEGATIVE_CHUNK_XZ_OFFSET) * BLOCKS_PER_CHUNK,
    };
}

export function getBooks(chunkX, chunkY, chunkZ, shelf, shulker) {
    const startingPageId = getPageId(chunkX, chunkY, chunkZ, shelf, shulker, 0, 0);
    return [...Array(NUM_DOUBLE_CHEST_SLOTS)].map(
        (_, bookIndex) => wrapBook(chunkX, chunkY, chunkZ, shelf, shulker, bookIndex, [...Array(NUM_PAGES)].map(
            (_, pageIndex) => getPage(startingPageId + BigInt((bookIndex * NUM_PAGES) + pageIndex)))
        )
    );
}

export function getPageId(chunkX, chunkY, chunkZ, shelf, shulker, book, page) {
    return BigInt(page)
        + BigInt(book) * BOOK_MULTIPLIER
        + BigInt(shulker) * SHULKER_MULTIPLIER
        + BigInt(shelf) * SHELF_MULTIPLIER
        + BigInt(chunkZ) * CHUNKZ_MULTIPLIER
        + BigInt(chunkY) * CHUNKY_MULTIPLIER
        + BigInt(chunkX) * CHUNKX_MULTIPLIER;
}

export function fromPageId(pageId) {
    const chunkX = Number(pageId / CHUNKX_MULTIPLIER);
    pageId = pageId % CHUNKX_MULTIPLIER;
    const chunkY = Number(pageId / CHUNKY_MULTIPLIER);
    pageId = pageId % CHUNKY_MULTIPLIER;
    const chunkZ = Number(pageId / CHUNKZ_MULTIPLIER);
    pageId = pageId % CHUNKZ_MULTIPLIER;
    const shelf = pageId / SHELF_MULTIPLIER;
    pageId = pageId % SHELF_MULTIPLIER;
    const shulker = pageId / SHULKER_MULTIPLIER;
    pageId = pageId % SHULKER_MULTIPLIER;
    const {x, y, z} = getChunkRoot({chunkX, chunkY, chunkZ});
    return {
        x, y, z, chunkX, chunkY, chunkZ, shelf, shulker,
        book: pageId / BOOK_MULTIPLIER,
        page: pageId % BOOK_MULTIPLIER,
    };
}

function getPage(pageId) {
    let result = '';
    while (pageId !== 0n) {
        const remainder = pageId % NUM_CHARACTERS;
        pageId = pageId / NUM_CHARACTERS;
        result = CHARACTERS[remainder] + result;
    }

    result = result.padStart(STRING_LENGTH);
    return encrypt(result);
}

export function fromPage(page) {
    let result = 0n;
    for (let index = 0n; index < page.length; ++index) {
        result += (NUM_CHARACTERS ** index) * BigInt(CHARACTERS.indexOf(page[BigInt(STRING_LENGTH - 1) - index]));
    }
    return result;
}

export function wrapBook(chunkX, chunkY, chunkZ, shelf, shulker, book, pages) {
    return {
        present: true,
        itemId: 943,
        itemCount: 1,
        nbtData: {
            type: 'compound',
            name: '',
            value: {
                filtered_title: {type: 'string', value: `Book ${book + 1}`},
                pages: {
                    type: 'list',
                    value: {type: 'string', value: pages.map(page => `{"text":"${page}"}`)},
                },
                title: {type: 'string', value: `Book ${book + 1}`},
                author: {type: 'string', value: '§kUNKNOWN'},
                resolved: {type: 'byte', value: 1},
            }
        }
    };
}

export function send5x5(client, chunkX, chunkZ) {
    for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
            // Don't need to send the corners.
            if (Math.abs(x) + Math.abs(z) === 4) continue;

            packets.libraryChunk(client, x + chunkX, z + chunkZ);
        }
    }
}

/*
 * Send a packet to all clients on the server.
 */
export function broadcast(clients, packet, params, exclude) {
    for (const [clientId, client] of Object.entries(clients)) {
        if (!client.__state || !client.__state.ready) continue;
        if (parseInt(clientId) === exclude) continue;
        packets[packet](client, ...params);
    }
}

/*
 * Angles sent by the client need to be converted before sent to other clients.
 *
 * This function is based off: https://github.com/PrismarineJS/flying-squid/blob/44daabea8cce0ef8f9c32b76b11332f356e84e3c/src/lib/plugins/updatePositions.js#L7
 */
export function convertAngle(clientAngle) {
    const angle = Math.floor((clientAngle % 360) * 256 / 360);
    return angle < -128
        ? angle + 256
        : angle > 127
            ? angle - 256
            : angle;
}

export function teleport(client, position) {
    client.__state.tpConfirmed = false;
    const {chunkX, chunkZ} = getChunk(position);
    packets.updateViewPosition(client, chunkX, chunkZ);
    send5x5(client, chunkX, chunkZ);
    packets.position(client, position);
    client.__state.lastChunk = [chunkX, chunkZ];
}

/*
 * Given a specific shelf, returns the coordinates where the highlighting particles should be spawned around.
 */
function findParticleLocation(x, y, z, shelf) {
    const coordinates = BOOKSHELF_COORDINATES[shelf].split(' ').map(coordinate => parseInt(coordinate));
    return [x + coordinates[0] + 0.5, y + coordinates[1] + 0.5, z + coordinates[2] + 0.5];
}

/*
 * Sets up a setInterval for spawning particles every second when the user is highlighting a shelf.
 */
export function createHighlightInterval(client, x, y, z, shelf) {
    clearHighlightInterval(client);
    const particleLocation = findParticleLocation(x, y, z, shelf);
    const id = EASTER_EGGS[`${x} ${y} ${z} ${shelf}`] ?? 31;
    client.__state.searchInterval = setInterval(() => packets.particle(client, ...particleLocation, id), 1000);
    return particleLocation;
}

export function clearHighlightInterval(client) {
    if (client.__state.searchInterval) {
        clearInterval(client.__state.searchInterval);
        delete client.__state.searchInterval;
    }
}

function playersClose(position1, position2) {
    return Math.abs(position1.x - position2.x) <= CLOSE_PLAYER_THRESHOLD
        && Math.abs(position2.z - position2.z) <= CLOSE_PLAYER_THRESHOLD;
}

/*
 * Process a movement tick, which syncs other players positions with all other players. In normal Minecraft, this
 * happens multiple times a second. However, since the library is mainly a single-player experience, the rate at which
 * this function is called can be made very low to save bandwidth.
 */
export function movementTick({clients}) {
    for (const client of Object.values(clients)) {
        if (!client.__state || !client.__state.ready || !client.__state.players || !client.__state.position) continue;
        const disconnectedPlayers = new Set(client.__state.nearbyClients);
        for (const {id, uuid, __state} of Object.values(clients)) {
            if (!__state) continue;
            const {ready, position, skinParts} = __state;
            if (!ready || !position || client.id === id) continue;
            disconnectedPlayers.delete(id);
            if (playersClose(client.__state.position, position)) {
                if (client.__state.nearbyClients.has(id)) {
                    // The client already knows about the other, so just update their position.
                    packets.teleportPlayer(client, id, position);
                } else {
                    // The client does not know about the other, so spawn them in.
                    packets.spawnPlayer(client, id, uuid, position);
                    packets.skinParts(client, id, skinParts);
                    client.__state.nearbyClients.add(id);
                }
            } else {
                if (client.__state.nearbyClients.has(id)) {
                    // The client knows about the other, but they're no longer nearby, so destroy them.
                    packets.destroyPlayer(client, id);
                    client.__state.nearbyClients.delete(id);
                }
            }
        }

        // Each player left in `disconnectedPlayers` has disconnected, so destroy them.
        for (const id of disconnectedPlayers) {
            client.__state.nearbyClients.delete(id);
            packets.destroyPlayer(client, id);
        }
    }
}

export function welcomeText(client) {
    packets.chat(client, [
        ...emojiFormat(
            '🟪➕=== Welcome to the Minecraft Library of Babel ===⬜➖\n' +
            'This library contains every possible 🟪➕15 character⬜➖ page.\n\n' +
            'Right click a bookshelf to open it and take out books.\n' +
            'They will respawn, so no need to put them back.\n\n' +
            'Type ',
        ),
        {color: 'light_purple', text: '/help', bold: true, clickEvent: {action: 'suggest_command', value:`/help`}},
        ...emojiFormat(
            ' for a list of commands, and have fun exploring.\n\n' +
            'Learn more here: '
        ),
        {color: 'aqua', text: LEARN_MORE_URL, clickEvent: {action: 'open_url', value: LEARN_MORE_URL}},
        ...emojiFormat('\nJoin the discord: '),
        {color: 'aqua', text: DISCORD_SERVER_INVITE_URL, clickEvent: {action: 'open_url', value: DISCORD_SERVER_INVITE_URL}},
    ]);
}

export function getRandomSpawn() {
    const chunkX = Math.floor(Math.random() * NUM_HORIZONTAL_CHUNKS) - NEGATIVE_CHUNK_XZ_OFFSET;
    const chunkZ = Math.floor(Math.random() * NUM_HORIZONTAL_CHUNKS) - NEGATIVE_CHUNK_XZ_OFFSET;

    return {
        x: chunkX * 16 + SPAWN_OFFSET_X,
        y: SPAWN_Y, // Y chunk is not randomized so that players can always move up or down from spawn.
        z: chunkZ * 16 + SPAWN_OFFSET_Z,
    };
}

export function banKick(client, reason) {
    client.end(`§dYou have been banned.${reason ? ` Reason: ${reason}.` : ''}`);
}

/*
 * Surrounds a string with random characters. Used when running the command /search fill <text>.
 */
export function randomFill(text) {
    const charactersToFill = STRING_LENGTH - text.length;
    const textPosition = Math.floor(Math.random() * (charactersToFill + 1));
    for (let index = 0; index < charactersToFill; ++index) {
        const newCharacter = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        text = index < textPosition ? newCharacter + text : text + newCharacter;
    }
    return text;
}

/*
 * Simple function to compute n % BLOCKS_PER_CHUNK that supports negative numbers.
 */
function negativeModBlocksPerChunk(n) {
    return n % BLOCKS_PER_CHUNK < 0 ? (BLOCKS_PER_CHUNK + (n % BLOCKS_PER_CHUNK)) : n % BLOCKS_PER_CHUNK;
}

export function getBookshelfCoordinates({x, y, z}) {
    return `${negativeModBlocksPerChunk(x)} ${negativeModBlocksPerChunk(y)} ${negativeModBlocksPerChunk(z)}`;
}

export function notice(client, message) {
    packets.chat(client, emojiFormat(`🟥➕[NOTICE]⬜➖ ${message}`));
}

export function error(client, message) {
    packets.chat(client, emojiFormat(`🟥➕[ERROR]➖ ${message}`));
}
