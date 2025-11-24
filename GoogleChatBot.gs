/**
 * GOOGLE CHAT BOT INTEGRATION
 * Handles incoming messages from Google Chat and sends rich responses
 */

/**
 * Main handler for incoming Google Chat messages (via HTTP POST)
 * This gets called when someone messages the bot in Google Chat
 */
function onMessage(event) {
  try {
    Logger.log('Received Google Chat event: ' + JSON.stringify(event));
    
    const message = event.message;
    const sender = event.user;
    const space = event.space;
    
    // Log the message to our internal chat
    const senderName = sender.displayName || sender.email || 'Unknown';
    const messageText = message.text || '';
    
    postToChatLog(`📨 ${senderName}: ${messageText}`, senderName);
    
    // Handle different message types
    if (message.slashCommand) {
      return handleSlashCommand(event);
    } else if (messageText.toLowerCase().includes('help')) {
      return createHelpCard();
    } else if (messageText.toLowerCase().includes('status')) {
      return createStatusCard();
    } else if (messageText.toLowerCase().includes('urgent')) {
      return createUrgentCasesCard();
    } else {
      // Echo back and log
      return {
        text: `Message received: "${messageText}"\n\nUse "help" to see available commands.`
      };
    }
  } catch (e) {
    Logger.log('Error in onMessage: ' + e.message);
    return { text: '❌ Error processing your message. Please try again.' };
  }
}

/**
 * Handler for added to space event
 */
function onAddToSpace(event) {
  try {
    const spaceName = event.space.displayName || 'this space';
    postToChatLog(`🎉 Bot added to ${spaceName}`, 'System');
    
    return {
      text: `👋 Hello! I'm the CWC Notification Bot.\n\nI'll help you stay updated on patient outreach activities.\n\nType "help" to see what I can do!`
    };
  } catch (e) {
    Logger.log('Error in onAddToSpace: ' + e.message);
    return { text: 'Hello! CWC Notification Bot is now active.' };
  }
}

/**
 * Handler for removed from space event
 */
function onRemoveFromSpace(event) {
  try {
    const spaceName = event.space.displayName || 'space';
    postToChatLog(`👋 Bot removed from ${spaceName}`, 'System');
  } catch (e) {
    Logger.log('Error in onRemoveFromSpace: ' + e.message);
  }
}

/**
 * Handle slash commands
 */
function handleSlashCommand(event) {
  const commandName = event.message.slashCommand.commandName;
  
  switch(commandName) {
    case '/status':
      return createStatusCard();
    case '/urgent':
      return createUrgentCasesCard();
    case '/help':
      return createHelpCard();
    case '/stats':
      return createStatsCard();
    default:
      return { text: `Unknown command: ${commandName}` };
  }
}

/**
 * Create help card
 */
function createHelpCard() {
  return {
    cards: [{
      header: {
        title: '📚 CWC Bot Help',
        subtitle: 'Available Commands',
        imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/help/default/48px.svg',
        imageStyle: 'AVATAR'
      },
      sections: [{
        widgets: [
          {
            textParagraph: {
              text: '<b>Text Commands:</b>\n• Type "status" - View current system status\n• Type "urgent" - See urgent cases\n• Type "help" - Show this help'
            }
          },
          {
            textParagraph: {
              text: '<b>Slash Commands:</b>\n• /status - System status card\n• /urgent - Urgent cases card\n• /stats - Analytics dashboard\n• /help - This help message'
            }
          },
          {
            buttons: [{
              textButton: {
                text: 'OPEN DASHBOARD',
                onClick: {
                  openLink: {
                    url: ScriptApp.getService().getUrl()
                  }
                }
              }
            }]
          }
        ]
      }]
    }]
  };
}

/**
 * Create status card showing system overview
 */
