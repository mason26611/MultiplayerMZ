/*:
 * @target MZ
 * @plugindesc v1.0 A plugin that facilitates multiplayer in RPG Maker MZ.
 * @author Mason Gover
 *
 * No plugin dependencies.
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

    let socket;
    let username;

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
            createMultiplayerPlayer(data);
        });

        socket.on('player_moved', (data) => {
            console.log('player moved event received', data);
        });

        socket.on('current_players', (players) => {
            console.log('current players:', players)
        })
    }

    // Creates a fake player sprite using events and 
    function createMultiplayerPlayer(data) {
        console.log('Creating multiplayer player at', data.x, data.y);
        var event = new MapEvent($gameMap.mapId(), -1);
        // const player = new Game_Event($gameMap.mapId(), -1);
        // player.setImage("Actor1", 1);
        // player.setPosition(data.x, data.y);
        // $gameMap._events.push(player);
    }
})();