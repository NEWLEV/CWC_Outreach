/**
 * CORE CHAT SERVICE (SHEET-BASED)
 * FIXED: Added global function aliases, proper logging
 */

var ChatService = {

  postOutreachMessage: function(text, clientRole = null) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) throw new Error("System busy, could not save message. Try again.");
    try {
      const userAccess = checkUserAccess();
      const userEmail = userAccess.email || "Unknown User";
      // Domain-Based Role Logic
      let userRole = (userEmail.toLowerCase().endsWith('@continentalwellnesscenter.com')) ? 'CWC' : 'PHARMACY';
      if (userEmail === "System") userRole = 'SYSTEM';

      ChatService.logToChatSheet(userEmail, text, userRole);
      // Also send to webhook if configured
      if (CONFIG.CHAT_WEBHOOK_URL) {
         Utils.sendChatWebhookNotification(text);
      }
      
      return ChatService.getChatHistory();
    } catch (e) {
      console.error("Chat Error: " + e.message);
      throw new Error("Failed to save: " + e.message);
    } finally {
      try { lock.releaseLock();
      } catch(e) {}
    }
  },

  pollChat: function() {
    return ChatService.getChatHistory();
  },

  logToChatSheet: function(sender, message, role = "") {
    if (!message) return;
    
    const ss = getSafeSpreadsheet();
    const sheetName = CONFIG && CONFIG.SHEET_NAMES ? CONFIG.SHEET_NAMES.CHAT_LOG : "Chat Log";
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Timestamp', 'Sender', 'Message', 'Role']);
      sheet.setColumnWidth(1, 150);
      sheet.setColumnWidth(2, 200);
      sheet.setColumnWidth(3, 400);
      sheet.setColumnWidth(4, 100);
    }
    
    // Ensure header has Role column if it exists but is old
    if (sheet.getLastColumn() < 4) {
      sheet.getRange(1, 4).setValue('Role');
    }
    
    sheet.appendRow([new Date(), sender, message, role]);
    SpreadsheetApp.flush();
  },

  logSystemMessage: function(text) {
    if (!text) return;
    ChatService.logToChatSheet('System', text, 'SYSTEM');
  },

  getChatHistory: function() {
    try {
      const ss = getSafeSpreadsheet();
      const sheetName = CONFIG && CONFIG.SHEET_NAMES ? CONFIG.SHEET_NAMES.CHAT_LOG : "Chat Log";
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return [];
      
      const lastRow = sheet.getLastRow();
      const limit = 50;
      const startRow = Math.max(2, lastRow - limit + 1);
      const numRows = lastRow - startRow + 1;
      const data = sheet.getRange(startRow, 1, numRows, 4).getValues();
      
      return data.map(row => ({
        time: row[0] instanceof Date ? row[0].toISOString() : String(row[0]), 
        sender: row[1],
        text: row[2],
        role: row[3] || (row[1] === 'System' ? 'SYSTEM' : 'CWC')
      }));
    } catch (e) {
      console.error("Get History Error: " + e.message);
      return null; // Return null on error so client doesn't wipe chat
    }
  }
};
// GLOBAL FUNCTION ALIASES - CRITICAL FIX
function postOutreachMessage(text, role) { return ChatService.postOutreachMessage(text, role); }
function pollChat() { return ChatService.pollChat();
}
function logToChatSheet(sender, message, role) { return ChatService.logToChatSheet(sender, message, role); }
function logSystemMessage(text) { return ChatService.logSystemMessage(text); }
function getChatHistory() { return ChatService.getChatHistory(); }
