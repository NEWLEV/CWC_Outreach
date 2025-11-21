/**
 * @OnlyCurrentDoc
 *
 * This script is the server-side backend for the CWC Outreach Web App.
 * It handles data fetching, role-based access, and all update/notification logic.
 *
 * Version: 5.8 (Added dedicated Role-Based Permissions)
 */

/* ------------------------------------------------------------------
 * Entry Point
 * ------------------------------------------------------------------ */

/**
 * Serves the main HTML file for the web app.
 * This is the only doGet function.
 * @returns {HtmlService.HtmlOutput} The HTML output for the web app.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('WebApp_Client.html')
    .setTitle('CWC Notification Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetches all initial data needed to build the app UI.
 * This includes records, config, and user role.
 * @returns {Object} An object containing all initial data.
 */
function getInitialData() {
  try {
    // 1. Get User Info
    const user = getUserInfo();

    // 2. Get Sheet Data
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);

    // 3. Get Active Records (Optimized)
    let activeRecords = [];
    if (activeSheet && activeSheet.getLastRow() > 1) {
      const activeHeaderRow = activeSheet
        .getRange(1, 1, 1, activeSheet.getLastColumn())
        .getDisplayValues()[0];
      const activeHeaderMap = createHeaderMap(activeHeaderRow);

      // SPEED OPTIMIZATION: Only fetch columns needed for the index.
      const indexCols = [
        activeHeaderMap[CONFIG.COLUMNS_BY_NAME.patientName],
        activeHeaderMap[CONFIG.COLUMNS_BY_NAME.prn],
        activeHeaderMap[CONFIG.COLUMNS_BY_NAME.workflowStatus],
      ];

      // This check is in case columns are missing
      if (indexCols.every(col => col !== undefined)) {
        const fullData = activeSheet.getDataRange().getDisplayValues();
        activeRecords = getUnifiedPatientData(fullData, activeHeaderMap, false, 2);
      } else {
        Logger.log(
          'Active sheet is missing required columns (Patient Name, PRN, or Workflow Status).'
        );
      }
    } else {
      Logger.log(
        `Active sheet "${CONFIG.SHEET_NAMES.ACTIVE}" not found or is empty.`
      );
    }

    // 4. Get Archived Record Index (Optimized)
    let archivedRecords = [];
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      const archiveHeaderRow = archiveSheet
        .getRange(1, 1, 1, archiveSheet.getLastColumn())
        .getDisplayValues()[0];
      const archiveHeaderMap = createHeaderMap(archiveHeaderRow);

      // SPEED OPTIMIZATION: Only fetch columns needed for the index.
      const indexCols = [
        archiveHeaderMap[CONFIG.COLUMNS_BY_NAME.patientName],
        archiveHeaderMap[CONFIG.COLUMNS_BY_NAME.prn],
        archiveHeaderMap[CONFIG.COLUMNS_BY_NAME.workflowStatus],
      ];

      if (indexCols.every(col => col !== undefined)) {
        const fullData = archiveSheet.getDataRange().getDisplayValues();
        // Pass true for indexOnly to speed up loading
        archivedRecords = getUnifiedPatientData(fullData, archiveHeaderMap, true, 2);
      } else {
        Logger.log(
          'Archive sheet is missing required columns (Patient Name, PRN, or Workflow Status).'
        );
      }
    } else {
      Logger.log(
        `Archive sheet "${CONFIG.SHEET_NAMES.ARCHIVED}" not found or is empty.`
      );
    }

    // 5. Get Dropdown Options from Settings sheet
    let dropdowns = {
      pharmacy: [],
      provider: [],
      medication: [],
      status: [],
      insurance: [],
      needsScript: [],
      sex: [],
    };

    if (settingsSheet) {
      try {
        dropdowns = {
          pharmacy: settingsSheet.getRange('C2:C').getDisplayValues().flat().filter(String),
          provider: settingsSheet.getRange('D2:D').getDisplayValues().flat().filter(String),
          medication: settingsSheet.getRange('E2:E').getDisplayValues().flat().filter(String),
          status: settingsSheet.getRange('F2:F').getDisplayValues().flat().filter(String),
          insurance: settingsSheet.getRange('G2:G').getDisplayValues().flat().filter(String),
          needsScript: settingsSheet.getRange('H2:H').getDisplayValues().flat().filter(String),
          sex: settingsSheet.getRange('I2:I').getDisplayValues().flat().filter(String),
        };
      } catch (e) {
        Logger.log(
          `Warning: Could not read dropdowns from "Settings" sheet. ${e.message}`
        );
      }
    } else {
      Logger.log(
        'Warning: "Settings" sheet not found. Skipping dropdown list load.'
      );
    }

    // 6. Get App Configuration
    const appConfig = {
      flags: CONFIG.FLAGS,
      columns: CONFIG.COLUMNS_BY_NAME,
      roles: CONFIG.ROLES,
      dropdowns: dropdowns,
    };

    return {
      user: user,
      activeRecords: activeRecords,
      archivedRecords: archivedRecords,
      config: appConfig,
    };
  } catch (error) {
    Logger.log(`Error in getInitialData: ${error.message}`);
    Logger.log(error.stack);
    return {
      error: `Failed to load app data: ${error.message}. Please try refreshing.`,
    };
  }
}

