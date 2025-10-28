const CONFIG = {
  BACKEND_URL: 'http://localhost:3001',
};

// Removed unused ENDPOINTS constant

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

async function makeRequest(endpoint: string, data?: any, method: string = 'GET'): Promise<any> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const url = method === 'GET' && data 
    ? `${CONFIG.BACKEND_URL}${endpoint}?${new URLSearchParams(data).toString()}`
    : `${CONFIG.BACKEND_URL}${endpoint}`;

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchUsers() {
  const response = await makeRequest('/api/users');

  if (!response || !response.users) {
    throw new Error('Failed to fetch users');
  }

  return {
    users: response.users,
    team: response.team
  };
}

function getMetricForStage(stage: any) {
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

function buildMetrics(stageConfig: typeof DEFAULT_STAGE_CONFIG) {
  const metrics: any[] = [];

  stageConfig.options.forEach((stage) => {
    const metric = getMetricForStage(stage);
    metrics.push({
      label: stage.label,
      ...metric
    });
  });

  return metrics;
}

async function fetchMetricData(metricSelect: any, startDate: Date, endDate: Date) {
  const data = {
    selects: metricSelect.selects,
    cnf: metricSelect.cnf,
    group_by: metricSelect.group_by,
    start: startDate.getTime() * MS_TO_MICRO,
    end: endDate.getTime() * MS_TO_MICRO,
  };

  return makeRequest('/api/metrics', data, 'POST');
}

async function fetchAllMetricsData(metrics: any[], startDate: Date, endDate: Date) {
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

function processMetricData(rawData: any) {
  const map = new Map();

  if (!rawData || !Array.isArray(rawData)) {
    return map;
  }

  rawData.forEach((row: any) => {
    const userId = row[0] === null ? 'Unknown' : String(row[0]);
    const value = row[1] ?? 0;
    map.set(userId, value);
  });

  return map;
}

function calculateColumnValue(metricResult: any, userId: string) {
  const numeratorMap = processMetricData(metricResult.numeratorData);
  return numeratorMap.get(userId) ?? 0;
}

function generateFlatRows(users: any[], metricsResults: any[]) {
  const rows: any[] = [];

  users.forEach((user: any) => {
    const row = {
      userId: user.user_id,
      userName: user.user_name,
      values: {} as Record<string, number>
    };

    metricsResults.forEach((metricResult: any) => {
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

export async function getMetricsData(days = 1) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const endDate = new Date();

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

// Simplified function that uses the backend's combined endpoint
export async function getMetricsDataSimple(days: number = 1) {
  return makeRequest('/api/metrics-data', { days });
}

// Function to get metrics data with custom date range
export async function getMetricsDataWithDateRange(startDate: string, endDate: string) {
  return makeRequest('/api/metrics-data', { startDate, endDate });
}

// AI Query function
export async function queryAI(query: string) {
  return makeRequest('/api/ai-query', { query }, 'POST');
}

// Meeting details function
export async function getMeetingDetails(userName: string, startDate: string, endDate: string) {
  return makeRequest('/api/meeting-details', { userName, startDate, endDate });
}