function createStatusCard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    
    if (!sheet) {
      return { text: '❌ Cannot access active records sheet.' };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);
    const data = sheet.getDataRange().getDisplayValues();
    const records = getUnifiedPatientData(data, headerMap, false, 2);
    
    const total = records.length;
    const urgent = records.filter(r => r.priority === 'Urgent').length;
    const newEntries = records.filter(r => r.workflowStatus === CONFIG.FLAGS.NEW_ENTRY).length;
    const inPharmacy = records.filter(r => r.workflowStatus === CONFIG.FLAGS.SUBMITTED_TO_PHARMACY).length;
    
    return {
      cards: [{
        header: {
          title: '📊 CWC System Status',
          subtitle: 'Real-time Overview',
          imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/dashboard/default/48px.svg',
          imageStyle: 'AVATAR'
        },
        sections: [{
          widgets: [
            {
              keyValue: {
                topLabel: 'Total Active Records',
                content: String(total),
                contentMultiline: false,
                icon: 'DESCRIPTION'
              }
            },
            {
              keyValue: {
                topLabel: 'Urgent Cases',
                content: String(urgent),
                contentMultiline: false,
                icon: 'STAR'
              }
            },
            {
              keyValue: {
                topLabel: 'New Entries',
                content: String(newEntries),
                contentMultiline: false,
                icon: 'BOOKMARK'
              }
            },
            {
              keyValue: {
                topLabel: 'In Pharmacy',
                content: String(inPharmacy),
                contentMultiline: false,
                icon: 'RECEIPT'
              }
            },
            {
              buttons: [
                {
                  textButton: {
                    text: 'OPEN DASHBOARD',
                    onClick: {
                      openLink: {
                        url: ScriptApp.getService().getUrl()
                      }
                    }
                  }
                },
                {
                  textButton: {
                    text: 'REFRESH',
                    onClick: {
                      action: {
                        actionMethodName: 'refreshStatus'
                      }
                    }
                  }
                }
              ]
            }
          ]
        }]
      }]
    };
  } catch (e) {
    Logger.log('Error creating status card: ' + e.message);
    return { text: '❌ Error fetching status: ' + e.message };
  }
}

/**
 * Create urgent cases card
 */
function createUrgentCasesCard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    
    if (!sheet) {
      return { text: '❌ Cannot access active records sheet.' };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);
    const data = sheet.getDataRange().getDisplayValues();
    const records = getUnifiedPatientData(data, headerMap, false, 2);
    
    const urgentCases = records.filter(r => r.priority === 'Urgent');
    
    if (urgentCases.length === 0) {
      return {
        text: '✅ No urgent cases at this time.'
      };
    }
    
    const widgets = urgentCases.slice(0, 5).map(r => ({
      keyValue: {
        topLabel: r.patientName || 'Unknown',
        content: `PRN: ${r.prn || 'N/A'}\nStatus: ${r.workflowStatus || 'N/A'}`,
        contentMultiline: true,
        icon: 'STAR',
        button: {
          textButton: {
            text: 'VIEW',
            onClick: {
              openLink: {
                url: ScriptApp.getService().getUrl()
              }
            }
          }
        }
      }
    }));
    
    widgets.push({
      textParagraph: {
        text: urgentCases.length > 5 ? `<i>Showing 5 of ${urgentCases.length} urgent cases</i>` : ''
      }
    });
    
    return {
      cards: [{
        header: {
          title: '🚨 Urgent Cases',
          subtitle: `${urgentCases.length} case(s) require attention`,
          imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/warning/default/48px.svg',
          imageStyle: 'AVATAR'
        },
        sections: [{
          widgets: widgets
        }]
      }]
    };
  } catch (e) {
    Logger.log('Error creating urgent cases card: ' + e.message);
    return { text: '❌ Error fetching urgent cases: ' + e.message };
  }
}

/**
 * Create stats card
 */
