const { EmbedBuilder, PermissionFlagsBits, UserSelectMenuBuilder, ActionRowBuilder, Events} = require('discord.js');
const { createTranscript } = require('discord-html-transcripts');

const TicketSetup = require('../Schemas/TicketSetup');
const TicketSchema = require('../Schemas/Ticket');

const minik = require('../../minik.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction,) {
        const {guild, member, customId, channel } = interaction;
        const {ManageChannels, SendMessages} = PermissionFlagsBits;
        if(!interaction.isButton()) return;
        if(!['ticket-close', 'ticket-lock', 'ticket-unlock', 'ticket-manage', 'ticket-claim'].includes(customId)) return;
        const docs = await TicketSetup.findOne({GuildID: guild.id});
        if (!docs) return;
        const errorEmbed = new EmbedBuilder()
        .setColor('Red')
        .setDescription(minik.ticket.ticketError);

        if (!guild.members.me.permissions.has((r) => r.id === docs.Handlers)) return interaction.reply({embeds: [errorEmbed], ephemeral: true}).catch(error => {return});
        const executeEmbed = new EmbedBuilder()
        .setColor('Aqua');
        const nopermissionsEmbed = new EmbedBuilder()
        .setColor('Red')
        .setDescription(minik.ticket.ticketNoPermissions);
        const alreadyEmbed = new EmbedBuilder()
        .setColor('Orange');
        const data = await TicketSchema.findOne({GuildID: guild.id, ChannelID: channel.id});
        if (!data) return;
        await guild.members.cache.get(data.MemberID);
        await guild.members.cache.get(data.OwnerID);
        switch (customId) {
            case 'ticket-close':
                if ((!member.permissions.has(ManageChannels)) & (!member.roles.cache.has(docs.Handlers))) return interaction.reply({embeds: [nopermissionsEmbed], ephemeral: true}).catch(error => {return});
                const transcript = await createTranscript(channel, {
                    limit: -1,
                    returnType: 'attachment',
                    saveImages: true,
                    poweredBy: false,
                    filename: minik.ticket.ticketName + data.TicketID + '.html',
                }).catch(error => {return});
                let claimed = undefined;
                if (data.Claimed === true) {
                    claimed = '\✅'
                }
                if (data.Claimed === false) {
                    claimed = '\❌'
                }
                if (data.ClaimedBy === undefined) {
                    data.ClaimedBy = '\❌'
                }else {
                    data.ClaimedBy = '<@' + data.ClaimedBy + '>'
                }
                const transcriptTimestamp = Math.round(Date.now() / 1000)
                const transcriptEmbed = new EmbedBuilder()
                .setDescription(`${minik.ticket.ticketTranscriptMember} <@${data.OwnerID}>\n${minik.ticket.ticketTranscriptTicket} ${data.TicketID}\n${minik.ticket.ticketTranscriptClaimed} ${claimed}\n${minik.ticket.ticketTranscriptModerator} ${data.ClaimedBy}\n${minik.ticket.ticketTranscriptTime} <t:${transcriptTimestamp}:R> (<t:${transcriptTimestamp}:F>)`)
                const closingTicket = new EmbedBuilder()
                .setTitle(minik.ticket.ticketCloseTitle)
                .setDescription(minik.ticket.ticketCloseDescription)
                .setColor('Red')
                await guild.channels.cache.get(docs.Transcripts).send({
                    embeds: [transcriptEmbed],
                    files: [transcript],
                }).catch(error => {return});
                interaction.deferUpdate().catch(error => {return});
                channel.send({embeds: [closingTicket]}).catch(error => {return});
                await TicketSchema.findOneAndDelete({GuildID: guild.id, ChannelID: channel.id});
                setTimeout(() => {channel.delete().catch(error => {return});}, 5000);
            break;

            case 'ticket-lock':
                if ((!member.permissions.has(ManageChannels)) & (!member.roles.cache.has(docs.Handlers))) return interaction.reply({embeds: [nopermissionsEmbed], ephemeral: true}).catch(error => {return});
                alreadyEmbed.setDescription(minik.ticket.ticketAlreadyLocked);
                if (data.Locked == true) return interaction.reply({embeds: [alreadyEmbed], ephemeral: true}).catch(error => {return});
                await TicketSchema.updateOne({ChannelID: channel.id}, {Locked: true});
                executeEmbed.setDescription(minik.ticket.ticketSuccessLocked);
                data.MembersID.forEach((m) => {channel.permissionOverwrites.edit(m, {SendMessages: false}).catch(error => {return})})
                channel.permissionOverwrites.edit(data.OwnerID, {SendMessages: false}).catch(error => {return});
                interaction.deferUpdate().catch(error => {return});
                interaction.channel.send({embeds: [executeEmbed]}).catch(error => {return});
            break;

            case 'ticket-unlock':
                if ((!member.permissions.has(ManageChannels)) & (!member.roles.cache.has(docs.Handlers))) return interaction.reply({embeds: [nopermissionsEmbed], ephemeral: true}).catch(error => {return});
                alreadyEmbed.setDescription(minik.ticket.ticketAlreadyUnlocked);
                if (data.Locked == false) return interaction.reply({embeds: [alreadyEmbed], ephemeral: true}).catch(error => {return});
                await TicketSchema.updateOne({ChannelID: channel.id}, {Locked: false});
                executeEmbed.setDescription(minik.ticket.ticketSuccessUnlocked);
                data.MembersID.forEach((m) => {channel.permissionOverwrites.edit(m, {SendMessages: true}).catch(error => {return})});
                channel.permissionOverwrites.edit(data.OwnerID, {SendMessages: true}).catch(error => {return});
                interaction.deferUpdate().catch(error => {return});
                interaction.channel.send({embeds: [executeEmbed]}).catch(error => {return});
            break;

            case 'ticket-manage':
                if ((!member.permissions.has(ManageChannels)) & (!member.roles.cache.has(docs.Handlers))) return interaction.reply({embeds: [nopermissionsEmbed], ephemeral: true}).catch(error => {return});
                const menu = new UserSelectMenuBuilder()
                .setCustomId('ticket-manage-menu')
                .setPlaceholder(minik.ticket.ticketManageMenuEmoji + minik.ticket.ticketManageMenuTitle)
                .setMinValues(1)
                .setMaxValues(1)
                interaction.reply({components: [
                    new ActionRowBuilder()
                    .addComponents(menu)], ephemeral: true}).catch(error => {return});
            break;
                    
            case 'ticket-claim':
                if ((!member.permissions.has(ManageChannels)) & (!member.roles.cache.has(docs.Handlers))) return interaction.reply({embeds: [nopermissionsEmbed], ephemeral: true}).catch(error => {return});
                alreadyEmbed.setDescription(minik.ticket.ticketAlreadyClaim + ' <@' + data.ClaimedBy + '>.');
                if (data.Claimed == true) return interaction.reply({embeds: [alreadyEmbed], ephemeral: true}).catch(error => {return});
                await TicketSchema.updateOne({ChannelID: channel.id}, {Claimed: true, ClaimedBy: member.id});
                let lastinfos = channel;
                await channel.edit({name: minik.ticket.ticketClaimEmoji + '・' + lastinfos.name, topic: lastinfos.topic + minik.ticket.ticketDescriptionClaim + '<@' + member.id + '>.'}).catch(error => {return});
                executeEmbed.setDescription(minik.ticket.ticketSuccessClaim + ' <@' + member.id + '>.');
                interaction.deferUpdate().catch(error => {return});
                interaction.channel.send({embeds: [executeEmbed]}).catch(error => {return});
            break;
        }
    }
}
