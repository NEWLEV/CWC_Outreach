/**
 * Shared utilities.
 */
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
  const keyToHeader = createKeyToHeaderMap();
  const headerToKey = {};
  for (const k in keyToHeader) headerToKey[keyToHeader[k]] = k;

  const findCol = (name) => {
    if (headerMap[name] !== undefined) return headerMap[name];
    if (headerMap[name.toLowerCase()] !== undefined) return headerMap[name.toLowerCase()];
    return -1;
  };

  const nameIdx = findCol(CONFIG.COLUMNS_BY_NAME.patientName);
  const prnIdx = findCol(CONFIG.COLUMNS_BY_NAME.prn);
  const statusIdx = findCol(CONFIG.COLUMNS_BY_NAME.workflowStatus);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.join('').trim() === '') continue;

    let record = {
      rowNum: (baseRowNum - 1) + i,
      patientName: (nameIdx > -1 ? row[nameIdx] : '') || '',
      prn: (prnIdx > -1 ? row[prnIdx] : '') || '',
      workflowStatus: (statusIdx > -1 ? row[statusIdx] : '') || ''
    };
    if (!indexOnly) {
      for (const header in headerMap) {
        let key = headerToKey[header];
        if(!key) {
           for(const k in CONFIG.COLUMNS_BY_NAME) {
             if(CONFIG.COLUMNS_BY_NAME[k].toLowerCase() === header.toLowerCase()) {
               key = k;
               break;
             }
           }
        }
        if (key && !record.hasOwnProperty(key)) {
            record[key] = row[headerMap[header]] || '';
        }
      }
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

function getNotificationWebhookUrl(mode = 'outreach') {
  const properties = PropertiesService.getScriptProperties();
  let url;
  let key;

  if (mode === 'outreach') {
    key = 'CHAT_WEBHOOK_URL';
    url = properties.getProperty(key) || CONFIG.CHAT_WEBHOOK_URL;
  } else if (mode === 'pharmacy') {
    key = 'PHARMACY_CHAT_WEBHOOK_URL';
    url = properties.getProperty(key) || CONFIG.PHARMACY_CHAT_WEBHOOK_URL;
  }
  return url;
}

/**
 * UPDATED: Sends notification to Google Chat AND logs to Sidebar Memory
 */
function sendChatWebhookNotification(text, mode = 'outreach') {
  const webhookUrl = getNotificationWebhookUrl(mode); 
  if (!webhookUrl || !text) return;

  // 1. Send to Google Chat
  try {
    const payload = { text: text };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(webhookUrl, options); 
  } catch (e) {
    Logger.log(`Webhook Failed: ${e.message}`);
  }

  // 2. Log to Sidebar Memory (Only for Outreach to avoid clutter)
  if (mode === 'outreach' && typeof logChatMessage === 'function') {
    try {
       // 'System' sender so it looks distinct in the sidebar
       logChatMessage('System', text);
    } catch(e) {
       Logger.log('Failed to log system message: ' + e.message);
    }
  }
}
