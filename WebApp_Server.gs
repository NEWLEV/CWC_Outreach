/**
 * Server-side backend for Web App interactions.
 */
function doGet() {
  const check = checkUserAccess();

  if (!check.allowed) {
    const template = HtmlService.createTemplateFromFile('AccessDenied.html');
    template.userEmail = check.email || "Unknown (Hidden)";
    template.reason = check.reason;
    template.CONFIG = CONFIG;
    template.appUrl = ScriptApp.getService().getUrl(); 
    
    return template.evaluate()
      .setTitle('Access Denied')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile('WebApp_Client.html')
    .setTitle('CWC Notification Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle POST requests from Google Chat
 * This is called when the bot receives messages in Google Chat
 */
function doPost(e) {
  try {
    // Parse the incoming event from Google Chat
    const event = JSON.parse(e.postData.contents);
    Logger.log('Received Google Chat event: ' + JSON.stringify(event));
    
    // Route to appropriate handler based on event type
    switch(event.type) {
      case 'MESSAGE':
        return ContentService.createTextOutput(
          JSON.stringify(onMessage(event))
        ).setMimeType(ContentService.MimeType.JSON);
        
      case 'ADDED_TO_SPACE':
        return ContentService.createTextOutput(
          JSON.stringify(onAddToSpace(event))
        ).setMimeType(ContentService.MimeType.JSON);
        
      case 'REMOVED_FROM_SPACE':
        onRemoveFromSpace(event);
        return ContentService.createTextOutput(JSON.stringify({}));
        
      case 'CARD_CLICKED':
        return ContentService.createTextOutput(
          JSON.stringify(onCardClick(event))
        ).setMimeType(ContentService.MimeType.JSON);
        
      default:
        Logger.log('Unknown event type: ' + event.type);
        return ContentService.createTextOutput(JSON.stringify({
          text: 'Event received'
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.message + '\n' + error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      text: '❌ Error processing request: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function checkUserAccess() {
  try {
    const email = Session.getActiveUser().getEmail().toLowerCase();

    // 1. Identity Check
    if (!email) {
      return { allowed: false, email: "Unknown", reason: "Google is hiding your identity. Ensure 'executeAs' is set to 'USER_ACCESSING' and you are logged in." };
    }
  
    // 2. Admin Override (Hardcoded in Config)
    if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) {
      return { allowed: true, email: email, role: 'ADMIN' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 3. Security Sheet Check
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SECURITY);
    if (!sheet) {
      // Fallback to Settings if Security sheet hasn't been created yet
      return { allowed: false, email: email, reason: "Critical: 'Security' sheet not found." };
    }
    
    if (sheet.getLastRow() < 2) {
      return { allowed: false, email: email, reason: "Security sheet is empty." };
    }

    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headerRow);
    
    // Robust column finding
    const EMAIL_IDX = headerMap['Email'] ?? headerMap['email']; 
    const ROLE_IDX = headerMap['Role'] ?? headerMap['role']; 
    const ACTIVE_IDX = headerMap['Active'] ?? headerMap['active'];

    if (EMAIL_IDX === undefined || ROLE_IDX === undefined || ACTIVE_IDX === undefined) {
      return { allowed: false, email: email, reason: "Security sheet missing required columns: Email, Role, Active." };
    }
    
    // Efficiently fetch data
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    // 4. Match User
    const userMatches = data.filter(row => String(row[EMAIL_IDX]).trim().toLowerCase() === email);

    if (userMatches.length === 0) {
      return { allowed: false, email: email, reason: "User not authorized in Security sheet." };
    }

    // 5. Check Active Status
    const activeMatch = userMatches.find(row => {
      const val = row[ACTIVE_IDX];
      if (val === true) return true; 
      const sVal = String(val).trim().toLowerCase();
      return sVal === 'true' || sVal === 'yes' || sVal === 'active';
    });

    if (!activeMatch) {
      return { allowed: false, email: email, reason: "Account is deactivated." };
    }

    return { allowed: true, email: email, role: activeMatch[ROLE_IDX] };

  } catch (e) {
    Logger.log("Access Check Critical Error: " + e.message);
    return { allowed: false, email: "System Error", reason: "Error: " + e.message };
  }
}

function getInitialData() {
  let response = {
    error: null,
    user: null,
    activeRecords: [],
    archivedRecords: [],
    dataHash: "",
    chatHistory: [],
    externalStatus: {},
    diagnostics: [],
    analytics: {},
    recentActivities: [],
    config: { flags: CONFIG.FLAGS, columns: CONFIG.COLUMNS_BY_NAME, roles: CONFIG.ROLES, dropdowns: {} }
  };

  try {
    const access = checkUserAccess();
    if (!access.allowed) {
      response.error = "Access Denied: " + access.reason;
      return JSON.stringify(response);
    }

    response.user = getUserInfo();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. DROPDOWNS (From Settings)
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
    } catch(e) { response.diagnostics.push("Dropdowns error: " + e.message); }

    // 2. ACTIVE RECORDS
    try {
      const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
      if (activeSheet && activeSheet.getLastRow() > 1) {
        const lastCol = activeSheet.getLastColumn();
        const headers = activeSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
        const headerMap = createHeaderMap(headers);
        const data = activeSheet.getRange(1, 1, activeSheet.getLastRow(), lastCol).getDisplayValues();
        response.activeRecords = getUnifiedPatientData(data, headerMap, false, 2);
        response.dataHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(response.activeRecords)));
      }
    } catch(e) { response.diagnostics.push("Active Records error: " + e.message); }

    // 3. ARCHIVED RECORDS
    try {
      const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
      if (archiveSheet && archiveSheet.getLastRow() > 1) {
        const lastCol = archiveSheet.getLastColumn();
        const headers = archiveSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
        const headerMap = createHeaderMap(headers);
        const data = archiveSheet.getRange(1, 1, archiveSheet.getLastRow(), lastCol).getDisplayValues();
        response.archivedRecords = getUnifiedPatientData(data, headerMap, true, 2);
      }
    } catch(e) { response.diagnostics.push("Archives error: " + e.message); }

    // 4. ANALYTICS
    try { response.analytics = getAnalytics(); } catch(e) {}

    // 5. EXTERNAL STATUS
    try {
      const extStatus = fetchExternalStatus(false);
      response.externalStatus = extStatus.map || {};
      if(extStatus.diagnostics) response.diagnostics.push(...extStatus.diagnostics);
    } catch(e) {}

    // 6. CHAT & ACTIVITIES
    try { response.chatHistory = getChatHistory(); } catch(e) {}
    try { response.recentActivities = getRecentActivities(); } catch(e) {}

  } catch (error) {
    Logger.log("Critical Failure in getInitialData: " + error.stack);
    response.error = `System Failure: ${error.message}`;
  }

  return JSON.stringify(response);
}

function fetchExternalStatus(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cachedData = cache.get("EXTERNAL_STATUS_MAP");
    if (cachedData) return { map: JSON.parse(cachedData), diagnostics: [] };
  }

  const statusMap = {};
  const diagnostics = [];
  
  if (!CONFIG.EXTERNAL_SHEETS) return { map: {}, diagnostics: [] };

  CONFIG.EXTERNAL_SHEETS.forEach(cfg => {
    try {
      if (!cfg.id) return;
      const ss = SpreadsheetApp.openById(cfg.id);
      let targetSheet = cfg.sheetName ? ss.getSheetByName(cfg.sheetName) : ss.getSheets()[0];
      
      if (!targetSheet || targetSheet.getLastRow() < 1) return;

      const data = targetSheet.getRange(1, 1, targetSheet.getLastRow(), 1).getDisplayValues();
      
      for (let i = 0; i < data.length; i++) {
        const prn = String(data[i][0]).toUpperCase().replace(/\s+/g, '');
        if (prn && prn.length > 1 && prn !== "PRN") {
          if (!statusMap[prn]) statusMap[prn] = [];
          if (!statusMap[prn].includes(cfg.label)) statusMap[prn].push(cfg.label);
        }
      }
    } catch (e) {
      diagnostics.push(`Connection Error [${cfg.label}]: ${e.message}`);
    }
  });

  try { cache.put("EXTERNAL_STATUS_MAP", JSON.stringify(statusMap), 600); } catch(e) {}
  return { map: statusMap, diagnostics: diagnostics };
}

function getColData(sheet, colLetter) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(`${colLetter}2:${colLetter}${lastRow}`).getDisplayValues().flat().filter(String);
  } catch(e) { return []; }
}

function getUserInfo() {
  const access = checkUserAccess();
  let email = Session.getActiveUser().getEmail().toLowerCase();
  
  let roles = [];
  if (access.allowed) {
    const role = String(access.role).toUpperCase().trim();
    if (role === 'BOTH' || role === 'ADMIN') roles = [CONFIG.ROLES.CWC, CONFIG.ROLES.PHARMACY];
    else roles.push(role);
  } else {
     // Fallback for admin if somehow access failed but they are admin
     if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) {
       roles = [CONFIG.ROLES.CWC, CONFIG.ROLES.PHARMACY];
     } else {
       roles.push(CONFIG.ROLES.CWC);
     }
  }
  Logger.log(`User Info - Email: ${email}, Roles: ${roles.join(',')}`);
  return { email: email, defaultRole: roles[0], roles: [...new Set(roles)] };
}

