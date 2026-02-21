import ragService from './src/services/ragService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSimpleRAG() {
  try {
    console.log('🚀 Testing RAG functionality with existing data\n');
    
    const testQuery = 'ประกันชีวิตคืออะไร';
    console.log(`📝 Query: "${testQuery}"`);
    console.log('=' + '='.repeat(50));
    
    // Test the RAG workflow
    const result = await ragService.queryWithRAG(testQuery, {
      contextLimit: 3,
      includeScore: true,
      language: 'thai'
    });

    if (result.success) {
      console.log('✅ RAG Query Successful!');
      console.log(`\n🤖 Generated Response:\n"${result.response}"\n`);
      
      console.log('📊 Metadata:');
      console.log(`  - Context Found: ${result.metadata.contextFound}`);
      console.log(`  - Documents Retrieved: ${result.metadata.contextCount}`);
      console.log(`  - Average Similarity: ${(result.metadata.avgSimilarity * 100).toFixed(1)}%`);
      
      if (result.context && result.context.length > 0) {
        console.log('\n📚 Retrieved Context:');
        result.context.forEach((doc, index) => {
          console.log(`${index + 1}. "${doc.title}"`);
          console.log(`   Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
          console.log(`   Content: ${doc.content.substring(0, 150)}...`);
          console.log('');
        });
        
        // Show the formatted citations
        const citations = ragService.formatSourceCitations(result.context);
        console.log('🔗 Formatted Citations:');
        console.log(citations);
      }
      
    } else {
      console.log('❌ RAG Query Failed');
      console.log(`Error: ${result.error}`);
      if (result.fallbackResponse) {
        console.log(`\n🔄 Fallback Response: "${result.fallbackResponse}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  process.exit(0);
}

testSimpleRAG();