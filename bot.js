const axios = require('axios');
const Discord = require('discord.js');
const client = new Discord.Client();
const WebSocket = require('ws');
require('dotenv').config();

const uid = process.env.UID; // User ID required to do POST requests
const token = process.env.TOKEN; // Cookie token for making requests
const data = [uid, { SHORT: true }, [], ['SHORTEST']]; // Data for game options

let messages = []; // Contains a reference for every EmbedMessage sent in discord

// URL targets for following requests
URL = {
  create: 'https://www.codingame.com/services/ClashOfCode/createPrivateClash',
  leave: 'https://www.codingame.com/services/ClashOfCode/leaveClashByHandle',
  update:
    'https://www.codingame.com/services/ClashOfCode/findClashReportInfoByHandle',
};

// When Discord is ready
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Updating players for respective EmbedMessage
const updatePlayersEmbedMessage = (message, players) => {
  embed = message.embeds[0];
  if (players.length) {
    embed.fields[0].value = players.join('\n');
  } else {
    embed.fields[0].value = 'None';
  }
  message.edit(embed);
};

// Updating status for respective EmbedMessage
const updateStatusEmbedMessage = (message, status) => {
  /*
  STATUS PARAMETER:
    1: Game started
    2: Game ended

    Every EmbedMessage starts with 'Waiting for Player' as initial status
  */

  embed = message.embeds[0];
  if (status == 1) {
    embed.title = 'Clashing ...';
    embed.color = 16498468;
  }
  if (status == 2) {
    embed.title = 'Game has finished';
    embed.color = 16281969;
  }
  message.edit(embed);
};

// Boilerplate for EmbedMessages
const createEmbedMessage = async (message, publicHandle) => {
  ({ channel, author } = message);
  msg = await channel.send(
    new Discord.MessageEmbed()
      .setColor('#34D399')
      .setTitle('Waiting for Players ...')
      .setURL('https://www.codingame.com/clashofcode/clash/' + publicHandle)
      .setAuthor(author.username, author.avatarURL(), 'https://discord.js.org')
      .setDescription('Your lobby has been created, click the link above')
      .setThumbnail(
        'https://cdn.discordapp.com/attachments/869494020466958366/869494813781807134/TECHOVER.png'
      )
      .addField('Players', 'None', true)
      .setImage(
        'https://files.codingame.com/codingame/share_pics_clash_of_code.jpg'
      )
      .setTimestamp()
      .setFooter(publicHandle)
  );

  // Store the created Discord EmbedMessage as a reference, in an array with the publicHandle as identifier for future edits
  messages[publicHandle] = msg;
};

//Prefix command to listen for
const prefix = '!';

