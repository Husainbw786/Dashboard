import https from 'https';
import fetch from 'node-fetch';

const CONFIG = {
  API_KEY: 'b7734dc1c976d0a38a0482a63b2dfa1f29f6e081',
  HOSTNAME: 'api.trellus.ai',
  TEAM_ID: null,
};

const ENDPOINTS = {
  GET_VISIBLE_ACCOUNTS: 'get-visible-accounts',
  METRIC_DETAILS_V6: 'metric-details-v6',
};

const MS_TO_MICRO = 1000;

const BackendTables = {
  SESSIONS_V2: 'SESSIONS_V2',
  SESSION_METRICS: 'SESSION_METRICS',
  CALL_METRICS: 'CALL_METRICS',
};

const SessionV2Columns = {
  RESOURCE_ID: 'resource_id',
};

const SessionMetricsColumns = {
  STAGE: 'stage',
  LIVE_DURATION: 'live_duration',
};

const FilterOperator = {
  GT: 'GT',
  IN: 'IN',
};

const STAGE = {
  PITCHED: 'PITCHED',
  CONVERSATION: 'CONVERSATION',
  BOOKED: 'BOOKED',
};

const LIVE_DURATION_GT_ZERO = {
  column_name: SessionMetricsColumns.LIVE_DURATION,
  table: BackendTables.SESSION_METRICS,
  operator: FilterOperator.GT,
  value_safe: 0
};

const DEFAULT_STAGE_CONFIG = {
  options: [
    {
      label: 'Dial',
      filter: []
    },
    {
      label: 'Connect',
      filter: [[LIVE_DURATION_GT_ZERO]]
    },
    {
      label: 'Pitch',
      filter: [[
        {
          column_name: SessionMetricsColumns.STAGE,
          table: BackendTables.SESSION_METRICS,
          operator: FilterOperator.IN,
          value_safe: [STAGE.PITCHED, STAGE.CONVERSATION, STAGE.BOOKED]
        },
        {
          column_name: SessionMetricsColumns.LIVE_DURATION,
          table: BackendTables.SESSION_METRICS,
          operator: FilterOperator.GT,
          value_safe: 60
        }
      ]]
    },
    {
      label: 'Conversation',
      filter: [[
        {
          column_name: SessionMetricsColumns.STAGE,
          table: BackendTables.SESSION_METRICS,
          operator: FilterOperator.IN,
          value_safe: [STAGE.CONVERSATION, STAGE.BOOKED]
        },
        {
          column_name: SessionMetricsColumns.LIVE_DURATION,
          table: BackendTables.SESSION_METRICS,
          operator: FilterOperator.GT,
          value_safe: 90
        }
      ]]
    },
    {
      label: 'Meeting',
      filter: [[{
        column_name: SessionMetricsColumns.STAGE,
        table: BackendTables.SESSION_METRICS,
        operator: FilterOperator.IN,
        value_safe: [STAGE.BOOKED]
      }]]
    }
  ],
  cumulative: true
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

async function fetchUsers() {
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

  return {
    users: activeDialerUsers,
    team: response.team
  };
}

function getMetricForStage(stage) {
  return {
    selects: [{
      column_type: 'CNF',
      cnf: stage.filter
    }],
    cnf: [],
    group_by: {
      column: {
        table: BackendTables.SESSIONS_V2,
        column_name: SessionV2Columns.RESOURCE_ID
      }
    }
  };
}

function buildMetrics(stageConfig) {
  const metrics = [];

  stageConfig.options.forEach((stage) => {
    const metric = getMetricForStage(stage);
    metrics.push({
      label: stage.label,
      ...metric
    });
  });

  return metrics;
}

async function fetchMetricData(metricSelect, startDate, endDate) {
  const params = {
    api_key: CONFIG.API_KEY,
    selects: metricSelect.selects,
    cnf: metricSelect.cnf,
    group_by: metricSelect.group_by,
    start: startDate.getTime() * MS_TO_MICRO,
    end: endDate.getTime() * MS_TO_MICRO,
  };

  if (CONFIG.TEAM_ID) {
    params.team_id = CONFIG.TEAM_ID;
  }

  return makeRequest(ENDPOINTS.METRIC_DETAILS_V6, params, 'GET');
}

async function fetchAllMetricsData(metrics, startDate, endDate) {
  const results = [];

  for (const metric of metrics) {
    const numeratorData = await fetchMetricData(metric, startDate, endDate);
    results.push({
      metric,
      numeratorData,
      denominatorData: null
    });
  }

  return results;
}

function processMetricData(rawData) {
  const map = new Map();

  if (!rawData || !Array.isArray(rawData)) {
    return map;
  }

  rawData.forEach(row => {
    const userId = row[0] === null ? 'Unknown' : String(row[0]);
    const value = row[1] ?? 0;
    map.set(userId, value);
  });

  return map;
}

function calculateColumnValue(metricResult, userId) {
  const numeratorMap = processMetricData(metricResult.numeratorData);
  return numeratorMap.get(userId) ?? 0;
}

function generateFlatRows(users, metricsResults) {
  const rows = [];

  users.forEach(user => {
    const row = {
      userId: user.user_id,
      userName: user.user_name,
      values: {}
    };

    metricsResults.forEach(metricResult => {
      const rawValue = calculateColumnValue(metricResult, user.user_id);
      row.values[metricResult.metric.label] = rawValue;
    });

    rows.push(row);
  });

  const firstMetricLabel = metricsResults[0].metric.label;
  rows.sort((a, b) => {
    const aValue = a.values[firstMetricLabel] ?? 0;
    const bValue = b.values[firstMetricLabel] ?? 0;
    return bValue - aValue;
  });

  return rows;
}

async function getMetricsData(days = 1) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const endDate = new Date();
  return getMetricsDataWithDates(startDate, endDate);
}

