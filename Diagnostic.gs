/**
 * DIAGNOSTIC SERVER FUNCTIONS
 * Add these to your Apps Script project temporarily to diagnose the loading issue
 */

function testConnection() {
  return {
    status: "connected",
    timestamp: new Date().toISOString(),
    user: Session.getActiveUser().getEmail(),
    message: "Server is responding correctly"
  };
}

function testUtilities() {
  const tests = {};
  
  // Test 1: Check if Utils functions exist
  try {
    tests.createHeaderMap = typeof createHeaderMap === 'function' ? "✅ Exists" : "❌ Missing";
  } catch(e) {
    tests.createHeaderMap = "❌ Error: " + e.message;
  }
  
  // Test 2: Check if ChatService exists
  try {
    tests.ChatService = typeof ChatService !== 'undefined' ? "✅ Exists" : "❌ Missing";
  } catch(e) {
    tests.ChatService = "❌ Error: " + e.message;
  }
  
  // Test 3: Check if getChatHistory works
  try {
    if (typeof ChatService !== 'undefined' && typeof ChatService.getChatHistory === 'function') {
      const history = ChatService.getChatHistory();
      tests.getChatHistory = `✅ Works (${history.length} messages)`;
    } else {
      tests.getChatHistory = "❌ Function missing";
    }
  } catch(e) {
    tests.getChatHistory = "❌ Error: " + e.message;
  }
  
  // Test 4: Check if getDataHash exists
  try {
    if (typeof getDataHash === 'function') {
      const hash = getDataHash();
      tests.getDataHash = `✅ Works (hash: ${hash.substring(0, 8)}...)`;
    } else {
      tests.getDataHash = "❌ Function missing";
    }
  } catch(e) {
    tests.getDataHash = "❌ Error: " + e.message;
  }
  
  // Test 5: Check CONFIG
  try {
    tests.CONFIG = typeof CONFIG !== 'undefined' ? "✅ Exists" : "❌ Missing";
    if (typeof CONFIG !== 'undefined') {
      tests.CONFIG_KEYS = Object.keys(CONFIG).join(', ');
    }
  } catch(e) {
    tests.CONFIG = "❌ Error: " + e.message;
  }
  
  // Test 6: Check Spreadsheet Access
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    tests.spreadsheet = `✅ Can access (${ss.getName()})`;
  } catch(e) {
    tests.spreadsheet = "❌ Error: " + e.message;
  }
  
  // Test 7: Check Sheets
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets().map(s => s.getName());
    tests.sheets = `✅ Found ${sheets.length} sheets: ${sheets.join(', ')}`;
  } catch(e) {
    tests.sheets = "❌ Error: " + e.message;
  }
  
  return tests;
}

/**
 * MINIMAL VERSION OF getInitialData that shows exactly where it fails
 */
function getInitialDataDebug() {
  const debug = {
    steps: [],
    errors: []
  };
  
  try {
    debug.steps.push("1. Starting getInitialData");
    
    // Step 1: Check user access
    debug.steps.push("2. Checking user access");
    const access = checkUserAccess();
    debug.access = access;
    
    if (!access.allowed) {
      debug.steps.push("3. Access denied");
      return JSON.stringify({
        error: access.reason,
        debug: debug
      });
    }
    
    debug.steps.push("3. Access granted");
    
    // Step 2: Get user info
    debug.steps.push("4. Getting user info");
    const user = getUserInfo(access);
    debug.user = user;
    
    // Step 3: Get spreadsheet
    debug.steps.push("5. Getting spreadsheet");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    debug.spreadsheetName = ss.getName();
    
    // Step 4: Get settings
    debug.steps.push("6. Loading settings");
    const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
    if (!settingsSheet) {
      debug.errors.push("Settings sheet not found");
    } else {
      debug.settingsRows = settingsSheet.getLastRow();
    }
    
    // Step 5: Get active records
    debug.steps.push("7. Loading active records");
    const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!activeSheet) {
      debug.errors.push("Active sheet not found");
    } else {
      debug.activeRows = activeSheet.getLastRow();
    }
    
    // Step 6: Test ChatService
    debug.steps.push("8. Testing ChatService");
    try {
      if (typeof ChatService !== 'undefined') {
        const history = ChatService.getChatHistory();
        debug.chatMessages = history.length;
      } else {
        debug.errors.push("ChatService not defined");
      }
    } catch(e) {
      debug.errors.push("ChatService error: " + e.message);
    }
    
    // Step 7: Test getDataHash
    debug.steps.push("9. Testing getDataHash");
    try {
      const hash = getDataHash();
      debug.dataHash = hash ? hash.substring(0, 8) + "..." : "null";
    } catch(e) {
      debug.errors.push("getDataHash error: " + e.message);
    }
    
    debug.steps.push("10. Debug complete");
    
    return JSON.stringify({
      message: "Debug complete - check details",
      debug: debug,
      totalErrors: debug.errors.length
    });
    
  } catch (error) {
    debug.errors.push("FATAL: " + error.message);
    debug.stack = error.stack;
    return JSON.stringify({
      error: "Fatal error in getInitialData",
      debug: debug
    });
  }
}

/**
 * SIMPLIFIED VERSION that skips problematic functions
 */
function getInitialDataSimple() {
  try {
    const access = checkUserAccess();
    if (!access.allowed) {
      return JSON.stringify({ error: access.reason });
    }

    const user = getUserInfo(access);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Simplified response with minimal data
    const response = {
      error: null,
      user: user,
      activeRecords: [],
      archivedRecords: [],
      chatHistory: [],
      config: {
        flags: CONFIG.FLAGS,
        dropdowns: {},
        soundAlertData: CONFIG.SOUND_ALERT_DATA
      },
      externalStatus: {},
      analytics: {},
      dataHash: ''
    };
    
    // Try to get active records
    try {
      const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
      if (activeSheet && activeSheet.getLastRow() > 1) {
        const data = activeSheet.getDataRange().getValues();
        const headerMap = createHeaderMap(data[0]);
        response.activeRecords = getUnifiedPatientData(data, headerMap, false, 2);
      }
    } catch(e) {
      Logger.log("Active records error: " + e.message);
    }
    
    // Try to get dropdowns
    try {
      const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
      if (settingsSheet) {
        response.config.dropdowns = {
          pharmacy: getColData(settingsSheet, 'C'),
          provider: getColData(settingsSheet, 'D'),
          medication: getColData(settingsSheet, 'E'),
          status: getColData(settingsSheet, 'F'),
          insurance: getColData(settingsSheet, 'G'),
          needsScript: getColData(settingsSheet, 'H'),
          sex: getColData(settingsSheet, 'I')
        };
      }
    } catch(e) {
      Logger.log("Dropdowns error: " + e.message);
    }
    
    return JSON.stringify(response);
    
  } catch (error) {
    return JSON.stringify({
      error: "Server error: " + error.message,
      stack: error.stack
    });
  }
}
