/**
 * ARCHIVE MANAGER
 * Handles automated and manual archiving of completed records
 */

/**
 * Archives all records where workflowStatus != "New Entry"
 * Moves records from "Form Responses 1" to "Archived Data"
 */
function archiveRecords() {
  try {
    const ss = getSafeSpreadsheet();
    const activeSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    const archiveSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ARCHIVED);
    const auditSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOG);
    
    if (!activeSheet || !archiveSheet) {
      throw new Error('Required sheets not found');
    }
    
    // Get all data from active sheet
    const activeData = activeSheet.getDataRange().getValues();
    const headers = activeData[0];
    const headerMap = Utils.createHeaderMap(headers);
    const statusCol = headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus] ?? headerMap[CONFIG.COLUMNS_BY_NAME.workflowStatus.toLowerCase()];
    
    if (statusCol === undefined) {
      throw new Error(`Workflow Status column '${CONFIG.COLUMNS_BY_NAME.workflowStatus}' not found`);
    }
    
    // Find rows to archive (status != "New Entry")
    const rowsToArchive = [];
    const rowsToDelete = [];
    
    for (let i = 1; i < activeData.length; i++) {
      const status = activeData[i][statusCol];
      if (status && status !== CONFIG.FLAGS.NEW_ENTRY) {
        rowsToArchive.push(activeData[i]);
        rowsToDelete.push(i + 1); // Sheet rows are 1-indexed
      }
    }
    
    if (rowsToArchive.length === 0) {
      Logger.log('No records to archive');
      return {
        success: true,
        archivedCount: 0,
        message: 'No records found for archiving (all are New Entry status)'
      };
    }
    
    // Append rows to archive sheet
    if (rowsToArchive.length > 0) {
      const archiveLastRow = archiveSheet.getLastRow();
      archiveSheet.getRange(archiveLastRow + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
        .setValues(rowsToArchive);
    }
    
    // Delete rows from active sheet (in reverse order to maintain indices)
    rowsToDelete.reverse().forEach(rowNum => {
      activeSheet.deleteRow(rowNum);
    });
    
    // Log to audit
    if (auditSheet) {
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      auditSheet.appendRow([
        timestamp,
        user,
        'BATCH',
        'ARCHIVE',
        'Workflow Status',
        `Archived ${rowsToArchive.length} records`,
        'Moved to Archived Data sheet'
      ]);
    }
    
    Logger.log(`Successfully archived ${rowsToArchive.length} records`);
    
    // Show success message to user
    SpreadsheetApp.getUi().alert(
      '✅ Archive Complete',
      `Successfully archived ${rowsToArchive.length} record(s) to "Archived Data" sheet.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    return {
      success: true,
      archivedCount: rowsToArchive.length,
      message: `Archived ${rowsToArchive.length} records`
    };
    
  } catch (error) {
    Logger.log('Archive error: ' + error.toString());
    SpreadsheetApp.getUi().alert(
      '❌ Archive Failed',
      'Error: ' + error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Sets up a daily time-based trigger to archive records at 6 PM
 */
function setupArchiveTrigger() {
  try {
    // Delete existing archive triggers to prevent duplicates
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'archiveRecords') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create new daily trigger at 6 PM
    ScriptApp.newTrigger('archiveRecords')
      .timeBased()
      .atHour(18) // 6 PM (18:00 in 24-hour format)
      .everyDays(1)
      .create();
    
    Logger.log('Archive trigger set up successfully for 6 PM daily');
    
    SpreadsheetApp.getUi().alert(
      '✅ Auto-Archive Enabled',
      'Daily archiving has been scheduled for 6:00 PM.\n\nRecords with status other than "New Entry" will be automatically moved to the Archived Data sheet every day at 6 PM.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    return { success: true };
    
  } catch (error) {
    Logger.log('Trigger setup error: ' + error.toString());
    SpreadsheetApp.getUi().alert(
      '❌ Trigger Setup Failed',
      'Error: ' + error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Removes the daily archive trigger
 */
function removeArchiveTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'archiveRecords') {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      }
    });
    
    SpreadsheetApp.getUi().alert(
      '✅ Auto-Archive Disabled',
      `Removed ${removed} archive trigger(s).`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    return { success: true, removed: removed };
    
  } catch (error) {
    Logger.log('Trigger removal error: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}
