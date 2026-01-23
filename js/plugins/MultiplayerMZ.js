/*:
 * @target MZ
 * @plugindesc v1.0 A plugin that facilitates multiplayer in RPG Maker MZ.
 * @author Mason Gover
 *
 * ------------------------------------------
 * PARAMETERS
 * ------------------------------------------
 *
 * @param backendServerUrl
 * @text Backend Server URL
 * @type string
 * @default http://localhost:3000
 * @desc Chooses a server to listen for events from.
 * 
 * 
 * @param enableDebug
 * @text Enable Debug Logs
 * @type boolean
 * @default true
 * @desc If true, logs info to the console.
 *
 * ------------------------------------------
 * COMMANDS
 * ------------------------------------------
 *
 * @command showGreeting
 * @text Show Greeting
 * @desc Displays the greeting text in a message window.
 *
 * @arg overrideText
 * @text Override Text
 * @type string
 * @default
 * @desc Optional text to override the greeting parameter.
 *
 * ------------------------------------------
*/

(() => {
    const PLUGIN_NAME = "MultiplayerMZ"
    const parameters = PluginManager.parameters("MultiplayerMZ")
    const BACKEND_SERVER_URL = parameters["backendServerUrl"]
    const DEBUG_MODE = parameters["enableDebug"]

    function createPlayerEvent(x, y, characterName, characterIndex) {
        const eventId = $dataMap.events.length;

        // Create event data
        const eventData = {
            id: eventId,
            name: "Player" + eventId,
            x: x,
            y: y,
            pages: [{
                conditions: {
                    actorId: 1,
                    actorValid: false,
                    itemId: 1,
                    itemValid: false,
                    selfSwitchCh: "A",
                    selfSwitchValid: false,
                    switch1Id: 1,
                    switch1Valid: false,
                    switch2Id: 1,
                    switch2Valid: false,
                    variableId: 1,
                    variableValid: false,
                    variableValue: 0
                },
                image: {
                    characterName: characterName,
                    characterIndex: characterIndex,
                    direction: 2,
                    pattern: 1,
                    tileId: 0
                },
                moveFrequency: 3,
                moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false },
                moveSpeed: 3,
                moveType: 0,
                priorityType: 1,
                stepAnime: false,
                through: false,
                trigger: 0,
                walkAnime: true,
                directionFix: false,
                list: []
            }]
        };

        // Add to map
        $dataMap.events[eventId] = eventData;

        // Create game event
        const gameEvent = new Game_Event($gameMap._mapId, eventId);
        $gameMap._events[eventId] = gameEvent;

        // Create sprite
        const spriteset = SceneManager._scene._spriteset;
        const sprite = new Sprite_Character(gameEvent);
        spriteset._characterSprites.push(sprite);
        spriteset._tilemap.addChild(sprite);

        return { eventData, gameEvent };
    }

    // Each player is an event with a sprite attached, and we need to store all of those events
    // Attached to their usernames
    const playerEvents = {}

    // Store local socket and username info for this client
    let socket;
    let username;

    // Hook isGameActive to always return true so that the game doesn't pause when losing focus
    SceneManager.isGameActive = function() {
        return true
    }

    // Hook into player movement to send updates to server once the player moves
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function () {
        _Scene_Map_start.call(this);

        // Once the game is loaded, request the current players from the server
        // This is so we can spawn the existing players into the game
        if (socket) {
            socket.emit('request_current_players');
        }

        const _Game_Player_moveStraight = Game_Player.prototype.moveStraight;
        Game_Player.prototype.moveStraight = function (d) {
            _Game_Player_moveStraight.call(this, d);
            if (!socket || !username) {
                if (DEBUG_MODE) {
                    console.log("Socket or username not initialized, cannot send movement. Uh ok.");
                }
                return;
            }

            if (DEBUG_MODE) {
                console.log("Sending player movement to server");
            }
            socket.emit('move_player', {
                username: username,
                x: this.x,
                y: this.y
            })
        }
    };

    // Load socket.io
    if (typeof io === "undefined") {
        let script = document.createElement("script");
        script.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
        script.onload = function () {
            startSocketConnection(); // Call function to initialize socket after loading
        };
        document.head.appendChild(script);
    } else {
        startSocketConnection();
    }

    function startSocketConnection() {
        // Make connection to backend address
        socket = io(BACKEND_SERVER_URL);
        console.log('starting socket connection to', BACKEND_SERVER_URL);

        socket.on('connected', (data) => {
            console.log('connected event received', data);
            username = data.username;
        });

        socket.on('player_connected', (data) => {
            console.log('a player has connected to the game')
            createMultiplayerPlayer(data);
        });

        socket.on('player_moved', (data) => {
            // Ignore our own movement updates because our client handles our own movement
            if (data.username === username) {
                return;
            }

            console.log('player moved event received', data);
            rpc_moveTo(data.username, data.x, data.y)
        });

        socket.on('current_players', (players) => {
            console.log('current players:', players)
            for (const player of players) {
                if (player.username === username) {
                    continue;
                }
                createMultiplayerPlayer(player);
            }
        })
    }

    // Handles other players movements
    function rpc_moveTo(username, x, y) {
        const playerEvent = playerEvents[username];
        if (!playerEvent) {
            if (DEBUG_MODE) {
                console.log("No event found for username:", username);
            }
            return;
        }

        const gameEvent = playerEvent.gameEvent;

        if (DEBUG_MODE) {
            console.log(`Moving player ${username} to (${x}, ${y})`);
        }


        // Determine direction based on movement
        const isLeft = x < gameEvent.x;
        const isRight = x > gameEvent.x;
        const isUp = y < gameEvent.y;
        const isDown = y > gameEvent.y;

        // Set the direction
        if (isUp) {
            gameEvent.setDirection(8); // Up
        } else if (isDown) {
            gameEvent.setDirection(2); // Down
        } else if (isLeft) {
            gameEvent.setDirection(4); // Left
        } else if (isRight) {
            gameEvent.setDirection(6); // Right
        }

        gameEvent.setPosition(x, y);
    }

    // Creates a fake player sprite using events with sprites attached
    function createMultiplayerPlayer(data) {
        // Avoid creating a player for ourselves
        if (data.username === username) {
            return;
        }

        if (DEBUG_MODE) {
            console.log('Creating multiplayer player at', data.x, data.y);
        }

        // Check if we're in a valid game state
        if (!$gameMap || !$dataMap) {
            console.error('Cannot create multiplayer player: Game not initialized');
            return;
        }

        // Check if we're in a map scene or else bad things may happen
        if (!SceneManager._scene || !SceneManager._scene._spriteset) {
            console.error('Cannot create multiplayer player: Not in map scene');
            return;
        }

        try {
            playerEvents[data.username] = createPlayerEvent(data.x, data.y, "Actor1", 0);

            if (DEBUG_MODE) {
                console.log('Multiplayer player created successfully');
            }
        } catch (error) {
            console.error('Error creating multiplayer player:', error);
        }
    }
})();