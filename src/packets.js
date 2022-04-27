import minecraft_data from 'minecraft-data';
import {
    BOOKSHELF_COORDINATES,
    GAME_MODE,
    LIBRARY_CHUNK,
    NEGATIVE_CHUNK_XZ_OFFSET,
    NUM_DOUBLE_CHEST_SLOTS,
    PARTICLE_DATA,
    VERSION,
} from './constants.js';
import {getBooks} from './helper.js';
import {CONFIG} from './config.js';

const mcData = minecraft_data(VERSION);

const packetDefinitions = {
    initClient: (client) => {
        client.write('login', {
            entityId: client.id,
            isHardcore: false,
            gameMode: GAME_MODE,
            previousGameMode: GAME_MODE,
            worldNames: mcData.loginPacket.worldNames,
            dimensionCodec: mcData.loginPacket.dimensionCodec,
            // Using effects from the nether to disable clouds. It also adds fog, which looks kinda cool.
            dimension: {
                ...mcData.loginPacket.dimension,
                value: {
                    ...mcData.loginPacket.dimension.value,
                    effects: {type: 'string', value: 'minecraft:the_nether'},
                },
            },
            worldName: 'minecraft:overworld',
            hashedSeed: [0, 0],
            maxPlayers: -1,
            viewDistance: 10,
            reducedDebugInfo: false,
            enableRespawnScreen: false,
            isDebug: false,
            isFlat: false,
        });

        // Tags packet is needed to declare ladders as climbable.
        client.write('tags', {tags: [{tagType: 'minecraft:block', tags: [{tagName: 'minecraft:climbable', entries: [169]}]}]});

        client.write('declare_commands', {
            nodes: [
                { // 0
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 0,
                    },
                    children: [1, 2, 3, 4, 5, 13, 14, 15, 19],
                },
                { // 1
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [],
                    extraNodeData: 'help',
                },
                { // 2
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [6, 8],
                    extraNodeData: 'tp',
                },
                { // 3
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [18],
                    extraNodeData: 'search',
                },
                { // 4
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [],
                    extraNodeData: 'nearbysearch',
                },
                { // 5
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [10, 12],
                    extraNodeData: 'highlight',
                },
                { // 6
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [7],
                    extraNodeData: {name: 'coordinates', parser: 'minecraft:vec3', properties: 2},
                },
                { // 7
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [],
                    extraNodeData: {name: 'rotation', parser: 'minecraft:rotation', properties: 2},
                },
                { // 8
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [],
                    extraNodeData: {name: 'player', parser: 'minecraft:game_profile', properties: 2},
                },
                { // 9
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [],
                    extraNodeData: {name: 'text', parser: 'brigadier:string', properties: 2},
                },
                { // 10
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [11],
                    extraNodeData: {
                        name: 'shelf',
                        parser: 'brigadier:integer',
                        properties: {
                            flags: {unused: 0, max_present: 1, min_present: 1},
                            min: 1,
                            max: BOOKSHELF_COORDINATES.length,
                        },
                    },
                },
                { // 11
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [],
                    extraNodeData: {name: 'coordinates', parser: 'minecraft:vec3', properties: 2},
                },
                { // 12
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [],
                    extraNodeData: {name: 'stop', parser: 'brigadier:string', properties: 2},
                },
                { // 13
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [],
                    extraNodeData: 'togglechat',
                },
                { // 14
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [],
                    extraNodeData: 'toggleplayers',
                },
                { // 15
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [16],
                    extraNodeData: 'report',
                },
                { // 16
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [17],
                    extraNodeData: {name: 'player', parser: 'minecraft:game_profile', properties: 2},
                },
                { // 17
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [],
                    extraNodeData: {name: 'reason', parser: 'brigadier:string', properties: 2},
                },
                { // 18
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 1,
                        command_node_type: 2,
                    },
                    children: [9],
                    extraNodeData: {name: 'exact | fill', parser: 'brigadier:string', properties: 2},
                },
                { // 19
                    flags: {
                        unused: 0,
                        has_custom_suggestions: 0,
                        has_redirect_node: 0,
                        has_command: 0,
                        command_node_type: 1,
                    },
                    children: [],
                    extraNodeData: 'clear',
                },
            ],
        });

        // Disable player collision.
        client.write('teams', {
            team: 'x',
            mode: 0,
            name: '{"text": "x"}',
            friendlyFire: 3,
            nameTagVisibility: 'always',
            collisionRule: 'never',
            formatting: 21,
            prefix: '{"text": ""}',
            suffix: '{"text": ""}',
            players: [client.username],
        });
    },
    libraryChunk: (client, x, z) => client.write('map_chunk', {
        x: x - NEGATIVE_CHUNK_XZ_OFFSET,
        z: z - NEGATIVE_CHUNK_XZ_OFFSET,
        ...LIBRARY_CHUNK,
    }),
    position: (client, position) => client.write('position', {
        ...position,
        flags: 0,
        teleportId: 2,
        dismountVehicle: false,
    }),
    updateViewPosition: (client, chunkX, chunkZ) => client.write('update_view_position', {
        chunkX: chunkX - NEGATIVE_CHUNK_XZ_OFFSET,
        chunkZ: chunkZ - NEGATIVE_CHUNK_XZ_OFFSET,
    }),
    shulkerChooserUI: (client, shelf) => {
        client.write('open_window', {
            windowId: 1,
            inventoryType: 5,
            windowTitle: `{"translate": "container.chestDouble", "text": "Shelf ${shelf + 1}"}`,
        });

        client.write('window_items', {
            windowId: 1,
            stateId: 1,
            items: [...Array(NUM_DOUBLE_CHEST_SLOTS)].map((_, index) => ({
                present: true,
                itemId: 451,
                itemCount: 1,
                nbtData: {
                    type: 'compound',
                    name: '',
                    value: {
                        display: {
                            type: 'compound',
                            value: {Name: {type: 'string', value: `{"text": "Shulkerbox ${index + 1}"}`}}
                        }
                    }
                }
            })),
            carriedItem: {present: false},
        })
    },
    bookChooserUI: (client, chunkX, chunkY, chunkZ, shelf, shulker) => {
        client.write('open_window', {
            windowId: 1,
            inventoryType: 5,
            windowTitle: `{"translate": "container.chestDouble", "text": "Shelf ${shelf + 1} Shulker ${shulker + 1}"}`,
        });

        client.write('window_items', {
            windowId: 1,
            stateId: 1,
            items: getBooks(chunkX, chunkY, chunkZ, shelf, shulker),
            carriedItem: {present: false}
        })
    },
    openBook: (client, hand) => client.write('open_book', {hand}),
    teleportPlayer: (client, id, {x, y, z, yaw, pitch, onGround}) => {
        client.write('entity_teleport', {entityId: id, x, y, z, yaw, pitch, onGround});
        client.write('entity_head_rotation', {entityId: id, headYaw: yaw, onGround});
    },
    playerInfo: (client, add, players) => {
        players = players.filter(player => player.uuid !== undefined);
        client.write('player_info', add ? {
            action: 0,
            data: players.map(player => ({
                UUID: player.uuid,
                name: player.username,
                properties: [],
                gamemode: GAME_MODE,
                ping: 0,
            })),
        } : {
            action: 4,
            data: players.map(player => ({UUID: player.uuid})),
        });
    },
    spawnPlayer: (client, id, uuid, {x, y, z, yaw, pitch}) => client.write('named_entity_spawn', {
        entityId: id,
        playerUUID: uuid,
        x, y, z, yaw, pitch,
    }),
    skinParts: (client, id, skinParts) => client.write('entity_metadata', {
        entityId: id,
        metadata: [{key: 17, type: 0, value: skinParts}],
    }),
    chat: (client, parts) => {
        if (!client.__state.chatColors) parts = parts.map(part => ({...part, color: 'white'}));
        client.write('chat', {
            message: JSON.stringify({
                extra: parts,
                text: '',
            }),
            position: 1,
            sender: '00000000-0000-0000-0000-000000000000',
        });
    },
    particle: (client, x, y, z, id) => {
        client.write('world_particles', {x: x + 0.5, y, z, particleId: id, ...PARTICLE_DATA});
        client.write('world_particles', {x, y, z: z + 0.5, particleId: id, ...PARTICLE_DATA});
        client.write('world_particles', {x: x - 0.5, y, z, particleId: id, ...PARTICLE_DATA});
        client.write('world_particles', {x, y, z: z - 0.5, particleId: id, ...PARTICLE_DATA});
    },
    destroyPlayer: (client, id) => client.write('entity_destroy', {entityIds: [id]}),
    clearSlot: (client, slot) => client.write('set_slot', {
       windowId: 0,
       stateId: 0,
       slot,
       item: {present: false},
    }),
    // Not used. May be used in the future to implement a library-wide map.
    map: (client) => client.write('map', {
        itemDamage: 0,
        scale: 0,
        locked: false,
        icons: [{type: 0, x: 0, z: 0, direction: 0}],
        columns: 1,
        rows: 1,
        x: 0,
        y: 0,
        data: {type: 'Buffer', data: [45]},
    }),
};

export const packets = CONFIG.debug
    ? Object.fromEntries(Object.entries(packetDefinitions).map(([key, callback]) => ([key, (...params) => {
        console.log(`${params[0].username} <- ${key}(${params.slice(1)}): {${params.slice(1).map(x => typeof x)}}`);
        callback(...params);
    }])))
    : packetDefinitions;
