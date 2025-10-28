import https from 'https';
import { processExcelData, matchUsersWithExcelData, getExcelDataSummary } from './excel-processor.js';

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

// Updated config to only fetch Meeting data
const MEETING_ONLY_CONFIG = {
  options: [
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

function generateFlatRows(users, metricsResults, excelMeetings = {}) {
  const rows = [];

  users.forEach(user => {
    const row = {
      userId: user.user_id,
      userName: user.user_name,
      values: {},
      details: []
    };

    // Get Trellus meeting count
    let trellusMeetings = 0;
    metricsResults.forEach(metricResult => {
      const rawValue = calculateColumnValue(metricResult, user.user_id);
      if (metricResult.metric.label === 'Meeting') {
        trellusMeetings = rawValue;
      }
    });

    // Get Excel meeting data for this user
    const excelUserData = excelMeetings[user.user_id] || { meetings: [], totalCount: 0 };
    
    // Only add Excel meetings to details (not Trellus meetings)
    if (excelUserData.meetings && excelUserData.meetings.length > 0) {
      row.details.push(...excelUserData.meetings);
    }

    // Combine meeting counts: Trellus + Excel
    const totalMeetings = trellusMeetings + excelUserData.totalCount;
    row.values.Meeting = totalMeetings;

    rows.push(row);
  });

  // Sort by total meeting count
  rows.sort((a, b) => {
    const aValue = a.values.Meeting ?? 0;
    const bValue = b.values.Meeting ?? 0;
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

  // Process Excel data for the same date range
  console.log('Processing Excel data for date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
  const excelMeetings = processExcelData(startDate, endDate);
  const excelSummary = getExcelDataSummary(excelMeetings);
  console.log('Excel data summary:', excelSummary);
  
  // Match Excel users with Trellus users
  const userMapping = matchUsersWithExcelData(users, excelMeetings);
  
  // Only fetch Meeting metrics from Trellus
  const stageConfig = MEETING_ONLY_CONFIG;
  const metrics = buildMetrics(stageConfig);
  const metricsResults = await fetchAllMetricsData(metrics, startDate, endDate);
  
  // Generate combined rows
  const rows = generateFlatRows(users, metricsResults, userMapping);

  return {
    rows,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    },
    excelSummary
  };
}

export { getMetricsData, getMetricsDataWithDates };
