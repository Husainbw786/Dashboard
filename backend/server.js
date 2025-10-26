import express from 'express';
import cors from 'cors';
import https from 'https';
import { getMetricsData, getMetricsDataWithDates } from './api-server.js';

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

app.post('/api/metrics', async (req, res) => {
  try {
    const { selects, cnf, group_by, start, end } = req.body;

    const params = {
      api_key: CONFIG.API_KEY,
      selects,
      cnf,
      group_by,
      start,
      end,
    };

    if (CONFIG.TEAM_ID) {
      params.team_id = CONFIG.TEAM_ID;
    }

    const response = await makeRequest(ENDPOINTS.METRIC_DETAILS_V6, params, 'GET');
    res.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Metrics data function imported at top

app.get('/api/metrics-data', async (req, res) => {
  try {
    const { startDate, endDate, days } = req.query;
    
    let data;
    if (startDate && endDate) {
      // Use custom date range
      data = await getMetricsDataWithDates(new Date(startDate), new Date(endDate));
    } else {
      // Use days parameter (backward compatibility)
      const daysNum = parseInt(days) || 1;
      data = await getMetricsData(daysNum);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error getting metrics data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
