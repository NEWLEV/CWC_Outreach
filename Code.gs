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
    .addItem('📦 Archive Completed Records', 'archiveRecords')
    .addItem('⚙️ Setup Auto-Archive (6 PM)', 'setupArchiveTrigger')
    .addItem('🚫 Disable Auto-Archive', 'removeArchiveTrigger')
    .addSeparator()
    .addItem('Re-Authorize Connections', 'FIX_PERMISSIONS')
    .addItem('Setup Daily Archive', 'setupDailyArchiveTrigger')
    .addItem('Setup Real-Time Updates', 'setupOnChangeTrigger')
    .addSeparator()
    .addItem('⚠️ Reset Audit Log', 'clearAuditLog')
    .addToUi();
}

function showWebAppSidebar() {
  // Use createTemplateFromFile to enable <?!= include('filename') ?> syntax
  // Now loads from the modular WebApp_Client which assembles CSS, HTML, and JS from separate files
  const template = HtmlService.createTemplateFromFile('WebApp_Client_Modular');
  const html = template.evaluate().setTitle('CWC Notification Manager');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Include helper for modular HTML templates
 * Usage in HTML: <?!= include('CSS_Styles') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// DELEGATED TO RecordService.createRecord()
function addOutreachRecord() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { error: "System is busy. Please try again." };
  }

  try {
    const ss = getSafeSpreadsheet();
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
    updateGlobalTimestamp(); // Trigger polling for all clients

    // Refresh and return full data set for client update
    return {
      message: 'New record created successfully!',
      allRecords: RecordService.getActiveRecords(),
      newRecordRow: nextRow  // Return the row number of the newly created record
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
  
  // Delegate to WebApp_Server for unified processing & notifications
  // This fixes the "Delayed Notification" issue by processing immediately
  processFormSubmission(e);
}

function setupDailyArchiveTrigger() {
  const functionName = 'Utils.archiveProcessedData';
  try {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === functionName) ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger(functionName)
      .timeBased().atHour(17).nearMinute(30).everyDays(1)
      .inTimezone(getSafeSpreadsheet().getSpreadsheetTimeZone())
      .create();
    SpreadsheetApp.getUi().alert('Success: Daily archive set for 5:30 PM.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error setting trigger: ' + e.message);
  }
}

/**
 * Setup installable onChange trigger for real-time updates
 */
function setupOnChangeTrigger() {
  try {
    // Remove existing onChange triggers
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getEventType() === ScriptApp.EventType.ON_CHANGE) {
        ScriptApp.deleteTrigger(t);
      }
    });
    
    // Create new onChange trigger
    ScriptApp.newTrigger('onSheetEdit')
      .forSpreadsheet(getSafeSpreadsheet())
      .onChange()
      .create();
    
    SpreadsheetApp.getUi().alert('✅ Real-time update trigger installed successfully!');
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Error setting up trigger: ' + e.message);
  }
}

/**
 * Trigger handler for sheet changes - updates timestamp for client polling
 */
function onSheetEdit(e) {
  try {
    // Update global timestamp to signal clients
    PropertiesService.getScriptProperties().setProperty('LAST_UPDATE', Date.now().toString());
    Logger.log('Sheet edited - timestamp updated: ' + Date.now());
  } catch (error) {
    Logger.log('onSheetEdit error: ' + error.message);
  }
}
