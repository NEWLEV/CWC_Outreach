/**
 * Shared utilities.
 * FIXED: Added getUuid, proper function exports, robust data mapping
 */

var Utils = {

  // Generate UUID for record identification
  getUuid: function() {
    // Fallback for environments without Utilities.getUuid()
    if (typeof Utilities.getUuid === 'function') {
      return Utilities.getUuid();
    }
    // Generate UUID v4 manually
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // Update record count cache
  updateRecordCountCache: function(count) {
    try {
      const cache = CacheService.getScriptCache();
      const duration = CONFIG.CACHE_DURATIONS ? CONFIG.CACHE_DURATIONS.ACTIVE_RECORD_COUNT : 3600;
      cache.put('activeRecordCount', count.toString(), duration);
      cache.put('lastUpdateTime', Date.now().toString(), duration);
      Logger.log(`✅ Cache updated: ${count} records, timestamp: ${Date.now()}`);
    } catch(e) {
      Logger.log(`⚠️ Failed to update cache: ${e.message}`);
    }
  },

  createHeaderMap: function(headerRow) {
    const map = {};
    headerRow.forEach((h, i) => {
      const clean = String(h).trim();
      if (clean) {
        map[clean] = i;
        map[clean.toLowerCase()] = i;
      }
    });
    return map;
  },

  createKeyToHeaderMap: function() {
    const map = {};
    for (const k in CONFIG.COLUMNS_BY_NAME) map[k] = CONFIG.COLUMNS_BY_NAME[k];
    return map;
  },

  sendChatWebhookNotification: function(text, retries = 3) {
    const url = CONFIG.CHAT_WEBHOOK_URL;
    if (!url || !text) return false;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const payload = { text: text };
        const options = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };
        
        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();
        
        if (responseCode === 200) {
          if (attempt > 0) {
            Logger.log(`✅ Webhook succeeded on attempt ${attempt + 1}`);
          }
          return true;
        }
        
        Logger.log(`⚠️ Webhook returned ${responseCode} on attempt ${attempt + 1}`);
        
        // If not last attempt, wait with exponential backoff
        if (attempt < retries - 1) {
          const waitTime = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          Utilities.sleep(waitTime);
        }
        
      } catch (e) {
        Logger.log(`❌ Webhook error (attempt ${attempt + 1}/${retries}): ${e.message}`);
        
        // If not last attempt, wait with exponential backoff
        if (attempt < retries - 1) {
          const waitTime = 1000 * Math.pow(2, attempt);
          Utilities.sleep(waitTime);
        } else {
          console.error("Webhook failed after all retries: " + e.message);
        }
      }
    }
    
    return false;
  },

  getRecipients: function() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('emailRecipients');
    if (cached) return JSON.parse(cached);
    try {
      const sheet = getSafeSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
      const pharmacy = sheet.getRange('A2:A').getDisplayValues().flat().filter(String);
      const outreach = sheet.getRange('B2:B').getDisplayValues().flat().filter(String);
      const result = { cwc: outreach, pharmacy: pharmacy, outreach: outreach };
      const duration = CONFIG.CACHE_DURATIONS ? CONFIG.CACHE_DURATIONS.EMAIL_RECIPIENTS : 600;
      cache.put('emailRecipients', JSON.stringify(result), duration);
      return result;
    } catch (e) {
      return { cwc: [CONFIG.ADMIN_EMAIL], pharmacy: [CONFIG.ADMIN_EMAIL], outreach: [CONFIG.ADMIN_EMAIL] };
    }
  },

  getAuditChanges: function(original, updated, row, action) {
    const changes = [];
    const map = Utils.createKeyToHeaderMap();
    for (const key in updated) {
      if (original[key] !== updated[key]) {
        changes.push({
          row: row, action: action, field: map[key] || key,
          oldValue: original[key] || '', newValue: updated[key] || ''
        });
      }
    }
    return changes;
  },

  sendErrorEmail: function(context, error) {
    try {
      MailApp.sendEmail(CONFIG.ADMIN_EMAIL, `Script Error: ${context}`, `Error: ${error.message}\\nStack: ${error.stack}`);
    } catch(e) {
      Logger.log(`🚨 CRITICAL: sendErrorEmail failed for ${context}: ${e.message}`);
      console.error(`Failed to send error email: ${e.message}`);
    }
  },

  archiveProcessedData: function() {
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(30000)) return;
    try {
      const ss = getSafeSpreadsheet();
      const src = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
      const dest = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
      if (!src || !dest || src.getLastRow() < 2) return;

      const data = src.getDataRange().getValues();
      const headers = data[0];
      const headerMap = Utils.createHeaderMap(headers);
      const statusIdx = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus] ?? headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus.toLowerCase()];

      const toArchive = [];
      const toDelete = [];

      const archiveFlags = [CONFIG.FLAGS.SUBMITTED_TO_PHARMACY, CONFIG.FLAGS.CWC_UPDATE_SENT, CONFIG.FLAGS.PHARMACY_UPDATE];
      for(let i = data.length - 1; i >= 1; i--) {
        if(statusIdx >= 0 && archiveFlags.includes(data[i][statusIdx])) {
          toArchive.unshift(data[i]);
          toDelete.push(i + 1); 
        }
      }

      if(toArchive.length > 0) {
        if(dest.getLastRow() === 0) dest.appendRow(headers);
        dest.getRange(dest.getLastRow()+1, 1, toArchive.length, headers.length).setValues(toArchive);
        toDelete.forEach(r => src.deleteRow(r));
      }
    } catch(e) {
      Logger.log(`❌ Archive error: ${e.message}`);
      console.error('Archive failed:', e);
      Utils.sendErrorEmail('Archiving', e);
    } finally {
      lock.releaseLock();
    }
  },

  clearAuditLog: function() {
    try {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        '⚠️ Confirm Data Reset', 
        'Are you sure you want to clear the Audit Log?\n\nThis will reset your "Completed Today" and "Average Pharmacy Time" metrics to zero.\nThis cannot be undone.',
        ui.ButtonSet.YES_NO
      );

      if (response == ui.Button.YES) {
        const ss = getSafeSpreadsheet();
        const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
        if (sheet && sheet.getLastRow() > 1) {
          sheet.deleteRows(2, sheet.getLastRow() - 1);
          ui.alert('✅ Audit Log Cleared', 'Metrics have been reset.', ui.ButtonSet.OK);
        } else {
          ui.alert('ℹ️ Log Empty', 'Audit log is already empty.', ui.ButtonSet.OK);
        }
      }
    } catch (e) {
      console.error("Clear Audit Log Failed: " + e.message);
      SpreadsheetApp.getUi().alert('❌ Error: ' + e.message);
    }
  }
};

