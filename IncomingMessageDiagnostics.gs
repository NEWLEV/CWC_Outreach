/**
 * GOOGLE CHAT INCOMING MESSAGE DIAGNOSTICS
 * Run these functions to diagnose why messages from Google Chat aren't appearing
 */

/**
 * STEP 1: Verify doPost() is receiving requests
 * This simulates what Google Chat sends
 */
function testDoPostHandler() {
  console.log('═══════════════════════════════════════════════');
  console.log('🧪 TESTING doPost() HANDLER');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  // Simulate a Google Chat message event
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        type: 'MESSAGE',
        message: {
          text: 'Test message from diagnostics',
          sender: {
            displayName: 'Test User',
            email: 'test@example.com'
          }
        },
        space: {
          name: 'spaces/test123',
          displayName: 'Test Space'
        },
        user: {
          name: 'users/test123',
          displayName: 'Test User',
          email: 'test@example.com'
        }
      })
    }
  };
  
  try {
    console.log('Calling doPost() with mock event...');
    const response = doPost(mockEvent);
    
    if (response) {
      console.log('✅ doPost() executed successfully');
      console.log('Response type:', response.getMimeType());
      console.log('Response content preview:', response.getContent().substring(0, 100) + '...');
      console.log('');
      console.log('Now check your Chat Log sheet - you should see:');
      console.log('  "📨 Test User: Test message from diagnostics"');
      console.log('');
      return true;
    } else {
      console.log('❌ doPost() returned nothing');
      return false;
    }
  } catch (e) {
    console.log('❌ ERROR in doPost():');
    console.log('   ' + e.message);
    console.log('');
    console.log('Stack trace:');
    console.log(e.stack);
    return false;
  }
}

/**
 * STEP 2: Check if messages are being logged to Chat Log sheet
 */
function checkChatLogSheet() {
  console.log('═══════════════════════════════════════════════');
  console.log('📋 CHECKING CHAT LOG SHEET');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.SHEET_NAMES.CHAT_LOG || 'Chat Log';
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      console.log('❌ Chat Log sheet not found!');
      console.log(`   Looking for: "${sheetName}"`);
      console.log('');
      console.log('Creating Chat Log sheet now...');
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Timestamp', 'Sender', 'Message']);
      console.log('✅ Chat Log sheet created');
      return false;
    }
    
    console.log('✅ Chat Log sheet exists');
    console.log(`   Name: "${sheet.getName()}"`);
    console.log(`   Total rows: ${sheet.getLastRow()}`);
    console.log('');
    
    if (sheet.getLastRow() < 2) {
      console.log('⚠️  Sheet is empty (no messages logged yet)');
      console.log('');
      console.log('Testing if we can write to it...');
      postToChatLog('🧪 Test message from diagnostics', 'System');
      console.log('✅ Test message written');
      console.log('   Check the Chat Log sheet to verify');
      return true;
    }
    
    // Show last 5 messages
    console.log('Last 5 messages in Chat Log:');
    console.log('─────────────────────────────────────────────');
    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - 4);
    const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 3).getDisplayValues();
    
    data.forEach(row => {
      console.log(`[${row[0]}] ${row[1]}: ${row[2]}`);
    });
    
    console.log('');
    return true;
    
  } catch (e) {
    console.log('❌ ERROR accessing Chat Log sheet:');
    console.log('   ' + e.message);
    return false;
  }
}

/**
 * STEP 3: Verify Web App URL is correct
 */
function verifyWebAppConfiguration() {
  console.log('═══════════════════════════════════════════════');
  console.log('🔗 WEB APP CONFIGURATION');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  try {
    const webAppUrl = ScriptApp.getService().getUrl();
    
    if (!webAppUrl) {
      console.log('❌ Web App not deployed!');
      console.log('');
      console.log('ACTION REQUIRED:');
      console.log('1. Click Deploy → New Deployment');
      console.log('2. Select "Web App"');
      console.log('3. Execute as: Me');
      console.log('4. Who has access: Anyone');
      console.log('5. Click Deploy');
      return false;
    }
    
    console.log('✅ Web App is deployed');
    console.log('');
    console.log('Your Web App URL:');
    console.log('─────────────────────────────────────────────');
    console.log(webAppUrl);
    console.log('─────────────────────────────────────────────');
    console.log('');
    console.log('⚠️  CRITICAL: This URL must be in Google Chat API config');
    console.log('');
    console.log('To verify:');
    console.log('1. Go to: https://console.cloud.google.com');
    console.log('2. Navigate to: Google Chat API → Configuration');
    console.log('3. Check "App URL" field matches above URL EXACTLY');
    console.log('4. Verify "Interactive features" is ENABLED');
    console.log('');
    
    return true;
    
  } catch (e) {
    console.log('❌ ERROR getting Web App URL:');
    console.log('   ' + e.message);
    return false;
  }
}

/**
 * STEP 4: Test if onMessage() function works
 */
