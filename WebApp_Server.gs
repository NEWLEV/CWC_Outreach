/**
 * Server-side backend for Web App interactions.
 * FIXED: Enhanced checkForNewRecords with data hash, proper system message logging
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
  return HtmlService.createTemplateFromFile('WebApp_Client_Modular').evaluate().setTitle('CWC Notification Manager').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper to safely get the Active Spreadsheet with retries.
 * Prevents "You do not have permission" errors on cold starts/race conditions.
 */
function getSafeSpreadsheet() {
  let lastError;
  for (let i = 0; i < 3; i++) {
    try {
      return SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      lastError = e;
      Utilities.sleep(1000); // Wait 1s before retry
    }
  }
  throw lastError;
}

function checkUserAccess() {
  try {
    const email = Session.getActiveUser().getEmail().toLowerCase();
    if (!email) {
      return { 
        allowed: false, 
        email: "Unknown", 
        reason: "Google cannot identify your account. This usually happens when multiple Google accounts are logged in. <b>Please open this link in an Incognito/Private Window.</b>" 
      };
    }

    // Try to access spreadsheet - may fail on first load due to auth timing
    let ss;
    try {
      ss = getSafeSpreadsheet();
    } catch (ssError) {
      // This usually resolves on refresh - provide helpful message
      return { 
        allowed: false, 
        email: email, 
        reason: "Authentication is still loading. <b>Please refresh the page.</b> If this persists, ensure you have access to the underlying spreadsheet.",
        retryable: true
      };
    }

    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SECURITY);
    
    if (!sheet || sheet.getLastRow() < 2) {
      if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) return { allowed: true, email: email, role: 'ADMIN' };
      return { allowed: false, email: email, reason: "Security configuration missing." };
    }

    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headerRow);
    
    const EMAIL_IDX = headerMap['Email'] ?? headerMap['email']; 
    const ROLE_IDX = headerMap['Role'] ?? headerMap['role'];

    if (EMAIL_IDX === undefined || ROLE_IDX === undefined) {
      if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) return { allowed: true, email: email, role: 'ADMIN' };
      return { allowed: false, email: email, reason: "Security sheet columns invalid." };
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const userMatch = data.find(row => String(row[EMAIL_IDX]).trim().toLowerCase() === email);
    
    if (userMatch) {
      return { allowed: true, email: email, role: String(userMatch[ROLE_IDX]).trim() };
    }

    if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) {
      return { allowed: true, email: email, role: 'ADMIN' };
    }

    return { allowed: false, email: email, reason: "User not authorized in Security list." };

  } catch (e) {
    // Generic error - likely auth timing issue
    const errorMsg = e.message || 'Unknown error';
    if (errorMsg.includes('permission') || errorMsg.includes('access')) {
      return { 
        allowed: false, 
        email: "Loading...", 
        reason: "Authentication is still loading. <b>Please refresh the page.</b>",
        retryable: true
      };
    }
    return { allowed: false, email: "System Error", reason: "An error occurred: " + errorMsg };
  }
}

