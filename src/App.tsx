import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, RefreshCw, Calendar, MessageSquare, Send, Loader2 } from 'lucide-react';

interface MetricRow {
  userId: string;
  userName: string;
  values: {
    Meeting: number;
  };
  details?: MeetingDetail[];
}

interface MeetingDetail {
  source: string;
  date: string;
  leadName?: string;
  company?: string;
  stage?: string;
}

interface MetricsData {
  rows: MetricRow[];
  dateRange: {
    start: string;
    end: string;
  };
}

type SortColumn = 'name' | 'meeting';
type SortDirection = 'asc' | 'desc';

interface AIQueryResponse {
  query: string;
  dateRange: {
    start: string;
    end: string;
  };
  intent: string;
  answer: string;
  dataUsed: MetricsData;
}

function App() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // AI Query states
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<AIQueryResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Meeting details modal states
  const [selectedUser, setSelectedUser] = useState<MetricRow | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchMetrics = async (customStart?: string, customEnd?: string) => {
    setLoading(true);
    setError(null);

    try {
      if (customStart && customEnd) {
        const { getMetricsDataWithDateRange } = await import('./api/metricsService');
        const metricsData = await getMetricsDataWithDateRange(customStart, customEnd);
        setData(metricsData);
      } else {
        const { getMetricsDataSimple } = await import('./api/metricsService');
        const metricsData = await getMetricsDataSimple(1);
        setData(metricsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeSubmit = () => {
    if (startDate && endDate) {
      fetchMetrics(startDate, endDate);
    }
  };

  const handleQuickDateRange = (days: number) => {
    setUseCustomDates(false);
    setStartDate('');
    setEndDate('');
    
    // Calculate date range based on days
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    fetchMetrics(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
  };

  const handleAIQuery = async () => {
    if (!aiQuery.trim()) return;
    
    setAiLoading(true);
    setAiError(null);
    setAiResponse(null);
    
    try {
      const { queryAI } = await import('./api/metricsService');
      const response = await queryAI(aiQuery);
      setAiResponse(response);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to process AI query');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAIQuery();
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending for numeric columns, ascending for name
      setSortColumn(column);
      setSortDirection(column === 'name' ? 'asc' : 'desc');
    }
  };

  const handleMeetingClick = (user: MetricRow) => {
    if (user.values.Meeting > 0) {
      setSelectedUser(user);
      setShowDetailsModal(true);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedUser(null);
  };

  const getSortedData = () => {
    if (!data) return [];
    
    const sortedRows = [...data.rows].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortColumn) {
        case 'name':
          aValue = a.userName.toLowerCase();
          bValue = b.userName.toLowerCase();
          break;
        case 'meeting':
          aValue = a.values.Meeting;
          bValue = b.values.Meeting;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sortedRows;
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Loading metrics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-md w-full">
          <div className="text-red-600 text-sm font-medium mb-2">Error</div>
          <p className="text-slate-700 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchMetrics()}
            className="w-full px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 text-sm">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Metrics Dashboard</h1>
              <p className="text-sm text-slate-600 mt-1">
                {data.dateRange.start} to {data.dateRange.end}
              </p>
            </div>
            <button
              onClick={() => fetchMetrics()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          
          {/* Date Range Controls */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useCustomDates}
                  onChange={(e) => setUseCustomDates(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Custom Date Range</span>
              </label>
            </div>
            
            {useCustomDates && (
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="mt-5">
                  <button
                    onClick={handleDateRangeSubmit}
                    disabled={!startDate || !endDate}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            )}
            
            {!useCustomDates && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickDateRange(1)}
                  className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => handleQuickDateRange(7)}
                  className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => handleQuickDateRange(30)}
                  className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                >
                  Last 30 Days
                </button>
              </div>
            )}
          </div>
        </div>

        {/* AI Query Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Ask AI about your metrics</h2>
          </div>
          
          <form onSubmit={handleAIQuerySubmit} className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Ask anything about your metrics... e.g., 'Who made the most dials last week?' or 'Show me top performers this month'"
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={aiLoading}
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Ask AI
                  </>
                )}
              </button>
            </div>
          </form>

          {aiError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{aiError}</p>
            </div>
          )}

          {aiResponse && (
            <div className="mt-6 space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 space-y-4">
                    {/* Query Header */}
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                      <div className="text-sm font-medium text-blue-800 mb-1">
                        💬 Your Question
                      </div>
                      <div className="text-base text-slate-800 font-medium">
                        "{aiResponse.query}"
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="bg-white px-3 py-1 rounded-full border border-blue-100">
                        📅 {aiResponse.dateRange.start} to {aiResponse.dateRange.end}
                      </div>
                      <div className="bg-white px-3 py-1 rounded-full border border-blue-100">
                        🎯 {aiResponse.intent}
                      </div>
                    </div>

                    {/* AI Answer */}
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                      <div className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                        🤖 AI Analysis
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed space-y-2">
                        {typeof aiResponse.answer === 'string' 
                          ? aiResponse.answer.split('\n').map((line, lineIndex) => (
                              <div key={lineIndex}>
                                {line.split(/(\*\*.*?\*\*)/).map((part, partIndex) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return (
                                      <span key={partIndex} className="font-semibold text-slate-900 bg-yellow-100 px-1 rounded">
                                        {part.slice(2, -2)}
                                      </span>
                                    );
                                  }
                                  return <span key={partIndex}>{part}</span>;
                                })}
                              </div>
                            ))
                          : <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">
                              {JSON.stringify(aiResponse.answer, null, 2)}
                            </pre>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-4">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 hover:text-slate-700 transition-colors"
                    >
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Name
                      </span>
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? 
                          <ChevronUp className="w-3 h-3" /> : 
                          <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="text-right px-6 py-4">
                    <button
                      onClick={() => handleSort('meeting')}
                      className="flex items-center gap-2 ml-auto hover:text-slate-700 transition-colors"
                    >
                      <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider">
                        Meet
                      </span>
                      {sortColumn === 'meeting' && (
                        sortDirection === 'asc' ? 
                          <ChevronUp className="w-3 h-3" /> : 
                          <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getSortedData().map((row, index) => {
                  const hasActivity = row.values.Meeting > 0;

                  return (
                    <tr
                      key={row.userId}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            {hasActivity && index < 3 && (
                              <ChevronUp className="w-4 h-4 text-green-500" />
                            )}
                            {hasActivity && index >= 3 && index < 10 && (
                              <ChevronDown className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium text-slate-900">
                              {row.userName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-right">
                          {row.values.Meeting > 0 ? (
                            <button
                              onClick={() => handleMeetingClick(row)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              {row.values.Meeting}
                            </button>
                          ) : (
                            <span className="text-sm font-medium text-slate-400">
                              {row.values.Meeting}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500">
          Showing {getSortedData().length} users
        </div>
      </div>

      {/* Meeting Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                Meeting Details - {selectedUser.userName}
              </h2>
              <button
                onClick={closeDetailsModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <div className="text-sm text-slate-600 mb-2">
                  Total Meetings: <span className="font-semibold text-slate-900">{selectedUser.values.Meeting}</span>
                </div>
              </div>
              
              {selectedUser.details && selectedUser.details.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900 mb-3">Meeting History</h3>
                  {selectedUser.details.map((detail, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Source</div>
                          <div className="text-sm text-slate-900">{detail.source}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Date</div>
                          <div className="text-sm text-slate-900">{detail.date}</div>
                        </div>
                        {detail.leadName && (
                          <div>
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Lead Name</div>
                            <div className="text-sm text-slate-900">{detail.leadName}</div>
                          </div>
                        )}
                        {detail.company && (
                          <div>
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Company</div>
                            <div className="text-sm text-slate-900">{detail.company}</div>
                          </div>
                        )}
                        {detail.stage && (
                          <div className="col-span-2">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Stage</div>
                            <div className="text-sm text-slate-900">{detail.stage}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-slate-400 text-sm">No detailed meeting information available</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
