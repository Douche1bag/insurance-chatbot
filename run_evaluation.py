#!/usr/bin/env python3
"""
Automated RAG Model Testing
Runs test cases against the RAG API and generates evaluation results
"""

import json
import requests
import time
from pathlib import Path
from datetime import datetime

# Configuration
API_URL = "http://localhost:3001/api/chat"
TEST_CASES_FILE = "src/services/llminsurance_weird_testcase1.json"
OUTPUT_FILE = "src/services/evaluation_results.json"
USER_ID = "test_evaluation_user"

def load_test_cases(file_path):
    """Load test cases from JSON file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def classify_answer(answer_text):
    """
    Classify the model's answer into categories:
    - approval: Insurance will cover
    - denial: Insurance will NOT cover
    - conditional: Depends on policy terms
    - unknown: Can't determine
    """
    answer_lower = answer_text.lower()
    
    # Strong denial indicators
    denial_keywords = [
        'ไม่คุ้มครอง', 'ไม่จ่าย', 'ปฏิเสธ', 'ยกเว้น',
        'ไม่ได้รับความคุ้มครอง', 'ไม่รับผิดชอบ',
        'exclusion', 'not covered', 'denied'
    ]
    
    # Strong approval indicators
    approval_keywords = [
        'คุ้มครอง', 'จ่าย', 'ได้รับความคุ้มครอง',
        'รับผิดชอบ', 'covered', 'approved'
    ]
    
    # Conditional indicators
    conditional_keywords = [
        'ขึ้นอยู่กับ', 'อาจ', 'บางกรณี', 'depends',
        'conditional', 'ตรวจสอบ', 'พิจารณา',
        'มีโอกาส', 'อาจจะ', 'ถ้า'
    ]
    
    # Count keyword occurrences
    denial_count = sum(1 for kw in denial_keywords if kw in answer_lower)
    approval_count = sum(1 for kw in approval_keywords if kw in answer_lower)
    conditional_count = sum(1 for kw in conditional_keywords if kw in answer_lower)
    
    # Decision logic
    if conditional_count >= 2:
        return "conditional"
    
    if denial_count > approval_count:
        return "denial"
    elif approval_count > denial_count:
        return "approval"
    elif conditional_count > 0:
        return "conditional"
    else:
        return "unknown"

def query_rag_api(question, user_id):
    """Send question to RAG API and get response"""
    try:
        response = requests.post(
            API_URL,
            json={
                "query": question,
                "userId": user_id
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                return result.get('response', '')
            else:
                return f"Error: {result.get('error', 'Unknown error')}"
        else:
            return f"HTTP Error: {response.status_code}"
    
    except Exception as e:
        return f"Exception: {str(e)}"

def run_evaluation(test_cases, user_id=USER_ID):
    """Run all test cases and collect results"""
    results = []
    total = len(test_cases)
    
    print(f"🧪 Running {total} test cases...")
    print("=" * 80)
    
    for i, test in enumerate(test_cases, 1):
        question = test['question']
        expected = test['expected_answer_type']
        
        print(f"\n[{i}/{total}] Testing Q{test['id']}: {question[:60]}...")
        
        # Query the RAG API
        model_answer = query_rag_api(question, user_id)
        
        # Classify the answer
        predicted = classify_answer(model_answer)
        
        # Check if correct
        correct = (predicted == expected)
        
        # Store result
        result = {
            "id": test['id'],
            "question": question,
            "expected": expected,
            "predicted": predicted,
            "correct": correct,
            "model_answer": model_answer
        }
        results.append(result)
        
        # Print result
        status = "✅" if correct else "❌"
        print(f"{status} Expected: {expected}, Predicted: {predicted}")
        
        # Rate limiting - be nice to the API
        if i < total:
            time.sleep(1)
    
    return results

def save_results(results, output_file):
    """Save evaluation results to JSON file"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Results saved to: {output_file}")

def print_summary(results):
    """Print evaluation summary"""
    total = len(results)
    correct = sum(1 for r in results if r['correct'])
    accuracy = (correct / total * 100) if total > 0 else 0
    
    print("\n" + "=" * 80)
    print("📊 EVALUATION SUMMARY")
    print("=" * 80)
    print(f"Total test cases: {total}")
    print(f"Correct predictions: {correct}")
    print(f"Accuracy: {accuracy:.1f}%")
    print("=" * 80)

if __name__ == '__main__':
    import sys
    
    # Check if API is accessible
    print("🔍 Checking API connection...")
    try:
        health_response = requests.get("http://localhost:3001/api/health", timeout=5)
        if health_response.status_code == 200:
            print("✅ API is running")
        else:
            print("⚠️  API returned unexpected status")
    except Exception as e:
        print(f"❌ Cannot connect to API: {e}")
        print("Please start the server with: pnpm start")
        sys.exit(1)
    
    # Load test cases
    test_cases = load_test_cases(TEST_CASES_FILE)
    print(f"✅ Loaded {len(test_cases)} test cases from {TEST_CASES_FILE}")
    
    # Run evaluation
    print(f"\n⏱️  Starting evaluation at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    results = run_evaluation(test_cases)
    
    # Save results
    save_results(results, OUTPUT_FILE)
    
    # Print summary
    print_summary(results)
    
    print(f"\n💡 Run 'python3 evaluate_rag.py' to see detailed metrics")
