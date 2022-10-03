import {
    clearHighlightInterval,
    createHighlightInterval,
    error,
    fromPage,
    fromPageId,
    getChunk,
    getChunkRoot,
    notice,
    randomFill,
    teleport,
} from './helper.js';
import {
    BOOKSHELF_COORDINATES,
    BOOKSHELF_COORDINATES_MAP,
    CHARACTERS,
    COORDINATE_KEYS,
    NEARBY_SEARCH_TOOL_URL,
    NUM_INVENTORY_SLOTS,
    STRING_LENGTH,
} from './constants.js';
import {packets} from './packets.js';
import {CONFIG} from './config.js';
import * as https from 'https';
import {admins} from './firebase.js';
import {emojiFormat} from './emojiFormat.js';
import {decrypt} from './encryption.js';

/*
 * Converts Minecraft coordinate format (including `~`) into absolute world coordinates.
 */
function parseCoordinates(client, parameters, errorClient) {
    const coordinates = Object.fromEntries(parameters
        .map((coordinate) => coordinate.replaceAll(',', ''))
        .map((coordinate, index) => coordinate.startsWith('~')
            ? (parseFloat(coordinate.slice(1)) || 0) + client.__state.position[COORDINATE_KEYS[index]]
            : coordinate)
        .map((coordinate, index) => [COORDINATE_KEYS[index], parseFloat(coordinate)]));

    if (Object.values(coordinates).some(isNaN)) {
        error(errorClient ?? client, 'Invalid coordinates.');
        return;
    }

    return coordinates;
}

/*
 * Send a report message to the Discord webhook path specified in the config.
 */
function makeReportRequest(client, username, text) {
    const request = https.request({
        hostname: 'discord.com',
        port: 443,
        path: CONFIG.reportPath,
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
    }, result => {
        if (!result.statusCode.toString().startsWith('2')) error(client, 'Error reporting user. Please try again later.');
        packets.chat(client, emojiFormat(`${username} has been successfully reported, thank you.`));
    });

    request.on('error', () => error(client, 'Error reporting user. Please try again later.'));
    request.write(`{"content": "${text}"}`);
    request.end();
}