function getInitialData() {
  // CRITICAL: Top-level try-catch to prevent ANY crash for external users
  try {
    let response = { 
      error: null, 
      user: null, 
      activeRecords: [], 
      archivedRecords: [], 
      chatHistory: [], 
      config: { 
        flags: CONFIG.FLAGS, 
        dropdowns: {},
        soundAlertData: CONFIG.SOUND_ALERT_DATA,
        soundProfiles: CONFIG.SOUND_PROFILES 
      }, 
      externalStatus: {}, 
      recentActivities: [], 
      analytics: {},
      dataHash: '',
      lastUpdateTimestamp: 0,
      quickLinks: []
    };
    
    // 1. SAFELY GET TIMESTAMP
    try {
      response.lastUpdateTimestamp = Number(PropertiesService.getScriptProperties().getProperty('LAST_UPDATE') || 0);
    } catch(e) {
      console.warn('⚠️ PropertiesService access failed:', e.message);
      response.lastUpdateTimestamp = Date.now();
    }

    // 2. CHECK ACCESS
    const access = checkUserAccess();
    if (!access.allowed) { 
      response.error = access.reason; 
      return JSON.stringify(response); 
    }

    response.user = getUserInfo(access);
    const ss = getSafeSpreadsheet();
    
    // 3. LOAD DATA
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
    } catch(e) { console.warn("Settings Error: " + e.message); }

    try {
      const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
      if (activeSheet && activeSheet.getLastRow() > 1) {
        const data = activeSheet.getDataRange().getValues();
        const headerMap = createHeaderMap(data[0]);
        response.activeRecords = getUnifiedPatientData(data, headerMap, false, 2);
      }
    } catch(e) { console.warn("Active Records Error: " + e.message); }

    try {
      const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
      if (archiveSheet && archiveSheet.getLastRow() > 1) {
        const data = archiveSheet.getDataRange().getValues();
        const headerMap = createHeaderMap(data[0]);
        response.archivedRecords = getUnifiedPatientData(data, headerMap, false, 2);
      }
    } catch(e) { console.warn("Archive Records Error: " + e.message); }

    try { response.chatHistory = ChatService.getChatHistory(); } catch(e) { console.warn("Chat Error: " + e.message); }
    
    // 4. EXTERNAL STATUS (Only for CWC - Pharmacy usually lacks access)
    try { 
      if (response.user.defaultRole === CONFIG.ROLES.CWC) {
        response.externalStatus = fetchExternalStatus();
        if (!response.externalStatus || Object.keys(response.externalStatus).length === 0) {
          console.log("External status empty, forcing refresh...");
          response.externalStatus = fetchExternalStatus(true);
        }
      } else {
        console.log("Skipping external status fetch for non-CWC user role:", response.user.defaultRole);
        response.externalStatus = {};
      }
    } catch(e) { 
      console.warn("Ext Status Error (Skipped gracefully): " + e.message); 
      response.externalStatus = {};
    }

    try { response.recentActivities = getRecentActivities(); } catch(e) { console.warn("Activities Error: " + e.message); }
    try { response.quickLinks = getQuickLinks(); } catch(e) { console.warn("Quick Links Error: " + e.message); }

    return JSON.stringify(response);

  } catch (criticalError) {
    console.error("🔥 CRITICAL SERVER CRASH: " + criticalError.message);
    return JSON.stringify({ error: "Critical Server Error: " + criticalError.message });
  }
}

function getColData(sheet, colLetter) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(`${colLetter}2:${colLetter}${lastRow}`).getDisplayValues().flat().filter(String);
  } catch(e) { return []; }
}

function getUserInfo(accessObject) {
  const access = accessObject || checkUserAccess();
  const email = access.email;
  let roles = [];

  if (access.allowed) {
    const rawRole = String(access.role).toUpperCase().trim();
    if (rawRole === 'BOTH' || rawRole === 'ADMIN') {
      roles = [CONFIG.ROLES.CWC, CONFIG.ROLES.PHARMACY];
    } else if (rawRole.includes('PHARM')) {
       roles = [CONFIG.ROLES.PHARMACY];
    } else {
       roles = [CONFIG.ROLES.CWC];
    }
  } 
  
  return { email: email, defaultRole: roles[0], roles: [...new Set(roles)] };
}

function getRecentActivities() {
  // PERFORMANCE: Add 60-second cache to avoid repeated reads during save operations
  const cache = CacheService.getScriptCache();
  const cached = cache.get('recentActivities');
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }
  
  try {
    const ss = getSafeSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - 14); 
    const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 7).getValues();
    const activities = data.reverse().map(r => {
      const timestamp = r[0] ? new Date(r[0]) : new Date();
      const user = String(r[1]).split('@')[0];
      const action = String(r[3]);
      let icon = '📝';
      if (action.includes('Pharmacy')) icon = '💊';
      else if (action.includes('Create')) icon = '✨';
      else if (action.includes('Chat')) icon = '💬';
      return { icon: icon, title: action, description: `${user}: ${r[4] || 'Record'}`, time: Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "MMM dd, h:mm a") };
    });
    
    // Cache for 60 seconds
    cache.put('recentActivities', JSON.stringify(activities), 60);
    return activities;
  } catch (e) { return []; }
}

