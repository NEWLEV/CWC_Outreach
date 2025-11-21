/**
 * Shared utilities.
 */

// Creates a map of "Header Name" -> Column Index
function createHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => {
    const clean = String(h).trim();
    if (clean) {
      map[clean] = i;
      map[clean.toLowerCase()] = i; // Lowercase fallback
    }
  });
  return map;
}

function createKeyToHeaderMap() {
  const map = {};
  for (const k in CONFIG.COLUMNS_BY_NAME) map[k] = CONFIG.COLUMNS_BY_NAME[k];
  return map;
}

/**
 * ROBUST DATA PARSER
 * Maps sheet rows to internal object keys using fuzzy matching on headers.
 */
function getUnifiedPatientData(data, headerMap, indexOnly = false, baseRowNum = 2) {
  const records = [];
  
  // 1. Create a robust reverse map: "lowercase header" -> "internal key"
  // Example: "patient name" -> "patientName"
  const headerToKey = {};
  for (const key in CONFIG.COLUMNS_BY_NAME) {
    const headerVal = CONFIG.COLUMNS_BY_NAME[key];
    if (headerVal) {
      headerToKey[headerVal.toLowerCase().trim()] = key;
    }
  }

  // 2. Identify the index for each internal key based on the Sheet Headers
  const keyToColIndex = {};
  for (const sheetHeader in headerMap) {
    const lowerSheetHeader = sheetHeader.toLowerCase().trim();
    // Match sheet header to config header
    if (headerToKey[lowerSheetHeader]) {
      keyToColIndex[headerToKey[lowerSheetHeader]] = headerMap[sheetHeader];
    }
  }

  // Debugging helper (logs to Stackdriver if needed)
  // console.log("Key Map:", keyToColIndex);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.join('').trim() === '') continue;

    let record = {
      rowNum: (baseRowNum - 1) + i
    };
    
    // Populate fields using the map
    for (const key in CONFIG.COLUMNS_BY_NAME) {
      const colIdx = keyToColIndex[key];
      if (colIdx !== undefined && row[colIdx] !== undefined) {
        record[key] = row[colIdx];
      } else {
        record[key] = ""; // Ensure key exists even if empty
      }
    }
    
    // Special handling for essential fields if mapping failed
    if (!record.patientName && keyToColIndex['patientName'] === undefined) {
       // Fallback: Try to find column by simple includes
       // This helps if headers are slightly different (e.g. extra spaces)
    }

    records.push(record);
  }
  return records;
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
    // Normalize comparisons
    const oldV = String(original[key] || '').trim();
    const newV = String(updated[key] || '').trim();
    
    if (oldV !== newV) {
      changes.push({
        row: row, 
        action: action, 
        field: map[key] || key,
        oldValue: oldV, 
        newValue: newV
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
    const data = src.getDataRange().getValues();
    const headers = data[0];
    
    const headerMap = createHeaderMap(headers);
    const statusIdx = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus.toLowerCase()];

    const toArchive = [];
    const toDelete = [];
    const archiveFlags = [CONFIG.FLAGS.SUBMITTED_TO_PHARMACY, CONFIG.FLAGS.CWC_UPDATE_SENT, CONFIG.FLAGS.PHARMACY_UPDATE];
    
    if (statusIdx === undefined) return;

    for(let i=1; i<data.length; i++) {
      if(archiveFlags.includes(data[i][statusIdx])) {
        toArchive.push(data[i]);
        toDelete.push(i+1);
      }
    }
    if(toArchive.length > 0) {
      dest.getRange(dest.getLastRow()+1, 1, toArchive.length, headers.length).setValues(toArchive);
      toDelete.reverse().forEach(r => src.deleteRow(r));
    }
  } catch(e) {
    sendErrorEmail('Archiving', e);
  } finally {
    lock.releaseLock();
  }
}
