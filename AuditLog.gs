
/**
 * Audit Logging
 */
function logToAudit(changes, userEmail) {
  if (!changes || changes.length === 0) return;
  try {
    const ss = getSafeSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAMES.AUDIT_LOG);
      sheet.appendRow(CONFIG.AUDIT_LOG_HEADERS);
    }

    const rows = changes.map(c => [new Date(), userEmail, c.row, c.action, c.field, c.oldValue, c.newValue]);
    sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
  } catch (e) {
    Logger.log("Audit Error: " + e.message);
  }
} 
