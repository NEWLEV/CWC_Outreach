/**
 * DIAGNOSTIC TOOL FOR CWC NOTIFICATION MANAGER
 * Run these functions to identify where the notification pipeline is failing
 */

/**
 * MASTER DIAGNOSTIC - Run this first
 * Tests all components and returns a detailed report
 */
function runFullDiagnostic() {
  const report = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { passed: 0, failed: 0, warnings: 0 }
  };
  
  // Test 1: Sheet Access
  report.tests.push(testSheetAccess());
  
  // Test 2: Configuration
  report.tests.push(testConfiguration());
  
  // Test 3: Triggers
  report.tests.push(testTriggers());
  
  // Test 4: Webhook
  report.tests.push(testWebhook());
  
  // Test 5: Chat Service
  report.tests.push(testChatService());
  
  // Test 6: Record Count & Hash
  report.tests.push(testRecordDetection());
  
  // Test 7: Cache System
  report.tests.push(testCacheSystem());
  
  // Test 8: Polling Function
  report.tests.push(testPollingFunction());
  
  // Calculate summary
  report.tests.forEach(t => {
    if (t.status === 'PASS') report.summary.passed++;
    else if (t.status === 'FAIL') report.summary.failed++;
    else report.summary.warnings++;
  });
  
  // Log full report
  Logger.log("═══════════════════════════════════════════");
  Logger.log("    CWC NOTIFICATION DIAGNOSTIC REPORT     ");
  Logger.log("═══════════════════════════════════════════");
  Logger.log(`Timestamp: ${report.timestamp}`);
  Logger.log(`Results: ${report.summary.passed} PASSED, ${report.summary.failed} FAILED, ${report.summary.warnings} WARNINGS`);
  Logger.log("───────────────────────────────────────────");
  
  report.tests.forEach((test, i) => {
    const icon = test.status === 'PASS' ? '✅' : (test.status === 'FAIL' ? '❌' : '⚠️');
    Logger.log(`${icon} Test ${i + 1}: ${test.name}`);
    Logger.log(`   Status: ${test.status}`);
    Logger.log(`   Message: ${test.message}`);
    if (test.details) {
      Logger.log(`   Details: ${JSON.stringify(test.details, null, 2)}`);
    }
    Logger.log("───────────────────────────────────────────");
  });
  
  return report;
}

/**
 * Test 1: Sheet Access
 */
