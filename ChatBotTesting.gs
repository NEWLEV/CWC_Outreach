/**
 * GOOGLE CHAT BOT - CONFIGURATION & TESTING UTILITIES
 * Run these functions to configure and test your Google Chat integration
 */

/**
 * 🎯 STEP 1: Get your Web App URL
 * Run this first to get the URL you'll need for Google Chat API configuration
 */
function getWebAppURL() {
  const url = ScriptApp.getService().getUrl();
  
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('📋 YOUR WEB APP URL:');
  Logger.log(url);
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('');
  Logger.log('✅ NEXT STEPS:');
  Logger.log('1. Copy this URL');
  Logger.log('2. Go to Google Cloud Console > Google Chat API > Configuration');
  Logger.log('3. Paste this URL in the "App URL" field');
  Logger.log('4. Enable "Interactive features"');
  Logger.log('5. Save the configuration');
  
  // Also show in UI if running from spreadsheet
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '📋 Web App URL',
      url + '\n\nCopy this URL and use it in Google Chat API configuration.',
      ui.ButtonSet.OK
    );
  } catch(e) {
    // Not running from spreadsheet UI
  }
  
  return url;
}

/**
 * 🧪 STEP 2: Test Webhook Connection
 * Verifies that your webhook URL is working
 */
function testWebhookConnection() {
  Logger.log('🧪 Testing Webhook Connection...');
  Logger.log('');
  
  // Test Outreach webhook
  const outreachUrl = getNotificationWebhookUrl('outreach');
  if (!outreachUrl) {
    Logger.log('❌ ERROR: No OUTREACH webhook URL configured!');
    Logger.log('   Please set CHAT_WEBHOOK_URL in Config.gs');
    return false;
  }
  
  Logger.log('✅ Outreach webhook URL found');
  Logger.log('   URL: ' + outreachUrl.substring(0, 50) + '...');
  
  try {
    sendChatWebhookNotification('🧪 **TEST MESSAGE**\nIf you see this, the webhook is working correctly!', 'outreach');
    Logger.log('✅ Test message sent successfully');
    Logger.log('   Check your Google Chat space for the test message');
  } catch (e) {
    Logger.log('❌ ERROR sending test message:');
    Logger.log('   ' + e.message);
    return false;
  }
  
  // Test Pharmacy webhook
  Logger.log('');
  const pharmacyUrl = getNotificationWebhookUrl('pharmacy');
  if (pharmacyUrl && pharmacyUrl !== outreachUrl) {
    Logger.log('✅ Pharmacy webhook URL found (separate from outreach)');
    try {
      sendChatWebhookNotification('🧪 **PHARMACY TEST**\nPharmacy webhook test', 'pharmacy');
      Logger.log('✅ Pharmacy test message sent');
    } catch (e) {
      Logger.log('❌ ERROR sending pharmacy test:');
      Logger.log('   ' + e.message);
    }
  } else {
    Logger.log('ℹ️  Pharmacy webhook using same URL as outreach (this is OK)');
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('🎉 WEBHOOK TEST COMPLETE');
  Logger.log('═══════════════════════════════════════════════');
  
  return true;
}

/**
 * 🔄 STEP 3: Test Bot Response (requires bot to be configured)
 * This simulates what happens when someone messages the bot
 */
function testBotResponse() {
  Logger.log('🔄 Testing Bot Response Handlers...');
  Logger.log('');
  
  // Simulate a MESSAGE event from Google Chat
  const testEvent = {
    type: 'MESSAGE',
    message: {
      text: 'status',
      sender: {
        displayName: 'Test User',
        email: 'test@example.com'
      }
    },
    space: {
      name: 'spaces/test',
      displayName: 'Test Space'
    },
    user: {
      name: 'users/test',
      displayName: 'Test User',
      email: 'test@example.com'
    }
  };
  
  try {
    const response = onMessage(testEvent);
    Logger.log('✅ Bot responded successfully');
    Logger.log('   Response type: ' + (response.cards ? 'Card' : 'Text'));
    Logger.log('   Response preview: ' + JSON.stringify(response).substring(0, 100) + '...');
  } catch (e) {
    Logger.log('❌ ERROR in bot response:');
    Logger.log('   ' + e.message);
    return false;
  }
  
  // Test help command
  Logger.log('');
  Logger.log('Testing help command...');
  testEvent.message.text = 'help';
  try {
    const helpResponse = onMessage(testEvent);
    Logger.log('✅ Help command works');
  } catch (e) {
    Logger.log('❌ Help command error: ' + e.message);
  }
  
  // Test urgent command
  Logger.log('');
  Logger.log('Testing urgent command...');
  testEvent.message.text = 'urgent';
  try {
    const urgentResponse = onMessage(testEvent);
    Logger.log('✅ Urgent command works');
  } catch (e) {
    Logger.log('❌ Urgent command error: ' + e.message);
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('🎉 BOT RESPONSE TEST COMPLETE');
  Logger.log('═══════════════════════════════════════════════');
  
  return true;
}

/**
 * 📊 STEP 4: Test Rich Card Notification
 * Tests the rich card that gets sent when actions happen
 */
function testRichCardNotification() {
  Logger.log('📊 Testing Rich Card Notification...');
  Logger.log('');
  
  // Create sample patient data
  const samplePatient = {
    patientName: 'John Doe (TEST)',
    prn: 'TEST123',
    workflowStatus: 'New Entry',
    medicationDetails: 'Sertraline 50mg',
    provider: 'Dr. Smith',
    pharmacy: 'CVS Pharmacy',
    priority: 'Urgent',
    outreachNote: 'This is a test notification from the CWC system.',
    creatorEmail: Session.getActiveUser().getEmail()
  };
  
  try {
    sendRichNotificationCard(
      'Test Notification',
      samplePatient,
      'Test Action',
      'HIGH'
    );
    
    Logger.log('✅ Rich card sent successfully');
    Logger.log('   Check your Google Chat space for a formatted card');
    Logger.log('   Patient: ' + samplePatient.patientName);
    Logger.log('   Priority: HIGH');
  } catch (e) {
    Logger.log('❌ ERROR sending rich card:');
    Logger.log('   ' + e.message);
    return false;
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('🎉 RICH CARD TEST COMPLETE');
  Logger.log('═══════════════════════════════════════════════');
  
  return true;
}

/**
 * 🔍 STEP 5: Verify Configuration
 * Checks that everything is configured correctly
 */
function verifyConfiguration() {
  Logger.log('🔍 VERIFYING CONFIGURATION...');
  Logger.log('');
  
  const issues = [];
  const warnings = [];
  
  // Check 1: Web App URL
  try {
    const webAppUrl = ScriptApp.getService().getUrl();
    if (webAppUrl) {
      Logger.log('✅ Web App is deployed');
      Logger.log('   URL: ' + webAppUrl);
    }
  } catch (e) {
    issues.push('Web App not deployed or not accessible');
  }
  
  // Check 2: Webhook URLs
  Logger.log('');
  const outreachUrl = getNotificationWebhookUrl('outreach');
  if (outreachUrl) {
    Logger.log('✅ Outreach webhook configured');
  } else {
    issues.push('CHAT_WEBHOOK_URL not set in Config.gs');
  }
  
  const pharmacyUrl = getNotificationWebhookUrl('pharmacy');
  if (pharmacyUrl) {
    Logger.log('✅ Pharmacy webhook configured');
  } else {
    warnings.push('PHARMACY_CHAT_WEBHOOK_URL not set (will use outreach URL)');
  }
  
  // Check 3: Required sheets
  Logger.log('');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const requiredSheets = [
      CONFIG.SHEET_NAMES.ACTIVE,
      CONFIG.SHEET_NAMES.SETTINGS,
      CONFIG.SHEET_NAMES.SECURITY,
      CONFIG.SHEET_NAMES.CHAT_LOG
    ];
    
    requiredSheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        Logger.log('✅ Sheet exists: ' + sheetName);
      } else {
        warnings.push('Sheet missing: ' + sheetName);
      }
    });
  } catch (e) {
    issues.push('Cannot access spreadsheet: ' + e.message);
  }
  
  // Check 4: External URLs (network access)
  Logger.log('');
  try {
    UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
    Logger.log('✅ Network access working (UrlFetchApp)');
  } catch (e) {
    issues.push('Cannot access external URLs - check script permissions');
  }
  
  // Summary
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('📋 CONFIGURATION SUMMARY');
  Logger.log('═══════════════════════════════════════════════');
  
  if (issues.length === 0 && warnings.length === 0) {
    Logger.log('🎉 ALL CHECKS PASSED!');
    Logger.log('   Your configuration looks good.');
  } else {
    if (issues.length > 0) {
      Logger.log('');
      Logger.log('❌ ISSUES FOUND (' + issues.length + '):');
      issues.forEach((issue, i) => {
        Logger.log('   ' + (i + 1) + '. ' + issue);
      });
    }
    
    if (warnings.length > 0) {
      Logger.log('');
      Logger.log('⚠️  WARNINGS (' + warnings.length + '):');
      warnings.forEach((warning, i) => {
        Logger.log('   ' + (i + 1) + '. ' + warning);
      });
    }
  }
  
  Logger.log('');
  
  return issues.length === 0;
}

