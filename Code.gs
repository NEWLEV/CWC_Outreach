/**
 * !!! CRITICAL: RUN THIS FUNCTION TO AUTHORIZE EXTERNAL SHEETS !!!
 * 1. Select 'FIX_PERMISSIONS' from the dropdown menu above.
 * 2. Click 'Run'.
 * 3. You may see a "Authorization Required" popup. Click "Review Permissions".
 * 4. Allow the script to access your spreadsheets.
 */
function FIX_PERMISSIONS() {
  console.log("--- STARTING PERMISSION CHECK ---");

  // 1. Force connection to External Sheets
  if (CONFIG.EXTERNAL_SHEETS && CONFIG.EXTERNAL_SHEETS.length > 0) {
    CONFIG.EXTERNAL_SHEETS.forEach(cfg => {
      try {
        console.log(`Attempting to connect to [${cfg.label}]...`);
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
    const headerMap = createHeaderMap(headers);
    const numCols = headers.length;

    const statusIdx = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    const creatorIdx = headerMap[CONFIG.COLUMNS_BY_NAME.creatorEmail];
    const tsIdx = headerMap[CONFIG.COLUMNS_BY_NAME.timestamp];

    const newRow = new Array(numCols).fill('');
    const nextRow = sheet.getLastRow() + 1;
    
    if (tsIdx !== undefined) {
      // Store as native Date object
      newRow[tsIdx] = new Date(); 
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
    
    const newRecordValues = sheet.getRange(nextRow, 1, 1, numCols).getDisplayValues();
    const newRecord = getUnifiedPatientData([headers, newRecordValues[0]], headerMap, false, nextRow)[0];

    const allData = sheet.getDataRange().getDisplayValues();
    const allRecords = getUnifiedPatientData(allData, headerMap, false, 2);
    const dataHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(allRecords)));
    
    logToAudit([
      { row: nextRow, action: 'Create', field: 'Record', oldValue: 'New', newValue: 'Created' }
    ], userEmail);
    
    // Force refresh external status on new record
    const extStatus = fetchExternalStatus(true);

    return {
      message: 'New record created successfully!',
      updatedRecord: newRecord,
      dataHash: dataHash,
      allRecords: allRecords,
      externalStatus: extStatus.map
    };
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
    sendErrorEmail('addOutreachRecord', error);
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
    const headerMap = createHeaderMap(headers);
    sendCWCNewEntryAlert(e.range, headers, headerMap);
    const statusCol = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    const creatorCol = headerMap[CONFIG.COLUMNS_BY_NAME.creatorEmail];
    
    if (statusCol !== undefined) sheet.getRange(row, statusCol + 1).setValue(CONFIG.FLAGS.NEW_ENTRY);
    
    if (creatorCol !== undefined && e.namedValues && e.namedValues['Email Address']) {
      sheet.getRange(row, creatorCol + 1).setValue(e.namedValues['Email Address'][0]);
    }
    
  } catch (error) {
    sendErrorEmail('onFormSubmit', error);
  }
}

function setupDailyArchiveTrigger() {
  const functionName = 'archiveProcessedData';
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
