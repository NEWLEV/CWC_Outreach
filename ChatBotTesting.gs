/**
 * GOOGLE CHAT BOT - CONFIGURATION & TESTING UTILITIES
 * Updated for ScriptProperties (No-Sheet) Architecture
 */

function getWebAppURL() {
  const url = ScriptApp.getService().getUrl();
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('📋 YOUR WEB APP URL (Current Mode)');
  Logger.log(url);
  Logger.log('');
  Logger.log('⚠️ IMPORTANT:');
  Logger.log('If this URL ends in "/dev", it is for TESTING ONLY.');
  Logger.log('You MUST use the "/exec" URL from "Deploy > Manage Deployments"');
  Logger.log('for the Google Chat API Configuration.');
  Logger.log('═══════════════════════════════════════════════');
  return url;
}

function testWebhookConnection() {
  Logger.log('🧪 Testing Webhook Connection...');
  
  const outreachUrl = getNotificationWebhookUrl('outreach');
  if (!outreachUrl) {
    Logger.log('❌ ERROR: No OUTREACH webhook URL configured in Config.gs!');
    return false;
  }
  
  Logger.log('✅ Outreach webhook URL found');
  try {
    const msg = `🧪 Connection Test: ${new Date().toLocaleTimeString()}`;
    sendChatWebhookNotification(msg, 'outreach');
    Logger.log('✅ Test message sent to Google Chat');
  } catch (e) {
    Logger.log('❌ ERROR sending test: ' + e.message);
    return false;
  }
  
  return true;
}

function testBotResponse() {
  Logger.log('🔄 Testing Bot Logic...');
  
  // Simulate incoming message
  const testEvent = {
    type: 'MESSAGE',
    message: { text: 'status' },
    user: { displayName: 'TestRunner', email: 'test@example.com', type: 'HUMAN' },
    space: { displayName: 'TestSpace' }
  };
  
  try {
    // 1. Run the handler
    onMessage(testEvent);
    Logger.log('✅ onMessage executed without error');
    
    // 2. Verify it saved to Memory
    const history = getChatHistory();
    const lastMsg = history[history.length - 1];
    
    if (lastMsg && lastMsg.text === 'status' && lastMsg.sender === 'TestRunner') {
      Logger.log('✅ Message correctly saved to Script Memory');
    } else {
      Logger.log('⚠️ Message processed but NOT found in Memory.');
      Logger.log('   Last saved: ' + JSON.stringify(lastMsg));
    }
    
  } catch (e) {
    Logger.log('❌ ERROR in bot response: ' + e.message);
    return false;
  }
  
  return true;
}

function testRichCardNotification() {
  Logger.log('📊 Testing Rich Card...');
  
  try {
    sendRichNotificationCard(
      'Test Card',
      { patientName: 'System Check', prn: 'SYS-01', workflowStatus: 'Active' },
      'Maintenance',
      'LOW'
    );
    Logger.log('✅ Rich card function executed');
  } catch (e) {
    Logger.log('❌ ERROR sending rich card: ' + e.message);
    return false;
  }
  return true;
}

function verifyConfiguration() {
  Logger.log('🔍 VERIFYING CONFIGURATION...');
  
  const issues = [];
  
  // Check 1: Webhook
  if (!getNotificationWebhookUrl('outreach')) {
    issues.push('CHAT_WEBHOOK_URL not set in Config.gs');
  }
  
  // Check 2: Required sheets (Only Active/Settings/Security now)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [CONFIG.SHEET_NAMES.ACTIVE, CONFIG.SHEET_NAMES.SETTINGS, CONFIG.SHEET_NAMES.SECURITY].forEach(name => {
    if (!ss.getSheetByName(name)) issues.push('Missing Sheet: ' + name);
  });
  
  if (issues.length === 0) {
    Logger.log('✅ Configuration looks good (Sheets + Webhook)');
    return true;
  } else {
    Logger.log('❌ ISSUES FOUND:');
    issues.forEach(i => Logger.log('   - ' + i));
    return false;
  }
}

function runAllTests() {
  Logger.log('🚀 RUNNING UPDATED TEST SUITE');
  
  const results = {
    config: verifyConfiguration(),
    webhook: testWebhookConnection(),
    botLogic: testBotResponse(),
    richCard: testRichCardNotification()
  };
  
  Logger.log('');
  Logger.log('📊 RESULTS');
  Object.entries(results).forEach(([k, v]) => Logger.log((v ? '✅ ' : '❌ ') + k.toUpperCase()));
  
  return results;
}