function getAnalytics() {
  const ss = getSafeSpreadsheet();
  const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
  const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
  const auditSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
  
  const result = { 
    completedToday: 0, 
    completedYesterday: 0, // For trend arrow
    avgSubmitTime: "N/A", 
    avgPharmacyTime: "N/A", 
    archiveTotal: 0, 
    archiveAvgSubmit: "N/A",
    // NEW KPIs
    topMedications: [],
    topProviders: [],
    topPharmacies: [],
    insuranceBreakdown: [],
    hourlySubmissions: new Array(24).fill(0),
    hourlyArchived: new Array(24).fill(0)
  };

  const today = new Date();
  const tYear = today.getFullYear();
  const tMonth = today.getMonth();
  const tDay = today.getDate();
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yYear = yesterday.getFullYear();
  const yMonth = yesterday.getMonth();
  const yDay = yesterday.getDate();

  // Helper: Check if date is today
  const isToday = (d) => d instanceof Date && !isNaN(d) && 
    d.getFullYear() === tYear && d.getMonth() === tMonth && d.getDate() === tDay;
  
  const isYesterday = (d) => d instanceof Date && !isNaN(d) && 
    d.getFullYear() === yYear && d.getMonth() === yMonth && d.getDate() === yDay;

  // Aggregate data
  const countsToday = { meds: {}, prov: {}, pharm: {}, ins: {} };
  const countsArchive = { meds: {}, prov: {}, pharm: {}, ins: {} };

  const addTo = (obj, row, map) => {
    const m = row[map[CONFIG.COLUMNS_BY_NAME.medicationDetails]];
    const p = row[map[CONFIG.COLUMNS_BY_NAME.provider]];
    const ph = row[map[CONFIG.COLUMNS_BY_NAME.pharmacy]];
    const i = row[map[CONFIG.COLUMNS_BY_NAME.insuranceName]];

    if (m) obj.meds[m] = (obj.meds[m] || 0) + 1;
    if (p) obj.prov[p] = (obj.prov[p] || 0) + 1;
    if (ph) obj.pharm[ph] = (obj.pharm[ph] || 0) + 1;
    if (i) obj.ins[i] = (obj.ins[i] || 0) + 1;
  };

  try {
    // Process Active Records
    if (activeSheet && activeSheet.getLastRow() > 1) {
      const headers = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0];
      const map = createHeaderMap(headers);
      const data = activeSheet.getRange(2, 1, activeSheet.getLastRow()-1, activeSheet.getLastColumn()).getValues();
      
      const tsIdx = map[CONFIG.COLUMNS_BY_NAME.timestamp];
      const createdIdx = map[CONFIG.COLUMNS_BY_NAME.timestamp];
      const sentIdx = map[CONFIG.COLUMNS_BY_NAME.sentTimestamp];
      
      data.forEach(row => {
        const ts = new Date(row[tsIdx]);
        const todayRec = isToday(ts);
        
        // Count records with today's date
        if (todayRec) {
          result.completedToday++;
          const hour = ts.getHours();
          result.hourlySubmissions[hour]++;
          // Add to Today Stats
          addTo(countsToday, row, map);
        }
        if (isYesterday(ts)) result.completedYesterday++;
      });
      
      // Calculate avg submit time
      if (createdIdx !== undefined && sentIdx !== undefined) {
        let totalTime = 0, count = 0;
        data.forEach(row => {
          const created = new Date(row[createdIdx]);
          const sent = new Date(row[sentIdx]);
          if (!isNaN(created) && !isNaN(sent) && sent > created) { totalTime += (sent - created); count++; }
        });
        if (count > 0) result.avgSubmitTime = formatDuration(totalTime / count);
      }
    }
  } catch(e) { console.error("Active analytics error:", e.message); }

  try {
    // Process Archived Records
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      result.archiveTotal = archiveSheet.getLastRow() - 1;
      
      const headers = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
      const map = createHeaderMap(headers);
      const lastRow = archiveSheet.getLastRow();
      const startRow = Math.max(2, lastRow - 500); // Last 500 for performance
      const data = archiveSheet.getRange(startRow, 1, lastRow - startRow + 1, archiveSheet.getLastColumn()).getValues();
      
      const tsIdx = map[CONFIG.COLUMNS_BY_NAME.timestamp];
      const createdIdx = map[CONFIG.COLUMNS_BY_NAME.timestamp];
      const sentIdx = map[CONFIG.COLUMNS_BY_NAME.sentTimestamp];
      
      data.forEach(row => {
        const ts = new Date(row[tsIdx]);
        const todayRec = isToday(ts);
        
        // Count archived records with today's date
        if (todayRec) {
          result.completedToday++;
          const hour = ts.getHours();
          result.hourlyArchived[hour]++;
          addTo(countsToday, row, map); 
        }
        if (isYesterday(ts)) result.completedYesterday++;
        
        // Always add to Archive Stats (for Recent History)
        addTo(countsArchive, row, map);
      });
      
      // Calculate archive avg submit time
      if (createdIdx !== undefined && sentIdx !== undefined) {
        let totalTime = 0, count = 0;
        data.forEach(row => {
          const created = new Date(row[createdIdx]);
          const sent = new Date(row[sentIdx]);
          if (!isNaN(created) && !isNaN(sent) && sent > created) { totalTime += (sent - created); count++; }
        });
        if (count > 0) result.archiveAvgSubmit = formatDuration(totalTime / count);
      }
    }
  } catch(e) { console.error("Archive analytics error:", e.message); }

  try {
    // Calculate avg pharmacy time from audit log
    if (auditSheet && auditSheet.getLastRow() > 1) {
      const data = auditSheet.getDataRange().getValues();
      let pharmTimeSum = 0, pharmCount = 0;
      const rowHistory = {};
      data.forEach(r => {
        const rowNum = r[2];
        if (!rowHistory[rowNum]) rowHistory[rowNum] = [];
        rowHistory[rowNum].push({ action: r[3], time: new Date(r[0]).getTime() });
      });
      
      for (const rNum in rowHistory) {
        const events = rowHistory[rNum].sort((a,b) => a.time - b.time);
        let lastSubmit = null;
        events.forEach(e => {
          if (e.action === 'Submit to Pharmacy') lastSubmit = e.time;
          else if (e.action === 'Pharmacy Update' && lastSubmit) {
            pharmTimeSum += (e.time - lastSubmit); pharmCount++; lastSubmit = null;
          }
        });
      }
      if (pharmCount > 0) result.avgPharmacyTime = formatDuration(pharmTimeSum / pharmCount);
    }
  } catch(e) { console.error("Audit analytics error:", e.message); }

  // Sort and get top 5 for each category
  const sortByCount = (obj) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Process Top Lists Helper
  const getTop = (obj) => Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([k,v]) => ({name: k, count: v}));

  result.todayStats = {
    meds: getTop(countsToday.meds),
    prov: getTop(countsToday.prov),
    pharm: getTop(countsToday.pharm),
    ins: getTop(countsToday.ins)
  };

  result.archiveStats = {
    meds: getTop(countsArchive.meds),
    prov: getTop(countsArchive.prov),
    pharm: getTop(countsArchive.pharm),
    ins: getTop(countsArchive.ins)
  };
  
  // Default legacy properties (default to Today)
  result.topMedications = result.todayStats.meds;
  result.topProviders = result.todayStats.prov;
  result.topPharmacies = result.todayStats.pharm;
  result.insuranceBreakdown = result.todayStats.ins;

  return result;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return "< 1m";
}

