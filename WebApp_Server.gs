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
    // ADD THIS LINE: Pass the correct app URL to the template
    template.appUrl = ScriptApp.getService().getUrl(); 
    
    return template.evaluate()
      .setTitle('Access Denied')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile('WebApp_Client.html')
    .setTitle('CWC Notification Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function checkUserAccess() {
  try {
    const email = Session.getActiveUser().getEmail().toLowerCase();

    // 1. CRITICAL: Check if Google is hiding the email
    if (!email) {
      return { 
        allowed: false, 
        email: "", 
        reason: "Google is hiding your identity. The Admin must set the script deployment to execute as 'User Accessing' in appsscript.json." 
      };
    }
  
    // 2. Always Allow Admin defined in CONFIG (Prevents lockout)
    if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) {
      return { allowed: true, email: email, role: 'ADMIN' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { allowed: false, email: email, reason: "Authorization list is empty." };
    }

    // Fetch J (Email), K (Role), L (Active) using getValues() for native types (Boolean)
    const data = sheet.getRange(2, 10, lastRow - 1, 3).getValues(); 
    
    // 3. Find ALL matches for this email (Handle duplicates in list)
    const userMatches = data.filter(r => String(r[0]).trim().toLowerCase() === email);

    if (userMatches.length === 0) {
      return { allowed: false, email: email, reason: "User not found in authorized list." };
    }

    // 4. Check if ANY matching row is Active
    const activeMatch = userMatches.find(r => {
      const val = r[2];
      if (val === true) return true; // Boolean true (Checkbox is checked)
      const sVal = String(val).trim().toLowerCase();
      return sVal === 'true' || sVal === 'yes' || sVal === 'active';
    });

    if (!activeMatch) {
       return { allowed: false, email: email, reason: "Account is deactivated." };
    }

    return { allowed: true, email: email, role: activeMatch[1] };

  } catch (e) {
    Logger.log("Access Check Error: " + e.message);
    const fallbackEmail = Session.getActiveUser().getEmail() || "Unknown";
    // Fail safe: Allow admin in case of error, deny others
    if (fallbackEmail.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase()) return { allowed: true, email: fallbackEmail };
    return { allowed: false, email: fallbackEmail, reason: "System error: " + e.message };
  }
}

// --- REST OF THE FILE REMAINS UNCHANGED ---
function getInitialData() {
  try {
    const access = checkUserAccess();
    if (!access.allowed) return { error: "Access Denied: " + access.reason };

    const user = getUserInfo();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
    
    let activeRecords = [];
    let dataHash = "";
    if (activeSheet && activeSheet.getLastRow() > 1) {
      const headers = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getDisplayValues()[0];
      const headerMap = createHeaderMap(headers);
      const data = activeSheet.getDataRange().getDisplayValues();
      activeRecords = getUnifiedPatientData(data, headerMap, false, 2);
      dataHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(activeRecords)));
    }
    
    let archivedRecords = [];
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      const headers = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getDisplayValues()[0];
      const headerMap = createHeaderMap(headers);
      const data = archiveSheet.getDataRange().getDisplayValues();
      archivedRecords = getUnifiedPatientData(data, headerMap, true, 2);
    }
    
    let dropdowns = {};
    if (settingsSheet) {
      dropdowns = {
        pharmacy: getColData(settingsSheet, 'C'),
        provider: getColData(settingsSheet, 'D'),
        medication: getColData(settingsSheet, 'E'),
        status: getColData(settingsSheet, 'F'),
        insurance: getColData(settingsSheet, 'G'),
        needsScript: getColData(settingsSheet, 'H'),
        sex: getColData(settingsSheet, 'I')
      };
    }

    const chatHistory = getChatHistory();
    const externalStatusResult = fetchExternalStatus(false);
    return {
      user: user,
      activeRecords: activeRecords,
      archivedRecords: archivedRecords,
      dataHash: dataHash,
      chatHistory: chatHistory, 
      externalStatus: externalStatusResult.map,
      diagnostics: externalStatusResult.diagnostics,
      config: {
        flags: CONFIG.FLAGS,
        columns: CONFIG.COLUMNS_BY_NAME,
        roles: CONFIG.ROLES,
        dropdowns: dropdowns
      }
    };
  } catch (error) {
    Logger.log(error);
    return { error: `Load failed: ${error.message}` };
  }
}

