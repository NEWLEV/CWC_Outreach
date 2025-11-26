/**
 * Server-side backend for Web App interactions.
 * Updated: Robust Data Fetching for Active & Archive
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

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SECURITY);
    
    if (!sheet || sheet.getLastRow() < 2) {
      if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) return { allowed: true, email: email, role: 'ADMIN' };
      return { allowed: false, email: email, reason: "Security configuration missing." };
    }

    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headerRow);
    
    const EMAIL_IDX = headerMap['Email'] ?? headerMap['email']; 
    const ROLE_IDX = headerMap['Role'] ?? headerMap['role'];
    const ACTIVE_IDX = headerMap['Active'] ?? headerMap['active'];

    if (EMAIL_IDX === undefined || ROLE_IDX === undefined) {
      if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) return { allowed: true, email: email, role: 'ADMIN' };
      return { allowed: false, email: email, reason: "Security sheet columns invalid." };
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const userMatch = data.find(row => String(row[EMAIL_IDX]).trim().toLowerCase() === email);
    
    if (userMatch) {
      if (ACTIVE_IDX !== undefined) {
        const val = String(userMatch[ACTIVE_IDX]).trim().toLowerCase();
        if (val === 'false' || val === 'no' || val === 'inactive') {
          return { allowed: false, email: email, reason: "Account is deactivated." };
        }
      }
      return { allowed: true, email: email, role: String(userMatch[ROLE_IDX]).trim() };
    }

    if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) {
      return { allowed: true, email: email, role: 'ADMIN' };
    }

    return { allowed: false, email: email, reason: "User not authorized in Security list." };

  } catch (e) {
    return { allowed: false, email: "System Error", reason: e.message };
  }
}

function getInitialData() {
  let response = { error: null, user: null, activeRecords: [], archivedRecords: [], chatHistory: [], config: { flags: CONFIG.FLAGS, dropdowns: {} }, externalStatus: {}, recentActivities: [], analytics: {} };
  try {
    const access = checkUserAccess();
    if (!access.allowed) { response.error = access.reason; return JSON.stringify(response); }

    response.user = getUserInfo(access);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
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

    try {
      const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
      if (activeSheet && activeSheet.getLastRow() > 1) {
        const data = activeSheet.getDataRange().getValues();
        const headerMap = createHeaderMap(data[0]);
        response.activeRecords = getUnifiedPatientData(data, headerMap, false, 2);
      }
    } catch(e) {}

    try {
      const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
      if (archiveSheet && archiveSheet.getLastRow() > 1) {
        const data = archiveSheet.getDataRange().getValues();
        const headerMap = createHeaderMap(data[0]);
        // IMPORTANT: Load FULL data for archives
        response.archivedRecords = getUnifiedPatientData(data, headerMap, false, 2);
      }
    } catch(e) {}

    try { response.chatHistory = getChatHistory(); } catch(e) {}
    try { response.externalStatus = fetchExternalStatus(); } catch(e) { console.error("Ext Status Error", e); }
    try { response.recentActivities = getRecentActivities(); } catch(e) {}
    try { response.analytics = getAnalytics(); } catch(e) { console.error("Analytics Error", e); }

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
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - 14); 
    const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 7).getValues();
    return data.reverse().map(r => {
      const timestamp = r[0] ? new Date(r[0]) : new Date();
      const user = String(r[1]).split('@')[0];
      const action = String(r[3]);
      let icon = '📝';
      if (action.includes('Pharmacy')) icon = '💊';
      else if (action.includes('Create')) icon = '✨';
      else if (action.includes('Chat')) icon = '💬';
      return { icon: icon, title: action, description: `${user}: ${r[4] || 'Record'}`, time: Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "MMM dd, h:mm a") };
    });
  } catch (e) { return []; }
}

function getAnalytics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
  const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
  const auditSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
  
  const result = { completedToday: 0, avgSubmitTime: "N/A", avgPharmacyTime: "N/A", archiveTotal: 0, archiveAvgSubmit: "N/A" };

  try {
    if (activeSheet && activeSheet.getLastRow() > 1) {
      const headers = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0];
      const map = createHeaderMap(headers);
      const createdIdx = map[CONFIG.COLUMNS_BY_NAME.timestamp];
      const sentIdx = map[CONFIG.COLUMNS_BY_NAME.sentTimestamp];
      
      if (createdIdx !== undefined && sentIdx !== undefined) {
        const data = activeSheet.getRange(2, 1, activeSheet.getLastRow()-1, activeSheet.getLastColumn()).getValues();
        let totalTime = 0, count = 0;
        data.forEach(row => {
          const created = new Date(row[createdIdx]);
          const sent = new Date(row[sentIdx]);
          if (!isNaN(created) && !isNaN(sent) && sent > created) { totalTime += (sent - created); count++; }
        });
        if (count > 0) result.avgSubmitTime = formatDuration(totalTime / count);
      }
    }
  } catch(e) {}

  try {
    if (auditSheet && auditSheet.getLastRow() > 1) {
      const today = new Date(); today.setHours(0,0,0,0);
      const data = auditSheet.getDataRange().getValues();
      result.completedToday = data.filter(r => {
        const d = new Date(r[0]); d.setHours(0,0,0,0);
        return d.getTime() === today.getTime() && (r[3] === 'Submit to Pharmacy' || r[3] === 'Pharmacy Update');
      }).length;

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
  } catch(e) {}

  try {
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      result.archiveTotal = archiveSheet.getLastRow() - 1;
      const headers = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
      const map = createHeaderMap(headers);
      const createdIdx = map[CONFIG.COLUMNS_BY_NAME.timestamp];
      const sentIdx = map[CONFIG.COLUMNS_BY_NAME.sentTimestamp];
      if (createdIdx !== undefined && sentIdx !== undefined) {
        const lastRow = archiveSheet.getLastRow();
        const startRow = Math.max(2, lastRow - 500);
        const data = archiveSheet.getRange(startRow, 1, lastRow - startRow + 1, archiveSheet.getLastColumn()).getValues();
        let totalTime = 0, count = 0;
        data.forEach(row => {
          const created = new Date(row[createdIdx]);
          const sent = new Date(row[sentIdx]);
          if (!isNaN(created) && !isNaN(sent) && sent > created) { totalTime += (sent - created); count++; }
        });
        if (count > 0) result.archiveAvgSubmit = formatDuration(totalTime / count);
      }
    }
  } catch(e) {}

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

function processUpdate(rowNum, updatedFields, action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { error: "System busy. Try again." };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
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

    const newVals = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
    const updatedRecord = getUnifiedPatientData([headers, newVals], map, false, rowNum)[0];

    if (changes.length > 0 || action === 'Submit to Pharmacy' || action === 'Pharmacy Update' || action === 'Outreach Update') {
      if(original.workflowStatus !== updatedRecord.workflowStatus) {
        changes.push({row:rowNum, action:action, field:'Status', oldValue:original.workflowStatus, newValue: updatedRecord.workflowStatus});
      }
      logToAudit(changes, user);
      
      try {
        const recipients = getRecipients();
        let targetEmails = [];
        if (action === 'Submit to Pharmacy' || action === 'Pharmacy Update') targetEmails = [...recipients.pharmacy, ...recipients.outreach];
        else if (action === 'Outreach Update') targetEmails = recipients.outreach;
        sendNotificationEmail(targetEmails, updatedRecord, action, changes);
        
        const priority = NotificationEngine.calculatePriority(updatedRecord, action);
        let logMsg = `ACTION: ${action} | Patient: ${updatedRecord.patientName}`;
        if (priority === 'CRITICAL' || priority === 'HIGH') logMsg = `🔥 ${logMsg}`;
        try { logSystemMessage(logMsg); } catch(e) {}

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

          let chatText = `${isUrgent ? '🔥 ' : '📝 '}*${actionTitle}*\n`;
          chatText += `────────────────\n`;
          chatText += `👤 *${v(updatedRecord.patientName)}* (PRN: ${v(updatedRecord.prn)})\n`;
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
    
    const allData = sheet.getDataRange().getValues();
    const allRecords = getUnifiedPatientData(allData, map, false, 2);
    const newDataHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(allRecords)));

    return {
      message: 'Update successful',
      updatedRecord: updatedRecord,
      dataHash: newDataHash,
      allRecords: allRecords,
      chatHistory: getChatHistory(),
      recentActivities: getRecentActivities(),
      analytics: getAnalytics()
    };
  } catch (e) { return { error: e.message }; } 
  finally { lock.releaseLock(); }
}

function addOutreachRecord() { return { message: "Refer to Code.gs for addOutreachRecord implementation" }; }

function getPDFDownloadUrl() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return { url: `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=pdf&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=true&fzr=false&gid=${ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE).getSheetId()}`, fileName: "Export.pdf" };
}

function getFullArchivedRecord(rowNum) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    if (!sheet || rowNum > sheet.getLastRow()) throw new Error("Record not found");
    const header = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(header);
    const data = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues();
    return { record: getUnifiedPatientData([header, ...data], headerMap, false, rowNum)[0] };
  } catch (e) { return { error: e.message }; }
}

function checkForNewRecords(clientCount) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!sheet) return { hasNew: false, currentRecordCount: 0 };
    const lastRow = sheet.getLastRow();
    const currentCount = Math.max(0, lastRow - 1);
    if (currentCount > clientCount) {
      const startRow = 2 + clientCount;
      const numNewRows = currentCount - clientCount;
      const data = sheet.getDataRange().getDisplayValues();
      const headers = data[0];
      const headerMap = createHeaderMap(headers);
      const newData = data.slice(startRow - 1, startRow - 1 + numNewRows);
      const dataWithHeaders = [headers, ...newData];
      const newRecords = getUnifiedPatientData(dataWithHeaders, headerMap, false, startRow);
      return { hasNew: true, newRecords: newRecords, currentRecordCount: currentCount };
    }
    return { hasNew: false, currentRecordCount: currentCount };
  } catch (e) { return { hasNew: false, currentRecordCount: clientCount }; }
}