function saveRecordChanges(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Save'); }
function submitToPharmacy(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Submit to Pharmacy'); }
function sendOutreachUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Outreach Update'); }
function submitPharmacyUpdate(rowNum, updatedFields) { return processUpdate(rowNum, updatedFields, 'Pharmacy Update'); }

// NEW: Handle Form Submissions (Called from Code.gs)
function processFormSubmission(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // Wait up to 30s for lock

  try {
    const sheet = e.range.getSheet();
    const row = e.range.getRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);
    
    // 1. Setup Data
    const idCol = headerMap[CONFIG.COLUMNS_BY_NAME.id];
    const statusCol = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    const creatorCol = headerMap[CONFIG.COLUMNS_BY_NAME.creatorEmail];
    
    // 2. Generate ID & Set Defaults
    if (idCol !== undefined) {
       const currentId = sheet.getRange(row, idCol + 1).getValue();
       if (!currentId) {
         // Generate readable ID: REC-{TIMESTAMP}-{RANDOM}
         const timestamp = new Date().getTime().toString().slice(-6);
         const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
         const newId = `REC-${timestamp}-${random}`;
         sheet.getRange(row, idCol + 1).setValue(newId);
       }
    }
    if (statusCol !== undefined) sheet.getRange(row, statusCol + 1).setValue(CONFIG.FLAGS.NEW_ENTRY);
    
    let creatorEmail = 'Form Submission';
    if (e.namedValues && e.namedValues['Email Address']) {
      creatorEmail = e.namedValues['Email Address'][0];
      if (creatorCol !== undefined) sheet.getRange(row, creatorCol + 1).setValue(creatorEmail);
    }

    SpreadsheetApp.flush(); // Ensure data is written before reading back
    updateGlobalTimestamp(); // Signal fast update to clients

    // 3. Fetch Full Record for Notification
    const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const record = getUnifiedPatientData([headers, data], headerMap, false, row)[0];

    // 4. Send Notifications
    try {
      // Email
      const recipients = getRecipients();
      sendNotificationEmail(recipients.cwc, record, 'New Patient Entry', []);
      
      // Chat
      // Chat - DISABLED PER USER REQUEST
      /*
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "h:mm a");
      let chatText = `🚨 *New Patient Entry*  🕒 ${timestamp}\n`;
      chatText += `────────────────\n`;
      chatText += `👤 *${record.patientName || 'N/A'}*\n`;
      chatText += `🆔 PRN: ${record.prn || 'N/A'}\n`;
      chatText += `🏥 Pharmacy: ${record.pharmacy || 'N/A'}\n`;
      chatText += `💊 Meds: ${record.medicationDetails || 'N/A'}\n`;
      if (record.priority === 'Urgent') chatText += `🔥 PRIORITY: URGENT\n`;
      chatText += `📧 By: ${creatorEmail}`;
      
      sendChatWebhookNotification(chatText);
      ChatService.logSystemMessage(`New Entry: ${record.patientName} (${record.prn})`);
      */

    } catch (nErr) {
      console.error("Notification Error: " + nErr.message);
    }

  } catch (error) {
    Utils.sendErrorEmail('processFormSubmission', error);
  } finally {
    lock.releaseLock();
  }
}

function processUpdate(rowNum, updatedFields, action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { error: "System busy. Try again." };

  try {
    const ss = getSafeSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const map = createHeaderMap(headers);
    const user = Session.getActiveUser().getEmail();
    
    if (rowNum < 2) throw new Error("Invalid row number");

    const oldVals = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
    const original = getUnifiedPatientData([headers, oldVals], map, false, rowNum)[0];
    const changes = getAuditChanges(original, updatedFields, rowNum, action);

    const range = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = range.getValues()[0];
    
    changes.forEach(c => {
      let colIdx = map[c.field] ?? map[c.field.toLowerCase()];
      if (colIdx !== undefined) values[colIdx] = c.newValue;
    });

    const findIdx = (name) => map[name] ?? map[name.toLowerCase()];

    // RECORD CWC STAFF EMAIL
    const creatorColIdx = findIdx(CONFIG.COLUMNS_BY_NAME.creatorEmail);
    if (creatorColIdx !== undefined && user) {
      values[creatorColIdx] = user;
    }

    if (action === 'Submit to Pharmacy') {
      const sIdx = findIdx(CONFIG.COLUMNS_BY_NAME.workflowStatus);
      const tIdx = findIdx(CONFIG.COLUMNS_BY_NAME.sentTimestamp);
      console.log(`DEBUG: Action=${action}, sIdx=${sIdx}, tIdx=${tIdx}, ColName=${CONFIG.COLUMNS_BY_NAME.workflowStatus}`);
      if(sIdx === undefined) {
          const validHeaders = headers.join(', ');
          return { error: `Column '${CONFIG.COLUMNS_BY_NAME.workflowStatus}' not found. Headers: ${validHeaders}` };
      }
      values[sIdx] = CONFIG.FLAGS.SUBMITTED_TO_PHARMACY;
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
    updateGlobalTimestamp(); // Signal fast update to clients

    const newVals = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
    const updatedRecord = getUnifiedPatientData([headers, newVals], map, false, rowNum)[0];

    // Only log and notify for meaningful actions
    if (changes.length > 0 || action === 'Submit to Pharmacy' || action === 'Pharmacy Update' || action === 'Outreach Update') {
      if(original.workflowStatus !== updatedRecord.workflowStatus) {
        changes.push({row:rowNum, action:action, field:'Status', oldValue:original.workflowStatus, newValue: updatedRecord.workflowStatus});
      }
      logToAudit(changes, user);
      
      const isTestMode = updatedFields.testMode === true || updatedFields.testMode === 'true';
      if (isTestMode) {
        console.log('🧪 TEST MODE: Notifications suppressed for ' + action);
      } else {
        try {
          const recipients = getRecipients();
        let targetEmails = [];
        if (action === 'Submit to Pharmacy' || action === 'Pharmacy Update') targetEmails = [...recipients.pharmacy, ...recipients.outreach];
        else if (action === 'Outreach Update') targetEmails = recipients.outreach;
        sendNotificationEmail(targetEmails, updatedRecord, action, changes);
        
        const priority = NotificationEngine.calculatePriority(updatedRecord, action);
        
        // FIXED: Only log system messages for Submit/Update actions, not Save
        if (action !== 'Save') {
          // PRIVACY UPDATE: Only show PRN, no Patient Name
          let logMsg = `${action} | PRN: ${updatedRecord.prn}`;
          if (priority === 'CRITICAL' || priority === 'HIGH') logMsg = `🔥 ${logMsg}`;
          try { 
            ChatService.logSystemMessage(logMsg); 
          } catch(e) { 
            console.error("System msg failed: " + e.message); 
          }
        }

        const isUrgent = priority === 'CRITICAL' || priority === 'HIGH';
        let actionTitle = '';
        if (action === 'Submit to Pharmacy') actionTitle = 'New Pharmacy Submission';
        else if (action === 'Pharmacy Update') actionTitle = 'Pharmacy Update';
        else if (action === 'Outreach Update') actionTitle = 'Outreach Update';

        if (actionTitle) {
          const v = (val) => val || 'N/A';
          const dob = updatedRecord.dob ? Utilities.formatDate(new Date(updatedRecord.dob), Session.getScriptTimeZone(), "MM/dd/yyyy") : 'N/A';
          let ssnDisplay = 'N/A';
          if (updatedRecord.ssn) {
             const ssnStr = String(updatedRecord.ssn).replace(/\D/g, '');
             if(ssnStr.length >= 4) ssnDisplay = `***-**-${ssnStr.slice(-4)}`;
          }

          // FIXED: Added Timestamp
          const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "h:mm a");
          let chatText = `${isUrgent ? '🔥 ' : '📝 '}*${actionTitle}*  🕒 ${timestamp}\n`;
          chatText += `────────────────\n`;
          // PRIVACY UPDATE: Name restored per user request
          chatText += `👤 Name: *${v(updatedRecord.patientName)}*\n`;
          chatText += `🆔 PRN: *${v(updatedRecord.prn)}*\n`;
          chatText += `📅 DOB: ${dob}  |  ⚧ Sex: ${v(updatedRecord.sex)}\n`;
          chatText += `🔒 SSN: ${ssnDisplay}\n`;
          chatText += `📞 Phone: ${v(updatedRecord.phoneNumber)}\n`;
          chatText += `🏠 Address: ${v(updatedRecord.address)}\n`;
          chatText += `────────────────\n`;
          chatText += `💊 Meds: ${v(updatedRecord.medicationDetails)}\n`;
          chatText += `🏥 Pharmacy: ${v(updatedRecord.pharmacy)}\n`;
          chatText += `🩺 Provider: ${v(updatedRecord.provider)}\n`;
          chatText += `🛡️ Insurance: ${v(updatedRecord.insuranceName)} (ID: ${v(updatedRecord.insuranceId)})\n`;
          chatText += `────────────────\n`;
          if (action === 'Pharmacy Update') {
             chatText += `💊 *Pharmacy Actions:*\n`;
             chatText += `   • Need Script: ${v(updatedRecord.needsScript)}\n`;
             chatText += `   • Policy #: ${v(updatedRecord.policyNumber)}\n`;
             chatText += `   • Update Ins: ${v(updatedRecord.insuranceDetail)}\n`;
             chatText += `   • Pharm Note: ${v(updatedRecord.gardenNotes)}\n`;
             chatText += `────────────────\n`;
          }
          if (updatedRecord.reason) chatText += `❓ Reason: ${updatedRecord.reason}\n`;
          if (updatedRecord.outreachNote) chatText += `📝 Outreach Note: ${updatedRecord.outreachNote}\n`;
          if (updatedRecord.officeNote) chatText += `📋 Office Note: ${updatedRecord.officeNote}\n`;
          
          chatText += `📧 By: ${user}`;
          sendChatWebhookNotification(chatText);
        }

        } catch(e) { Logger.log("Notification failed: " + e.message); }
      }
    }
    
    // PERFORMANCE OPTIMIZATION: Return only updated record instead of all records
    // Client will update its state incrementally, avoiding expensive full sheet read
    return {
      message: 'Update successful',
      updatedRecord: updatedRecord,
      // PERFORMANCE: Removed dataHash - not needed with timestamp polling
      // PERFORMANCE: Return only new data, not full datasets
      chatHistory: ChatService.getChatHistory(),
      recentActivities: getRecentActivities(),
      // PERFORMANCE: Skip analytics recalculation on save - will be updated on next dashboard view
      lastUpdateTimestamp: Number(PropertiesService.getScriptProperties().getProperty('LAST_UPDATE') || 0)
    };
  } catch (e) { return { error: e.message }; } 
  finally { lock.releaseLock(); }
}

function getPDFDownloadUrl() {
  const ss = getSafeSpreadsheet();
  return { url: `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=pdf&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=true&fzr=false&gid=${ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE).getSheetId()}`, fileName: "Export.pdf" };
}

function getFullArchivedRecord(rowNum) {
  try {
    const ss = getSafeSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    if (!sheet || rowNum > sheet.getLastRow()) throw new Error("Record not found");
    const header = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(header);
    const data = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues();
    return { record: getUnifiedPatientData([header, ...data], headerMap, false, rowNum)[0] };
  } catch (e) { return { error: e.message }; }
}

/**
 * Calculate a hash of the active sheet data to detect updates
 */
function getDataHash() {
  try {
    const ss = getSafeSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!sheet || sheet.getLastRow() < 2) return '';
    
    // Get all data and create a hash
    const data = sheet.getDataRange().getDisplayValues();
    const dataString = JSON.stringify(data);
    
    // Create MD5 hash
    const hash = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataString)
    );
    
    return hash;
  } catch(e) {
    Logger.log('getDataHash error: ' + e.message);
    return '';
  }
}

