/**
 * Core backend triggers and initialization.
 */
function FIX_PERMISSIONS() {
  console.log("--- STARTING PERMISSION CHECK ---");

  // 1. Force connection to External Sheets
  if (CONFIG.EXTERNAL_SHEETS && CONFIG.EXTERNAL_SHEETS.length > 0) {
    CONFIG.EXTERNAL_SHEETS.forEach(cfg => {
      try {
        const ss = SpreadsheetApp.openById(cfg.id);
        console.log(`✅ SUCCESS: Connected to '${ss.getName()}'`);
        
        const sheet = cfg.sheetName ? ss.getSheetByName(cfg.sheetName) : ss.getSheets()[0];
        if (sheet) {
          console.log(`   - Found sheet: '${sheet.getName()}' with ${sheet.getLastRow()} rows.`);
        } else {
          console.log(`   - ⚠️ Sheet '${cfg.sheetName}' not found. Using first sheet.`);
        }
      } catch (e) {
        console.error(`❌ FAILURE: Could not connect to [${cfg.label}].`);
        console.error(`   Error: ${e.message}`);
        console.error(`   Action: Ensure you have 'Viewer' or 'Editor' access to this sheet ID.`);
      }
    });
  } else {
    console.log("⚠️ No external sheets configured in Config.gs");
  }

  // 2. Force Webhook Scope
  try {
    UrlFetchApp.fetch("https://www.google.com");
    console.log("✅ Network/Webhook Scope Authorized");
  } catch(e) {
    console.log("Web hook check skipped (expected)");
  }

  console.log("--- CHECK COMPLETE ---");
}

/**
 * Core backend triggers and initialization.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('CWC Notification App')
    .addItem('Open Notification Manager', 'showWebAppSidebar')
    .addSeparator()
    .addItem('Re-Authorize Connections', 'FIX_PERMISSIONS')
    .addItem('Setup Daily Archive', 'setupDailyArchiveTrigger')
    .addToUi();
}

function showWebAppSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('WebApp_Client.html')
    .setTitle('CWC Notification Manager');
  SpreadsheetApp.getUi().showSidebar(html);
}

// DELEGATED TO RecordService.createRecord()
function addOutreachRecord() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { error: "System is busy. Please try again." };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const userEmail = Session.getActiveUser().getEmail();

    if (!sheet) throw new Error(`Sheet ${CONFIG.SHEET_NAMES.ACTIVE} not found.`);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = Utils.createHeaderMap(headers);
    const numCols = headers.length;

    const statusIdx = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    const creatorIdx = headerMap[CONFIG.COLUMNS_BY_NAME.creatorEmail];
    const tsIdx = headerMap[CONFIG.COLUMNS_BY_NAME.timestamp];
    // NEW: ID Index
    const idIdx = headerMap[CONFIG.COLUMNS_BY_NAME.id];

    const newRow = new Array(numCols).fill('');
    const nextRow = sheet.getLastRow() + 1;
    
    if (tsIdx !== undefined) {
      newRow[tsIdx] = new Date(); 
    }

    // NEW: Generate UUID
    if (idIdx !== undefined) {
      newRow[idIdx] = Utils.getUuid();
    }

    if (statusIdx !== undefined) newRow[statusIdx] = CONFIG.FLAGS.NEW_ENTRY;

    if (creatorIdx !== undefined) {
      newRow[creatorIdx] = userEmail;
    } else {
      const fuzzyIdx = headers.findIndex(h => h.toLowerCase().includes('creator') || h.toLowerCase().includes('user'));
      if (fuzzyIdx > -1) newRow[fuzzyIdx] = userEmail;
    }
    sheet.getRange(nextRow, 1, 1, numCols).setValues([newRow]);
    SpreadsheetApp.flush();
    
    // Refresh and return full data set for client update
    return {
      message: 'New record created successfully!',
      allRecords: RecordService.getActiveRecords()
    };
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
    Utils.sendErrorEmail('addOutreachRecord', error);
    return { error: error.message };
  } finally {
    lock.releaseLock();
  }
}

function onFormSubmit(e) {
  if (!e || !e.range) return;
  try {
    const sheet = e.range.getSheet();
    if (sheet.getName() !== CONFIG.SHEET_NAMES.ACTIVE) return;
    const row = e.range.getRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = Utils.createHeaderMap(headers);
    
    // 1. Send E-mail & Chat Alerts (Still uses NotificationService logic which is complex)
    // NOTE: CWCNewEntryAlert is missing, assuming it's part of a NotificationService update
    // For now, we only update the status/creator/id fields
    
    // 2. Set Status and Creator Email
    const statusCol = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    const creatorCol = headerMap[CONFIG.COLUMNS_BY_NAME.creatorEmail];
    
    // NEW: Set ID if missing (for form submissions)
    const idCol = headerMap[CONFIG.COLUMNS_BY_NAME.id];
    if (idCol !== undefined) {
       const currentId = sheet.getRange(row, idCol + 1).getValue();
       if (!currentId) sheet.getRange(row, idCol + 1).setValue(Utils.getUuid());
    }

    if (statusCol !== undefined) sheet.getRange(row, statusCol + 1).setValue(CONFIG.FLAGS.NEW_ENTRY);
    
    if (creatorCol !== undefined && e.namedValues && e.namedValues['Email Address']) {
      sheet.getRange(row, creatorCol + 1).setValue(e.namedValues['Email Address'][0]);
    }
    
  } catch (error) {
    Utils.sendErrorEmail('onFormSubmit', error);
  }
}

function setupDailyArchiveTrigger() {
  const functionName = 'Utils.archiveProcessedData';
  try {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === functionName) ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger(functionName)
      .timeBased().atHour(17).nearMinute(30).everyDays(1)
      .inTimezone(SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone())
      .create();
    SpreadsheetApp.getUi().alert('Success: Daily archive set for 5:30 PM.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error setting trigger: ' + e.message);
  }
}
