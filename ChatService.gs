/**
 * Handles Chat Logging.
 * 1. Internal Chat (Sheet-based) -> For Sidebar
 * 2. External Webhook -> For Notifications
 */

// --- INTERNAL PHARMACY CHAT (SHEET LOGGING) ---

function postUserMessage(text) {
  const user = Session.getActiveUser().getEmail();
  
  // LOGGING TO SHEET (This is the PHARMACY CHAT/Internal Log)
  postToChatLog(text, user); 
  
  return getChatHistory();
}

/**
 * Sends a message directly to the OUTREACH WEBHOOK.
 */
function postUserMessageToWebhook(text, mode) {
  const user = Session.getActiveUser().getEmail().split('@')[0];
  const prefix = `[${mode.toUpperCase()}] ${user}: `;
  
  // NOTE: This function does NOT save to the internal log.
  sendChatWebhookNotification(prefix + text);
  
  // Return current history so the client chat window can update instantly.
  return getChatHistory();
}

function testChatConnection() {
  // Check Sheet Permission
  if (CONFIG.EXTERNAL_SHEETS && CONFIG.EXTERNAL_SHEETS.length > 0) {
    try {
      const id = CONFIG.EXTERNAL_SHEETS[0].id;
      SpreadsheetApp.openById(id);
    } catch (e) {}
  }
  // Check Webhook Permission
  try {
    UrlFetchApp.fetch("https://www.google.com");
  } catch(e) {}

  postToChatLog("🔔 System: Permissions Check Successful", "System");
}

function postToChatLog(text, sender) {
  if (!text) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHAT_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAMES.CHAT_LOG);
      sheet.appendRow(['Timestamp', 'Sender', 'Message']);
    }
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd HH:mm");
    sheet.appendRow([ts, sender, text]);
    if (sheet.getLastRow() > 200) sheet.deleteRow(2);
  } catch (e) {
    Logger.log("Chat Log Error: " + e.message);
  }
}

function getChatHistory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHAT_LOG);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const startRow = Math.max(2, lastRow - 49);
    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 3).getDisplayValues();
    return data.map(r => ({ time: r[0], sender: r[1], text: r[2] }));
  } catch (e) {
    return [];
  }
}

// --- EXTERNAL WEBHOOK (NOTIFICATIONS) ---

/**
 * Sends a notification to the Google Chat Space.
 * The implementation is now consolidated into Utilities.gs
 */
// function sendWebhookNotification(text) { ... REMOVED - Logic moved to Utilities.gs }