// GLOBAL FUNCTION ALIASES for backward compatibility
function createHeaderMap(headerRow) { return Utils.createHeaderMap(headerRow); }
function createKeyToHeaderMap() { return Utils.createKeyToHeaderMap(); }
function sendChatWebhookNotification(text) { return Utils.sendChatWebhookNotification(text); }
function getRecipients() { return Utils.getRecipients(); }
function getAuditChanges(original, updated, row, action) { return Utils.getAuditChanges(original, updated, row, action); }
function sendErrorEmail(context, error) { return Utils.sendErrorEmail(context, error); }
function archiveProcessedData() { return Utils.archiveProcessedData(); }
function clearAuditLog() { return Utils.clearAuditLog(); }
function updateRecordCountCache(count) { return Utils.updateRecordCountCache(count); }

// --- DATA MAPPING ---
function getUnifiedPatientData(data, headerMap, indexOnly = false, baseRowNum = 2) {
  const records = [];
  const keyToHeader = Utils.createKeyToHeaderMap();

  // Pre-calculate indices for all known columns
  const colIndices = {};
  for (const key in keyToHeader) {
    const headerName = keyToHeader[key];
    if (headerMap[headerName] !== undefined) {
      colIndices[key] = headerMap[headerName];
    } else if (headerMap[headerName.toLowerCase()] !== undefined) {
      colIndices[key] = headerMap[headerName.toLowerCase()];
    } else {
      colIndices[key] = -1;
    }
  }

  // Add ID column index
  if (headerMap['ID'] !== undefined) colIndices['id'] = headerMap['ID'];
  else if (headerMap['id'] !== undefined) colIndices['id'] = headerMap['id'];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.join('').trim() === '') continue;

    let record = {
      rowNum: (baseRowNum - 1) + i
    };

    for (const key in colIndices) {
      const idx = colIndices[key];
      if (idx > -1 && idx < row.length) {
        record[key] = row[idx];
      } else {
        record[key] = '';
      }
    }

    record.patientName = record.patientName || '';
    record.prn = record.prn || '';
    record.workflowStatus = record.workflowStatus || '';

    records.push(record);
  }
  return records;
}

