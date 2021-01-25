const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36';
const regex = new RegExp(/(discord.gift|discord.com|discordapp.com\/gifts)\/\w{16,25}/gim);
const consumedCodes = [];

require('dotenv').config({ path: 'dotenv' });

const phin = require('phin').unpromisified;
const { Client, WebhookClient, RichEmbed } = require('discord.js');
const chalk = require('chalk');

const tokens = process.env.guildTokens.split(',');
const mainToken = process.env.mainToken;
const webhookUrl = process.env.webhookUrl;
const snipeGiveaways = Boolean(process.env.snipeGiveaways) || true;
const dmHosterOnGiveawayWin = Boolean(process.env.dmHosterOnGiveawayWin) || true;
const snipeGiveawaysOnlyNitro = Boolean(process.env.snipeGiveawaysOnlyNitro) || false;
const giveawayWinDM = String(process.env.giveawayWinDM) || 'Hey, i won the giveaway. Could i redeem my prize?';

let paymentMethod = null;

phin({
   url: 'https://discord.com/api/v6/users/@me/billing/payment-sources',
   method: 'GET',
   parse: 'json',
   headers: {
      'Authorization': mainToken,
      'User-Agent': userAgent
   }
}, (err, res) => {
   if (err) console.log(err);
   if (res.body['message'] == '401: Unauthorized') {
      console.log(chalk.red('[Sniper] Invalid main token, terminating process.'));
      process.exit(-1);
   } else if (res.body.length && res.body.length === 0) {
      console.log(chalk.red('[Sniper] Main token does not have a billing source, some codes will not be sniped.'));
   } else if (res.body[0]) {
      paymentMethod = res.body[0].id;
   } else {
      console.log(chalk.red(`[Sniper] Unable to get billing source: ${res.body}`));
   };
})

if (webhookUrl != null) {
   const webhooktoken = /[^/]*$/.exec(webhookUrl)[0];
   const webhookid = webhookUrl.replace(/^.*\/(?=[^\/]*\/[^\/]*$)|\/[^\/]*$/g, '');
   const webhookclient = new WebhookClient(webhookid, webhooktoken);
   function fireHook(opts) {
      let embed = new RichEmbed();
      if (opts.title) embed.setTitle(opts.title);
      if (opts.color) embed.setColor(opts.color);
      for (const field of opts.fields) {
         embed.addField(field.key, field.value, field.inline);
      }
      webhookclient.send('', { embeds: [embed] }).catch(() => {
         if (webhookUrl) {
            console.log(chalk.red("[Sniper] Couldn't reach webhook. Your webhook URL is invalid."));
         };
      });
   };
};