function createStatsCard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ACTIVE);
    
    if (!sheet) {
      return { text: '❌ Cannot access active records sheet.' };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headerMap = createHeaderMap(headers);
    const data = sheet.getDataRange().getDisplayValues();
    const records = getUnifiedPatientData(data, headerMap, false, 2);
    
    // Calculate stats
    const statusCounts = {};
    records.forEach(r => {
      const status = r.workflowStatus || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const widgets = Object.entries(statusCounts).map(([status, count]) => ({
      keyValue: {
        topLabel: status,
        content: String(count),
        contentMultiline: false
      }
    }));
    
    return {
      cards: [{
        header: {
          title: '📈 Analytics Dashboard',
          subtitle: 'Breakdown by Status',
          imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/analytics/default/48px.svg',
          imageStyle: 'AVATAR'
        },
        sections: [{
          widgets: widgets
        }]
      }]
    };
  } catch (e) {
    Logger.log('Error creating stats card: ' + e.message);
    return { text: '❌ Error fetching stats: ' + e.message };
  }
}

/**
 * Send a rich card notification to Google Chat
 */
function sendRichNotificationCard(title, patientData, action, priority) {
  const webhookUrl = getNotificationWebhookUrl('outreach');
  if (!webhookUrl) return;
  
  const priorityInfo = NotificationEngine.PRIORITY_LEVELS[priority];
  const appUrl = ScriptApp.getService().getUrl();
  
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
            {
              keyValue: {
                topLabel: 'Patient',
                content: patientData.patientName || 'Unknown',
                icon: 'PERSON'
              }
            },
            {
              keyValue: {
                topLabel: 'PRN',
                content: patientData.prn || 'N/A',
                icon: 'BOOKMARK'
              }
            },
            {
              keyValue: {
                topLabel: 'Status',
                content: patientData.workflowStatus || 'N/A',
                icon: 'DESCRIPTION'
              }
            }
          ]
        },
        {
          header: 'Clinical Details',
          widgets: [
            {
              keyValue: {
                topLabel: 'Medication',
                content: patientData.medicationDetails || 'N/A',
                contentMultiline: true
              }
            },
            {
              keyValue: {
                topLabel: 'Provider',
                content: patientData.provider || 'N/A'
              }
            },
            {
              keyValue: {
                topLabel: 'Pharmacy',
                content: patientData.pharmacy || 'N/A'
              }
            }
          ]
        },
        {
          header: 'Notes',
          widgets: [
            {
              textParagraph: {
                text: patientData.outreachNote || patientData.gardenNotes || 'No notes available'
              }
            }
          ]
        },
        {
          widgets: [
            {
              buttons: [{
                textButton: {
                  text: 'OPEN IN DASHBOARD',
                  onClick: {
                    openLink: {
                      url: appUrl
                    }
                  }
                }
              }]
            }
          ]
        }
      ]
    }]
  };
  
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(card),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    Logger.log('Rich card sent to Google Chat: ' + response.getContentText());
  } catch (e) {
    Logger.log('Error sending rich card: ' + e.message);
  }
}

/**
 * Interactive button handler
 */
function onCardClick(event) {
  try {
    const actionMethodName = event.action.actionMethodName;
    
    switch(actionMethodName) {
      case 'refreshStatus':
        return createStatusCard();
      case 'viewUrgent':
        return createUrgentCasesCard();
      default:
        return { text: 'Action completed.' };
    }
  } catch (e) {
    Logger.log('Error in onCardClick: ' + e.message);
    return { text: '❌ Error processing action.' };
  }
}

/**
 * Test function to verify bot is working
 */
function testGoogleChatBot() {
  // Test status card
  const statusCard = createStatusCard();
  Logger.log('Status Card: ' + JSON.stringify(statusCard));
  
  // Test sending to webhook
  sendChatWebhookNotification('🧪 Test message from CWC Bot', 'outreach');
  
  return 'Test complete - check logs';
}

/**
 * Configure the bot (run this once to set up)
 */
function configureGoogleChatBot() {
  const ui = SpreadsheetApp.getUi();
  const webAppUrl = ScriptApp.getService().getUrl();
  
  const message = `
    🤖 GOOGLE CHAT BOT CONFIGURATION
    
    To complete setup:
    
    1. Go to Google Chat API Console: https://console.cloud.google.com/apis/library/chat.googleapis.com
    
    2. Enable the Google Chat API
    
    3. Configure the bot with these settings:
       • Bot name: CWC Notification Bot
       • Avatar URL: (optional)
       • Description: Healthcare notification and workflow bot
       
    4. Connection Settings:
       • App URL: ${webAppUrl}
       • Enable "Interactive features"
       
    5. Slash Commands (optional):
       /status - View system status
       /urgent - Show urgent cases
       /stats - Analytics dashboard
       /help - Show help
    
    6. Permissions:
       • Check "Receive 1:1 messages"
       • Check "Join spaces and group conversations"
    
    7. Copy your Webhook URL and update Config.gs
    
    📋 Your Web App URL has been copied to logs.
  `;
  
  ui.alert('Google Chat Bot Setup', message, ui.ButtonSet.OK);
  Logger.log('Web App URL: ' + webAppUrl);
  
  return webAppUrl;
}
