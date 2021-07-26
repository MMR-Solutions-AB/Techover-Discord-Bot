const axios = require('axios');
const Discord = require('discord.js');
const client = new Discord.Client();
require('dotenv').config();

const url = 'https://www.codingame.com/services/ClashOfCode/createPrivateClash';
const leaveUrl =
  'https://www.codingame.com/services/ClashOfCode/leaveClashByHandle';
const uid = '444560622ebc45c5b60167747ba62bd4e157bea';

const actionId = 4445606;
const data = [actionId, { SHORT: true }, [], ['SHORTEST', 'REVERSE']];

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

let publicHandle;

const prefix = '!';

client.on('message', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'create') {
    axios({
      method: 'post',
      url: url,
      headers: {
        'Content-Type': 'application/json',
        cookie: 'rememberMe=' + uid,
      },
      data: data,
    })
      .then((result) => {
        publicHandle = result.data.publicHandle;
        message.channel.send(`Good luck :),${args}`);
        console.log(message.author.avatarURL());
        const exampleEmbed = new Discord.MessageEmbed()
          .setColor('#0099ff')
          .setTitle('Clash of Code Lobby')
          .setURL('https://www.codingame.com/clashofcode/clash/' + publicHandle)
          .setAuthor(
            message.author.username,
            message.author.avatarURL(),
            'https://discord.js.org'
          )
          .setDescription('Your lobby has been created, click the link above')
          .setThumbnail(
            'https://www.academy.techover.nu/hosted/images/97/75e31bbbf7423c834124ab44d6facf/TECHOVER-Tr300ppi-B01.png'
          )
          .setImage(
            'https://files.codingame.com/codingame/share_pics_clash_of_code.jpg'
          )
          .setTimestamp()
          .setFooter('Created at');
        message.channel.send(exampleEmbed);
        setTimeout(() => {
          axios({
            method: 'post',
            url: leaveUrl,
            headers: {
              'Content-Type': 'application/json',
              cookie: 'rememberMe=' + uid,
            },
            data: [actionId, publicHandle],
          });
        }, 10000);
      })
      .catch((e) => {
        console.warn(e);
      });
  }
});

client.login(process.env.DISCORD_TOKEN);
