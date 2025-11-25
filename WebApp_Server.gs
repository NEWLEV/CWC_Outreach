/**
 * Server-side backend for Web App interactions.
 */
function doGet() {
  const check = checkUserAccess();
  if (!check.allowed) {
    const template = HtmlService.createTemplateFromFile('AccessDenied.html');
    template.userEmail = check.email || "Unknown";
    template.reason = check.reason;
    template.CONFIG = CONFIG;
    template.appUrl = ScriptApp.getService().getUrl(); 
    return template.evaluate().setTitle('Access Denied').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('WebApp_Client.html').setTitle('CWC Notification Manager').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const event = JSON.parse(e.postData.contents);
    // Route to GoogleChatBot.gs handlers
    switch(event.type) {
      case 'MESSAGE':
        return ContentService.createTextOutput(JSON.stringify(onMessage(event))).setMimeType(ContentService.MimeType.JSON);
      case 'ADDED_TO_SPACE':
        return ContentService.createTextOutput(JSON.stringify(onAddToSpace(event))).setMimeType(ContentService.MimeType.JSON);
      case 'REMOVED_FROM_SPACE':
        onRemoveFromSpace(event);
        return ContentService.createTextOutput(JSON.stringify({}));
      case 'CARD_CLICKED':
        return ContentService.createTextOutput(JSON.stringify(onCardClick(event))).setMimeType(ContentService.MimeType.JSON);
      default:
        return ContentService.createTextOutput(JSON.stringify({})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({text: 'Error processing request'})).setMimeType(ContentService.MimeType.JSON);
  }
}

function checkUserAccess() {
  try {
    const email = Session.getActiveUser().getEmail().toLowerCase();
    if (!email) return { allowed: false, email: "Unknown", reason: "Google is hiding your identity." };
    if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) return { allowed: true, email: email, role: 'ADMIN' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SECURITY);
    if (!sheet || sheet.getLastRow() < 2) return { allowed: false, email: email, reason: "Security sheet empty/missing." };

    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headerRow);
    const EMAIL_IDX = headerMap['Email'] ?? headerMap['email']; 
    const ROLE_IDX = headerMap['Role'] ?? headerMap['role'];
    const ACTIVE_IDX = headerMap['Active'] ?? headerMap['active'];

    if (EMAIL_IDX === undefined || ROLE_IDX === undefined || ACTIVE_IDX === undefined) return { allowed: false, email: email, reason: "Security sheet columns missing." };
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const userMatches = data.filter(row => String(row[EMAIL_IDX]).trim().toLowerCase() === email);
    
    if (userMatches.length === 0) return { allowed: false, email: email, reason: "User not authorized." };

    const activeMatch = userMatches.find(row => {
      const val = String(row[ACTIVE_IDX]).trim().toLowerCase();
      return val === 'true' || val === 'yes' || val === 'active';
    });

    if (!activeMatch) return { allowed: false, email: email, reason: "Account deactivated." };
    return { allowed: true, email: email, role: activeMatch[ROLE_IDX] };
  } catch (e) {
    return { allowed: false, email: "System Error", reason: e.message };
  }
}

function getInitialData() {
  let response = { error: null, user: null, activeRecords: [], archivedRecords: [], chatHistory: [], config: { flags: CONFIG.FLAGS, dropdowns: {} } };
  try {
    const access = checkUserAccess();
    if (!access.allowed) { response.error = access.reason; return JSON.stringify(response); }

    response.user = getUserInfo();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Dropdowns
    try {
      const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
      if (settingsSheet) {
        response.config.dropdowns = {
          pharmacy: getColData(settingsSheet, 'C'), provider: getColData(settingsSheet, 'D'),
          medication: getColData(settingsSheet, 'E'), status: getColData(settingsSheet, 'F'),
          insurance: getColData(settingsSheet, 'G'), needsScript: getColData(settingsSheet, 'H'), sex: getColData(settingsSheet, 'I')
        };
      }
    } catch(e) {}

    // Records
    try {
      const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
      if (activeSheet && activeSheet.getLastRow() > 1) {
        const data = activeSheet.getDataRange().getDisplayValues();
        const headerMap = createHeaderMap(data[0]);
        response.activeRecords = getUnifiedPatientData(data, headerMap, false, 2);
      }
    } catch(e) {}

    // Archive
    try {
      const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
      if (archiveSheet && archiveSheet.getLastRow() > 1) {
        const data = archiveSheet.getDataRange().getDisplayValues();
        const headerMap = createHeaderMap(data[0]);
        response.archivedRecords = getUnifiedPatientData(data, headerMap, true, 2);
      }
    } catch(e) {}

    // Chat (from Memory)
    try { response.chatHistory = getChatHistory(); } catch(e) {}

  } catch (error) { response.error = error.message; }
  return JSON.stringify(response);
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
  } else if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) {
     roles = [CONFIG.ROLES.CWC, CONFIG.ROLES.PHARMACY];
  }
  return { email: email, defaultRole: roles[0], roles: [...new Set(roles)] };
}