/**
 * ENHANCED checkForNewRecords - Detects both NEW records and UPDATES
 * CRITICAL: This function must be updated for polling to work!
 */
/**
 * ENHANCED checkForNewRecords - Optimized Text-Based Polling
 * Uses PropertiesService timestamp for O(1) checks instead of O(N) full sheet reads.
 */
function checkForNewRecords(clientCount, clientTimestamp) {
  try {
    const ss = getSafeSpreadsheet();
    
    // 1. FAST CHECK: Compare Timestamps
    let serverTimestamp = 0;
    try {
      serverTimestamp = Number(PropertiesService.getScriptProperties().getProperty('LAST_UPDATE') || 0);
    } catch(e) {
       console.warn('PropertiesService access failed (polling): ' + e.message);
       serverTimestamp = Date.now(); // Force check logic to rely on sheet if prop fails
    }
    
    const clientTs = Number(clientTimestamp || 0);
    
    // Debug log for monitoring optimization
    // Logger.log(`⏱️ POLL: Client=${clientTs}, Server=${serverTimestamp}, Diff=${serverTimestamp - clientTs}`);

    // If server isn't newer than client (allow small drift), return immediately
    // heavily reducing SpreadsheetApp read operations
    if (serverTimestamp <= clientTs) {
       return { 
        hasNew: false, 
        hasUpdates: false, 
        currentRecordCount: clientCount, 
        lastUpdateTimestamp: serverTimestamp
      };
    }
    
    // 2. SLOW CHECK: Only proceed if there is an actual update
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!sheet) return { hasNew: false, hasUpdates: false, currentRecordCount: 0, lastUpdateTimestamp: serverTimestamp };
    
    const lastRow = sheet.getLastRow();
    const currentCount = Math.max(0, lastRow - 1);
    
    let result = { 
      hasNew: false, 
      hasUpdates: false,
      newRecords: [], 
      allRecords: [],
      currentRecordCount: currentCount,
      lastUpdateTimestamp: serverTimestamp, // Send back new timestamp to update client
      debug: {
        clientCount: clientCount,
        serverCount: currentCount,
        clientTs: clientTs,
        serverTs: serverTimestamp
      }
    };
    
    // A. Check for NEW records (count increased)
    if (currentCount > clientCount) {
      Logger.log(`✅ NEW RECORDS: Client=${clientCount}, Server=${currentCount}`);
      try {
        const startRow = 2 + clientCount;
        const numNewRows = currentCount - clientCount;
        
        // Critical: Only read the NEW rows
        // Note: We need headers to map the data correctly
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
        const headerMap = createHeaderMap(headers);
        
        // Read only new rows
        const newData = sheet.getRange(startRow, 1, numNewRows, sheet.getLastColumn()).getDisplayValues();
        const dataWithHeaders = [headers, ...newData];
        
        // Re-use baseRowNum loginc in getUnifiedPatientData to assign correct row numbers
        result.newRecords = getUnifiedPatientData(dataWithHeaders, headerMap, false, startRow);
        result.hasNew = true;
      } catch(e) {
        Logger.log(`Error reading new records: ${e.message}`);
        result.hasNew = false; 
      }
    }
    
    // B. Check for UPDATES (timestamp changed but count same/similar)
    // If not new records, or if we have new records but the timestamp implies other updates too
    if (serverTimestamp > clientTs && !result.hasNew) {
       Logger.log(`✅ UPDATE DETECTED: Ts changed ${clientTs} -> ${serverTimestamp}`);
       try {
         // Sadly, for general updates we must read the whole sheet to be safe, 
         // OR we could implement a 'dirty rows' log. For now, full read is safer 
         // but happens MUCH less often (only on actual edit).
         const data = sheet.getDataRange().getDisplayValues();
         const headerMap = createHeaderMap(data[0]);
         result.allRecords = getUnifiedPatientData(data, headerMap, false, 2);
         result.hasUpdates = true;
       } catch(e) {
         Logger.log(`Error reading updates: ${e.message}`);
         result.hasUpdates = false;
       }
    }
    
    return result;
    
  } catch (e) { 
    Logger.log(`❌ checkForNewRecords Error: ${e.message}`);
    return { 
      hasNew: false, 
      hasUpdates: false, 
      currentRecordCount: clientCount,
      lastUpdateTimestamp: Number(PropertiesService.getScriptProperties().getProperty('LAST_UPDATE') || 0),
      error: e.message
    }; 
  }
}   

