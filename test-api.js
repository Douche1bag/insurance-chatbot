// Test script to check API connectivity
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function testAPI() {
  const API_KEY = process.env.VITE_API_KEY;
  const BASE_URL = process.env.VITE_API_BASE_URL;
  const MODEL = process.env.VITE_MODEL_NAME;

  console.log('Testing API configuration:');
  console.log('API Key:', API_KEY ? `${API_KEY.substring(0, 20)}...` : 'Not found');
  console.log('Base URL:', BASE_URL);
  console.log('Model:', MODEL);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Hello, this is a test message.'
          }
        ],
        max_tokens: 100,
        temperature: 0.6
      })
    });

    console.log('\nResponse Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers));

    const responseText = await response.text();
    console.log('\nResponse Body:');
    console.log(responseText);

    if (!response.ok) {
      console.error(`\nAPI Error: ${response.status} - ${response.statusText}`);
      console.error('Response:', responseText);
    } else {
      const data = JSON.parse(responseText);
      console.log('\nAPI Response:', data);
      if (data.choices && data.choices[0]) {
        console.log('Message:', data.choices[0].message.content);
      }
    }
  } catch (error) {
    console.error('\nNetwork Error:', error.message);
  }
}

testAPI();