export const commands = {
    help(server, client) {
        packets.chat(client, emojiFormat(
            '🟪➕=== Minecraft Library of Babel - Commands ===\n' +
            '⬜➖/tp 🟨<username> ⬜| (🟨<x> <y> <z> ⬜[🟨<yaw> <pitch>⬜])\n' +
            '    ⬛✖Teleport to a player or coordinates.\n' +
            '⬜➗/search (🟨"exact" ⬜| 🟨"fill"⬜) 🟨<text>\n' +
            '    ⬛✖Search for specific text. May contain spaces.\n' +
            '⬜➗/nearbysearch\n' +
            '    ⬛✖Search for text nearby (website link).\n' +
            '⬜➗/highlight (🟨<shelf> ⬜[🟨<nearX> <nearY> <nearZ>⬜]) | 🟨"stop"\n' +
            '    ⬛✖Highlight a shelf near you or near coordinates.\n' +
            '⬜➗/togglechat\n' +
            '    ⬛✖Toggle chat on and off.\n' +
            '⬜➗/toggleplayers\n' +
            '    ⬛✖Toggle other player visibility on and off.\n' +
            '⬜➗/report 🟨<username> ⬜[🟨<reason>⬜]\n' +
            '    ⬛✖Report a player for abuse.\n' +
            '⬜➗/clear\n' +
            '    ⬛✖Clear your inventory.',
        ));
        if (admins.has(client.uuid)) {
            packets.chat(client, emojiFormat(
                '🟪➕=== Admin Commands ===\n' +
                '⬜➖/kick 🟨<username> ⬜[🟨<reason>⬜]\n' +
                '    ⬛✖Kick a player.\n' +
                '⬜➗/tpother 🟨<username> </tp parameters>\n' +
                '    ⬛✖Execute a tp command as another player.\n' +
                '⬜➗/announce 🟨<message>\n' +
                '    ⬛✖Make an announcement bypassing chat toggle.\n' +
                '⬜➗/tell 🟨<username> <message>\n' +
                '    ⬛✖Send a direct message to a player, bypassing chat toggle.',
            ));
        }
    },
    tp(server, client, parameters, errorClient) {
        errorClient = errorClient ?? client;
        if (parameters.length === 1) {
            const [username] = parameters;
            if (username === client.username) {
                error(errorClient, 'You cannot tp to yourself.');
                return;
            }
            const otherClient = Object.values(server.clients).find(client => client.username === username);
            if (otherClient === undefined) {
                error(errorClient, 'That player is not online.');
                return;
            }
            console.log(`${client.username} teleported to ${otherClient.username}.`);
            teleport(client, otherClient.__state.position);
        } else if (parameters.length === 3 || parameters.length === 5) {
            const coordinates = parseCoordinates(client, parameters, errorClient);
            if (coordinates === undefined) return;
            console.log(`${client.username} teleported to ${Object.values(coordinates).join(', ')}.`);
            teleport(client, {yaw: 0, pitch: 0, ...coordinates});
        } else {
            error(errorClient, 'That command takes one, three, or five parameters.');
        }
    },
    search(server, client, parameters) {
        const [searchMode, ...rest] = parameters;
        let searchQuery = rest.join(' ').toUpperCase();
        if (searchQuery.length > STRING_LENGTH) {
            error(client, `Phrases cannot be longer than ${STRING_LENGTH} characters.`);
            return;
        }
        if (Array.from(searchQuery).every(character => character === ' ')) {
            notice(client, 'Your search text was empty.');
        }
        if (searchMode === 'fill') {
            const filledSearchQuery = randomFill(searchQuery);
            console.log(`${client.username} searched with fill for "${searchQuery}" ("${filledSearchQuery}").`);
            searchQuery = filledSearchQuery
        }
        else if (searchMode !== 'exact') {
            error(client, 'Search mode must be either "fill" or "exact".');
            return;
        } else {
            console.log(`${client.username} searched for "${searchQuery}".`);
        }
        if (Array.from(searchQuery).some(character => !CHARACTERS.includes(character))) {
            error(client, 'Only letters and spaces are allowed.');
            return;
        }
        if (searchQuery.length < STRING_LENGTH) searchQuery = searchQuery.padEnd(STRING_LENGTH, ' ');
        const {x, y, z, shelf, shulker, book, page} = fromPageId(fromPage(decrypt(searchQuery)));
        const [shelfX, shelfY, shelfZ] = BOOKSHELF_COORDINATES[shelf].split(' ').map(coordinate => parseInt(coordinate));
        const tpCoordinates = Object.values(BOOKSHELF_COORDINATES_MAP)[shelf];
        const [formattedX, formattedY, formattedZ] = [x + shelfX, y + shelfY, z + shelfZ].map(coordinate => coordinate.toLocaleString("en-US"));
        packets.chat(client, [
            ...emojiFormat(
                '🟪➕=== Search Results ===\n' +
                `⬜➖That text was found at 🟥➕x=${formattedX} y=${formattedY} z=${formattedZ}⬜➖.\n` +
                `In 🟨➕shelf ${shelf + 1n}⬜➖, 🟩➕shulker ${shulker + 1n}⬜➖, 🟦➕book ${book + 1n}⬜➖, 🟪➕page ${page + 1n}⬜➖.\n\n` +
                `Actions: 🟦`,
            ),
            {color: 'aqua', text: '[Teleport Nearby]', clickEvent: {action: 'run_command', value:`/tp ${x + tpCoordinates.x} ${y + tpCoordinates.y} ${z + tpCoordinates.z} ${tpCoordinates.yaw} ${tpCoordinates.pitch}`}},
            {color: 'white', text: ' '},
            {color: 'aqua', text: '[Highlight Shelf]', clickEvent: {action: 'run_command', value:`/highlight ${shelf + 1n} ${x} ${y} ${z}`}},
            ...(searchMode === 'fill' ? [
                {color: 'white', text: ' '},
                {color: 'aqua', text: '[Find Next]', clickEvent: {action: 'run_command', value:`/search fill ${rest.join(' ')}`}},
            ] : []),
        ]);
    },
    nearbysearch(server, client) {
        const {x, y, z} = client.__state.position;
        const query = `?x=${Math.floor(x)}&y=${Math.floor(y)}&z=${Math.floor(z)}`;
        packets.chat(client, [
            ...emojiFormat('Nearby search tool: '),
            {color: 'aqua', text: NEARBY_SEARCH_TOOL_URL, clickEvent: {action: 'open_url', value: NEARBY_SEARCH_TOOL_URL + query}},
        ]);
    },
    highlight(server, client, parameters) {
        let position;
        if (parameters.length === 1) {
            if (parameters[0] === 'stop') {
                packets.chat(client, emojiFormat('Highlighting has been stopped.'))
                clearHighlightInterval(client);
                return;
            }

            position = client.__state.position;
        } else if (parameters.length === 4) {
            position = parseCoordinates(client, parameters.slice(1));
            if (position === undefined) return;
        }
        else {
            error(client, 'The command takes one or four parameters.');
            return;
        }

        const shelf = parseInt(parameters[0]) - 1;

        if (isNaN(shelf) || shelf < 0 || shelf >= BOOKSHELF_COORDINATES.length) {
            error(client, `Shelf must be between 1 and ${BOOKSHELF_COORDINATES.length} (inclusive).`);
            return;
        }

        const {x, y, z} = getChunkRoot(getChunk(position));
        const coordinates = createHighlightInterval(client, x, y, z, shelf).map(Math.floor);

        console.log(`${client.username} is highlighting shelf ${parameters[0]} at ${coordinates.join(', ')}.`);
        packets.chat(client, [
            ...emojiFormat(`🟨➕Shelf ${parameters[0]} ⬜➖(🟥➕${coordinates.join(', ')}⬜➖) highlighted.\nRun `),
            {color: 'aqua', text: '[/highlight stop]', clickEvent: {action: 'suggest_command', value:'/highlight stop'}},
            {color: 'white', text: ' to stop highlighting.'},
        ]);
    },
    togglechat(server, client) {
        client.__state.chat = !client.__state.chat;
        const onOff = client.__state.chat ? 'ON' : 'OFF';
        console.log(`${client.username} has toggled chat ${onOff}.`);
        packets.chat(client, emojiFormat(`Chat has been toggled 🟪➕${onOff}⬜➖.`));
        if (client.__state.chat) notice(client, 'Please be respectful. Abuse will not be tolerated.');
    },
    toggleplayers(server, client) {
        if (client.__state.players) {
            client.__state.nearbyClients.forEach(id => {
                packets.destroyPlayer(client, id);
                client.__state.nearbyClients.delete(id);
            });
        }
        client.__state.players = !client.__state.players;
        const onOff = client.__state.players ? 'ON' : 'OFF';
        console.log(`${client.username} has toggled chat ${onOff}.`);
        packets.chat(client, emojiFormat(`Player visibility has been toggled 🟪➕${onOff}⬜➖.`));
    },
    report(server, client, parameters) {
        if (!CONFIG.reportPath) {
            error(client, 'Reporting is not enabled on this server.');
            return;
        }

        if (parameters.length < 1) {
            error(client, 'The command takes one or two parameters.');
            return;
        }

        const [username, ...reason] = parameters;
        const otherClient = Object.values(server.clients).find(otherClient => otherClient.username === username);
        if (!otherClient) notice(client, 'That player is not online, report will submit anyway.');

        console.log(`${client.username} reported ${username} for "${reason.join(' ')}".`);

        makeReportRequest(
            client,
            username,
            `**${client.username}** reported **${username}**${otherClient ? ` (${otherClient.uuid})` : ''} for \\"${reason.join(' ')}\\".\\n\\n` +
                `${otherClient ? `**${username}**'s recent chat messages:\\n${otherClient.__state.recentChats.map(chat => `- \\"${chat}\\"`).join('\\n')}` : ''}`,
        );
    },
    clear(server, client) {
        for (let slot = 0; slot <= NUM_INVENTORY_SLOTS; ++slot) packets.clearSlot(client, slot);
        packets.chat(client, emojiFormat(`Your inventory has been cleared.`));
        console.log(`${client.username} cleared their inventory.`);
    },

    // Below are admin only commands

    kick(server, client, parameters) {
        if (!admins.has(client.uuid)) {
            error(client, 'Invalid command. Type /help for a list of commands.');
            return;
        }

        if (parameters.length < 1) {
            error(client, 'The command takes one or two parameters.');
            return;
        }

        const [username, ...reason] = parameters;
        const otherClient = Object.values(server.clients).find(otherClient => otherClient.username === username);
        if (!otherClient) {
            error(client, 'That user is not online.');
            return;
        }

        const reasonString = reason.join(' ');
        console.log(`${client.username} has kicked ${otherClient.username} for "${reasonString}".`);
        otherClient.end('§dYou have been kicked.' + (reasonString ? ` Reason: ${reasonString}.` : ''));
        packets.chat(client, emojiFormat(`${username} has been kicked.`));
    },
    tpother(server, client, parameters) {
        if (!admins.has(client.uuid)) {
            error(client, 'Invalid command. Type /help for a list of commands.');
            return;
        }

        if (parameters.length < 2) {
            error(client, 'That command takes two, four, or six parameters.');
            return;
        }

        const [username, ...rest] = parameters;
        const otherClient = Object.values(server.clients).find(otherClient => otherClient.username === username);

        console.log(`${client.username} used /tpother on ${otherClient.username}.`);
        this.tp(server, otherClient, rest, client);
    },
    announce(server, client, parameters) {
        if (!admins.has(client.uuid)) {
            error(client, 'Invalid command. Type /help for a list of commands.');
            return;
        }

        if (parameters.length < 1) {
            error(client, 'That command takes one parameter.');
            return;
        }

        const message = parameters.join(' ');
        console.log(`${client.username} announced: "${message}".`);
        packets.chat(client, emojiFormat(`🟥➕[ANNOUNCEMENT] ⬜➖<🟪${client.username}⬜> ${message}`));
    },
    tell(server, client, parameters) {
        if (!admins.has(client.uuid)) {
            error(client, 'Invalid command. Type /help for a list of commands.');
            return;
        }

        if (parameters.length < 2) {
            error(client, 'That command takes two parameters.');
            return;
        }

        const [username, ...rest] = parameters;
        const otherClient = Object.values(server.clients).find(otherClient => otherClient.username === username);
        if (!otherClient) {
            error(client, 'That user is not online.');
            return;
        }
        const message = rest.join(' ');

        packets.chat(otherClient, emojiFormat(`🟥➕[DIRECT MESSAGE] ⬜➖<🟪${client.username}⬜> ${message}`));
        console.log(`${client.username} told ${otherClient.username} "${message}".`);
    },
};
