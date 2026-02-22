// Test script for policy comparison functionality
// Run with: node test-comparison.js

import mongoService from './src/services/mongoService.js';

async function testComparison() {
  console.log('🧪 Testing Policy Comparison Functionality\n');
  
  try {
    // Test 1: Connect to MongoDB
    console.log('📌 Test 1: Connecting to MongoDB...');
    await mongoService.connect();
    console.log('✅ Connected successfully\n');

    // Test 2: Get available providers
    console.log('📌 Test 2: Getting available policy providers...');
    const providers = await mongoService.getPolicyProviders(10);
    console.log(`✅ Found ${providers.length} providers:`);
    providers.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
    console.log('');

    // Test 3: Search for specific policies
    console.log('📌 Test 3: Searching for policies...');
    const searchTerms = ['AIA', 'FWD', 'เอไอเอ'];
    console.log(`   Search terms: ${searchTerms.join(', ')}`);
    const results = await mongoService.searchPoliciesByName(searchTerms);
    console.log(`✅ Found ${results.length} matching documents\n`);

    // Test 4: Parse coverage from first result
    if (results.length > 0) {
      console.log('📌 Test 4: Parsing coverage from first document...');
      const firstDoc = results[0];
      console.log(`   Document title: ${firstDoc.title || 'N/A'}`);
      
      const coverage = mongoService.parsePolicyCoverage(firstDoc.text || '');
      console.log('   Parsed coverage:');
      console.log(`   - Life Insurance: ${coverage.life ? '฿' + coverage.life.toLocaleString() : 'N/A'}`);
      console.log(`   - IPD Coverage: ${coverage.ipd ? '฿' + coverage.ipd.toLocaleString() : 'N/A'}`);
      console.log(`   - Room Coverage: ${coverage.room ? '฿' + coverage.room.toLocaleString() : 'N/A'}`);
      console.log(`   - Critical Illness: ${coverage.critical ? '฿' + coverage.critical.toLocaleString() : 'N/A'}`);
      console.log(`   - Accident: ${coverage.accident ? '฿' + coverage.accident.toLocaleString() : 'N/A'}`);
      console.log('');
    }

    // Test 5: Get system documents sample
    console.log('📌 Test 5: Getting sample system documents...');
    const docs = await mongoService.getSystemDocuments(5);
    console.log(`✅ Retrieved ${docs.length} documents`);
    docs.forEach((doc, i) => {
      const titlePreview = (doc.title || 'Untitled').substring(0, 50);
      console.log(`   ${i + 1}. ${titlePreview}...`);
    });
    console.log('');

    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await mongoService.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run tests
testComparison().catch(console.error);
