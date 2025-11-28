/**
 * CORE CHAT SERVICE (SHEET-BASED)
 * Handles reading/writing to the Chat Log sheet.
 */

const ChatService = {

  postOutreachMessage: function(text) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) throw new Error("System busy, could not save message. Try again.");

    try {
      const userEmail = Session.getActiveUser().getEmail() || "Unknown User";
      ChatService.logToChatSheet(userEmail, text);
      
      // Also send to webhook if configured
      if (CONFIG.CHAT_WEBHOOK_URL) {
         Utils.sendChatWebhookNotification(text);
      }
      
      return ChatService.getChatHistory();
    } catch (e) {
      console.error("Chat Error: " + e.message);
      throw new Error("Failed to save: " + e.message);
    } finally {
      try { lock.releaseLock(); } catch(e) {}
    }
  },

  pollChat: function() {
    return ChatService.getChatHistory();
  },

  logToChatSheet: function(sender, message) {
    if (!message) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG && CONFIG.SHEET_NAMES ? CONFIG.SHEET_NAMES.CHAT_LOG : "Chat Log";
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Timestamp', 'Sender', 'Message']);
      sheet.setColumnWidth(1, 150);
      sheet.setColumnWidth(2, 200);
      sheet.setColumnWidth(3, 400);
    }
    
    sheet.appendRow([new Date(), sender, message]);
    SpreadsheetApp.flush();
  },

  logSystemMessage: function(text) {
    ChatService.logToChatSheet('System', text);
  },

  getChatHistory: function() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetName = CONFIG && CONFIG.SHEET_NAMES ? CONFIG.SHEET_NAMES.CHAT_LOG : "Chat Log";
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet || sheet.getLastRow() < 2) return [];
      
      const lastRow = sheet.getLastRow();
      const limit = 50;
      const startRow = Math.max(2, lastRow - limit + 1);
      const numRows = lastRow - startRow + 1;
      
      const data = sheet.getRange(startRow, 1, numRows, 3).getValues();
      
      return data.map(row => ({
        time: row[0] instanceof Date ? row[0].toISOString() : String(row[0]), 
        sender: row[1],
        text: row[2]
      }));
      
    } catch (e) {
      console.error("Get History Error: " + e.message);
      return [];
    }
  }
};
