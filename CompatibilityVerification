/**
 * COMPATIBILITY VERIFICATION SCRIPT
 * Run this BEFORE implementing Google Chat integration
 * This will check if your codebase has all required dependencies
 */

function verifyCompatibilityBeforeIntegration() {
  console.log('═══════════════════════════════════════════════');
  console.log('🔍 GOOGLE CHAT INTEGRATION - COMPATIBILITY CHECK');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  const checks = {
    config: false,
    utilities: false,
    chatService: false,
    notification: false,
    sheets: false,
    scopes: false
  };
  
  let criticalIssues = [];
  let warnings = [];
  
  // ═══════════════════════════════════════════════════
  // CHECK 1: CONFIG.GS PROPERTIES
  // ═══════════════════════════════════════════════════
  console.log('CHECK 1: Config.gs Properties');
  console.log('─────────────────────────────────────────────');
  
  try {
    // Check if CONFIG exists
    if (typeof CONFIG === 'undefined') {
      criticalIssues.push('CONFIG object not found');
    } else {
      console.log('✅ CONFIG object exists');
      
      // Check webhook URLs
      if (CONFIG.CHAT_WEBHOOK_URL) {
        console.log('✅ CHAT_WEBHOOK_URL defined');
      } else {
        warnings.push('CHAT_WEBHOOK_URL not set (you can add it later)');
        console.log('⚠️  CHAT_WEBHOOK_URL not set');
      }
      
      if (CONFIG.PHARMACY_CHAT_WEBHOOK_URL) {
        console.log('✅ PHARMACY_CHAT_WEBHOOK_URL defined');
      } else {
        warnings.push('PHARMACY_CHAT_WEBHOOK_URL not set (optional)');
        console.log('ℹ️  PHARMACY_CHAT_WEBHOOK_URL not set (optional)');
      }
      
      // Check required properties
      const requiredProps = ['SHEET_NAMES', 'FLAGS', 'COLUMNS_BY_NAME', 'ROLES'];
      requiredProps.forEach(prop => {
        if (CONFIG[prop]) {
          console.log(`✅ CONFIG.${prop} exists`);
        } else {
          criticalIssues.push(`CONFIG.${prop} missing`);
        }
      });
      
      // Check SHEET_NAMES.SECURITY
      if (CONFIG.SHEET_NAMES && CONFIG.SHEET_NAMES.SECURITY) {
        console.log('✅ CONFIG.SHEET_NAMES.SECURITY defined');
      } else {
        warnings.push('SHEET_NAMES.SECURITY not defined');
      }
      
      checks.config = criticalIssues.length === 0;
    }
  } catch (e) {
    criticalIssues.push('Error reading CONFIG: ' + e.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════
  // CHECK 2: UTILITIES.GS FUNCTIONS
  // ═══════════════════════════════════════════════════
  console.log('CHECK 2: Utilities.gs Functions');
  console.log('─────────────────────────────────────────────');
  
  const utilityFunctions = [
    'getNotificationWebhookUrl',
    'sendChatWebhookNotification',
    'createHeaderMap',
    'getUnifiedPatientData',
    'getRecipients'
  ];
  
  utilityFunctions.forEach(funcName => {
    try {
      if (typeof eval(funcName) === 'function') {
        console.log(`✅ ${funcName}() exists`);
      } else {
        criticalIssues.push(`Function ${funcName}() not found`);
      }
    } catch (e) {
      criticalIssues.push(`Function ${funcName}() not found`);
      console.log(`❌ ${funcName}() not found`);
    }
  });
  
  checks.utilities = criticalIssues.length === 0;
  console.log('');
  
  // ═══════════════════════════════════════════════════
  // CHECK 3: CHATSERVICE.GS FUNCTIONS
  // ═══════════════════════════════════════════════════
  console.log('CHECK 3: ChatService.gs Functions');
  console.log('─────────────────────────────────────────────');
  
  const chatFunctions = [
    'postUserMessage',
    'postUserMessageToWebhook',
    'postToChatLog',
    'getChatHistory'
  ];
  
  chatFunctions.forEach(funcName => {
    try {
      if (typeof eval(funcName) === 'function') {
        console.log(`✅ ${funcName}() exists`);
      } else {
        criticalIssues.push(`Function ${funcName}() not found`);
      }
    } catch (e) {
      criticalIssues.push(`Function ${funcName}() not found`);
      console.log(`❌ ${funcName}() not found`);
    }
  });
  
  checks.chatService = true; // Non-critical
  console.log('');
  
  // ═══════════════════════════════════════════════════
  // CHECK 4: NOTIFICATION.GS FUNCTIONS
  // ═══════════════════════════════════════════════════
  console.log('CHECK 4: Notification.gs Functions');
  console.log('─────────────────────────────────────────────');
  
  try {
    if (typeof NotificationEngine !== 'undefined') {
      console.log('✅ NotificationEngine object exists');
      
      if (NotificationEngine.PRIORITY_LEVELS) {
        console.log('✅ NotificationEngine.PRIORITY_LEVELS exists');
      } else {
        warnings.push('NotificationEngine.PRIORITY_LEVELS not found');
      }
      
      if (typeof NotificationEngine.calculatePriority === 'function') {
        console.log('✅ NotificationEngine.calculatePriority() exists');
      } else {
        warnings.push('NotificationEngine.calculatePriority() not found');
      }
      
      checks.notification = true;
    } else {
      warnings.push('NotificationEngine object not found (not critical)');
    }
  } catch (e) {
    warnings.push('Error checking NotificationEngine: ' + e.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════
  // CHECK 5: REQUIRED SHEETS
  // ═══════════════════════════════════════════════════
  console.log('CHECK 5: Required Sheets');
  console.log('─────────────────────────────────────────────');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (CONFIG && CONFIG.SHEET_NAMES) {
      const requiredSheets = ['ACTIVE', 'SETTINGS', 'CHAT_LOG'];
      const optionalSheets = ['ARCHIVED', 'AUDIT_LOG', 'SECURITY'];
      
      requiredSheets.forEach(sheetKey => {
        const sheetName = CONFIG.SHEET_NAMES[sheetKey];
        if (sheetName) {
          const sheet = ss.getSheetByName(sheetName);
          if (sheet) {
            console.log(`✅ Sheet "${sheetName}" exists`);
          } else {
            criticalIssues.push(`Required sheet "${sheetName}" not found`);
          }
        }
      });
      
      optionalSheets.forEach(sheetKey => {
        const sheetName = CONFIG.SHEET_NAMES[sheetKey];
        if (sheetName) {
          const sheet = ss.getSheetByName(sheetName);
          if (sheet) {
            console.log(`✅ Sheet "${sheetName}" exists`);
          } else {
            warnings.push(`Optional sheet "${sheetName}" not found`);
            console.log(`ℹ️  Sheet "${sheetName}" not found (optional)`);
          }
        }
      });
      
      checks.sheets = true;
    }
  } catch (e) {
    criticalIssues.push('Error checking sheets: ' + e.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════
  // CHECK 6: OAUTH SCOPES
  // ═══════════════════════════════════════════════════
  console.log('CHECK 6: OAuth Scopes & Permissions');
  console.log('─────────────────────────────────────────────');
  
  try {
    // Test external URL access
    UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
    console.log('✅ External URL access (UrlFetchApp) working');
    
    // Test spreadsheet access
    SpreadsheetApp.getActiveSpreadsheet();
    console.log('✅ Spreadsheet access working');
    
    // Test user info
    Session.getActiveUser().getEmail();
    console.log('✅ User info access working');
    
    checks.scopes = true;
  } catch (e) {
    criticalIssues.push('Permission/scope error: ' + e.message);
    console.log('❌ Permission error - may need to run FIX_PERMISSIONS()');
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════
  // CHECK 7: WEB APP DEPLOYMENT
  // ═══════════════════════════════════════════════════
  console.log('CHECK 7: Web App Deployment');
  console.log('─────────────────────────────────────────────');
  
  try {
    const webAppUrl = ScriptApp.getService().getUrl();
    if (webAppUrl) {
      console.log('✅ Web App is deployed');
      console.log('   URL: ' + webAppUrl);
    } else {
      warnings.push('Web App not yet deployed (deploy after adding files)');
      console.log('ℹ️  Web App not yet deployed (do this after adding files)');
    }
  } catch (e) {
    warnings.push('Cannot check Web App URL: ' + e.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════');
  console.log('📊 COMPATIBILITY SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  const passedChecks = Object.values(checks).filter(v => v === true).length;
  const totalChecks = Object.keys(checks).length;
  
  console.log(`Checks Passed: ${passedChecks}/${totalChecks}`);
  console.log('');
  
  if (criticalIssues.length > 0) {
    console.log('❌ CRITICAL ISSUES FOUND (' + criticalIssues.length + '):');
    criticalIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log('');
    console.log('⚠️  FIX THESE BEFORE PROCEEDING');
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS (' + warnings.length + '):');
    warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
    console.log('');
    console.log('ℹ️  These are not critical but should be addressed');
    console.log('');
  }
  
  if (criticalIssues.length === 0 && warnings.length === 0) {
    console.log('🎉 ALL CHECKS PASSED!');
    console.log('');
    console.log('✅ Your codebase is 100% compatible');
    console.log('✅ All required functions exist');
    console.log('✅ All required config properties defined');
    console.log('✅ All permissions granted');
    console.log('');
    console.log('🚀 READY TO IMPLEMENT GOOGLE CHAT INTEGRATION!');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Add GoogleChatBot.gs to your project');
    console.log('2. Add ChatBotTesting.gs to your project');
    console.log('3. Replace WebApp_Server.gs with updated version');
    console.log('4. Replace WebApp_Client.html with updated version');
    console.log('5. Deploy as Web App');
    console.log('6. Configure Google Chat API');
    console.log('7. Run runAllTests()');
  } else if (criticalIssues.length === 0) {
    console.log('✅ COMPATIBLE WITH MINOR WARNINGS');
    console.log('');
    console.log('Your codebase is compatible! Address warnings if needed.');
    console.log('');
    console.log('PROCEED WITH CAUTION:');
    console.log('1. Review warnings above');
    console.log('2. Add missing components if needed');
    console.log('3. Follow implementation checklist');
  } else {
    console.log('❌ NOT READY FOR INTEGRATION');
    console.log('');
    console.log('Please fix critical issues before proceeding.');
    console.log('');
    console.log('TROUBLESHOOTING:');
    console.log('1. Ensure all required files are present');
    console.log('2. Run FIX_PERMISSIONS() if permission errors');
    console.log('3. Check Config.gs has all required properties');
    console.log('4. Verify Utilities.gs has webhook functions');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════');
  
  // Return results
  return {
    compatible: criticalIssues.length === 0,
    checks: checks,
    criticalIssues: criticalIssues,
    warnings: warnings,
    score: `${passedChecks}/${totalChecks}`
  };
}

/**
 * Quick test of specific dependencies
 */
function testSpecificDependencies() {
  console.log('🧪 TESTING SPECIFIC DEPENDENCIES');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  // Test 1: Webhook URL retrieval
  console.log('Test 1: getNotificationWebhookUrl()');
  try {
    const url = getNotificationWebhookUrl('outreach');
    if (url) {
      console.log('✅ Function works, URL found');
      console.log('   URL: ' + url.substring(0, 50) + '...');
    } else {
      console.log('⚠️  Function works but no URL configured');
    }
  } catch (e) {
    console.log('❌ Function failed: ' + e.message);
  }
  console.log('');
  
  // Test 2: Header mapping
  console.log('Test 2: createHeaderMap()');
  try {
    const testHeaders = ['Name', 'Email', 'Phone'];
    const map = createHeaderMap(testHeaders);
    if (map && map['Name'] === 0) {
      console.log('✅ Function works correctly');
    } else {
      console.log('❌ Function returned unexpected result');
    }
  } catch (e) {
    console.log('❌ Function failed: ' + e.message);
  }
  console.log('');
  
  // Test 3: Chat log
  console.log('Test 3: postToChatLog()');
  try {
    postToChatLog('🧪 Test message', 'System');
    console.log('✅ Function works (check Chat Log sheet)');
  } catch (e) {
    console.log('❌ Function failed: ' + e.message);
  }
  console.log('');
  
  // Test 4: Priority calculation
  console.log('Test 4: NotificationEngine.calculatePriority()');
  try {
    const testPatient = { priority: 'Urgent' };
    const priority = NotificationEngine.calculatePriority(testPatient, 'Test');
    console.log('✅ Function works, priority: ' + priority);
  } catch (e) {
    console.log('⚠️  Function not available (not critical): ' + e.message);
  }
  console.log('');
  
  console.log('═══════════════════════════════════════════════');
  console.log('Test complete. Check results above.');
}

/**
 * Show what functions the integration will use
 */
function showIntegrationDependencies() {
  console.log('📋 GOOGLE CHAT INTEGRATION DEPENDENCIES');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('The integration will use these existing functions:');
  console.log('');
  console.log('FROM UTILITIES.GS:');
  console.log('  • getNotificationWebhookUrl(mode)');
  console.log('  • sendChatWebhookNotification(text, mode)');
  console.log('  • createHeaderMap(headers)');
  console.log('  • getUnifiedPatientData(data, headerMap, ...)');
  console.log('  • getRecipients()');
  console.log('');
  console.log('FROM CHATSERVICE.GS:');
  console.log('  • postToChatLog(text, sender)');
  console.log('  • getChatHistory()');
  console.log('  • postUserMessage(text)');
  console.log('  • postUserMessageToWebhook(text, mode)');
  console.log('');
  console.log('FROM NOTIFICATION.GS:');
  console.log('  • NotificationEngine.PRIORITY_LEVELS');
  console.log('  • NotificationEngine.calculatePriority()');
  console.log('');
  console.log('FROM CONFIG.GS:');
  console.log('  • CONFIG.CHAT_WEBHOOK_URL');
  console.log('  • CONFIG.PHARMACY_CHAT_WEBHOOK_URL');
  console.log('  • CONFIG.SHEET_NAMES.*');
  console.log('  • CONFIG.FLAGS.*');
  console.log('  • CONFIG.COLUMNS_BY_NAME.*');
  console.log('');
  console.log('NEW FUNCTIONS ADDED:');
  console.log('  • GoogleChatBot.gs: onMessage(), createStatusCard(), etc.');
  console.log('  • WebApp_Server.gs: doPost() [handles incoming messages]');
  console.log('  • ChatBotTesting.gs: runAllTests(), verify(), etc.');
  console.log('');
  console.log('═══════════════════════════════════════════════');
}