// --- EXTERNAL STATUS (MAIL / MEDS) ---

function fetchExternalStatus(forceRefresh = false) {
  console.log('🏷️ fetchExternalStatus called, forceRefresh:', forceRefresh);
  const cache = CacheService.getScriptCache();
  const cached = cache.get('externalStatus');

  if (cached && !forceRefresh) {
    try {
      console.log('🏷️ Returning cached externalStatus');
      return JSON.parse(cached);
    } catch(e) {
      console.error('🏷️ Cache parse error:', e.message);
    }
  }

  const statusMap = {};

  if (CONFIG.EXTERNAL_SHEETS) {
    console.log('🏷️ Processing', CONFIG.EXTERNAL_SHEETS.length, 'external sheets');
    CONFIG.EXTERNAL_SHEETS.forEach(conf => {
      try {
        console.log('🏷️ Opening sheet:', conf.id, 'sheetName:', conf.sheetName, 'label:', conf.label);
        const ss = SpreadsheetApp.openById(conf.id);
        const sheet = conf.sheetName ? ss.getSheetByName(conf.sheetName) : ss.getSheets()[0];
        if (!sheet) {
          console.warn('🏷️ Sheet not found:', conf.sheetName);
          return;
        }

        const lastRow = sheet.getLastRow();
        console.log('🏷️ Sheet', conf.label, 'has', lastRow, 'rows');
        if (lastRow < 2) return;

        const data = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
        console.log('🏷️ Loaded', data.length, 'PRNs from', conf.label);

        data.forEach(val => {
          if (!val) return;
          const key = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!statusMap[key]) statusMap[key] = [];
          if (!statusMap[key].includes(conf.label)) statusMap[key].push(conf.label);
        });
      } catch (e) {
        console.error(`🏷️ Error fetching ${conf.label}: ${e.message}`);
      }
    });
  } else {
    console.warn('🏷️ CONFIG.EXTERNAL_SHEETS is not defined');
  }

  console.log('🏷️ Final statusMap has', Object.keys(statusMap).length, 'entries');
  const duration = CONFIG.CACHE_DURATIONS ? CONFIG.CACHE_DURATIONS.EXTERNAL_STATUS : 300;
  cache.put('externalStatus', JSON.stringify(statusMap), duration);
  return statusMap;
}

// --- DATA HASH FOR CHANGE DETECTION ---
function getDataHash() {
  try {
    const ss = getSafeSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if (!sheet || sheet.getLastRow() < 2) return '';

    const data = sheet.getDataRange().getDisplayValues();
    const hashInput = JSON.stringify(data);
    return Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, hashInput)
    );
  } catch(e) {
    Logger.log('getDataHash error: ' + e.message);
    return '';
  }
}
