/**

 * @OnlyCurrentDoc

 *

 * This script runs the core backend for the Transactional Patient Notification System.

 * It handles the onOpen, onFormSubmit, and onEdit triggers, and launches the

 * main web application sidebar.

 *

 * Version: 2.1.0 (Added Admin Sync)

 */



/**

 * Creates the custom menu when the spreadsheet is opened.

 * This menu is the primary entry point for users.

 */

function onOpen() {

  const ui = SpreadsheetApp.getUi();

  ui.createMenu('CWC Notification App')

    .addItem('Open Notification Manager', 'showWebAppSidebar')

    .addSeparator()

    .addItem('Archive Processed Records', 'manualArchiveData_UI')

    .addSeparator() // New separator for admin tasks

    .addItem('(Admin) Sync Project Editors', 'runSyncProjectEditors_UI') // New admin function

    .addToUi();

}



/**

 * Runs on new Google Form submission.

 * Logs the entry and sends a simple *internal* CWC notification.

 *

 * @param {GoogleAppsScript.Events.Sheets.OnFormSubmit} e The event object.

 */

function onFormSubmit(e) {

  if (!e || !e.range) {

    Logger.log('onFormSubmit event was invalid or had no range.');

    return;

  }

 

  try {

    const sheet = e.range.getSheet();

    if (sheet.getName() !== CONFIG.SHEET_NAMES.ACTIVE) {

      return;

    }

   

    Logger.log(`New form submission received on row ${e.range.getRow()}.`);

   

    // Send a simple internal CWC alert

    sendCWCNewEntryAlert(e.range);

   

    // Set the default visual status for a new entry

    const headers = getSheetHeaders(sheet);

    const statusColIndex = headers.indexOf(CONFIG.COLUMNS.WORKFLOW_STATUS.header);

    if (statusColIndex !== -1) {

      const statusCell = sheet.getRange(e.range.getRow(), statusColIndex + 1);

      statusCell.setValue(CONFIG.FLAGS.NEW_ENTRY);

      statusCell.setBackground(CONFIG.COLORS.NEW_ENTRY);

    }

   

  } catch (error) {

    Logger.log(`Error in onFormSubmit: ${error.message}`);

    sendErrorEmail('onFormSubmit', error);

  }

}



/**

 * Runs when a user manually edits any cell.

 * If a "critical" column is edited, it flags the row for "Review Required".

 *

 * @param {GoogleAppsScript.Events.Sheets.OnEdit} e The event object.

 */

function onEdit(e) {

  if (!e || !e.range) {

    Logger.log('onEdit event was invalid or had no range.');

    return;

  }



  const sheet = e.range.getSheet();

  const row = e.range.getRow();

  const column = e.range.getColumn();



  // Exit if not on the active sheet or if it's the header row

  if (sheet.getName() !== CONFIG.SHEET_NAMES.ACTIVE || row <= 1) {

    return;

  }

 

  // Exit if on a settings or log sheet

  if (sheet.getName() === CONFIG.SHEET_NAMES.SETTINGS || sheet.getName() === CONFIG.SHEET_NAMES.AUDIT_LOG) {

    return;

  }



  try {

    const headers = getSheetHeaders(sheet);

    const statusColIndex = headers.indexOf(CONFIG.COLUMNS.WORKFLOW_STATUS.header);

    const sentColIndex = headers.indexOf(CONFIG.COLUMNS.NOTIFICATION_SENT.header);



    // If the edit was to the workflow status column itself, don't do anything

    if (column === statusColIndex + 1) {

      return;

    }

   

    // Check if the edited column is one we are monitoring

    const editedHeader = headers[column - 1];

    const isCriticalColumn = CONFIG.CRITICAL_COLUMNS_TO_WATCH.includes(editedHeader);



    if (isCriticalColumn) {

      // Get the current status

      const statusCell = sheet.getRange(row, statusColIndex + 1);

      const currentStatus = statusCell.getValue();

      const sentStatus = sheet.getRange(row, sentColIndex + 1).getValue();

     

      // If the notification has NOT been sent and the row is not already

      // marked as "Submitted", flag it for review.

      if (!sentStatus && currentStatus !== CONFIG.FLAGS.SUBMITTED_TO_PHARMACY) {

        statusCell.setValue(CONFIG.FLAGS.REVIEW_REQUIRED);

        statusCell.setBackground(CONFIG.COLORS.REVIEW_REQUIRED);

      }

    }

  } catch (error) {

    Logger.log(`Error in onEdit: ${error.message}`);

  }

}



/**

 * Opens the web app in a sidebar.

 */

function showWebAppSidebar() {

  try {

    const html = HtmlService.createTemplateFromFile('WebApp_Client')

      .evaluate()

      .setTitle('CWC Notification Manager');

    SpreadsheetApp.getUi().showSidebar(html);

  } catch (error) {

    Logger.log(`Error showing web app sidebar: ${error.message}`);

    sendErrorEmail('showWebAppSidebar', error);

  }

}



/**

 * Wrapper function to allow manual archiving from the UI menu.

 */

function manualArchiveData_UI() {

  const ui = SpreadsheetApp.getUi();

  try {

    const count = archiveProcessedData();

    ui.alert(`Archiving Complete`, `Successfully archived ${count} processed records.`, ui.ButtonSet.OK);

  } catch (error) {

    Logger.log(`Error during manual archive: ${error.message}`);

    sendErrorEmail('manualArchiveData_UI', error);

    ui.alert('Archive Failed', `An error occurred: ${error.message}`, ui.ButtonSet.OK);

  }

}



/**

 * NEW: UI wrapper for the editor sync function.

 * Only the project owner can run this successfully.

 */

function runSyncProjectEditors_UI() {

  const ui = SpreadsheetApp.getUi();

  try {

    // This function requires advanced Drive API services.

    // Google will ask the user running this to approve those permissions.

    const count = syncProjectEditors();

    ui.alert('Permissions Synced', `Successfully added ${count} new user(s) as editors to the Apps Script project. Other users are already editors.`, ui.ButtonSet.OK);

  } catch (e) {

    Logger.log(`Error syncing editors: ${e.message}`);

    sendErrorEmail('runSyncProjectEditors_UI', e);

    ui.alert('Sync Failed', `An error occurred: ${e.message}. You must be the project owner to run this.`, ui.ButtonSet.OK);

  }

}