async function getMetricsDataWithDates(startDate, endDate) {
  const { users } = await fetchUsers();

  if (users.length === 0) {
    return {
      rows: [],
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    };
  }

  const stageConfig = DEFAULT_STAGE_CONFIG;
  const metrics = buildMetrics(stageConfig);
  const metricsResults = await fetchAllMetricsData(metrics, startDate, endDate);
  const rows = generateFlatRows(users, metricsResults);

  return {
    rows,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  };
}

// Function to fetch meeting data from flow.sokt.io API
async function fetchMeetingData() {
  try {
    const response = await fetch('https://flow.sokt.io/func/scritKOiRBu9');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching meeting data:', error);
    throw error;
  }
}

// Function to parse date from timestamp string
function parseTimestamp(timestamp) {
  // Handle format like "10/14/2025 14:22:23"
  const [datePart, timePart] = timestamp.split(' ');
  const [month, day, year] = datePart.split('/');
  return new Date(year, month - 1, day);
}

// Team mapping data
const TEAM_MAPPING = {
  "Aashima Soni": "Botzilla",
  "Aastha Jain": "Botzilla",
  "Abhishek Joshi": "Botzilla",
  "Adarsh Kaushal": "Botzilla",
  "Aditi Soni": "Alphabots",
  "Ananya Chauhan": "Cloudtech",
  "Anika Garg": "Botzilla",
  "Anish Alam": "Alphabots",
  "Anjali Meena": "Cloudtech",
  "Anjali Pandey": "Botzilla",
  "Ankit Kumar Patel": "Botzilla",
  "Anurag Sontale": "Cloudtech",
  "Anusha Khare": "Botzilla",
  "Anushka Pawar": "Cloudtech",
  "Apurva Dubey": "KnowcloudAI",
  "Arpit Gupta": "Cloudtech",
  "Atharv Bhoot": "Alphabots",
  "Atharv Tiwari": "KnowcloudAI",
  "Avani Lakhotia": "Alphabots",
  "Ayush Verma": "Cloudtech",
  "Bhakti Atul Landge": "Botzilla",
  "Deepika Saxena": "Botzilla",
  "Digvijay Suryawanshi": "Alphabots",
  "Divyansh Bansal": "Cloudtech",
  "Drishti Gupta": "Cloudtech",
  "Eureka Baranwal": "Alphabots",
  "HARSH RAJ": "Botzilla",
  "Harsh Srivastava": "Botzilla",
  "Harshit Parwani": "Botzilla",
  "Himanshu Malviya": "Botzilla",
  "Jasleen Kaur": "Alphabots",
  "Jessica Aaron": "Hyperflex",
  "Jison Nongmeikapam": "Botzilla",
  "Karishma Sankhala": "Alphabots",
  "Khushi Malviya": "Botzilla",
  "krishnraj singh rathod": "Botzilla",
  "Lovish Sahota": "Alphabots",
  "Matthew Clay": "KnowcloudAI",
  "Mohmmad Junaid": "Alphabots",
  "Nihal Rathod": "Alphabots",
  "Nilesh Rathore": "Alphabots",
  "Nisha Singh": "Alphabots",
  "Ojasvee Sharma": "KnowcloudAI",
  "Pallavi Bharti": "Alphabots",
  "Pavitra Rai": "Botzilla",
  "Pranali Chaudhari": "Botzilla",
  "Rahul Mathur": "Alphabots",
  "Raj Thakur": "KnowcloudAI",
  "Rohan Dsouza": "Cloudtech",
  "Rohan Gothwal": "Cloudtech",
  "Rohit Pagare": "Alphabots",
  "Rohit Tanwar": "Alphabots",
  "Sakshi Choudhary": "Alphabots",
  "Sakshi Jaiswal": "Alphabots",
  "Sakshi Patidar": "Botzilla",
  "Saloni K": "Alphabots",
  "Sanket Nathani": "KnowcloudAI",
  "Sanskriti Rathore": "KnowcloudAI",
  "Shailendra Singh Ranawat": "KnowcloudAI",
  "Shashank Giri": "Alphabots",
  "Shantanu Rajgire": "Alphabots",
  "Shivam Bhatnagar": "Botzilla",
  "Shivam Kapil": "Alphabots",
  "Shivani V S": "Alphabots",
  "Shravani Neelam": "Botzilla",
  "Siddhant Singh": "Botzilla",
  "Simran Subba Nembang": "Botzilla",
  "Soumya Sharma": "KnowcloudAI",
  "Suyog Shewale": "Botzilla",
  "Tanay Patekar": "Alphabots",
  "Tina Bidikikar": "Alphabots",
  "Tushar Sandhu": "Alphabots",
  "Uday Yada": "KnowcloudAI",
  "uddeshya Saxena": "Alphabots",
  "Vaibhav Shresth": "Alphabots",
  "Vaidehi Khande": "KnowcloudAI",
  "Vishvajit Jadha": "Botzilla",
  "zahid hasan": "Alphabots"
};