function getChatHistory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHAT_LOG);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const data = sheet.getRange(Math.max(2, sheet.getLastRow()-49), 1, Math.min(50, sheet.getLastRow()-1), 3).getDisplayValues();
    return data.map(r => ({ time: r[0], sender: r[1], text: r[2] }));
  } catch (e) { return []; }
}

function pollChat() { return getChatHistory(); }

function checkForUpdates(clientHash) { return { hasUpdate: false }; }

function checkForUpdatesEnhanced(clientHash) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!sheet || sheet.getLastRow() <= 1) return { hasUpdate: false, activeRecords: [] };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);
    const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getDisplayValues();
    const activeRecords = getUnifiedPatientData(data, headerMap, false, 2);
    const currentHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(activeRecords)));

    if (currentHash !== clientHash) {
      const clientIds = new Set(JSON.parse(clientHash || "[]").map(r => r.rowNum));
      return { 
        hasUpdate: true, 
        activeRecords: activeRecords, 
        dataHash: currentHash,
        newRecords: activeRecords.filter(r => !clientIds.has(r.rowNum)),
        updatedRecords: activeRecords.filter(r => clientIds.has(r.rowNum))
      };
    }
    return { hasUpdate: false };
  } catch(e) { return { hasUpdate: false }; }
}

function getPDFDownloadUrl() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=pdf&size=letter`;
    return { url: url, fileName: "CWC_List.pdf" };
  } catch (e) { return { error: e.message }; }
}

function getFullArchivedRecord(rowNum) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    if (!sheet || rowNum > sheet.getLastRow()) throw new Error("Record not found");
    const header = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(header);
    const data = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getDisplayValues();
    return { record: getUnifiedPatientData([header, ...data], headerMap, false, rowNum)[0] };
  } catch (e) { return { error: e.message }; }
}

// WRITES
function saveRecordChanges(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Save'); }
function submitToPharmacy(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Submit to Pharmacy'); }
function sendOutreachUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Outreach Update'); }
function submitPharmacyUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Pharmacy Update'); }

function processUpdate(rowNum, updatedFields, action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { error: "System busy. Try again." };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const map = createHeaderMap(headers);
    const user = Session.getActiveUser().getEmail();
    
    if (rowNum > sheet.getLastRow()) throw new Error("Row does not exist");

    const oldVals = sheet.getRange(rowNum, 1, 1, headers.length).getDisplayValues()[0];
    const original = getUnifiedPatientData([headers, oldVals], map, false, rowNum)[0];
    const changes = getAuditChanges(original, updatedFields, rowNum, action);

    const range = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = range.getDisplayValues()[0];
    
    // Apply updates
    changes.forEach(c => {
      let colIdx = map[c.field] ?? map[c.field.toLowerCase()];
      if (colIdx !== undefined) values[colIdx] = c.newValue;
    });

    // Set Metadata
    const findIdx = (name) => map[name] ?? map[name.toLowerCase()];
    
    if (action === 'Submit to Pharmacy') {
      const sIdx = findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus);
      const tIdx = findIdx(CONFIG.COLUMNS_BY_NAME.sentTimestamp);
      if(sIdx !== undefined) values[sIdx] = CONFIG.FLAGS.SUBMITTED_TO_PHARMACY;
      if(tIdx !== undefined) values[tIdx] = new Date(); 
    } else if (action === 'Outreach Update') {
      const sIdx = findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus);
      if(sIdx !== undefined) values[sIdx] = CONFIG.FLAGS.CWC_UPDATE_SENT;
    } else if (action === 'Pharmacy Update') {
      const sIdx = findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus);
      if(sIdx !== undefined) values[sIdx] = CONFIG.FLAGS.PHARMACY_UPDATE;
    }
    
    range.setValues([values]);
    SpreadsheetApp.flush();

    // Fetch updated record for notification
    const newVals = sheet.getRange(rowNum, 1, 1, headers.length).getDisplayValues()[0];
    const updatedRecord = getUnifiedPatientData([headers, newVals], map, false, rowNum)[0];

    // NOTIFICATIONS
    if (changes.length > 0 || action === 'Submit to Pharmacy' || action === 'Pharmacy Update') {
      
      if(original.workflowStatus !== updatedRecord.workflowStatus) {
        changes.push({row:rowNum, action:action, field:'Status', oldValue:original.workflowStatus, newValue: updatedRecord.workflowStatus});
      }
      
      logToAudit(changes, user);
      
      try {
        const recipients = getRecipients();
        let targetEmails = [];
        
        if (action === 'Submit to Pharmacy' || action === 'Pharmacy Update') {
          targetEmails = [...recipients.pharmacy, ...recipients.outreach];
        } else if (action === 'Outreach Update') {
          targetEmails = recipients.outreach;
        }
        
        sendNotificationEmail(targetEmails, updatedRecord, action, changes);
        
        // Also send rich card to Google Chat
        const priority = NotificationEngine.calculatePriority(updatedRecord, action);
        sendRichNotificationCard(action, updatedRecord, action, priority);
        
      } catch(e) { Logger.log("Notification failed: " + e.message); }
    }
    
    // Return fresh data
    const allData = sheet.getDataRange().getDisplayValues();
    const allRecords = getUnifiedPatientData(allData, map, false, 2);
    const newDataHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(allRecords)));

    return {
      message: 'Update successful',
      updatedRecord: updatedRecord,
      dataHash: newDataHash,
      allRecords: allRecords,
      chatHistory: getChatHistory()
    };
  } catch (e) { return { error: e.message }; } 
  finally { lock.releaseLock(); }
}

function getRecentActivities() { return []; }
function getAnalytics() { return {}; }
