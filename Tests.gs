/**
 * CWC OS Server-Side Unit Tests
 * Run: testRunner() from Apps Script editor
 * 
 * These tests verify core server-side functions work correctly.
 */

function testRunner() {
  const results = [];
  
  console.log('\n=== RUNNING CWC OS UNIT TESTS ===\n');
  
  // Run all tests
  results.push(test_createHeaderMap());
  results.push(test_getDataHash());
  results.push(test_maskSSN());
  results.push(test_isValidEmail());
  results.push(test_getUuid());
  
  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);
  
  console.log('\n=== TEST RESULTS ===');
  console.log(`Passed: ${passed}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\nFailed tests:');
    failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.error}`));
  } else {
    console.log('✅ All tests passed!');
  }
  
  return { passed, total: results.length, failed };
}

// --- Individual Tests ---

function test_createHeaderMap() {
  const name = 'createHeaderMap';
  try {
    const headers = ['ID', 'Patient Name', 'PRN', 'Timestamp'];
    const map = Utils.createHeaderMap(headers);
    
    const pass = map['ID'] === 0 && 
                 map['Patient Name'] === 1 && 
                 map['PRN'] === 2 &&
                 map['Timestamp'] === 3;
    
    return { name, pass, error: pass ? null : 'Incorrect index mapping' };
  } catch (e) {
    return { name, pass: false, error: e.message };
  }
}

function test_getDataHash() {
  const name = 'getDataHash';
  try {
    // This should return a string (hash)
    const hash = getDataHash();
    const pass = typeof hash === 'string' && hash.length > 0;
    
    return { name, pass, error: pass ? null : 'Hash not returned correctly' };
  } catch (e) {
    return { name, pass: false, error: e.message };
  }
}

function test_maskSSN() {
  const name = 'maskSSN';
  try {
    const result1 = maskSSN('123456789');
    const result2 = maskSSN('123-45-6789');
    const result3 = maskSSN('');
    const result4 = maskSSN(null);
    
    const pass = result1 === '***-**-6789' && 
                 result2 === '***-**-6789' &&
                 result3 === 'N/A' &&
                 result4 === 'N/A';
    
    return { name, pass, error: pass ? null : `Got: ${result1}, ${result2}` };
  } catch (e) {
    return { name, pass: false, error: e.message };
  }
}

function test_isValidEmail() {
  const name = 'isValidEmail';
  try {
    const valid = isValidEmail('test@example.com');
    const invalid1 = isValidEmail('notanemail');
    const invalid2 = isValidEmail('');
    const invalid3 = isValidEmail('@missing.com');
    
    const pass = valid === true && 
                 invalid1 === false && 
                 invalid2 === false &&
                 invalid3 === false;
    
    return { name, pass, error: pass ? null : 'Email validation failed' };
  } catch (e) {
    return { name, pass: false, error: e.message };
  }
}

function test_getUuid() {
  const name = 'getUuid';
  try {
    const uuid1 = Utils.getUuid();
    const uuid2 = Utils.getUuid();
    
    // UUIDs should be strings and unique
    const pass = typeof uuid1 === 'string' && 
                 typeof uuid2 === 'string' && 
                 uuid1 !== uuid2 &&
                 uuid1.length > 10;
    
    return { name, pass, error: pass ? null : 'UUID generation failed' };
  } catch (e) {
    return { name, pass: false, error: e.message };
  }
}

// --- Helper for running subset ---

function runSingleTest(testName) {
  const testFn = this[`test_${testName}`];
  if (testFn) {
    const result = testFn();
    console.log(result.pass ? `✅ ${result.name}` : `❌ ${result.name}: ${result.error}`);
    return result;
  }
  console.log(`Test not found: ${testName}`);
  return null;
}
