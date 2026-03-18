#!/usr/bin/env python3
"""
Automated RAG Model Testing with Precision, Recall, and F1 Score
Runs test cases against the RAG API and generates evaluation results
"""

import json
import requests
import time
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Configuration
API_URL = "http://localhost:3001/api/chat"
CONVERSATION_API = "http://localhost:3001/api/conversations"
TEST_CASES_FILE = "src/services/llminsurance_weird_testcase1.json"
OUTPUT_FILE = "src/services/evaluation_results.json"
USER_ID = "test_evaluation_user"

def load_test_cases(file_path):
    """Load test cases from JSON file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_test_conversation(user_id):
    """Create a test conversation and return its ID"""
    try:
        response = requests.post(
            CONVERSATION_API,
            json={
                "userId": user_id,
                "title": f"Evaluation Test {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                conv_id = result['conversation'].get('_id') or result['conversation'].get('id')
                print(f" Created test conversation: {conv_id}")
                return conv_id
        
        print(f"⚠️  Failed to create conversation, using fallback ID")
        return "fallback_test_conversation"
    
    except Exception as e:
        print(f"⚠️  Error creating conversation: {e}, using fallback ID")
        return "fallback_test_conversation"

def classify_answer(answer_text):
    """
    Classify the model's answer into categories:
    - approval: Insurance will cover
    - denial: Insurance will NOT cover
    - conditional: Depends on policy terms
    - unknown: Can't determine
    
    Prioritizes first 2-3 lines since the new format instructs
    the model to start with the classification.
    """
    if not answer_text:
        return "unknown"
    
    answer_lower = answer_text.lower()
    
    # Get first 2-3 lines for priority checking (where answer should be)
    first_lines = '\n'.join(answer_text.split('\n')[:3]).lower()
    
    # Check first lines for explicit classification
    if 'approved' in first_lines or 'คุ้มครอง' in first_lines:
        if 'ไม่คุ้มครอง' not in first_lines:
            return "approval"
    
    if 'not covered' in first_lines or 'ไม่คุ้มครอง' in first_lines:
        return "denial"
    
    if 'conditional' in first_lines or 'conditional' in first_lines:
        return "conditional"
    
    # Fallback to keyword counting in full text
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
        'มีโอกาส', 'อาจจะ', 'ถ้า', 'กรุณาตรวจสอบ'
    ]
    
    # Count keyword occurrences
    denial_count = sum(1 for kw in denial_keywords if kw in answer_lower)
    approval_count = sum(1 for kw in approval_keywords if kw in answer_lower)
    conditional_count = sum(1 for kw in conditional_keywords if kw in answer_lower)
    
    # Decision logic with stronger thresholds
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

def query_rag_api(question, user_id, conversation_id="test_conversation"):
    """Send question to RAG API and get response"""
    try:
        response = requests.post(
            API_URL,
            json={
                "query": question,
                "userId": user_id,
                "conversationId": conversation_id
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

def run_evaluation(test_cases, user_id=USER_ID, conversation_id=None):
    """Run all test cases and collect results"""
    results = []
    total = len(test_cases)
    
    print(f"test Running {total} test cases...")
    print("=" * 80)
    
    for i, test in enumerate(test_cases, 1):
        question = test['question']
        expected = test['expected_answer_type']
        
        print(f"\n[{i}/{total}] Testing Q{test['id']}: {question[:60]}...")
        
        # Query the RAG API
        model_answer = query_rag_api(question, user_id, conversation_id)
        
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
        status = "correct" if correct else "❌"
        print(f"{status} Expected: {expected}, Predicted: {predicted}")
        
        # Rate limiting - be nice to the API
        if i < total:
            time.sleep(1)
    
    return results

def save_results(results, output_file):
    """Save evaluation results to JSON file"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n Results saved to: {output_file}")

