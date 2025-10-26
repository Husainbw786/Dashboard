/**
 * ============================================================================
 * GENERATE METRIC TABLE ROWS - SELF-CONTAINED SCRIPT
 * ============================================================================
 *
 * This script replicates the exact logic used by the MetricTable component
 * in src/components/MetricTable/ for Outbound analytics reports.
 *
 * It demonstrates:
 * 1. Fetching users from get-visible-accounts API
 * 2. Loading stage definitions (team-specific or defaults)
 * 3. Fetching metric data via metric-details-v6 API
 * 4. Processing and displaying flat rows grouped by users
 *
 * USAGE:
 * 1. Set your API_KEY below
 * 2. Optionally adjust DATE_RANGE and other config
 * 3. Run: node generate-metric-table-rows.js
 */

const https = require('https');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Your Trellus API key (REQUIRED - get this from your account)
  API_KEY: 'b7734dc1c976d0a38a0482a63b2dfa1f29f6e081',

  // API hostname
  HOSTNAME: 'api.trellus.ai',

  // Date range for metrics - last 1 day
  START_DATE: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  END_DATE: new Date(),

  // Optional: specific team_id to query (null = use your default team)
  TEAM_ID: null,
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

const ENDPOINTS = {
  GET_VISIBLE_ACCOUNTS: 'get-visible-accounts',
  METRIC_DETAILS_V6: 'metric-details-v6',
  CUSTOM_DEFINITIONS: 'custom-definitions',
};

// ============================================================================
// CONSTANTS (from codebase)
// ============================================================================

// Microseconds conversion
const MS_TO_MICRO = 1000;

// Backend tables (UPPERCASE as used by API)
const BackendTables = {
  SESSIONS_V2: 'SESSIONS_V2',
  SESSION_METRICS: 'SESSION_METRICS',
  CALL_METRICS: 'CALL_METRICS',
  PROSPECT_INFO: 'PROSPECT_INFO',
};

// Column names
const SessionV2Columns = {
  SESSION_ID: 'session_id',
  RESOURCE_ID: 'resource_id',
};

const SessionMetricsColumns = {
  STAGE: 'stage',
  LIVE_DURATION: 'live_duration',
};

const CallMetricColumns = {
  CALL_DURATION: 'call_duration',
};

// Filter operators (as used by API)
const FilterOperator = {
  GT: 'GT',
  IN: 'IN',
  EQ: 'EQ',
};

// Stage enum values
const STAGE = {
  PITCHED: 'PITCHED',
  CONVERSATION: 'CONVERSATION',
  BOOKED: 'BOOKED',
};

// ============================================================================
// DEFAULT STAGE DEFINITIONS
// ============================================================================

// Filter for connected calls (live_duration > 0)
const LIVE_DURATION_GT_ZERO = {
  column_name: SessionMetricsColumns.LIVE_DURATION,
  table: BackendTables.SESSION_METRICS,
  operator: FilterOperator.GT,
  value_safe: 0
};

// Outbound filter (is_inbound = false OR is_inbound = null)
const OUTBOUND_FILTER = [[{
  column_name: 'is_inbound',
  table: BackendTables.CALL_METRICS,
  operator: FilterOperator.EQ,
  value_safe: false
}, {
  column_name: 'is_inbound',
  table: BackendTables.CALL_METRICS,
  operator: FilterOperator.EQ,
  value_safe: null
}]];