for (const token of tokens) {
   const client = new Client({
      messageCacheLifetime: 1,
      messageCacheMaxSize: 1,
      messageSweepInterval: 1,
      messageEditHistoryMaxSize: 1,
      restTimeOffset: 0,
      disabledEvents: [
         'TYPING_START',
         'VOICE_SERVER_UPDATE',
         'RELATIONSHIP_ADD',
         'RELATIONSHIP_REMOVE',
         'GUILD_ROLE_DELETE',
         'GUILD_ROLE_UPDATE',
         'GUILD_BAN_ADD',
         'GUILD_BAN_REMOVE',
         'CHANNEL_UPDATE',
         'CHANNEL_PINS_UPDATE',
         'MESSAGE_DELETE',
         'MESSAGE_UPDATE',
         'MESSAGE_DELETE_BULK',
         'MESSAGE_REACTION_ADD',
         'MESSAGE_REACTION_REMOVE',
         'GUILD_MEMBER_UPDATE',
         'GUILD_MEMBERS_CHUNK',
         'GUILD_ROLE_CREATE',
         'MESSAGE_REACTION_REMOVE_ALL',
         'USER_UPDATE', 'USER_NOTE_UPDATE',
         'USER_SETTINGS_UPDATE',
         'PRESENCE_UPDATE',
         'VOICE_STATE_UPDATE',
         'GUILD_UPDATE',
         'GUILD_MEMBER_ADD',
         'GUILD_MEMBER_REMOVE'
      ]
   });

   client.on('message', async (msg) => {
      let codes = msg.content.match(regex);
      let author = msg.author.tag;
      let from = msg.guild ? `${msg.guild.name} (Server)` : 'DMs';

      if (codes && codes.length) {
         for (let code of codes) {
            code = code.replace(/(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)/gim, '');

            let start = new Date();

            if (consumedCodes.indexOf(code) > -1) {
               console.log(chalk.gray(`[Sniper] Avoiding Duplicate - Code: ${chalk.bold(code)} - ${from} (${author})`));
               continue;
            };

            let payload = `{"channel_id":${msg.channel.id},"payment_source_id":${paymentMethod}}`;
            phin({
               url: `https://discord.com/api/v6/entitlements/gift-codes/${code}/redeem`,
               method: 'POST',
               parse: 'json',
               headers: {
                  'Authorization': mainToken,
                  'User-Agent': userAgent,
                  'Content-Length': payload.length
               },
               data: payload
            }, (err, res) => {
               let end = `${new Date() - start}ms`;
               let type = res.body.subscription_plan?.name;
               if (err) {
                  return console.log(chalk.red(`[Sniper] Error - Code: ${chalk.bold(code)} - ${err} - ${from} (${author}) - ${end}`));
               } else if (res.body.message === '401: Unauthorized') {
                  return console.log(chalk.red(`[Sniper] Error - Code: ${chalk.bold(code)} - Your main token is invalid.`));
               } else if (res.body.message == 'This gift has been redeemed already.') {
                  console.log(chalk.red(`[Sniper] Already Redeemed - Code: ${chalk.bold(code)} - ${from} (${author}) - ${end}`));
               } else if ('subscription_plan' in res.body) {
                  console.log(chalk.green(`[Sniper] Success - Code: ${chalk.bold(code)} - ${type} - ${from} (${author}) - ${end}`));
                  fireHook({
                     title: 'Nitro Sniped',
                     fields: [
                        {
                           key: 'Time Taken',
                           value: end,
                           inline: true
                        },
                        {
                           key: 'Type',
                           value: type,
                           inline: true
                        },
                        {
                           key: 'Code',
                           value: code,
                           inline: true
                        },
                        {
                           key: 'Account',
                           value: client.user.tag,
                           inline: true
                        },
                        {
                           key: 'Author',
                           value: author,
                           inline: true
                        },
                        {
                           key: 'Location',
                           value: from,
                           inline: true
                        },
                     ],
                     color: '#41FC9F'
                  });
               } else if (res.body.message == 'Unknown Gift Code') {
                  console.log(chalk.red(`[Sniper] Invalid Code - Code: ${chalk.bold(code)} - ${from} (${author}) - ${end}`));
               };
               consumedCodes.push(code);
            });
         }
      };
      if (snipeGiveaways) {
         // GiveawayBot#2381 (294882584201003009)
         if (msg.author.id == '294882584201003009' && msg.content.includes('GIVEAWAY')) {
            let timeout = randomInt(10e3, 30e3);
            let prize = msg.embeds[0].author.name;
            if (snipeGiveawaysOnlyNitro && !prize.toLowerCase().includes('nitro')) return;
            console.log(chalk.gray(`[Sniper] Giveaway detected in ${from}, reacting in ${((timeout % 60000) / 1000).toFixed(0)} seconds.`));

            setTimeout(async () => {
               let react = await msg.react('🎉').catch(() => null);
               if (react) console.log(chalk.green(`[Sniper] Reacted to giveaway in ${from} (Prize: ${prize})`));
            }, timeout);
         }
         if (msg.author.id == '294882584201003009' && msg.content.includes('Congratulations') && msg.mentions.users.first()?.id == client.user.id) {
            let messageLink = msg.content.replace(/\r/g, "").split(/\n/)[1].replace(/(<|>)/g, '');
            let giveawayMessageId = messageLink.split('/')[6];

            let message = await msg.channel.fetchMessage(giveawayMessageId).catch(() => null);
            if (message) {
               let prize = message.embeds[0].author.name;
               let description = message.embeds[0].description.replace(/\r/g, "").split(/\n/);

               let hosterId = description[1].split('<@')[1].replace('>', '');
               await client.fetchUser(hosterId);
               let hoster = client.users.get(hosterId);

               console.log(chalk.green(`[Sniper] Giveaway Won in ${from} (Prize: ${prize})`));
               fireHook({
                  title: 'Giveaway Won',
                  fields: [
                     {
                        key: 'Prize',
                        value: prize,
                        inline: true
                     },
                     {
                        key: 'Location',
                        value: from,
                        inline: true
                     },
                     {
                        key: 'Hoster',
                        value: hoster.tag,
                        inline: true
                     }
                  ],
                  color: '#41FC9F'
               });

               if (dmHosterOnGiveawayWin) {
                  let sentMsg = await hoster.send(giveawayWinDM).catch(() => null);
                  if (sentMsg) console.log(chalk.gray(`[Sniper] DMed giveaway hoster (${hoster.tag}) - ${giveawayWinDM}`));
                  else console.log(chalk.red(`[Sniper] Failed to DM giveaway host (${hoster.tag}) - This might require you to manually log in.`));
               };
            };
         };
      };
   });

   client.on('ready', () => {
      console.log(chalk.green(`[Sniper] Logged in as ${client.user.tag}.`));
   });

   setTimeout(() => {
      client.login(token).catch(err => {
         console.log(chalk.red(`[Sniper] Skipping alt token - ${err} - ${token}`));
      });
   }, randomInt(1e3, 3e3));

   function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
   };
}
