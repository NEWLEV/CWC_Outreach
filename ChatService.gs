/**
 * CORE CHAT SERVICE (SHEET-BASED) - ROBUST VERSION
 * Updated: Uses getValues() to return proper timestamps (Date objects -> ISO Strings)
 */

function postOutreachMessage(text) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("System busy, could not save message. Try again.");

  try {
    const userEmail = Session.getActiveUser().getEmail() || "Unknown User";
    logToChatSheet(userEmail, text);
    lock.releaseLock();
    return getChatHistory();
  } catch (e) {
    console.error("Chat Error: " + e.message);
    throw new Error("Failed to save: " + e.message);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function pollChat() {
  return getChatHistory();
}

function logToChatSheet(sender, message) {
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
}

function logSystemMessage(text) {
  logToChatSheet('System', text);
}

function getChatHistory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG && CONFIG.SHEET_NAMES ? CONFIG.SHEET_NAMES.CHAT_LOG : "Chat Log";
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet || sheet.getLastRow() < 2) return [];
    
    const lastRow = sheet.getLastRow();
    const limit = 50;
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;
    
    // Use getValues() to get Date objects
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