function fetchExternalStatus(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get("EXTERNAL_STATUS_MAP");
  if (!forceRefresh && cachedData) {
    return { 
      map: JSON.parse(cachedData), 
      diagnostics: ["✅ Loaded from Cache (Updates every 10m)"] 
    };
  }

  const statusMap = {};
  const diagnostics = [];
  CONFIG.EXTERNAL_SHEETS.forEach(cfg => {
    try {
      const ss = SpreadsheetApp.openById(cfg.id);
      let targetSheet = ss.getSheetByName(cfg.sheetName);
      
      if (!targetSheet) {
        targetSheet = ss.getSheets()[0]; 
        diagnostics.push(`⚠️ [${cfg.label}] Sheet '${cfg.sheetName}' missing. Using '${targetSheet.getName()}'.`);
      }

      const lastRow = targetSheet.getLastRow();
      if (lastRow < 1) {
        diagnostics.push(`⚠️ [${cfg.label}] Sheet is empty.`);
        return;
      }

      const data = targetSheet.getRange(1, 1, lastRow, 1).getDisplayValues();
      let matchCount = 0;

      for (let i = 0; i < data.length; i++) {
        const raw = String(data[i][0]);
        const prn = raw.toUpperCase().replace(/\s+/g, '');
        
        if (prn && prn !== "PRN" && prn.length > 1) {
          if (!statusMap[prn]) statusMap[prn] = [];
          if (!statusMap[prn].includes(cfg.label)) statusMap[prn].push(cfg.label);
          matchCount++;
        }
      }
      diagnostics.push(`✅ [${cfg.label}] Live Fetch: Indexed ${matchCount} records.`);
    } catch (e) {
      diagnostics.push(`❌ [${cfg.label}] Error: ${e.message}`);
      Logger.log(`Error accessing external sheet ${cfg.label}: ${e.message}`);
    }
  });

  try {
    cache.put("EXTERNAL_STATUS_MAP", JSON.stringify(statusMap), 600);
  } catch(e) {
    Logger.log("Cache save failed: " + e.message);
  }

  return { map: statusMap, diagnostics: diagnostics };
}

function pollChat() {
  return getChatHistory();
}

function checkForUpdates(clientHash) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
  
  const extStatusResult = fetchExternalStatus(false);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { hasUpdate: false, externalStatus: extStatusResult.map };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const headerMap = createHeaderMap(headers);
  const data = sheet.getDataRange().getDisplayValues();
  const activeRecords = getUnifiedPatientData(data, headerMap, false, 2);

  const currentHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(activeRecords)));

  const hasUpdate = (currentHash !== clientHash);
  return { 
    hasUpdate: hasUpdate, 
    activeRecords: hasUpdate ? activeRecords : [], 
    dataHash: currentHash,
    externalStatus: extStatusResult.map 
  };
}

function getColData(sheet, colLetter) {
  return sheet.getRange(`${colLetter}2:${colLetter}`).getDisplayValues().flat().filter(String);
}

function getPDFDownloadUrl() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!sheet) throw new Error("Active sheet not found.");
    const ssId = ss.getId();
    const sheetId = sheet.getSheetId();
    const url = `https://docs.google.com/spreadsheets/d/${ssId}/export?format=pdf&gid=${sheetId}&size=letter&portrait=false&fitw=true&gridlines=false`;
    return { url: url, fileName: "CWC_Outreach_Active_List.pdf" };
  } catch (e) {
    return { error: e.message };
  }
}

function getUserInfo() {
  // Re-use the secure access check
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

  return { email: email, defaultRole: roles[0], roles: [...new Set(roles)] };
}

