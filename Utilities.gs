/**
 * Shared utilities.
 * Updated: Robust Data Mapping to ensure all fields are captured.
 */

// --- HEADERS & DATA MAPPING ---

function createHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => {
    const clean = String(h).trim();
    if (clean) {
      map[clean] = i;
      map[clean.toLowerCase()] = i;
    }
  });
  return map;
}

function createKeyToHeaderMap() {
  const map = {};
  for (const k in CONFIG.COLUMNS_BY_NAME) map[k] = CONFIG.COLUMNS_BY_NAME[k];
  return map;
}

function getUnifiedPatientData(data, headerMap, indexOnly = false, baseRowNum = 2) {
  const records = [];
  const keyToHeader = createKeyToHeaderMap(); // Maps internal keys (patientName) to Header Names ("Patient Name")

  // Pre-calculate indices for all known columns to avoid repeated lookups
  const colIndices = {};
  for (const key in keyToHeader) {
    const headerName = keyToHeader[key];
    // Try exact match, then lowercase
    if (headerMap[headerName] !== undefined) {
      colIndices[key] = headerMap[headerName];
    } else if (headerMap[headerName.toLowerCase()] !== undefined) {
      colIndices[key] = headerMap[headerName.toLowerCase()];
    } else {
      colIndices[key] = -1; // Column not found
    }
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip empty rows
    if (row.join('').trim() === '') continue;

    let record = {
      rowNum: (baseRowNum - 1) + i
    };

    // Map ALL fields defined in CONFIG
    for (const key in colIndices) {
      const idx = colIndices[key];
      if (idx > -1 && idx < row.length) {
        record[key] = row[idx];
      } else {
        record[key] = ''; // Default to empty string if missing
      }
    }

    // Specific handling for critical fields if they might be missing/empty
    record.patientName = record.patientName || 'Unnamed';
    record.prn = record.prn || '';
    record.workflowStatus = record.workflowStatus || '';

    records.push(record);
  }
  return records;
}

// --- EXTERNAL STATUS (MAIL / MEDS) ---

function fetchExternalStatus(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('externalStatus');
  
  if (cached && !forceRefresh) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }

  const statusMap = {};
  
  if (CONFIG.EXTERNAL_SHEETS) {
    CONFIG.EXTERNAL_SHEETS.forEach(conf => {
      try {
        const ss = SpreadsheetApp.openById(conf.id);
        const sheet = conf.sheetName ? ss.getSheetByName(conf.sheetName) : ss.getSheets()[0];
        if (!sheet) return;
        
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        
        const data = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
        
        data.forEach(val => {
          if (!val) return;
          const key = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!statusMap[key]) statusMap[key] = [];
          if (!statusMap[key].includes(conf.label)) statusMap[key].push(conf.label);
        });
      } catch (e) {
        console.error(`Error fetching ${conf.label}: ${e.message}`);
      }
    });
  }
  
  cache.put('externalStatus', JSON.stringify(statusMap), 300);
  return statusMap;
}

// --- WEBHOOK NOTIFICATION ---

function sendChatWebhookNotification(text) {
  const url = CONFIG.CHAT_WEBHOOK_URL;
  if (!url || !text) return;

  try {
    const payload = { text: text };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error("Webhook Error: " + e.message);
  }
}

function getRecipients() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('emailRecipients');
  if (cached) return JSON.parse(cached);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
    const pharmacy = sheet.getRange('A2:A').getDisplayValues().flat().filter(String);
    const outreach = sheet.getRange('B2:B').getDisplayValues().flat().filter(String);
    const result = { cwc: outreach, pharmacy: pharmacy, outreach: outreach };
    cache.put('emailRecipients', JSON.stringify(result), 600);
    return result;
  } catch (e) {
    return { cwc: [CONFIG.ADMIN_EMAIL], pharmacy: [CONFIG.ADMIN_EMAIL], outreach: [CONFIG.ADMIN_EMAIL] };
  }
}

function getAuditChanges(original, updated, row, action) {
  const changes = [];
  const map = createKeyToHeaderMap();
  for (const key in updated) {
    if (original[key] !== updated[key]) {
      changes.push({
        row: row, action: action, field: map[key] || key,
        oldValue: original[key] || '', newValue: updated[key] || ''
      });
    }
  }
  return changes;
}

function sendErrorEmail(context, error) {
  try {
    MailApp.sendEmail(CONFIG.ADMIN_EMAIL, `Script Error: ${context}`, `Error: ${error.message}\nStack: ${error.stack}`);
  } catch(e) {}
}

function archiveProcessedData() {
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(30000)) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const src = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const dest = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    if (!src || !dest || src.getLastRow() < 2) return;
    
    const data = src.getDataRange().getValues();
    const headers = data[0];
    const statusIdx = headers.indexOf(CONFIG.COLUMNS_BY_NAME.workflowStatus);

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
    sendErrorEmail('Archiving', e);
  } finally {
    lock.releaseLock();
  }
}