// Function to get team for a user
function getTeamForUser(userName) {
  if (!userName) return 'NA';
  
  // First try exact match
  if (TEAM_MAPPING[userName]) {
    return TEAM_MAPPING[userName];
  }
  
  // Then try fuzzy matching for case variations
  for (const [mappedName, team] of Object.entries(TEAM_MAPPING)) {
    if (namesMatch(userName, mappedName)) {
      return team;
    }
  }
  
  return 'NA';
}

// Function to normalize names for matching
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Function to check if names match (fuzzy matching)
function namesMatch(name1, name2) {
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);
  
  if (normalized1 === normalized2) return true;
  
  // Check if one name contains the other (for cases like "Aashima Soni" vs "Aashima soni")
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');
  
  // Check if at least 2 words match or if it's a single name match
  let matchCount = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 && word1.length > 2) { // Ignore very short words
        matchCount++;
      }
    }
  }
  
  return matchCount >= Math.min(words1.length, words2.length, 2);
}

// Function to filter meeting data by date range
function filterMeetingDataByDate(meetingData, startDate, endDate) {
  if (!meetingData || !meetingData.data) return [];
  
  return meetingData.data.filter(meeting => {
    if (!meeting.Timestamp) return false;
    
    try {
      const meetingDate = parseTimestamp(meeting.Timestamp);
      return meetingDate >= startDate && meetingDate <= endDate;
    } catch (error) {
      console.error('Error parsing timestamp:', meeting.Timestamp, error);
      return false;
    }
  });
}

