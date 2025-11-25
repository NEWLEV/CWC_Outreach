/**
 * GOOGLE CHAT BOT INTEGRATION
 * Handles incoming messages from Google Chat and sends rich responses.
 */

// --- INCOMING MESSAGE HANDLER ---
function onMessage(event) {
  try {
    const message = event.message;
    const sender = event.user;
    const senderName = sender.displayName || sender.email || 'Unknown';
    const messageText = message.text || '';
    
    // Ignore Bot's own messages to prevent loops
    if (sender.type === 'BOT') return { };

    // LOGIC: Log user messages to Sidebar Memory
    try {
      logChatMessage(senderName, messageText);
    } catch (e) { Logger.log('Log error: ' + e.message); }

    // Handle Commands
    if (message.slashCommand) return handleSlashCommand(event);
    if (messageText.toLowerCase().includes('help')) return createHelpCard();
    if (messageText.toLowerCase().includes('status')) return createStatusCard();
    if (messageText.toLowerCase().includes('urgent')) return createUrgentCasesCard();
    
    // Return empty JSON so we don't echo the text back to the chat user
    return { };

  } catch (e) {
    return { text: '❌ System Error' };
  }
}

// --- OUTGOING NOTIFICATION HANDLER ---

/**
 * UPDATED: Sends Rich Card to Chat AND logs text summary to Sidebar Memory
 */
function sendRichNotificationCard(title, patientData, action, priority) {
  const webhookUrl = getNotificationWebhookUrl('outreach');
  if (!webhookUrl) return;
  
  const priorityInfo = NotificationEngine.PRIORITY_LEVELS[priority];
  const appUrl = ScriptApp.getService().getUrl();

  // 1. Construct Rich Card for Google Chat
  const card = {
    cards: [{
      header: {
        title: `${priorityInfo.icon} ${title}`,
        subtitle: `${priority} Priority`,
        imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/notification_important/default/48px.svg',
        imageStyle: 'AVATAR'
      },
      sections: [
        {
          header: 'Patient Information',
          widgets: [
            { keyValue: { topLabel: 'Patient', content: patientData.patientName || 'Unknown', icon: 'PERSON' } },
            { keyValue: { topLabel: 'PRN', content: patientData.prn || 'N/A', icon: 'BOOKMARK' } },
            { keyValue: { topLabel: 'Status', content: patientData.workflowStatus || 'N/A', icon: 'DESCRIPTION' } }
          ]
        },
        {
          header: 'Details',
          widgets: [
            { keyValue: { topLabel: 'Action', content: action || 'Update', contentMultiline: true } }
          ]
        },
        {
          widgets: [
            { buttons: [{ textButton: { text: 'OPEN DASHBOARD', onClick: { openLink: { url: appUrl } } } }] }
          ]
        }
      ]
    }]
  };
  
  // 2. Send to Google Chat
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(card),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(webhookUrl, options);
  } catch (e) {
    Logger.log('Error sending rich card: ' + e.message);
  }

  // 3. Log Summary to Sidebar History
  try {
    const summary = `📢 *${title}* \nPatient: ${patientData.patientName} (${patientData.prn})`;
    logChatMessage('System', summary);
  } catch (e) {
    Logger.log('Error logging card summary: ' + e.message);
  }
}

// --- STANDARD HANDLERS ---

function onAddToSpace(event) {
  logChatMessage('System', `Bot added to ${event.space.displayName || 'space'}`);
  return { text: `👋 Hello! I'm the CWC Notification Bot.` };
}

function onRemoveFromSpace(event) {
  logChatMessage('System', `Bot removed from ${event.space.displayName || 'space'}`);
}

function handleSlashCommand(event) {
  const commandName = event.message.slashCommand.commandName;
  switch(commandName) {
    case '/status': return createStatusCard();
    case '/urgent': return createUrgentCasesCard();
    case '/help': return createHelpCard();
    default: return { text: `Unknown command: ${commandName}` };
  }
}

function onCardClick(event) {
  const action = event.action.actionMethodName;
  if (action === 'refreshStatus') return createStatusCard();
  return { text: 'Action completed.' };
}

// --- CARD GENERATORS ---

function createHelpCard() {
  return {
    cards: [{
      header: { title: 'Help', subtitle: 'Commands', imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/help/default/48px.svg', imageStyle: 'AVATAR' },
      sections: [{ widgets: [{ textParagraph: { text: 'Use /status or /urgent' } }] }]
    }]
  };
}

function createStatusCard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    if(!sheet) return { text: "Error: No Sheet" };
    const count = sheet.getLastRow() - 1;
    return {
      cards: [{
        header: { title: 'System Status', subtitle: `${count} Active Records`, imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/dashboard/default/48px.svg', imageStyle: 'AVATAR' },
        sections: [{ widgets: [{ buttons: [{ textButton: { text: 'REFRESH', onClick: { action: { actionMethodName: 'refreshStatus' } } } }] }] }]
      }]
    };
  } catch(e) { return { text: "Error" }; }
}

function createUrgentCasesCard() {
  return { text: "Urgent cases feature is active." }; 
}

function createStatsCard() { return createStatusCard(); }

function testGoogleChatBot() {
  sendRichNotificationCard('Test Card', {patientName:'Test Patient', prn:'123'}, 'Test Action', 'HIGH');
}