function testSheetAccess() {
  const result = { name: "Sheet Access", status: "PASS", message: "", details: {} };
  
  try {
    const ss = getSafeSpreadsheet();
    result.details.spreadsheetName = ss.getName();
    result.details.spreadsheetId = ss.getId();
    
    const sheets = {};
    
    // Check each required sheet
    const requiredSheets = [
      CONFIG.SHEET_NAMES.ACTIVE,
      CONFIG.SHEET_NAMES.SETTINGS,
      CONFIG.SHEET_NAMES.SECURITY,
      CONFIG.SHEET_NAMES.CHAT_LOG,
      CONFIG.SHEET_NAMES.AUDIT_LOG
    ];
    
    requiredSheets.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        sheets[name] = { exists: true, rows: sheet.getLastRow(), cols: sheet.getLastColumn() };
      } else {
        sheets[name] = { exists: false };
        result.status = "WARN";
      }
    });
    
    result.details.sheets = sheets;
    
    // Check active sheet specifically
    const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!activeSheet) {
      result.status = "FAIL";
      result.message = `Active sheet '${CONFIG.SHEET_NAMES.ACTIVE}' not found!`;
    } else {
      result.details.activeSheetRows = activeSheet.getLastRow();
      result.details.activeSheetHeaders = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0];
      result.message = `All sheets accessible. Active sheet has ${activeSheet.getLastRow() - 1} records.`;
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Error: ${e.message}`;
  }
  
  return result;
}

/**
 * Test 2: Configuration
 */
function testConfiguration() {
  const result = { name: "Configuration Check", status: "PASS", message: "", details: {} };
  
  try {
    // Check CONFIG exists
    if (typeof CONFIG === 'undefined') {
      result.status = "FAIL";
      result.message = "CONFIG is not defined!";
      return result;
    }
    
    result.details.configKeys = Object.keys(CONFIG);
    
    // Check critical config values
    const checks = {
      ADMIN_EMAIL: !!CONFIG.ADMIN_EMAIL,
      SHEET_NAMES: !!CONFIG.SHEET_NAMES,
      FLAGS: !!CONFIG.FLAGS,
      COLUMNS_BY_NAME: !!CONFIG.COLUMNS_BY_NAME,
      CHAT_WEBHOOK_URL: !!CONFIG.CHAT_WEBHOOK_URL,
      SOUND_ALERT_DATA: !!CONFIG.SOUND_ALERT_DATA
    };
    
    result.details.checks = checks;
    
    const missing = Object.keys(checks).filter(k => !checks[k]);
    if (missing.length > 0) {
      result.status = "WARN";
      result.message = `Missing config: ${missing.join(', ')}`;
    } else {
      result.message = "All configuration values present.";
    }
    
    // Check webhook URL format
    if (CONFIG.CHAT_WEBHOOK_URL) {
      result.details.webhookUrlValid = CONFIG.CHAT_WEBHOOK_URL.startsWith('https://chat.googleapis.com/');
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Error: ${e.message}`;
  }
  
  return result;
}

/**
 * Test 3: Triggers
 */
function testTriggers() {
  const result = { name: "Trigger Check", status: "PASS", message: "", details: {} };
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    result.details.totalTriggers = triggers.length;
    result.details.triggers = [];
    
    let hasFormSubmit = false;
    
    triggers.forEach(t => {
      const info = {
        function: t.getHandlerFunction(),
        type: t.getEventType().toString(),
        source: t.getTriggerSource().toString()
      };
      result.details.triggers.push(info);
      
      if (t.getHandlerFunction() === 'onFormSubmit') {
        hasFormSubmit = true;
      }
    });
    
    result.details.hasFormSubmitTrigger = hasFormSubmit;
    
    if (!hasFormSubmit) {
      result.status = "FAIL";
      result.message = "No onFormSubmit trigger found! Run setupFormSubmitTrigger() to fix.";
    } else {
      result.message = `Found ${triggers.length} triggers including onFormSubmit.`;
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Error: ${e.message}`;
  }
  
  return result;
}

/**
 * Test 4: Webhook
 */
function testWebhook() {
  const result = { name: "Webhook Test", status: "PASS", message: "", details: {} };
  
  try {
    const webhookUrl = CONFIG.CHAT_WEBHOOK_URL;
    
    if (!webhookUrl) {
      result.status = "WARN";
      result.message = "No webhook URL configured.";
      return result;
    }
    
    result.details.webhookUrl = webhookUrl.substring(0, 50) + "...";
    
    // Send test message
    const testPayload = {
      text: `🔧 *DIAGNOSTIC TEST*\n⏰ ${new Date().toISOString()}\nThis is an automated test message from CWC Notification Manager diagnostic tool.`
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseCode = response.getResponseCode();
    
    result.details.responseCode = responseCode;
    result.details.responseBody = response.getContentText().substring(0, 200);
    
    if (responseCode === 200) {
      result.message = "Webhook test message sent successfully!";
    } else {
      result.status = "FAIL";
      result.message = `Webhook returned status ${responseCode}`;
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Webhook error: ${e.message}`;
  }
  
  return result;
}

/**
 * Test 5: Chat Service
 */