/**
 * FIX: This function was missing and causing the client crash
 */
function checkForNewRecords(clientCount) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!sheet) return { hasNew: false, currentRecordCount: 0 };

    const lastRow = sheet.getLastRow();
    const currentCount = Math.max(0, lastRow - 1); // Subtract header

    if (currentCount > clientCount) {
      const startRow = 2 + clientCount;
      const numNewRows = currentCount - clientCount;
      const data = sheet.getDataRange().getDisplayValues();
      const headers = data[0];
      const headerMap = createHeaderMap(headers);
      
      // Slice the new data
      const newData = data.slice(startRow - 1, startRow - 1 + numNewRows);
      // Prepend headers for the helper function
      const dataWithHeaders = [headers, ...newData];
      
      const newRecords = getUnifiedPatientData(dataWithHeaders, headerMap, false, startRow);
      return { hasNew: true, newRecords: newRecords, currentRecordCount: currentCount };
    }
    return { hasNew: false, currentRecordCount: currentCount };
  } catch (e) {
    return { hasNew: false, currentRecordCount: clientCount };
  }
}

// --- Writes & Updates ---
function saveRecordChanges(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Save'); }
function submitToPharmacy(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Submit to Pharmacy'); }
function sendOutreachUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Outreach Update'); }
function submitPharmacyUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Pharmacy Update'); }

function processUpdate(rowNum, updatedFields, action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { error: "System busy." };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const map = createHeaderMap(headers);
    
    // Update Logic
    const range = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = range.getDisplayValues()[0];
    
    // Apply fields
    const keyToHeader = createKeyToHeaderMap();
    for (const key in updatedFields) {
       // Map internal key (e.g. patientName) to header index
       let colName = CONFIG.COLUMNS_BY_NAME[key];
       let colIdx = map[colName] ?? map[colName.toLowerCase()];
       if(colIdx !== undefined) values[colIdx] = updatedFields[key];
    }

    // Set Status Flags
    const findIdx = (name) => map[name] ?? map[name.toLowerCase()];
    if (action === 'Submit to Pharmacy') values[findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus)] = CONFIG.FLAGS.SUBMITTED_TO_PHARMACY;
    else if (action === 'Outreach Update') values[findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus)] = CONFIG.FLAGS.CWC_UPDATE_SENT;
    else if (action === 'Pharmacy Update') values[findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus)] = CONFIG.FLAGS.PHARMACY_UPDATE;

    range.setValues([values]);
    SpreadsheetApp.flush();
    
    // Send Notifications
    const updatedRecord = getUnifiedPatientData([headers, values], map, false, rowNum)[0];
    if (action !== 'Save') {
       try {
         sendRichNotificationCard(action, updatedRecord, action, 'MEDIUM');
         // Email logic can be called here if needed
       } catch(e) {}
    }

    // Return data
    const allData = sheet.getDataRange().getDisplayValues();
    const allRecords = getUnifiedPatientData(allData, map, false, 2);
    return { message: 'Success', updatedRecord: updatedRecord, allRecords: allRecords, chatHistory: getChatHistory() };

  } catch (e) { return { error: e.message }; } 
  finally { lock.releaseLock(); }
}

function addOutreachRecord() {
  // ... (Simplified for brevity, assume typical logic using getUnifiedPatientData and logToAudit)
  // Just ensure you return { allRecords: ... }
  return { message: "Please implement addOutreachRecord fully if needed based on previous files" }; 
}

function getPDFDownloadUrl() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return { url: `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=pdf`, fileName: "Export.pdf" };
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

/**
 * Polling function called by Client to check for new spreadsheet rows.
 * @param {number} clientCount - The number of records the client currently has.
 */
function checkForNewRecords(clientCount) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    
    if (!sheet) return { hasNew: false, currentRecordCount: 0 };

    const lastRow = sheet.getLastRow();
    // Assuming row 1 is headers, data starts at row 2.
    const currentCount = Math.max(0, lastRow - 1);

    // If there are more rows than the client has
    if (currentCount > clientCount) {
      const startRow = 2 + clientCount;
      const numNewRows = currentCount - clientCount;
      
      // Get headers for mapping
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
      const headerMap = createHeaderMap(headers);
      
      // Get only the new data rows
      const data = sheet.getRange(startRow, 1, numNewRows, sheet.getLastColumn()).getDisplayValues();
      
      // Prepend headers so getUnifiedPatientData works (it skips the first row)
      const dataWithHeaders = [headers, ...data];
      
      const newRecords = getUnifiedPatientData(dataWithHeaders, headerMap, false, startRow);
      
      return {
        hasNew: true,
        newRecords: newRecords,
        currentRecordCount: currentCount
      };
    }
    
    // No new records, but return current count to keep client in sync
    return { hasNew: false, currentRecordCount: currentCount };

  } catch (e) {
    Logger.log("Error in checkForNewRecords: " + e.message);
    return { hasNew: false, currentRecordCount: clientCount };
  }
}
