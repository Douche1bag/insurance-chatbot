import { API_CONFIG, SYSTEM_MESSAGE } from '../utils/constants.js';

export class APIService {
  static async sendMessage(messages) {
    try {
      console.log('Sending request to Typhoon API...');
      console.log('Messages:', JSON.stringify(messages, null, 2));
      
      const response = await fetch(`${API_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: messages, 
          max_tokens: API_CONFIG.maxTokens,
          temperature: API_CONFIG.temperature
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('API Error Response:', errorBody);
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      
      console.log('API Response:', JSON.stringify(data, null, 2));
      
      if (!data.choices || !data.choices[0]) {
        throw new Error('Invalid response format from API');
      }

      return {
        success: true,
        message: data.choices[0].message.content
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}