/**
 * Handles Chat Logging.
 * 1. Internal Chat (Sheet-based) -> For Sidebar
 * 2. External Webhook -> For Notifications
 */

// --- INTERNAL CHAT (SIDEBAR) ---

function postUserMessage(text) {
  const user = Session.getActiveUser().getEmail();
  postToChatLog(text, user);
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
 * Used by Notification.gs when emails are sent.
 */
function sendWebhookNotification(text) {
  if (!CONFIG.CHAT_WEBHOOK_URL || !text) return;

  try {
    const payload = { text: text };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    UrlFetchApp.fetch(CONFIG.CHAT_WEBHOOK_URL, options);
    Logger.log("Webhook notification sent: " + text);
  } catch (e) {
    Logger.log("Webhook Failed: " + e.message);
  }
} 
