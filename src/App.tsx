import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, RefreshCw, Calendar, MessageSquare, Loader2, Search, BarChart3, Users, Clock, TrendingUp, Filter, X } from 'lucide-react';

interface MeetingTimestamp {
  timestamp: string;
  leadName: string;
  companyName: string;
  currentStage: string;
  meetingBookedDate: string;
  sourceOfLead: string;
  source: 'trellus' | 'google_sheet';
}

interface MeetingCounts {
  trellus: number;
  googleSheet: number;
  total: number;
}

interface MetricRow {
  userId: string;
  userName: string;
  team: string;
  values: {
    Dial: number;
    Connect: number;
    Pitch: number;
    Conversation: number;
    Meeting: number;
  };
  meetingTimestamps?: MeetingTimestamp[];
  meetingCounts?: MeetingCounts;
}

interface MetricsData {
  rows: MetricRow[];
  dateRange: {
    start: string;
    end: string;
  };
}

type SortColumn = 'name' | 'team' | 'dial' | 'connect' | 'pitch' | 'conversation' | 'meeting';
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
  const [showMeetingModal, setShowMeetingModal] = useState(false);

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
        case 'team':
          aValue = a.team.toLowerCase();
          bValue = b.team.toLowerCase();
          break;
        case 'dial':
          aValue = a.values.Dial;
          bValue = b.values.Dial;
          break;
        case 'connect':
          aValue = a.values.Connect;
          bValue = b.values.Connect;
          break;
        case 'pitch':
          aValue = a.values.Pitch;
          bValue = b.values.Pitch;
          break;
        case 'conversation':
          aValue = a.values.Conversation;
          bValue = b.values.Conversation;
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

  const handleMeetingClick = (row: MetricRow) => {
    if (row.values.Meeting > 0) {
      setSelectedUser(row);
      setShowMeetingModal(true);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const [datePart] = timestamp.split(' ');
      const [month, day, year] = datePart.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return timestamp;
    }
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Metrics</h1>
              <p className="text-xs text-gray-500">Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-6">
          {/* Quick Stats */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Overview</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Total Users</p>
                    <p className="text-xs text-blue-600">{data ? data.rows.length : 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900">Total Meetings</p>
                    <p className="text-xs text-green-600">{data ? data.rows.reduce((sum, row) => sum + row.values.Meeting, 0) : 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Quick Actions</h3>
            <div className="space-y-1">
              <button
                onClick={() => handleQuickDateRange(1)}
                className="w-full flex items-center gap-3 p-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Clock className="w-4 h-4" />
                Today
              </button>
              <button
                onClick={() => handleQuickDateRange(7)}
                className="w-full flex items-center gap-3 p-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Last 7 Days
              </button>
              <button
                onClick={() => handleQuickDateRange(30)}
                className="w-full flex items-center gap-3 p-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Last 30 Days
              </button>
              <button
                onClick={() => setUseCustomDates(!useCustomDates)}
                className="w-full flex items-center gap-3 p-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Filter className="w-4 h-4" />
                Custom Range
              </button>
            </div>
          </div>

          {/* Team Filters */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Teams</h3>
            <div className="space-y-1">
              {data && [...new Set(data.rows.map(row => row.team))].map(team => {
                const getTeamColor = (teamName: string) => {
                  switch (teamName) {
                    case 'Botzilla': return 'bg-purple-100 text-purple-700';
                    case 'Alphabots': return 'bg-blue-100 text-blue-700';
                    case 'Cloudtech': return 'bg-green-100 text-green-700';
                    case 'KnowcloudAI': return 'bg-orange-100 text-orange-700';
                    case 'Hyperflex': return 'bg-pink-100 text-pink-700';
                    default: return 'bg-gray-100 text-gray-700';
                  }
                };
                return (
                  <div key={team} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${getTeamColor(team).split(' ')[0]}`}></div>
                    <span className="text-sm text-gray-700">{team}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {data.rows.filter(row => row.team === team).length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => fetchMetrics()}
            className="w-full flex items-center justify-center gap-2 p-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAIQuery()}
                  placeholder="Ask AI about your metrics..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={aiLoading}
                />
              </div>
              <button
                onClick={handleAIQuery}
                disabled={aiLoading || !aiQuery.trim()}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                {aiLoading ? 'Processing...' : 'Ask AI'}
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Hi, User</p>
                <p className="text-xs text-gray-500">
                  {data ? `${data.dateRange.start} to ${data.dateRange.end}` : 'Loading...'}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          {/* Main Content */}
          <div className="flex-1 p-6">
            {/* Custom Date Range Section */}
            {useCustomDates && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useCustomDates}
                      onChange={(e) => setUseCustomDates(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Custom Date Range</span>
                  </label>
                </div>
                
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="mt-5">
                    <button
                      onClick={handleDateRangeSubmit}
                      disabled={!startDate || !endDate}
                      className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Apply Range
                    </button>
                  </div>
                </div>
              </div>
            )}

            {aiError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{aiError}</p>
              </div>
            )}

            {/* Metrics Table - Dropbox Style */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Team Performance</h2>
                  <div className="flex items-center gap-2">
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <Filter className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* File List Style Table */}
              <div className="divide-y divide-gray-100">
                {/* Table Header Row */}
                <div className="flex items-center px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                  <div className="flex-1">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 hover:text-gray-700 transition-colors"
                    >
                      Name
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? 
                          <ChevronUp className="w-3 h-3" /> : 
                          <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <div className="w-24 text-center">
                    <button onClick={() => handleSort('dial')} className="hover:text-gray-700">
                      Dials
                    </button>
                  </div>
                  <div className="w-24 text-center">
                    <button onClick={() => handleSort('connect')} className="hover:text-gray-700">
                      Connects
                    </button>
                  </div>
                  <div className="w-24 text-center">
                    <button onClick={() => handleSort('meeting')} className="hover:text-gray-700">
                      Meetings
                    </button>
                  </div>
                  <div className="w-32 text-center">Team</div>
                </div>
                {/* Table Rows */}
                {getSortedData().map((row, index) => {
                  const hasActivity = row.values.Dial > 0;
                  const getTeamBadgeStyle = (team: string) => {
                    switch (team) {
                      case 'Botzilla': return 'bg-purple-100 text-purple-800 border-purple-200';
                      case 'Alphabots': return 'bg-blue-100 text-blue-800 border-blue-200';
                      case 'Cloudtech': return 'bg-green-100 text-green-800 border-green-200';
                      case 'KnowcloudAI': return 'bg-orange-100 text-orange-800 border-orange-200';
                      case 'Hyperflex': return 'bg-pink-100 text-pink-800 border-pink-200';
                      default: return 'bg-gray-100 text-gray-600 border-gray-200';
                    }
                  };

                  return (
                    <div
                      key={row.userId}
                      className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      {/* User Info */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">
                          {row.userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasActivity && index < 3 && (
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          )}
                          {hasActivity && index >= 3 && index < 10 && (
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{row.userName}</p>
                            <p className="text-xs text-gray-500">#{index + 1} performer</p>
                          </div>
                        </div>
                      </div>
                      {/* Metrics */}
                      <div className="w-24 text-center">
                        <span className={`text-sm font-medium ${hasActivity ? 'text-gray-900' : 'text-gray-400'}`}>
                          {row.values.Dial}
                        </span>
                      </div>
                      <div className="w-24 text-center">
                        <span className={`text-sm font-medium ${hasActivity ? 'text-gray-900' : 'text-gray-400'}`}>
                          {row.values.Connect}
                        </span>
                      </div>
                      <div className="w-24 text-center">
                        {row.values.Meeting > 0 ? (
                          <button
                            onClick={() => handleMeetingClick(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors"
                            title={`Click to view ${row.values.Meeting} meeting details`}
                          >
                            {row.values.Meeting}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-gray-400">
                            {row.values.Meeting}
                          </span>
                        )}
                      </div>
                      <div className="w-32 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTeamBadgeStyle(row.team)}`}>
                          {row.team}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Showing {getSortedData().length} users • Updated {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          {/* Right Activity Panel */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Activity</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {aiResponse && (
                <div className="p-4 space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-medium text-blue-800 mb-1">💬 Your Question</p>
                          <p className="text-sm text-gray-800 font-medium">"{aiResponse.query}"</p>
                        </div>
                        
                        <div className="flex gap-2 text-xs">
                          <span className="bg-white px-2 py-1 rounded-full border border-blue-100">
                            📅 {aiResponse.dateRange.start} to {aiResponse.dateRange.end}
                          </span>
                        </div>
                        
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-medium text-blue-800 mb-2">🤖 AI Analysis</p>
                          <div className="text-sm text-gray-700 leading-relaxed space-y-1">
                            {typeof aiResponse.answer === 'string' 
                              ? aiResponse.answer.split('\n').map((line, lineIndex) => (
                                  <div key={lineIndex}>
                                    {line.split(/(\*\*.*?\*\*)/).map((part, partIndex) => {
                                      if (part.startsWith('**') && part.endsWith('**')) {
                                        return (
                                          <span key={partIndex} className="font-semibold text-gray-900 bg-yellow-100 px-1 rounded">
                                            {part.slice(2, -2)}
                                          </span>
                                        );
                                      }
                                      return <span key={partIndex}>{part}</span>;
                                    })}
                                  </div>
                                ))
                              : <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
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
              
              {!aiResponse && (
                <div className="p-4 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Ask AI a question to see analysis here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Details Modal */}
      {showMeetingModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Meeting Details - {selectedUser.userName}
                  </h3>
                  <div className="text-sm text-gray-600 mt-1 space-y-1">
                    <p>{selectedUser.values.Meeting} meeting{selectedUser.values.Meeting !== 1 ? 's' : ''} found</p>
                    {selectedUser.meetingCounts && (
                      <div className="flex gap-4 text-xs">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full border border-blue-200">
                          Trellus: {selectedUser.meetingCounts.trellus}
                        </span>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200">
                          Manual Entry: {selectedUser.meetingCounts.googleSheet}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowMeetingModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedUser.meetingTimestamps && selectedUser.meetingTimestamps.length > 0 ? (
                <div className="space-y-4">
                  {selectedUser.meetingTimestamps.map((meeting, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Meeting Date</div>
                          <div className="text-sm text-gray-900 font-semibold">
                            {formatTimestamp(meeting.timestamp)}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Current Stage</div>
                          <div className="text-sm text-gray-900">
                            {meeting.currentStage || 'N/A'}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Lead Contact</div>
                          <div className="text-sm text-gray-900">
                            {meeting.leadName || 'N/A'}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Company</div>
                          <div className="text-sm text-gray-900">
                            {meeting.companyName || 'N/A'}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Source of Lead</div>
                          <div className="text-sm text-gray-900">
                            {meeting.sourceOfLead || 'N/A'}
                          </div>
                        </div>
                        
                        {meeting.meetingBookedDate && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Meeting Booked Date</div>
                            <div className="text-sm text-gray-900">
                              {meeting.meetingBookedDate}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 text-sm">
                    No meeting details available for this user.
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowMeetingModal(false)}
                className="w-full px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