/**
 * 🚀 MASTER TEST: Run all tests in sequence
 * Run this after configuration to verify everything works
 */
function runAllTests() {
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('🚀 RUNNING MASTER TEST SUITE');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('');
  
  const results = {
    webAppUrl: false,
    configuration: false,
    webhook: false,
    botResponse: false,
    richCard: false
  };
  
  // Test 1: Get Web App URL
  Logger.log('TEST 1: Web App URL');
  Logger.log('─────────────────────────────────────────────');
  try {
    getWebAppURL();
    results.webAppUrl = true;
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
  }
  Logger.log('');
  
  Utilities.sleep(1000);
  
  // Test 2: Verify Configuration
  Logger.log('TEST 2: Configuration Verification');
  Logger.log('─────────────────────────────────────────────');
  try {
    results.configuration = verifyConfiguration();
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
  }
  Logger.log('');
  
  Utilities.sleep(1000);
  
  // Test 3: Webhook Connection
  Logger.log('TEST 3: Webhook Connection');
  Logger.log('─────────────────────────────────────────────');
  try {
    results.webhook = testWebhookConnection();
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
  }
  Logger.log('');
  
  Utilities.sleep(2000);
  
  // Test 4: Bot Response
  Logger.log('TEST 4: Bot Response Handlers');
  Logger.log('─────────────────────────────────────────────');
  try {
    results.botResponse = testBotResponse();
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
  }
  Logger.log('');
  
  Utilities.sleep(2000);
  
  // Test 5: Rich Card
  Logger.log('TEST 5: Rich Card Notification');
  Logger.log('─────────────────────────────────────────────');
  try {
    results.richCard = testRichCardNotification();
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
  }
  Logger.log('');
  
  // Final Summary
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('📊 FINAL TEST RESULTS');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('');
  
  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const icon = result ? '✅' : '❌';
    const testName = test.replace(/([A-Z])/g, ' $1').trim();
    Logger.log(icon + ' ' + testName.toUpperCase());
  });
  
  Logger.log('');
  Logger.log('─────────────────────────────────────────────');
  Logger.log(`Score: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    Logger.log('');
    Logger.log('🎉🎉🎉 ALL TESTS PASSED! 🎉🎉🎉');
    Logger.log('');
    Logger.log('Your Google Chat integration is fully operational!');
    Logger.log('');
    Logger.log('NEXT STEPS:');
    Logger.log('1. Add the bot to your Google Chat space');
    Logger.log('2. Type "help" to see available commands');
    Logger.log('3. Test by submitting a patient in the dashboard');
  } else {
    Logger.log('');
    Logger.log('⚠️  Some tests failed. Review the logs above.');
    Logger.log('   Check the setup guide for troubleshooting tips.');
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════');
  
  return results;
}

/**
 * 📝 Show Quick Setup Instructions
 */
function showQuickSetup() {
  const instructions = `
╔═══════════════════════════════════════════════════════════╗
║         GOOGLE CHAT BOT - QUICK SETUP GUIDE               ║
╚═══════════════════════════════════════════════════════════╝

STEP 1: Deploy Web App
────────────────────────────────────────────────────────────
1. Click Deploy → New Deployment
2. Type: Web App
3. Execute as: Me
4. Who has access: Anyone
5. Click Deploy and copy the URL

STEP 2: Enable Google Chat API
────────────────────────────────────────────────────────────
1. Go to: https://console.cloud.google.com
2. APIs & Services → Library
3. Search "Google Chat API"
4. Click Enable

STEP 3: Configure Bot
────────────────────────────────────────────────────────────
1. In Cloud Console → Google Chat API → Configuration
2. Bot name: CWC Notification Bot
3. App URL: [paste your Web App URL]
4. Enable: Interactive features
5. Enable: Receive 1:1 messages
6. Enable: Join spaces and group conversations

STEP 4: Get Webhook URL
────────────────────────────────────────────────────────────
1. Open Google Chat
2. Create space: "CWC Outreach"
3. Space menu → Manage webhooks
4. Add webhook and copy URL

STEP 5: Update Config
────────────────────────────────────────────────────────────
1. Open Config.gs
2. Update CHAT_WEBHOOK_URL with your webhook
3. Save

STEP 6: Test Everything
────────────────────────────────────────────────────────────
Run function: runAllTests()

═══════════════════════════════════════════════════════════

For detailed instructions, see: GOOGLE_CHAT_SETUP_GUIDE.md
  `;
  
  Logger.log(instructions);
  
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert('Google Chat Bot Setup', 'See execution logs for setup instructions', ui.ButtonSet.OK);
  } catch(e) {}
  
  return instructions;
}