// Function to merge meeting data with Trellus data
function mergeMeetingData(trellusRows, meetingData, startDate, endDate, debug = false) {
  const filteredMeetings = filterMeetingDataByDate(meetingData, startDate, endDate);
  
  if (debug) {
    console.log(`Filtered meetings for date range: ${filteredMeetings.length} meetings`);
  }
  
  // Create a map of meeting counts and timestamps by normalized name
  const meetingMap = new Map();
  
  filteredMeetings.forEach(meeting => {
    const name = meeting.Name;
    if (!name) return;
    
    // Skip meetings with "Cold Calls (Clay + Trellus)" as source
    const sourceOfLead = meeting['Source of Lead'];
    if (sourceOfLead === 'Cold Calls (Clay + Trellus)') {
      return; // Skip this meeting
    }
    
    const normalizedName = normalizeName(name);
    if (!meetingMap.has(normalizedName)) {
      meetingMap.set(normalizedName, {
        count: 0,
        timestamps: []
      });
    }
    
    const meetingInfo = meetingMap.get(normalizedName);
    meetingInfo.count++;
    meetingInfo.timestamps.push({
      timestamp: meeting.Timestamp,
      leadName: meeting['Lead Name (individual you were speaking to)'] || '',
      companyName: meeting['Company Name'] || '',
      currentStage: meeting['Current Stage'] || '',
      meetingBookedDate: meeting['Meeting Booked (date of the cold call conversion)'] || '',
      sourceOfLead: sourceOfLead || '',
      source: 'google_sheet' // Mark as Google Sheet data
    });
  });
  
  if (debug) {
    console.log(`Meeting map created with ${meetingMap.size} unique names`);
    if (meetingMap.size > 0) {
      console.log('Sample meeting names:', Array.from(meetingMap.keys()).slice(0, 5));
    }
  }
  
  // Merge the data
  return trellusRows.map(row => {
    let additionalMeetings = 0;
    let meetingTimestamps = [];
    
    // Try to find matching meeting data
    for (const [normalizedMeetingName, meetingInfo] of meetingMap.entries()) {
      if (namesMatch(row.userName, normalizedMeetingName)) {
        if (debug) {
          console.log(`Match found: ${row.userName} -> ${normalizedMeetingName} (${meetingInfo.count} meetings)`);
        }
        additionalMeetings += meetingInfo.count;
        meetingTimestamps = meetingTimestamps.concat(meetingInfo.timestamps);
      }
    }
    
    // Update the Meeting count
    const originalMeetingCount = row.values.Meeting || 0;
    const totalMeetingCount = originalMeetingCount + additionalMeetings;
    
    return {
      ...row,
      team: getTeamForUser(row.userName),
      values: {
        ...row.values,
        Meeting: totalMeetingCount
      },
      meetingCounts: {
        trellus: originalMeetingCount,
        googleSheet: additionalMeetings,
        total: totalMeetingCount
      },
      meetingTimestamps: meetingTimestamps.sort((a, b) => {
        const dateA = parseTimestamp(a.timestamp);
        const dateB = parseTimestamp(b.timestamp);
        return dateB - dateA; // Sort by newest first
      })
    };
  });
}

// Enhanced function to get metrics data with meeting integration
async function getMetricsDataWithMeetings(startDate, endDate, debug = false) {
  try {
    if (debug) {
      console.log(`Fetching metrics data for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }
    
    // Fetch both Trellus and meeting data in parallel
    const [trellusData, meetingData] = await Promise.all([
      getMetricsDataWithDates(startDate, endDate),
      fetchMeetingData()
    ]);
    
    if (debug) {
      console.log(`Fetched ${trellusData.rows.length} Trellus rows and ${meetingData.data ? meetingData.data.length : 0} meeting records`);
    }
    
    // Merge the meeting data with Trellus data
    const mergedRows = mergeMeetingData(trellusData.rows, meetingData, startDate, endDate, debug);
    
    return {
      ...trellusData,
      rows: mergedRows
    };
  } catch (error) {
    console.error('Error getting metrics data with meetings:', error);
    // Fallback to original data if meeting API fails
    return getMetricsDataWithDates(startDate, endDate);
  }
}

export { getMetricsData, getMetricsDataWithDates, getMetricsDataWithMeetings };