/**
 * Gets the full data for a single archived record.
 * @param {number} rowNum The physical row number of the record in the Archive sheet.
 * @returns {Object} The full patient record object.
 */
function getFullArchivedRecord(rowNum) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);

    const headerRow = archiveSheet
      .getRange(1, 1, 1, archiveSheet.getLastColumn())
      .getDisplayValues()[0];
    const headerMap = createHeaderMap(headerRow);

    const data = archiveSheet
      .getRange(rowNum, 1, 1, archiveSheet.getLastColumn())
      .getDisplayValues();

    // We pass [headerRow, ...data] so getUnifiedPatientData has context
    const fullRecord = getUnifiedPatientData(
      [headerRow, ...data],
      headerMap,
      false,
      rowNum
    );

    return {
      record: fullRecord[0] || null,
    };
  } catch (error) {
    Logger.log(`Error in getFullArchivedRecord: ${error.message}`);
    return {
      error: `Failed to fetch archived record: ${error.message}`,
    };
  }
}

/* ------------------------------------------------------------------
 * User & Role Management
 * ------------------------------------------------------------------ */

/**
 * --- UPDATED ---
 * Gets the current user's email and determines their role(s)
 * by reading the permissions table in the "Settings" sheet (Cols J:K).
 * @returns {Object} An object { email, defaultRole, roles[] }.
 */
function getUserInfo() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  let roles = [];

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);

    // Read the permissions table from J2:K
    const lastRow = settingsSheet.getLastRow();
    const permissionsData = settingsSheet
      .getRange(`J2:K${lastRow}`)
      .getDisplayValues();

    const userRow = permissionsData.find(
      row => (row[0] || '').toLowerCase().trim() === email
    );

    if (userRow) {
      const role = (userRow[1] || '').toUpperCase().trim();
      if (role === CONFIG.ROLES.CWC) {
        roles.push(CONFIG.ROLES.CWC);
      } else if (role === CONFIG.ROLES.PHARMACY) {
        roles.push(CONFIG.ROLES.PHARMACY);
      } else if (role === 'BOTH' || role === 'ADMIN') {
        roles.push(CONFIG.ROLES.CWC, CONFIG.ROLES.PHARMACY);
      }
    }

    // Admin override (always has both roles)
    if (email === CONFIG.ADMIN_EMAIL.toLowerCase()) {
      roles = [CONFIG.ROLES.CWC, CONFIG.ROLES.PHARMACY];
    }

    // Remove duplicates just in case
    roles = [...new Set(roles)];

    if (roles.length === 0) {
      // If no role was found and they are not admin, default to CWC.
      roles.push(CONFIG.ROLES.CWC);
      Logger.log(
        `User ${email} has no role defined in Settings (Cols J:K). Defaulting to CWC.`
      );
    }
  } catch (e) {
    Logger.log(
      `Error in getUserInfo: ${e.message}. Defaulting to CWC role for user ${email}.`
    );
    sendErrorEmail('getUserInfo', e);
    roles = [CONFIG.ROLES.CWC]; // Default to CWC on error
  }

  return {
    email: email,
    defaultRole: roles[0],
    roles: roles, // >1 if they have BOTH
  };
}

/* ------------------------------------------------------------------
 * Data Update Actions
 * ------------------------------------------------------------------ */

/**
 * Saves changes to a record without submitting or sending notifications.
 * @param {number} rowNum The row number to update.
 * @param {Object} updatedFields A simple {key: value} object of fields that changed.
 * @returns {Object} The full, updated patient record.
 */