function testOnMessageFunction() {
  console.log('═══════════════════════════════════════════════');
  console.log('💬 TESTING onMessage() FUNCTION');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  const testEvent = {
    type: 'MESSAGE',
    message: {
      text: 'help',
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
    console.log('Calling onMessage() with "help" command...');
    const response = onMessage(testEvent);
    
    if (response) {
      console.log('✅ onMessage() executed successfully');
      
      if (response.cards) {
        console.log('✅ Response contains cards (rich format)');
        console.log(`   Card title: ${response.cards[0].header.title}`);
      } else if (response.text) {
        console.log('✅ Response contains text');
        console.log(`   Text preview: ${response.text.substring(0, 50)}...`);
      }
      
      console.log('');
      console.log('Now check Chat Log sheet for entry:');
      console.log('  "📨 Test User: help"');
      
      return true;
    } else {
      console.log('❌ onMessage() returned nothing');
      return false;
    }
  } catch (e) {
    console.log('❌ ERROR in onMessage():');
    console.log('   ' + e.message);
    console.log('');
    console.log('This usually means GoogleChatBot.gs is not added to project');
    console.log('or there is a syntax error in the file.');
    return false;
  }
}

/**
 * STEP 5: Check if dashboard can retrieve messages
 */
function testDashboardChatRetrieval() {
  console.log('═══════════════════════════════════════════════');
  console.log('📱 TESTING DASHBOARD CHAT RETRIEVAL');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  try {
    // Add a test message
    postToChatLog('🧪 Dashboard test message', 'Diagnostics');
    console.log('✅ Test message added to Chat Log');
    console.log('');
    
    // Try to retrieve
    const history = getChatHistory();
    
    if (!history) {
      console.log('❌ getChatHistory() returned nothing');
      return false;
    }
    
    if (history.length === 0) {
      console.log('⚠️  getChatHistory() returned empty array');
      console.log('   Chat Log sheet exists but no messages retrieved');
      return false;
    }
    
    console.log(`✅ Retrieved ${history.length} messages`);
    console.log('');
    console.log('Last 3 messages:');
    console.log('─────────────────────────────────────────────');
    history.slice(-3).forEach(msg => {
      console.log(`[${msg.time}] ${msg.sender}: ${msg.text}`);
    });
    console.log('');
    
    // Check if our test message is there
    const hasTestMsg = history.some(m => m.text.includes('Dashboard test message'));
    if (hasTestMsg) {
      console.log('✅ Test message found in retrieved history');
    } else {
      console.log('⚠️  Test message not found (might be too old)');
    }
    
    return true;
    
  } catch (e) {
    console.log('❌ ERROR testing dashboard retrieval:');
    console.log('   ' + e.message);
    return false;
  }
}

/**
 * MASTER DIAGNOSTIC - Run all tests
 */
function diagnoseIncomingMessages() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  GOOGLE CHAT INCOMING MESSAGE DIAGNOSTICS     ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
  
  const results = {
    webAppConfig: false,
    chatLogSheet: false,
    onMessageFunction: false,
    doPostHandler: false,
    dashboardRetrieval: false
  };
  
  // Test 1
  results.webAppConfig = verifyWebAppConfiguration();
  Utilities.sleep(1000);
  
  // Test 2
  results.chatLogSheet = checkChatLogSheet();
  Utilities.sleep(1000);
  
  // Test 3
  results.onMessageFunction = testOnMessageFunction();
  Utilities.sleep(1000);
  
  // Test 4
  results.doPostHandler = testDoPostHandler();
  Utilities.sleep(1000);
  
  // Test 5
  results.dashboardRetrieval = testDashboardChatRetrieval();
  
  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  const passed = Object.values(results).filter(v => v === true).length;
  const total = Object.keys(results).length;
  
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log('');
  
  Object.entries(results).forEach(([test, result]) => {
    const icon = result ? '✅' : '❌';
    const name = test.replace(/([A-Z])/g, ' $1').trim();
    console.log(`${icon} ${name}`);
  });
  
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🔍 LIKELY ISSUE:');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  if (!results.webAppConfig) {
    console.log('❌ Web App not properly deployed');
    console.log('   → Deploy the Web App first');
  } else if (!results.onMessageFunction) {
    console.log('❌ GoogleChatBot.gs not loaded');
    console.log('   → Add GoogleChatBot.gs to your project');
  } else if (!results.doPostHandler) {
    console.log('❌ doPost() handler not working');
    console.log('   → Replace WebApp_Server.gs with updated version');
  } else if (!results.chatLogSheet) {
    console.log('❌ Chat Log sheet issue');
    console.log('   → Check CONFIG.SHEET_NAMES.CHAT_LOG is set');
  } else if (!results.dashboardRetrieval) {
    console.log('❌ Dashboard can\'t retrieve messages');
    console.log('   → Check getChatHistory() function in ChatService.gs');
  } else if (passed === total) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('');
    console.log('If Google Chat messages still don\'t appear:');
    console.log('');
    console.log('1. Verify Web App URL in Google Chat API config');
    console.log('2. Check that "Interactive features" is ENABLED');
    console.log('3. Try sending "help" command in Google Chat');
    console.log('4. Check Chat Log sheet for incoming messages');
    console.log('5. Hard refresh dashboard (Ctrl+F5)');
  } else {
    console.log('❌ Multiple issues detected');
    console.log('   → Fix failed tests above in order');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════');
  
  return results;
}

/**
 * Quick fix - Force create Chat Log with test messages
 */
function createChatLogWithTestMessages() {
  console.log('Creating Chat Log sheet with test messages...');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.SHEET_NAMES.CHAT_LOG || 'Chat Log';
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Timestamp', 'Sender', 'Message']);
    }
    
    // Add test messages
    postToChatLog('Test message 1 from Google Chat user', 'john@example.com');
    postToChatLog('Test message 2 from another user', 'jane@example.com');
    postToChatLog('This simulates incoming Google Chat messages', 'System');
    
    console.log('✅ Chat Log created with test messages');
    console.log('   Open the Chat Log sheet to verify');
    console.log('   Refresh your dashboard - messages should appear');
    
  } catch (e) {
    console.log('❌ Error: ' + e.message);
  }
}

/**
 * Show current Web App URL for copy/paste
 */
function showWebAppURL() {
  const url = ScriptApp.getService().getUrl();
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('📋 YOUR WEB APP URL');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log(url);
  console.log('');
  console.log('Copy this EXACT URL to:');
  console.log('Google Chat API → Configuration → App URL');
  console.log('');
  console.log('═══════════════════════════════════════════════');
  
  return url;
}
