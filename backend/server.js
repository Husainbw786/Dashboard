import express from 'express';
import cors from 'cors';
import https from 'https';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { getMetricsData, getMetricsDataWithDates, getMetricsDataWithMeetings } from './api-server.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

const CONFIG = {
  API_KEY: 'b7734dc1c976d0a38a0482a63b2dfa1f29f6e081',
  HOSTNAME: 'api.trellus.ai',
  TEAM_ID: null,
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ENDPOINTS = {
  GET_VISIBLE_ACCOUNTS: 'get-visible-accounts',
  METRIC_DETAILS_V6: 'metric-details-v6',
};

function makeRequest(endpoint, params, method = 'GET') {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'text/plain'
    };

    Object.entries(params).forEach(([key, value]) => {
      const jsonValue = JSON.stringify(value);
      const escapedValue = jsonValue.replace(/[\u007f-\uffff]/g, c =>
        '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
      );
      headers[key] = escapedValue;
    });

    const options = {
      hostname: CONFIG.HOSTNAME,
      path: `/${endpoint}`,
      method: method,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

// API Routes
app.get('/api/users', async (req, res) => {
  try {
    const params = {
      api_key: CONFIG.API_KEY
    };

    if (CONFIG.TEAM_ID) {
      params.team_id = CONFIG.TEAM_ID;
    }

    const response = await makeRequest(ENDPOINTS.GET_VISIBLE_ACCOUNTS, params);

    if (!response || !response.users) {
      throw new Error('Failed to fetch users');
    }

    const activeDialerUsers = response.users.filter(user =>
      user.can_dial && user.team_is_active
    );

    res.json({
      users: activeDialerUsers,
      team: response.team
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Metrics data function imported at top

app.get('/api/metrics-data', async (req, res) => {
  try {
    const { startDate, endDate, days, debug } = req.query;
    const debugMode = debug === 'true';
    
    let data;
    if (startDate && endDate) {
      // Use custom date range with meeting integration
      data = await getMetricsDataWithMeetings(new Date(startDate), new Date(endDate), debugMode);
    } else {
      // Use days parameter (backward compatibility) with meeting integration
      const daysNum = parseInt(days) || 1;
      const endDateObj = new Date();
      const startDateObj = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
      data = await getMetricsDataWithMeetings(startDateObj, endDateObj, debugMode);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error getting metrics data:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Query endpoint
app.post('/api/ai-query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Step 1: Ask OpenAI to extract date range and intent from the query
    const dateExtractionPrompt = `
You are a helpful assistant that extracts date ranges and intent from natural language queries about sales metrics.

The user query is: "${query}"

Current date is: ${new Date().toISOString().split('T')[0]}

IMPORTANT: You must respond with ONLY a valid JSON object, no additional text, explanations, or formatting.

Please analyze the query and respond with a JSON object containing:
1. "startDate": The start date in YYYY-MM-DD format
2. "endDate": The end date in YYYY-MM-DD format  
3. "intent": A brief description of what the user wants to know

For time periods like:
- "today" = current date to current date
- "yesterday" = previous date to previous date
- "last 7 days" = 7 days ago to today
- "last month" = 30 days ago to today
- "last week" = 7 days ago to today

Example response (respond exactly like this format):
{"startDate": "2025-10-01", "endDate": "2025-10-26", "intent": "Find the person with the highest number of dials"}
`;

    const dateResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: dateExtractionPrompt }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    let dateInfo;
    try {
      const aiResponse = dateResponse.choices[0].message.content;
      console.log('AI Date Response:', aiResponse); // Debug log
      
      // Try to extract JSON from the response if it contains extra text
      let jsonStr = aiResponse;
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      dateInfo = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', dateResponse.choices[0].message.content);
      return res.status(500).json({ 
        error: 'Failed to parse date information from AI',
        aiResponse: dateResponse.choices[0].message.content 
      });
    }

    // Step 2: Fetch enhanced metrics data (including meeting integration) for the extracted date range
    const metricsData = await getMetricsDataWithMeetings(
      new Date(dateInfo.startDate), 
      new Date(dateInfo.endDate)
    );

    // Step 3: Ask OpenAI to analyze the data and provide an answer
    const analysisPrompt = `
You are a helpful assistant analyzing sales metrics data. 

User Query: "${query}"
Intent: ${dateInfo.intent}
Date Range: ${dateInfo.startDate} to ${dateInfo.endDate}

Here is the metrics data:
${JSON.stringify(metricsData, null, 2)}

The data contains:
- userName: Name of the sales person
- Dial: Number of calls made
- Connect: Number of calls connected
- Pitch: Number of pitches given
- Conversation: Number of conversations held
- Meeting: Number of meetings scheduled (includes both Trellus meetings and additional meetings from external sources, excluding "Cold Calls (Clay + Trellus)" sources)
- meetingTimestamps: Array of detailed meeting information with timestamps, lead names, companies, current stages, and sources (only for meetings from valid sources)

Note: The meeting data excludes meetings from "Cold Calls (Clay + Trellus)" source as per filtering rules.

Please analyze this data and provide a clear, conversational answer to the user's query. 

IMPORTANT: Respond with a natural, conversational text answer only. Do NOT return JSON or structured data.

Guidelines:
- Use **bold** formatting for names and important numbers
- Be specific with numbers and names
- Provide context and insights
- Keep it conversational and easy to understand
- If asked for rankings, mention the top 3-5 performers
- Include relevant comparisons or insights
- When discussing meetings, you can reference the detailed meeting information including lead names, companies, and current stages
- Be aware that meeting data comes from multiple sources and excludes "Cold Calls (Clay + Trellus)" entries

Example response format:
"Based on the data for [date range], **[Name]** has the highest number of dials with **[number] dials**. This is significantly higher than the next performer, showing exceptional activity during this period."
`;

    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.3,
    });

    const answer = analysisResponse.choices[0].message.content;

    res.json({
      query,
      dateRange: {
        start: dateInfo.startDate,
        end: dateInfo.endDate
      },
      intent: dateInfo.intent,
      answer,
      dataUsed: metricsData
    });

  } catch (error) {
    console.error('Error processing AI query:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