function saveRecordChanges(rowNum, updatedFields) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const userEmail = Session.getActiveUser().getEmail();

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);

    const originalData = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues();
    const originalRecord = getUnifiedPatientData(
      [headers, ...originalData],
      headerMap,
      false,
      rowNum
    )[0];

    const changes = getAuditChanges(originalRecord, updatedFields, rowNum, 'Save');

    const rowRange = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = rowRange.getDisplayValues()[0];

    changes.forEach(change => {
      const colIndex = headerMap[change.field];
      if (colIndex !== undefined) {
        values[colIndex] = change.newValue;
      }
    });

    sheet.getRange(rowNum, 1, 1, headers.length).setValues([values]);
    SpreadsheetApp.flush();

    const updatedValues = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues()[0];
    const updatedRecord = getUnifiedPatientData(
      [headers, updatedValues],
      headerMap,
      false,
      rowNum
    )[0];

    if (changes.length > 0) {
      logToAudit(changes, userEmail);
    }

    return {
      message: 'Changes saved successfully!',
      updatedRecord: updatedRecord,
    };
  } catch (error) {
    Logger.log(`Error in saveRecordChanges: ${error.message}`);
    return {
      error: `Failed to save: ${error.message}`,
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Submits a CWC update, logs it, and sends notifications.
 * @param {number} rowNum The row number to update.
 * @param {Object} updatedFields A simple {key: value} object of fields that changed.
 * @returns {Object} The full, updated patient record.
 */
function submitToPharmacy(rowNum, updatedFields) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const userEmail = Session.getActiveUser().getEmail();

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);

    const originalData = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues();
    const originalRecord = getUnifiedPatientData(
      [headers, ...originalData],
      headerMap,
      false,
      rowNum
    )[0];

    const changes = getAuditChanges(
      originalRecord,
      updatedFields,
      rowNum,
      'Submit to Pharmacy'
    );

    const rowRange = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = rowRange.getDisplayValues()[0];

    changes.forEach(change => {
      const colIndex = headerMap[change.field];
      if (colIndex !== undefined) {
        values[colIndex] = change.newValue;
      }
    });

    const statusColIndex = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    const tsColIndex = headerMap[CONFIG.COLUMNS_BY_NAME.sentTimestamp];

    if (statusColIndex === undefined || tsColIndex === undefined) {
      throw new Error(
        "Could not find 'Workflow Status' or 'Notification Sent Timestamp' columns. Check Config.gs and sheet headers."
      );
    }

    values[statusColIndex] = CONFIG.FLAGS.SUBMITTED_TO_PHARMACY;
    values[tsColIndex] = new Date();

    sheet.getRange(rowNum, 1, 1, headers.length).setValues([values]);
    SpreadsheetApp.flush();

    const updatedValues = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues()[0];
    const updatedRecord = getUnifiedPatientData(
      [headers, updatedValues],
      headerMap,
      false,
      rowNum
    )[0];

    const auditChanges = changes.concat([
      {
        row: rowNum,
        action: 'Submit to Pharmacy',
        field: 'Workflow Status',
        oldValue: originalRecord.workflowStatus,
        newValue: updatedRecord.workflowStatus,
      },
      {
        row: rowNum,
        action: 'Submit to Pharmacy',
        field: 'Sent Timestamp',
        oldValue: '',
        newValue: updatedRecord.sentTimestamp,
      },
    ]);

    logToAudit(auditChanges, userEmail);

    const recipients = getRecipients();
    const emailList = [...recipients.pharmacy, ...recipients.outreach];
    sendNotificationEmail(
      emailList,
      updatedRecord,
      'New Patient Submitted to Pharmacy',
      auditChanges
    );

    return {
      message: 'Submitted to Pharmacy successfully!',
      updatedRecord: updatedRecord,
    };
  } catch (error) {
    Logger.log(`Error in submitToPharmacy: ${error.message}`);
    sendErrorEmail('submitToPharmacy', error);
    return {
      error: `Failed to submit: ${error.message}`,
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Submits an Outreach update, logs it, and sends notifications.
 * @param {number} rowNum The row number to update.
 * @param {Object} updatedFields A simple {key: value} object of fields that changed.
 * @returns {Object} The full, updated patient record.
 */
function sendOutreachUpdate(rowNum, updatedFields) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const userEmail = Session.getActiveUser().getEmail();

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);

    const originalData = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues();
    const originalRecord = getUnifiedPatientData(
      [headers, ...originalData],
      headerMap,
      false,
      rowNum
    )[0];

    const changes = getAuditChanges(
      originalRecord,
      updatedFields,
      rowNum,
      'Outreach Update'
    );

    const rowRange = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = rowRange.getDisplayValues()[0];

    changes.forEach(change => {
      const colIndex = headerMap[change.field];
      if (colIndex !== undefined) {
        values[colIndex] = change.newValue;
      }
    });

    const statusColIndex = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    if (statusColIndex === undefined) {
      throw new Error("Could not find 'Workflow Status' column.");
    }

    values[statusColIndex] = CONFIG.FLAGS.CWC_UPDATE_SENT;

    sheet.getRange(rowNum, 1, 1, headers.length).setValues([values]);
    SpreadsheetApp.flush();

    const updatedValues = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues()[0];
    const updatedRecord = getUnifiedPatientData(
      [headers, updatedValues],
      headerMap,
      false,
      rowNum
    )[0];

    const auditChanges = changes.concat([
      {
        row: rowNum,
        action: 'Outreach Update',
        field: 'Workflow Status',
        oldValue: originalRecord.workflowStatus,
        newValue: updatedRecord.workflowStatus,
      },
    ]);

    logToAudit(auditChanges, userEmail);

    const recipients = getRecipients();
    sendNotificationEmail(
      recipients.outreach,
      updatedRecord,
      'CWC Outreach Update',
      auditChanges
    );

    return {
      message: 'Outreach update sent!',
      updatedRecord: updatedRecord,
    };
  } catch (error) {
    Logger.log(`Error in sendOutreachUpdate: ${error.message}`);
    sendErrorEmail('sendOutreachUpdate', error);
    return {
      error: `Failed to send update: ${error.message}`,
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Submits a Pharmacy update, logs it, and sends notifications.
 * @param {number} rowNum The row number to update.
 * @param {Object} updatedFields A simple {key: value} object of fields that changed.
 * @returns {Object} The full, updated patient record.
 */
function submitPharmacyUpdate(rowNum, updatedFields) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const userEmail = Session.getActiveUser().getEmail();

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);

    const originalData = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues();
    const originalRecord = getUnifiedPatientData(
      [headers, ...originalData],
      headerMap,
      false,
      rowNum
    )[0];

    const changes = getAuditChanges(
      originalRecord,
      updatedFields,
      rowNum,
      'Pharmacy Update'
    );

    const rowRange = sheet.getRange(rowNum, 1, 1, headers.length);
    let values = rowRange.getDisplayValues()[0];

    changes.forEach(change => {
      const colIndex = headerMap[change.field];
      if (colIndex !== undefined) {
        values[colIndex] = change.newValue;
      }
    });

    const statusColIndex = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus];
    if (statusColIndex === undefined) {
      throw new Error("Could not find 'Workflow Status' column.");
    }

    values[statusColIndex] = CONFIG.FLAGS.PHARMACY_UPDATE;

    sheet.getRange(rowNum, 1, 1, headers.length).setValues([values]);
    SpreadsheetApp.flush();

    const updatedValues = sheet
      .getRange(rowNum, 1, 1, headers.length)
      .getDisplayValues()[0];
    const updatedRecord = getUnifiedPatientData(
      [headers, updatedValues],
      headerMap,
      false,
      rowNum
    )[0];

    const auditChanges = changes.concat([
      {
        row: rowNum,
        action: 'Pharmacy Update',
        field: 'Workflow Status',
        oldValue: originalRecord.workflowStatus,
        newValue: updatedRecord.workflowStatus,
      },
    ]);

    logToAudit(auditChanges, userEmail);

    const recipients = getRecipients();
    const emailList = [...recipients.pharmacy, ...recipients.outreach];
    sendNotificationEmail(
      emailList,
      updatedRecord,
      'Pharmacy Update Received',
      auditChanges
    );

    return {
      message: 'Pharmacy update sent!',
      updatedRecord: updatedRecord,
    };
  } catch (error) {
    Logger.log(`Error in submitPharmacyUpdate: ${error.message}`);
    sendErrorEmail('submitPharmacyUpdate', error);
    return {
      error: `Failed to send update: ${error.message}`,
    };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------
 * Audit Helpers
 * ------------------------------------------------------------------ */

/**
 * Generates an array of change objects for auditing.
 * @param {Object} originalRecord The original patient data.
 * @param {Object} updatedFields The fields that were updated.
 * @param {number} rowNum The row number.
 * @param {string} action The action type.
 * @returns {Array<Object>} Array of change objects.
 */
function getAuditChanges(originalRecord, updatedFields, rowNum, action) {
  const changes = [];
  const keyToHeader = createKeyToHeaderMap();

  for (const key in updatedFields) {
    const fieldName = keyToHeader[key] || key; // Use header name if available
    changes.push({
      row: rowNum,
      action: action,
      field: fieldName,
      oldValue: originalRecord[key] || '',
      newValue: updatedFields[key] || '',
    });
  }

  return changes;
}