function testChatService() {
  const result = { name: "Chat Service", status: "PASS", message: "", details: {} };
  
  try {
    // Check if ChatService exists
    if (typeof ChatService === 'undefined') {
      result.status = "FAIL";
      result.message = "ChatService is not defined!";
      return result;
    }
    
    result.details.functions = {
      getChatHistory: typeof ChatService.getChatHistory === 'function',
      logToChatSheet: typeof ChatService.logToChatSheet === 'function',
      logSystemMessage: typeof ChatService.logSystemMessage === 'function',
      postOutreachMessage: typeof ChatService.postOutreachMessage === 'function'
    };
    
    // Test getChatHistory
    const history = ChatService.getChatHistory();
    result.details.chatHistoryCount = history.length;
    
    if (history.length > 0) {
      result.details.lastMessage = {
        time: history[history.length - 1].time,
        sender: history[history.length - 1].sender,
        textPreview: (history[history.length - 1].text || '').substring(0, 50)
      };
    }
    
    // Test logging a system message
    const testMsg = `[DIAGNOSTIC] Test at ${new Date().toISOString()}`;
    ChatService.logSystemMessage(testMsg);
    
    // Verify it was logged
    const newHistory = ChatService.getChatHistory();
    const lastMsg = newHistory[newHistory.length - 1];
    
    if (lastMsg && lastMsg.text === testMsg) {
      result.message = `Chat service working. ${history.length} messages in history.`;
    } else {
      result.status = "WARN";
      result.message = "Chat logging may have issues - test message not found.";
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Chat service error: ${e.message}`;
  }
  
  return result;
}

/**
 * Test 6: Record Detection
 */
function testRecordDetection() {
  const result = { name: "Record Detection", status: "PASS", message: "", details: {} };
  
  try {
    const ss = getSafeSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    
    if (!sheet) {
      result.status = "FAIL";
      result.message = "Active sheet not found!";
      return result;
    }
    
    // Get actual row count
    const actualRowCount = sheet.getLastRow() - 1;
    result.details.actualRowCount = actualRowCount;
    
    // Test getDataHash
    if (typeof getDataHash === 'function') {
      const hash = getDataHash();
      result.details.dataHash = hash ? hash.substring(0, 16) + "..." : "null";
    } else {
      result.details.dataHash = "getDataHash function not found!";
      result.status = "WARN";
    }
    
    // Test getUnifiedPatientData
    if (typeof getUnifiedPatientData === 'function') {
      const data = sheet.getDataRange().getValues();
      const headerMap = createHeaderMap(data[0]);
      const records = getUnifiedPatientData(data, headerMap, false, 2);
      result.details.parsedRecordCount = records.length;
      
      if (records.length !== actualRowCount) {
        result.status = "WARN";
        result.message = `Row count mismatch: ${actualRowCount} rows but ${records.length} parsed records`;
      }
    }
    
    // Test checkForNewRecords with current count
    if (typeof checkForNewRecords === 'function') {
      const checkResult = checkForNewRecords(actualRowCount, result.details.dataHash);
      result.details.checkForNewRecords = {
        hasNew: checkResult.hasNew,
        hasUpdates: checkResult.hasUpdates,
        serverCount: checkResult.currentRecordCount
      };
    }
    
    if (result.status === "PASS") {
      result.message = `Record detection working. ${actualRowCount} records found.`;
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Record detection error: ${e.message}`;
  }
  
  return result;
}

/**
 * Test 7: Cache System
 */
function testCacheSystem() {
  const result = { name: "Cache System", status: "PASS", message: "", details: {} };
  
  try {
    const cache = CacheService.getScriptCache();
    
    // Test write
    const testKey = 'DIAGNOSTIC_TEST';
    const testValue = `test_${Date.now()}`;
    cache.put(testKey, testValue, 60);
    
    // Test read
    const readValue = cache.get(testKey);
    result.details.cacheWriteRead = readValue === testValue;
    
    // Check existing cache values
    result.details.existingCache = {
      activeRecordCount: cache.get('activeRecordCount'),
      lastUpdateTime: cache.get('lastUpdateTime'),
      externalStatus: cache.get('externalStatus') ? 'present' : 'absent',
      emailRecipients: cache.get('emailRecipients') ? 'present' : 'absent'
    };
    
    // Clean up
    cache.remove(testKey);
    
    if (!result.details.cacheWriteRead) {
      result.status = "FAIL";
      result.message = "Cache write/read test failed!";
    } else {
      result.message = "Cache system working correctly.";
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Cache error: ${e.message}`;
  }
  
  return result;
}

/**
 * Test 8: Polling Function
 */
function testPollingFunction() {
  const result = { name: "Polling Function", status: "PASS", message: "", details: {} };
  
  try {
    // Check function exists
    if (typeof checkForNewRecords !== 'function') {
      result.status = "FAIL";
      result.message = "checkForNewRecords function not found!";
      return result;
    }
    
    const ss = getSafeSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const currentCount = sheet ? sheet.getLastRow() - 1 : 0;
    const currentHash = typeof getDataHash === 'function' ? getDataHash() : '';
    
    // Test 1: No changes scenario
    const test1 = checkForNewRecords(currentCount, currentHash);
    result.details.noChangeTest = {
      hasNew: test1.hasNew,
      hasUpdates: test1.hasUpdates,
      expected: "both false"
    };
    
    // Test 2: Simulate missing records (client behind)
    const test2 = checkForNewRecords(Math.max(0, currentCount - 1), currentHash);
    result.details.newRecordTest = {
      hasNew: test2.hasNew,
      newRecordsCount: test2.newRecords ? test2.newRecords.length : 0,
      expected: currentCount > 0 ? "hasNew=true with 1 record" : "hasNew=false (no records)"
    };
    
    // Test 3: Simulate hash change (client has old hash)
    const test3 = checkForNewRecords(currentCount, 'old_hash_value');
    result.details.hashChangeTest = {
      hasUpdates: test3.hasUpdates,
      allRecordsCount: test3.allRecords ? test3.allRecords.length : 0,
      expected: "hasUpdates=true with all records"
    };
    
    // Validate results
    if (test1.hasNew || test1.hasUpdates) {
      result.status = "WARN";
      result.message = "No-change test showed changes unexpectedly.";
    } else if (currentCount > 0 && !test2.hasNew) {
      result.status = "FAIL";
      result.message = "New record detection not working!";
    } else if (!test3.hasUpdates && currentHash !== 'old_hash_value') {
      result.status = "FAIL";
      result.message = "Hash change detection not working!";
    } else {
      result.message = "Polling function working correctly.";
    }
    
  } catch (e) {
    result.status = "FAIL";
    result.message = `Polling error: ${e.message}`;
  }
  
  return result;
}

/**
 * SIMULATE NEW RECORD
 * Creates a test record and tracks what happens
 */
function simulateNewRecord() {
  Logger.log("═══════════════════════════════════════════");
  Logger.log("    SIMULATING NEW RECORD CREATION         ");
  Logger.log("═══════════════════════════════════════════");
  
  const ss = getSafeSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
  
  // Step 1: Get initial state
  const initialRowCount = sheet.getLastRow() - 1;
  const initialHash = getDataHash();
  Logger.log(`📊 Initial State: ${initialRowCount} records, hash: ${initialHash.substring(0, 8)}...`);
  
  // Step 2: Create test record
  Logger.log("📝 Creating test record...");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerMap = createHeaderMap(headers);
  const numCols = headers.length;
  
  const newRow = new Array(numCols).fill('');
  const nextRow = sheet.getLastRow() + 1;
  
  // Set basic fields
  const tsIdx = headerMap[CONFIG.COLUMNS_BY_NAME.timestamp];
  const statusIdx = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
  const nameIdx = headerMap[CONFIG.COLUMNS_BY_NAME.patientName];
  const idIdx = headerMap[CONFIG.COLUMNS_BY_NAME.id];
  
  if (tsIdx !== undefined) newRow[tsIdx] = new Date();
  if (statusIdx !== undefined) newRow[statusIdx] = CONFIG.FLAGS.NEW_ENTRY;
  if (nameIdx !== undefined) newRow[nameIdx] = `DIAGNOSTIC TEST ${Date.now()}`;
  if (idIdx !== undefined) newRow[idIdx] = Utilities.getUuid();
  
  sheet.getRange(nextRow, 1, 1, numCols).setValues([newRow]);
  SpreadsheetApp.flush();
  
  Logger.log(`✅ Test record created at row ${nextRow}`);
  
  // Step 3: Check new state
  const newRowCount = sheet.getLastRow() - 1;
  const newHash = getDataHash();
  Logger.log(`📊 New State: ${newRowCount} records, hash: ${newHash.substring(0, 8)}...`);
  
  // Step 4: Test polling detection
  Logger.log("🔍 Testing polling detection...");
  const pollResult = checkForNewRecords(initialRowCount, initialHash);
  
  Logger.log(`   hasNew: ${pollResult.hasNew}`);
  Logger.log(`   hasUpdates: ${pollResult.hasUpdates}`);
  Logger.log(`   newRecords count: ${pollResult.newRecords ? pollResult.newRecords.length : 0}`);
  Logger.log(`   currentRecordCount: ${pollResult.currentRecordCount}`);
  
  // Step 5: Test notifications
  Logger.log("📢 Testing notifications...");
  
  // Test chat logging
  try {
    ChatService.logSystemMessage(`[DIAGNOSTIC] New record simulation at ${new Date().toISOString()}`);
    Logger.log("   ✅ Chat logging works");
  } catch (e) {
    Logger.log(`   ❌ Chat logging failed: ${e.message}`);
  }
  
  // Test webhook
  try {
    if (CONFIG.CHAT_WEBHOOK_URL) {
      Utils.sendChatWebhookNotification(`🔧 DIAGNOSTIC: New record simulation test`);
      Logger.log("   ✅ Webhook sent");
    } else {
      Logger.log("   ⚠️ No webhook URL configured");
    }
  } catch (e) {
    Logger.log(`   ❌ Webhook failed: ${e.message}`);
  }
  
  // Step 6: Cleanup - delete test record
  Logger.log("🧹 Cleaning up test record...");
  sheet.deleteRow(nextRow);
  SpreadsheetApp.flush();
  Logger.log("✅ Test record deleted");
  
  // Summary
  Logger.log("═══════════════════════════════════════════");
  Logger.log("SIMULATION SUMMARY:");
  Logger.log(`   Row count changed: ${initialRowCount} → ${newRowCount} → ${sheet.getLastRow() - 1}`);
  Logger.log(`   Hash changed: ${initialHash !== newHash ? 'YES' : 'NO'}`);
  Logger.log(`   Polling detected new record: ${pollResult.hasNew ? 'YES' : 'NO'}`);
  Logger.log("═══════════════════════════════════════════");
  
  return {
    success: pollResult.hasNew,
    initialCount: initialRowCount,
    afterCreateCount: newRowCount,
    pollResult: pollResult
  };
}

/**
 * TEST FORM SUBMIT TRIGGER
 * Simulates what happens when a form is submitted
 */
function testFormSubmitFlow() {
  Logger.log("═══════════════════════════════════════════");
  Logger.log("    TESTING FORM SUBMIT FLOW               ");
  Logger.log("═══════════════════════════════════════════");
  
  const ss = getSafeSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
  
  // Create a mock event object similar to form submit
  const lastRow = sheet.getLastRow();
  const mockEvent = {
    range: sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()),
    namedValues: {
      'Email Address': ['test@example.com']
    }
  };
  
  Logger.log(`📋 Mock event created for row ${lastRow}`);
  Logger.log(`   Range: ${mockEvent.range.getA1Notation()}`);
  
  // Check if onFormSubmit function exists
  if (typeof onFormSubmit !== 'function') {
    Logger.log("❌ onFormSubmit function not found!");
    return { success: false, error: "onFormSubmit not defined" };
  }
  
  // Note: We won't actually call onFormSubmit with mock data as it could cause issues
  // Instead, we verify the function exists and check its dependencies
  
  Logger.log("✅ onFormSubmit function exists");
  
  // Check dependencies
  const dependencies = {
    createHeaderMap: typeof createHeaderMap === 'function',
    'Utils.getUuid': typeof Utils !== 'undefined' && typeof Utils.getUuid === 'function',
    'Utils.createKeyToHeaderMap': typeof Utils !== 'undefined' && typeof Utils.createKeyToHeaderMap === 'function',
    sendFormSubmitNotifications: typeof sendFormSubmitNotifications === 'function',
    updateRecordCountCache: typeof updateRecordCountCache === 'function',
    'ChatService.logSystemMessage': typeof ChatService !== 'undefined' && typeof ChatService.logSystemMessage === 'function',
    sendNotificationEmail: typeof sendNotificationEmail === 'function'
  };
  
  Logger.log("📦 Dependency check:");
  let allDepsOk = true;
  for (const [name, exists] of Object.entries(dependencies)) {
    Logger.log(`   ${exists ? '✅' : '❌'} ${name}`);
    if (!exists) allDepsOk = false;
  }
  
  if (!allDepsOk) {
    Logger.log("⚠️ Some dependencies are missing!");
  }
  
  return {
    success: allDepsOk,
    dependencies: dependencies
  };
}

/**
 * CHECK CLIENT-SERVER SYNC
 * Verifies that client and server would be in sync
 */
function checkClientServerSync() {
  Logger.log("═══════════════════════════════════════════");
  Logger.log("    CLIENT-SERVER SYNC CHECK               ");
  Logger.log("═══════════════════════════════════════════");
  
  const ss = getSafeSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
  
  // Get what server would send
  const actualRowCount = sheet.getLastRow() - 1;
  const dataHash = getDataHash();
  
  const data = sheet.getDataRange().getValues();
  const headerMap = createHeaderMap(data[0]);
  const records = getUnifiedPatientData(data, headerMap, false, 2);
  
  Logger.log("📊 Server State:");
  Logger.log(`   Actual row count (lastRow - 1): ${actualRowCount}`);
  Logger.log(`   Parsed record count: ${records.length}`);
  Logger.log(`   Data hash: ${dataHash.substring(0, 16)}...`);
  
  // Check for mismatch
  if (actualRowCount !== records.length) {
    Logger.log("⚠️ MISMATCH: Row count differs from parsed records!");
    Logger.log("   This could cause polling issues.");
    
    // Find empty rows
    let emptyRows = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i].join('').trim() === '') emptyRows++;
    }
    Logger.log(`   Empty rows found: ${emptyRows}`);
  } else {
    Logger.log("✅ Row count matches parsed records");
  }
  
  // Simulate what getInitialData returns
  Logger.log("\n📤 What getInitialData would return:");
  Logger.log(`   activeRecords.length: ${records.length}`);
  Logger.log(`   actualRowCount: ${actualRowCount}`);
  Logger.log(`   dataHash: ${dataHash.substring(0, 16)}...`);
  
  // Simulate polling with these values
  Logger.log("\n🔄 Polling simulation:");
  const poll1 = checkForNewRecords(actualRowCount, dataHash);
  Logger.log(`   Same values - hasNew: ${poll1.hasNew}, hasUpdates: ${poll1.hasUpdates}`);
  
  const poll2 = checkForNewRecords(actualRowCount - 1, dataHash);
  Logger.log(`   Count - 1 - hasNew: ${poll2.hasNew}, newRecords: ${poll2.newRecords?.length || 0}`);
  
  const poll3 = checkForNewRecords(actualRowCount, 'different_hash');
  Logger.log(`   Different hash - hasUpdates: ${poll3.hasUpdates}`);
  
  return {
    actualRowCount,
    parsedRecordCount: records.length,
    dataHash,
    synced: actualRowCount === records.length
  };
}

/**
 * QUICK FIX: Setup all necessary triggers
 */
function setupAllTriggers() {
  Logger.log("Setting up triggers...");
  
  const ss = getSafeSpreadsheet();
  
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const fn = trigger.getHandlerFunction();
    if (['onFormSubmit', 'onEdit', 'onOpen'].includes(fn)) {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`   Deleted existing ${fn} trigger`);
    }
  });
  
  // Create onFormSubmit trigger
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  Logger.log("   ✅ Created onFormSubmit trigger");
  
  // Create onOpen trigger
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(ss)
    .onOpen()
    .create();
  Logger.log("   ✅ Created onOpen trigger");
  
  Logger.log("Triggers setup complete!");
  
  return { success: true };
}

/**
 * VIEW CURRENT TRIGGERS
 */
function viewTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`Found ${triggers.length} triggers:`);
  
  triggers.forEach((t, i) => {
    Logger.log(`${i + 1}. ${t.getHandlerFunction()} - ${t.getEventType()} - ${t.getTriggerSource()}`);
  });
  
  return triggers.map(t => ({
    function: t.getHandlerFunction(),
    type: t.getEventType().toString(),
    source: t.getTriggerSource().toString()
  }));
}

/**
 * TEST EXTERNAL STATUS LOADING
 * Run this to diagnose why PRN badges aren't showing
 */
function testExternalStatus() {
  Logger.log("═══════════════════════════════════════════");
  Logger.log("    EXTERNAL STATUS DIAGNOSTIC             ");
  Logger.log("═══════════════════════════════════════════");
  
  // Step 1: Check CONFIG
  Logger.log("\n📋 Step 1: Checking CONFIG.EXTERNAL_SHEETS...");
  if (!CONFIG.EXTERNAL_SHEETS) {
    Logger.log("❌ CONFIG.EXTERNAL_SHEETS is not defined!");
    return { success: false, error: "CONFIG.EXTERNAL_SHEETS not defined" };
  }
  
  Logger.log(`✅ Found ${CONFIG.EXTERNAL_SHEETS.length} external sheets configured:`);
  CONFIG.EXTERNAL_SHEETS.forEach((conf, i) => {
    Logger.log(`   ${i + 1}. Label: "${conf.label}", Sheet: "${conf.sheetName}", ID: ${conf.id.substring(0, 20)}...`);
  });
  
  // Step 2: Clear cache to force fresh fetch
  Logger.log("\n📋 Step 2: Clearing external status cache...");
  const cache = CacheService.getScriptCache();
  const cachedBefore = cache.get('externalStatus');
  Logger.log(`   Cache before: ${cachedBefore ? 'EXISTS (' + cachedBefore.length + ' chars)' : 'EMPTY'}`);
  cache.remove('externalStatus');
  Logger.log("   ✅ Cache cleared");
  
  // Step 3: Try to access each external sheet
  Logger.log("\n📋 Step 3: Testing access to each external sheet...");
  const results = [];
  
  CONFIG.EXTERNAL_SHEETS.forEach(conf => {
    const result = {
      label: conf.label,
      sheetId: conf.id,
      sheetName: conf.sheetName,
      success: false,
      error: null,
      rowCount: 0,
      samplePRNs: []
    };
    
    try {
      Logger.log(`\n   Testing ${conf.label}...`);
      Logger.log(`   Opening spreadsheet ID: ${conf.id}`);
      
      const ss = SpreadsheetApp.openById(conf.id);
      Logger.log(`   ✅ Opened: "${ss.getName()}"`);
      
      const sheet = conf.sheetName ? ss.getSheetByName(conf.sheetName) : ss.getSheets()[0];
      if (!sheet) {
        result.error = `Sheet "${conf.sheetName}" not found in spreadsheet`;
        Logger.log(`   ❌ ${result.error}`);
        results.push(result);
        return;
      }
      
      Logger.log(`   ✅ Found sheet: "${sheet.getName()}"`);
      
      const lastRow = sheet.getLastRow();
      Logger.log(`   Rows: ${lastRow}`);
      
      if (lastRow < 2) {
        result.error = "Sheet has no data rows (only header or empty)";
        result.rowCount = 0;
        Logger.log(`   ⚠️ ${result.error}`);
        results.push(result);
        return;
      }
      
      result.rowCount = lastRow - 1;
      
      // Get sample PRNs
      const data = sheet.getRange(2, 1, Math.min(lastRow - 1, 10), 1).getDisplayValues().flat();
      result.samplePRNs = data.filter(v => v).map(v => {
        const raw = v;
        const normalized = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return { raw, normalized };
      });
      
      Logger.log(`   Sample PRNs (first 10):`);
      result.samplePRNs.forEach((prn, i) => {
        Logger.log(`      ${i + 1}. Raw: "${prn.raw}" → Normalized: "${prn.normalized}"`);
      });
      
      result.success = true;
      
    } catch (e) {
      result.error = e.message;
      Logger.log(`   ❌ ERROR: ${e.message}`);
    }
    
    results.push(result);
  });
  
  // Step 4: Call fetchExternalStatus and check result
  Logger.log("\n📋 Step 4: Calling fetchExternalStatus(true) to force refresh...");
  let statusMap = {};
  try {
    statusMap = fetchExternalStatus(true);
    const keyCount = Object.keys(statusMap).length;
    Logger.log(`   ✅ fetchExternalStatus returned ${keyCount} entries`);
    
    if (keyCount > 0) {
      Logger.log("   Sample entries:");
      Object.keys(statusMap).slice(0, 10).forEach(key => {
        Logger.log(`      "${key}": ${JSON.stringify(statusMap[key])}`);
      });
    } else {
      Logger.log("   ⚠️ No entries returned - external sheets may be empty or inaccessible");
    }
    
  } catch (e) {
    Logger.log(`   ❌ fetchExternalStatus ERROR: ${e.message}`);
  }
  
  // Step 5: Verify cache was updated
  Logger.log("\n📋 Step 5: Verifying cache was updated...");
  const cachedAfter = cache.get('externalStatus');
  Logger.log(`   Cache after: ${cachedAfter ? 'EXISTS (' + cachedAfter.length + ' chars)' : 'EMPTY'}`);
  
  // Summary
  Logger.log("\n═══════════════════════════════════════════");
  Logger.log("SUMMARY:");
  Logger.log(`   External sheets configured: ${CONFIG.EXTERNAL_SHEETS.length}`);
  Logger.log(`   Sheets accessible: ${results.filter(r => r.success).length}`);
  Logger.log(`   Total PRN entries: ${Object.keys(statusMap).length}`);
  
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    Logger.log(`   ${icon} ${r.label}: ${r.success ? r.rowCount + ' rows' : r.error}`);
  });
  Logger.log("═══════════════════════════════════════════");
  
  return {
    configuredSheets: CONFIG.EXTERNAL_SHEETS.length,
    accessibleSheets: results.filter(r => r.success).length,
    totalPRNs: Object.keys(statusMap).length,
    results: results,
    statusMap: statusMap
  };
}

/**
 * CLEAR EXTERNAL STATUS CACHE
 * Run this to force a refresh on next load
 */
function clearExternalStatusCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('externalStatus');
  Logger.log("✅ External status cache cleared. Next app load will fetch fresh data.");
  return { success: true };
}