def print_summary(results):
    """Print evaluation summary with precision, recall, and F1 score"""
    total = len(results)
    correct = sum(1 for r in results if r['correct'])
    accuracy = (correct / total * 100) if total > 0 else 0
    
    # Calculate metrics per class
    classes = ['approval', 'denial', 'conditional', 'unknown']
    metrics = {}
    
    for cls in classes:
        tp = sum(1 for r in results if r['expected'] == cls and r['predicted'] == cls)
        fp = sum(1 for r in results if r['expected'] != cls and r['predicted'] == cls)
        fn = sum(1 for r in results if r['expected'] == cls and r['predicted'] != cls)
        tn = sum(1 for r in results if r['expected'] != cls and r['predicted'] != cls)
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        support = sum(1 for r in results if r['expected'] == cls)
        
        metrics[cls] = {
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'support': support,
            'tp': tp,
            'fp': fp,
            'fn': fn
        }
    
    # Calculate macro averages
    macro_precision = sum(m['precision'] for m in metrics.values()) / len(classes)
    macro_recall = sum(m['recall'] for m in metrics.values()) / len(classes)
    macro_f1 = sum(m['f1'] for m in metrics.values()) / len(classes)
    
    # Calculate weighted averages
    total_support = sum(m['support'] for m in metrics.values())
    weighted_precision = sum(m['precision'] * m['support'] for m in metrics.values()) / total_support if total_support > 0 else 0
    weighted_recall = sum(m['recall'] * m['support'] for m in metrics.values()) / total_support if total_support > 0 else 0
    weighted_f1 = sum(m['f1'] * m['support'] for m in metrics.values()) / total_support if total_support > 0 else 0
    
    print("\n" + "=" * 80)
    print(" EVALUATION SUMMARY")
    print("=" * 80)
    print(f"Total test cases: {total}")
    print(f"Correct predictions: {correct}")
    print(f"Overall Accuracy: {accuracy:.1f}%")
    print("=" * 80)
    
    print("\n PER-CLASS METRICS:")
    print("-" * 80)
    print(f"{'Class':<15} {'Precision':>10} {'Recall':>10} {'F1-Score':>10} {'Support':>10}")
    print("-" * 80)
    
    for cls in classes:
        m = metrics[cls]
        print(f"{cls:<15} {m['precision']:>9.1%} {m['recall']:>9.1%} {m['f1']:>9.1%} {m['support']:>10}")
    
    print("-" * 80)
    print(f"{'Macro Avg':<15} {macro_precision:>9.1%} {macro_recall:>9.1%} {macro_f1:>9.1%} {total:>10}")
    print(f"{'Weighted Avg':<15} {weighted_precision:>9.1%} {weighted_recall:>9.1%} {weighted_f1:>9.1%} {total:>10}")
    print("=" * 80)
    
    print("\n🔍 CONFUSION DETAILS:")
    print("-" * 80)
    for cls in classes:
        m = metrics[cls]
        if m['support'] > 0:
            print(f"\n{cls.upper()}:")
            print(f"  True Positives:  {m['tp']}")
            print(f"  False Positives: {m['fp']}")
            print(f"  False Negatives: {m['fn']}")
    print("=" * 80)
    
    return {
        'accuracy': accuracy,
        'macro_precision': macro_precision,
        'macro_recall': macro_recall,
        'macro_f1': macro_f1,
        'weighted_precision': weighted_precision,
        'weighted_recall': weighted_recall,
        'weighted_f1': weighted_f1,
        'per_class': metrics
    }

if __name__ == '__main__':
    import sys
    
    # Check if API is accessible
    print("🔍 Checking API connection...")
    try:
        health_response = requests.get("http://localhost:3001/api/health", timeout=5)
        if health_response.status_code == 200:
            print(" API is running")
        else:
            print("⚠️  API returned unexpected status")
    except Exception as e:
        print(f"❌ Cannot connect to API: {e}")
        print("Please start the server with: pnpm start")
        sys.exit(1)
    
    # Load test cases
    test_cases = load_test_cases(TEST_CASES_FILE)
    print(f" Loaded {len(test_cases)} test cases from {TEST_CASES_FILE}")
    
    # Create test conversation
    print(f"\n🔨 Creating test conversation for user: {USER_ID}")
    conversation_id = create_test_conversation(USER_ID)
    
    # Run evaluation
    print(f"\n⏱️  Starting evaluation at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    results = run_evaluation(test_cases, conversation_id=conversation_id)
    
    # Save results
    save_results(results, OUTPUT_FILE)
    
    # Print summary with metrics
    summary_metrics = print_summary(results)
    
    # Save summary metrics to separate file
    metrics_file = OUTPUT_FILE.replace('.json', '_metrics.json')
    with open(metrics_file, 'w', encoding='utf-8') as f:
        json.dump(summary_metrics, f, ensure_ascii=False, indent=2)
    print(f"\n Metrics saved to: {metrics_file}")
    
    print(f"\n💡 View detailed results in: {OUTPUT_FILE}")
