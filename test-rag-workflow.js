import ragService from './src/services/ragService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testRAGWorkflow() {
  console.log('🧪 Testing RAG Workflow\n');
  
  const testQueries = [
    'ประกันชีวิตคืออะไร',
    'วิธีการเคลมประกันรถยนต์',
    'ประกันสุขภาพมีความคุ้มครองอะไรบ้าง',
    'เบี้ยประกันคำนวณยังไง'
  ];

  for (const query of testQueries) {
    try {
      console.log(`\n🔍 Testing Query: "${query}"`);
      console.log('=' + '='.repeat(50));
      
      // Test RAG workflow
      const result = await ragService.queryWithRAG(query, {
        contextLimit: 3,
        includeScore: true,
        language: 'thai'
      });

      if (result.success) {
        console.log('✅ RAG Query Success');
        console.log(`📊 Context Found: ${result.metadata.contextFound}`);
        console.log(`📄 Documents Retrieved: ${result.metadata.contextCount}`);
        console.log(`🎯 Average Similarity: ${(result.metadata.avgSimilarity * 100).toFixed(1)}%`);
        
        if (result.context && result.context.length > 0) {
          console.log('\n📚 Retrieved Context:');
          result.context.forEach((doc, index) => {
            console.log(`   ${index + 1}. "${doc.title}" (${(doc.similarity * 100).toFixed(1)}% relevant)`);
            console.log(`      Content: ${doc.content.substring(0, 100)}...`);
          });
        }
        
        console.log('\n🤖 Generated Response:');
        console.log(`"${result.response.substring(0, 200)}..."`);
        
      } else {
        console.log('❌ RAG Query Failed');
        console.log(`Error: ${result.error}`);
        if (result.fallbackResponse) {
          console.log(`Fallback: ${result.fallbackResponse.substring(0, 100)}...`);
        }
      }
      
      // Wait between queries
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Test Error for "${query}":`, error.message);
    }
  }
  
  console.log('\n✅ RAG Testing Complete!');
}

async function testContextRetrieval() {
  console.log('\n🔬 Testing Context Retrieval Only\n');
  
  const testQuery = 'ประกันชีวิต';
  
  try {
    console.log(`Testing context retrieval for: "${testQuery}"`);
    
    const contextData = await ragService.retrieveContext(testQuery, 5);
    
    console.log(`📄 Total documents found: ${contextData.totalFound}`);
    console.log(`✅ Relevant documents: ${contextData.relevantCount}`);
    console.log(`📋 Context returned: ${contextData.context.length}`);
    
    if (contextData.context.length > 0) {
      console.log('\nTop Results:');
      contextData.context.forEach((doc, index) => {
        console.log(`${index + 1}. "${doc.title}"`);
        console.log(`   Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
        console.log(`   Content: ${doc.content.substring(0, 150)}...`);
        console.log('');
      });
    } else {
      console.log('❌ No relevant context found');
    }
    
  } catch (error) {
    console.error('❌ Context retrieval test failed:', error.message);
  }
}

async function testAdvancedFeatures() {
  console.log('\n🚀 Testing Advanced RAG Features\n');
  
  try {
    // Test complex query processing
    const complexQuery = 'ประกันรถยนต์ชั้น 1 เบี้ยประกัน 15,000 บาท ต่อปี ความคุ้มครองอะไรบ้าง';
    
    console.log(`Testing complex query: "${complexQuery}"`);
    
    const result = await ragService.processComplexQuery(complexQuery, {
      contextLimit: 5
    });
    
    if (result.success) {
      console.log('✅ Complex query processed successfully');
      console.log(`📊 Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
      
      if (result.keywords) {
        console.log(`🔑 Keywords found: ${result.keywords.join(', ')}`);
      }
      
      if (result.entities && result.entities.amounts.length > 0) {
        console.log(`💰 Amounts detected: ${result.entities.amounts.join(', ')}`);
      }
      
    } else {
      console.log('❌ Complex query processing failed');
    }
    
  } catch (error) {
    console.error('❌ Advanced features test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🎯 Starting Comprehensive RAG Testing');
  console.log('=====================================\n');
  
  await testContextRetrieval();
  await testRAGWorkflow();
  await testAdvancedFeatures();
  
  console.log('\n🎉 All RAG tests completed!');
  process.exit(0);
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runAllTests().catch(console.error);