function getFullArchivedRecord(rowNum) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    if (!sheet) throw new Error("Archive sheet missing");

    const lastRow = sheet.getLastRow();
    if (rowNum < 2 || rowNum > lastRow) {
      throw new Error("Record no longer exists (Row " + rowNum + ")");
    }

    const header = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(header);
    const data = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getDisplayValues();
    const records = getUnifiedPatientData([header, ...data], headerMap, false, rowNum);
    return { record: records[0] };
  } catch (e) {
    return { error: e.message };
  }
}

function saveRecordChanges(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Save'); }
function submitToPharmacy(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Submit to Pharmacy'); }
function sendOutreachUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Outreach Update'); }
function submitPharmacyUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Pharmacy Update'); }

function processUpdate(rowNum, updatedFields, action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { error: "Record is currently being edited. Please try again." };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const map = createHeaderMap(headers);
    const user = Session.getActiveUser().getEmail();
    const oldVals = sheet.getRange(rowNum, 1, 1, headers.length).getDisplayValues()[0];
    const original = getUnifiedPatientData([headers, [oldVals]], map, false, rowNum)[0];
    const changes = getAuditChanges(original, updatedFields, rowNum, action);

    const range = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = range.getDisplayValues()[0];
    let warning = "";
    
    changes.forEach(c => {
      let colIdx = map[c.field];
      if (colIdx === undefined && c.field) colIdx = map[c.field.toLowerCase()];
      if (colIdx !== undefined) {
        values[colIdx] = c.newValue;
      } else {
        if(c.field !== 'Status') warning = `Warning: Column '${c.field}' not found. Check header spelling.`;
      }
    });

    const creatorCol = map[CONFIG.COLUMNS_BY_NAME.creatorEmail] ?? map[CONFIG.COLUMNS_BY_NAME.creatorEmail.toLowerCase()];
    if (creatorCol !== undefined) {
      values[creatorCol] = user;
    }
    
    const tsString = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm:ss");
    const findIdx = (name) => map[name] ?? map[name.toLowerCase()];

    if (action === 'Submit to Pharmacy') {
      const sIdx = findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus);
      const tIdx = findIdx(CONFIG.COLUMNS_BY_NAME.sentTimestamp);
      if(sIdx !== undefined) values[sIdx] = CONFIG.FLAGS.SUBMITTED_TO_PHARMACY;
      if(tIdx !== undefined) values[tIdx] = tsString;
    } else if (action === 'Outreach Update') {
      const sIdx = findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus);
      if(sIdx !== undefined) values[sIdx] = CONFIG.FLAGS.CWC_UPDATE_SENT;
    } else if (action === 'Pharmacy Update') {
      const sIdx = findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus);
      if(sIdx !== undefined) values[sIdx] = CONFIG.FLAGS.PHARMACY_UPDATE;
    }
    
    range.setValues([values]);
    SpreadsheetApp.flush();

    const newVals = sheet.getRange(rowNum, 1, 1, headers.length).getDisplayValues()[0];
    const updatedRecord = getUnifiedPatientData([headers, [newVals]], map, false, rowNum)[0];

    if (changes.length > 0 || action.includes('Submit')) {
      if(original.workflowStatus !== updatedRecord.workflowStatus) {
        changes.push({row:rowNum, action:action, field:'Status', oldValue:original.workflowStatus, newValue: updatedRecord.workflowStatus});
      }
      logToAudit(changes, user);

      const recipients = getRecipients();
      if (action === 'Submit to Pharmacy' || action === 'Pharmacy Update') {
        sendNotificationEmail([...recipients.pharmacy, ...recipients.outreach], updatedRecord, action, changes);
      } else if (action === 'Outreach Update') {
        sendNotificationEmail(recipients.outreach, updatedRecord, action, changes);
      }
    }

    const allData = sheet.getDataRange().getDisplayValues();
    const allRecords = getUnifiedPatientData(allData, map, false, 2);
    const newDataHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(allRecords)));
    
    const extStatus = fetchExternalStatus(true);

    return {
      message: warning ? warning : 'Update successful',
      updatedRecord: updatedRecord,
      dataHash: newDataHash,
      allRecords: allRecords,
      chatHistory: getChatHistory(),
      externalStatus: extStatus.map 
    };
  } catch (e) {
    return { error: e.message };
  } finally {
    lock.releaseLock();
  }
}
