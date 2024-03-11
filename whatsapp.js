// async getGroups() {
//     let chats = await this.pupPage.evaluate(async () => {
//         return await window.WWebJS.getChats();
//     });

//     chats = chats.filter(chat => chat.isGroup);

//     return chats.map(chat => ChatFactory.create(this, chat));
// }