// Log changes to audit sheet
function logToAudit(changes, user) {
  if (!changes || changes.length === 0) return;
  
  try {
    const ss = getSafeSpreadsheet();
    let auditSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
    
    if (!auditSheet) {
      auditSheet = ss.insertSheet(CONFIG.SHEET_NAMES.AUDIT_LOG);
      auditSheet.appendRow(CONFIG.AUDIT_LOG_HEADERS);
      auditSheet.setFrozenRows(1);
      
      // Format header
      const headerRange = auditSheet.getRange(1, 1, 1, CONFIG.AUDIT_LOG_HEADERS.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a5568');
      headerRange.setFontColor('#ffffff');
    }
    
    changes.forEach(change => {
      const rowData = [
        new Date(),
        user,
        change.row,
        change.action,
        change.field,
        change.oldValue || '',
        change.newValue || ''
      ];
      auditSheet.appendRow(rowData);
    });
    
  } catch(e) {
    console.error("Audit logging failed: " + e.message);
  }
}

// --- FAST POLLING INFRASTRUCTURE ---

function checkUpdateSignal(clientTimestamp) {
  try {
    const serverTimestamp = Number(PropertiesService.getScriptProperties().getProperty('LAST_UPDATE') || 0);
    // Return true if server is newer than client (allow 100ms drift)
    return { 
      hasUpdate: serverTimestamp > (Number(clientTimestamp) + 100), 
      timestamp: serverTimestamp 
    };
  } catch (e) { return { hasUpdate: false, error: e.message }; }
}


function updateGlobalTimestamp() {
  try {
    try {
      PropertiesService.getScriptProperties().setProperty('LAST_UPDATE', Date.now().toString());
    } catch(e) {
      console.warn('PropertiesService access failed (updateGlobalTimestamp): ' + e.message);
    }
  } catch(e) { console.error("Failed to update timestamp: " + e.message); }
}

/**
 * PERFORMANCE: Lazy-load analytics only when needed
 * Called separately from client when dashboard is viewed
 */
function getLazyAnalytics() {
  try {
    return { analytics: getAnalytics() };
  } catch(e) {
    return { analytics: {}, error: e.message };
  }
}
 