// Listens for every message sent
client.on('message', (message) => {
  // Check if message contains prefix
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  // Extracting command from message
  const args = message.content.slice(prefix.length).split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'create') {
    // Sending POST request to create a lobby
    axios({
      method: 'post',
      url: URL.create,
      headers: {
        'Content-Type': 'application/json',
        cookie: 'rememberMe=' + token,
      },
      data: data,
    })
      .then((result) => {
        publicHandle = result.data.publicHandle;

        // Connecting to CodinGame Websocket Server
        const ws = new WebSocket(
          'wss://push-community.codingame.com/socket.io/?EIO=3&transport=websocket'
        );

        const send = (msg) => {
          console.log('Sending: ' + msg);
          ws.send(msg);
        };

        // When a connection is successfully established
        ws.on('open', () => {
          let gameId = publicHandle;
          createEmbedMessage(message, gameId);

          // When recieving data through Websocket Server
          ws.on('message', (data) => {
            // Extracting message ID & additional data

            /*
            MESSAGE IDS FROM CLIENT:
            2: Ping!
            42: Clash of Code [context, action]


            MESSAGE IDS FROM SERVER:
              0: Assigned connection ID & recieving ping parameters
              3: Pong!
              40: Server is ready to handle requests
              42: Clash of Code [context, ... status]
            */

            let messageId = data.match(/\d+/)[0];
            let message = data.replace(messageId, '');

            if (message) {
              message = JSON.parse(message);
            }

            // Start pinger
            if (messageId == 0) {
              setInterval(() => {
                send(2);
              }, message.pingInterval);
            }

            // When server is ready to handle requests, subscribe to respective Clash lobby
            if (messageId == 40) {
              send('42["joinGroup","codingame"]');
              send('42["register",' + uid + ']');
              send('42["joinGroup","clashLobby_' + gameId + '"]');
            }

            // Clash of Code
            if (messageId == 42) {
              if (!message) return;

              // Check if the data has clash context
              if (message[0] == 'clash') {
                // Define data status
                let status = message[1]['status'];

                // Updates to a Clash lobby
                if (status == 'updateCurrentClash') {
                  if (!message[1]['clashDto']) return;
                  clashDto = JSON.parse(message[1]['clashDto']);

                  // Convert array from player object to player names
                  players = clashDto.minifiedPlayers.map((player) => {
                    return player.k;
                  });

                  // If a player joins an lobby, the bot leaves to transfer host
                  if (players.length >= 2 && players.includes('Techover')) {
                    axios({
                      method: 'post',
                      url: URL.leave,
                      headers: {
                        'Content-Type': 'application/json',
                        cookie: 'rememberMe=' + token,
                      },
                      data: [uid, gameId],
                    });
                  }
                  updatePlayersEmbedMessage(
                    messages[gameId],
                    players.filter((player) => player != 'Techover')
                  );
                  if (clashDto.finished) {
                    updateStatusEmbedMessage(messages[gameId], 2);
                  }
                }
                if (status == 'redirectReportCurrentClash') {
                  updateStatusEmbedMessage(messages[gameId], 1);
                }

                // Trigger for checking end-game results
                if (status == 'updateClash') {
                  // Post request for end-game results
                  axios({
                    method: 'post',
                    url: URL.update,
                    headers: {
                      'Content-Type': 'application/json',
                      cookie: 'rememberMe=' + token,
                    },
                    data: [gameId],
                  }).then((result) => {
                    // Retrieve all players that have submitted an answer and format to show game result
                    submittedPlayers = result.data.players
                      .map((player) => {
                        if (
                          player.testSessionStatus == 'COMPLETED' &&
                          player.score >= 0
                        ) {
                          time = Math.floor(player.duration / 1000);

                          minutes = Math.floor(time / 60);
                          seconds = time % 60;

                          seconds = seconds < 9 ? '0' + seconds : seconds;
                          minutes = minutes < 9 ? '0' + minutes : minutes;

                          characthers = player.criterion
                            ? player.criterion
                            : 'N/A';

                          return (
                            player.rank +
                            '. ' +
                            player.codingamerNickname +
                            ' - ' +
                            minutes +
                            ':' +
                            seconds +
                            ' - ' +
                            characthers +
                            ' - ' +
                            player.score +
                            '%'
                          );
                        }
                      })
                      .filter((player) => player !== undefined)
                      .sort((a, b) => {
                        parseInt(a.match(/\d/)[0]) - parseInt(b.match(/\d/)[0]);
                      });

                    // Retrieve all players who haven't submitted yet and show only name
                    clashingPlayers = result.data.players
                      .map((player) => {
                        if (
                          player.testSessionStatus != 'COMPLETED' ||
                          player.score === undefined
                        ) {
                          return player.codingamerNickname;
                        }
                      })
                      .filter((player) => player !== undefined);
                    updatePlayersEmbedMessage(
                      messages[gameId],
                      submittedPlayers.concat(clashingPlayers)
                    );

                    // If game has finished, terminate socket connection and update EmbedMessage status
                    if (r.data.finished) {
                      updateStatusEmbedMessage(messages[gameId], 2);
                      ws.terminate();
                    }
                  });
                }
              }
            }
          });
        });

        // When a Websocket connection has been closed/terminated
        ws.on('close', () => {
          console.log('disconnected');
        });
      })
      .catch((e) => {
        console.log(e);
      });
  }
});

client.login(process.env.DISCORD_TOKEN);