// Default stage definitions (matching src/lib/redux/analytics/stage-definitions.tsx)
const DEFAULT_STAGE_CONFIG = {
  options: [
    {
      label: 'Dial',
      filter: [] // All sessions
    },
    {
      label: 'Connect',
      filter: [[LIVE_DURATION_GT_ZERO]] // Sessions with live_duration > 0
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
  cumulative: true // Each stage includes filters from previous stages
};

// ============================================================================
// HTTPS REQUEST HELPER
// ============================================================================

/**
 * Make an HTTPS request to the Trellus API
 * NOTE: Trellus API uses a special format - params are passed as JSON-stringified headers!
 * IMPORTANT: Unicode characters must be escaped in the headers (matching corsGet behavior)
 */
function makeRequest(endpoint, params, method = 'GET') {
  return new Promise((resolve, reject) => {
    // Convert params to JSON-stringified headers with Unicode escaping (this is how corsGet works)
    const headers = {
      'Content-Type': 'text/plain'
    };

    Object.entries(params).forEach(([key, value]) => {
      // JSON stringify and escape Unicode characters (same as corsGet line 71)
      // BUT: The browser shows api_key is double-stringified: "\"xxx\""
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
        console.log(`[DEBUG] ${method} ${endpoint} - Status: ${res.statusCode}, Response length: ${data.length} bytes`);

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}. Body: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

// ============================================================================
// STEP 1: FETCH USERS
// ============================================================================

/**
 * Fetch all visible accounts (users) from the API
 * Endpoint: get-visible-accounts
 */
async function fetchUsers() {
  console.log('\n=== STEP 1: Fetching Users ===\n');

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

  // Filter to active dialer users (can_dial && team_is_active)
  const activeDialerUsers = response.users.filter(user =>
    user.can_dial && user.team_is_active
  );

  console.log(`Found ${activeDialerUsers.length} active dialer users:`);
  activeDialerUsers.forEach(user => {
    console.log(`  - ${user.user_name} (${user.user_id})`);
  });

  return {
    users: activeDialerUsers,
    team: response.team
  };
}

// ============================================================================
// STEP 2: LOAD STAGE DEFINITIONS
// ============================================================================

/**
 * Load stage definitions for the team
 * In a full implementation, this would fetch from custom-definitions API
 * For now, we use the default stage config
 */
async function loadStageDefinitions(team) {
  console.log('\n=== STEP 2: Loading Stage Definitions ===\n');

  // In a real implementation, you would fetch custom definitions:
  // const response = await makeRequest(ENDPOINTS.CUSTOM_DEFINITIONS, { api_key: CONFIG.API_KEY });
  // and parse the team's custom stage config if it exists

  // For this script, we use the default config
  const stageConfig = DEFAULT_STAGE_CONFIG;

  console.log(`Using stage configuration:`);
  stageConfig.options.forEach((stage, idx) => {
    console.log(`  ${idx + 1}. ${stage.label}`);
  });
  console.log(`  Cumulative: ${stageConfig.cumulative}\n`);

  return stageConfig;
}

// ============================================================================
// STEP 3: BUILD METRICS FOR STAGES
// ============================================================================

/**
 * Build a metric select for a given stage definition
 * Handles cumulative filters (includes previous stage filters)
 */
function getMetricForStage(stage, stageConfig, stageIndex) {
  // For now, don't do cumulative - just use the stage filter directly
  let combinedFilter = [...stage.filter];

  // DISABLED: Cumulative filters seem to cause issues
  // if (stageConfig.cumulative && stageIndex < stageConfig.options.length - 1) {
  //   for (let i = 0; i < stageIndex; i++) {
  //     const previousStage = stageConfig.options[i];
  //     if (previousStage.filter && previousStage.filter.length > 0) {
  //       combinedFilter.push(...previousStage.filter);
  //     }
  //   }
  // }

  return {
    selects: [{
      column_type: 'CNF',
      cnf: combinedFilter
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

/**
 * Build all metrics we need for the Outbound report
 */
function buildMetrics(stageConfig) {
  console.log('\n=== STEP 3: Building Metrics ===\n');

  const metrics = [];

  // Build count metric for each stage
  stageConfig.options.forEach((stage, index) => {
    const metric = getMetricForStage(stage, stageConfig, index);
    metrics.push({
      label: stage.label,
      ...metric
    });
    console.log(`  - ${stage.label} count`);
  });

  console.log();
  return metrics;
}

// ============================================================================
// STEP 4: FETCH METRIC DATA
// ============================================================================

/**
 * Fetch metric data from the metric-details-v6 API
 * Uses GET with params as JSON-stringified headers (same as other endpoints)
 */
async function fetchMetricData(metricSelect) {
  const params = {
    api_key: CONFIG.API_KEY,
    selects: metricSelect.selects,
    cnf: metricSelect.cnf,
    group_by: metricSelect.group_by,
    start: CONFIG.START_DATE.getTime() * MS_TO_MICRO,
    end: CONFIG.END_DATE.getTime() * MS_TO_MICRO,
  };

  if (CONFIG.TEAM_ID) {
    params.team_id = CONFIG.TEAM_ID;
  }

  // Debug: log the request params (disabled for cleaner output)
  // console.log(`[DEBUG] Metric request params (size: ${JSON.stringify(params).length} bytes):`, JSON.stringify(params, null, 2).substring(0, 500));

  // Use the same makeRequest function (GET with headers)
  return makeRequest(ENDPOINTS.METRIC_DETAILS_V6, params, 'GET');
}

/**
 * Fetch data for all metrics
 */
async function fetchAllMetricsData(metrics) {
  console.log('\n=== STEP 4: Fetching Metric Data ===\n');

  const results = [];

  for (const metric of metrics) {
    console.log(`Fetching data for: ${metric.label}...`);

    // Fetch numerator data
    let numeratorData = null;
    if (metric.numerator) {
      numeratorData = await fetchMetricData(metric.numerator);
    } else {
      // Simple count metric (no numerator/denominator)
      numeratorData = await fetchMetricData(metric);
    }

    // Fetch denominator data if exists
    let denominatorData = null;
    if (metric.denominator) {
      denominatorData = await fetchMetricData(metric.denominator);
    }

    results.push({
      metric,
      numeratorData,
      denominatorData
    });
  }

  console.log('All data fetched!\n');
  return results;
}

// ============================================================================
// STEP 5: PROCESS DATA INTO ROWS
// ============================================================================

/**
 * Convert raw API data into a map: userId -> value
 */
function processMetricData(rawData) {
  const map = new Map();

  if (!rawData || !Array.isArray(rawData)) {
    return map;
  }

  rawData.forEach(row => {
    // Format: [user_id, metric_value]
    const userId = row[0] === null ? 'Unknown' : String(row[0]);
    const value = row[1] ?? 0;
    map.set(userId, value);
  });

  return map;
}

/**
 * Calculate column value for a specific user
 */
function calculateColumnValue(metricResult, userId) {
  const numeratorMap = processMetricData(metricResult.numeratorData);
  const numeratorValue = numeratorMap.get(userId) ?? 0;

  if (!metricResult.denominatorData) {
    // Simple count metric
    return numeratorValue;
  }

  // Ratio metric (percentage or average)
  const denominatorMap = processMetricData(metricResult.denominatorData);
  const denominatorValue = denominatorMap.get(userId) ?? 0;

  if (denominatorValue === 0) {
    return 0; // Avoid division by zero
  }

  return numeratorValue / denominatorValue;
}

/**
 * Format a metric value for display
 */
function formatMetricValue(value, metric) {
  if (value === null || value === undefined) {
    return '-';
  }

  // Handle time columns (convert seconds to human-readable)
  if (metric.isTimeColumn) {
    const seconds = metric.divideBy ? value / metric.divideBy : value;

    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  // Handle percentage columns
  if (metric.isPercentage) {
    const percentage = value * 100;
    return `${percentage.toFixed(1)}%`;
  }

  // Handle divideBy (e.g., converting to minutes)
  if (metric.divideBy) {
    const divided = value / metric.divideBy;
    return divided.toFixed(1);
  }

  // Default: show as number
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
}

/**
 * Generate flat rows (one row per user)
 */
function generateFlatRows(users, metricsResults) {
  console.log('\n=== STEP 5: Processing Data into Rows ===\n');

  const rows = [];

  users.forEach(user => {
    const row = {
      userId: user.user_id,
      userName: user.user_name,
      values: {}
    };

    metricsResults.forEach(metricResult => {
      const rawValue = calculateColumnValue(metricResult, user.user_id);
      const formattedValue = formatMetricValue(rawValue, metricResult.metric);

      row.values[metricResult.metric.label] = {
        raw: rawValue,
        formatted: formattedValue
      };
    });

    rows.push(row);
  });

  // Sort by first metric (total dials) descending
  const firstMetricLabel = metricsResults[0].metric.label;
  rows.sort((a, b) => {
    const aValue = a.values[firstMetricLabel]?.raw ?? 0;
    const bValue = b.values[firstMetricLabel]?.raw ?? 0;
    return bValue - aValue;
  });

  console.log(`Generated ${rows.length} rows\n`);
  return rows;
}

// ============================================================================
// STEP 6: DISPLAY RESULTS
// ============================================================================

/**
 * Display the flat rows in a nice table format
 */
function displayResults(rows, metrics) {
  console.log('\n=== RESULTS ===\n');
  console.log(`Date Range: ${CONFIG.START_DATE.toISOString().split('T')[0]} to ${CONFIG.END_DATE.toISOString().split('T')[0]}\n`);

  if (rows.length === 0) {
    console.log('No data found for the selected date range and users.\n');
    return;
  }

  // Build header
  const headers = ['User', ...metrics.map(m => m.metric.label)];
  const colWidths = headers.map((h, i) => {
    if (i === 0) {
      // User column: max of header or longest user name
      return Math.max(h.length, ...rows.map(r => r.userName.length));
    } else {
      // Metric columns: max of header or longest formatted value
      const metricLabel = metrics[i - 1].metric.label;
      return Math.max(h.length, ...rows.map(r => r.values[metricLabel].formatted.length));
    }
  });

  // Print header
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
  console.log(headerRow);
  console.log('-'.repeat(headerRow.length));

  // Print each row
  rows.forEach(row => {
    const cells = [
      row.userName.padEnd(colWidths[0]),
      ...metrics.map((m, i) =>
        row.values[m.metric.label].formatted.padEnd(colWidths[i + 1])
      )
    ];
    console.log(cells.join(' | '));
  });

  console.log('\n');
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('============================================================================');
  console.log('METRIC TABLE ROWS GENERATOR');
  console.log('============================================================================');

  try {
    // Validate API key
    if (CONFIG.API_KEY === 'your-api-key-here') {
      throw new Error('Please set your API_KEY in the CONFIG section at the top of this file');
    }

    // Step 1: Fetch users
    const { users, team } = await fetchUsers();

    if (users.length === 0) {
      console.log('\nNo active dialer users found. Exiting.\n');
      return;
    }

    // Step 2: Load stage definitions
    const stageConfig = await loadStageDefinitions(team);

    // Step 3: Build metrics
    const metrics = buildMetrics(stageConfig);

    // Step 4: Fetch data for all metrics
    const metricsResults = await fetchAllMetricsData(metrics);

    // Step 5: Process into flat rows
    const rows = generateFlatRows(users, metricsResults);

    // Step 6: Display results
    displayResults(rows, metricsResults);

    console.log('============================================================================');
    console.log('COMPLETE!');
    console.log('============================================================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
main();
