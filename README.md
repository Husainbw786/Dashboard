# Metrics Dashboard with AI Query

A React-based metrics dashboard that displays sales performance data with AI-powered natural language querying capabilities.

## Features

- **Metrics Dashboard**: View sales metrics including Dials, Connects, Pitches, Conversations, and Meetings
- **Date Range Selection**: Filter data by custom date ranges or quick presets (Today, Last 7 Days, Last 30 Days)
- **Sortable Columns**: Sort by any metric column or user name
- **AI Query Interface**: Ask natural language questions about your metrics data using OpenAI GPT-4o

## AI Query Examples

- "Who made the most dials last week?"
- "Show me the top performers this month"
- "Tell me the person with the greatest dial in last 1 month"
- "Who has the highest conversion rate from dials to meetings?"
- "What's the average number of connections per person today?"

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. **Clone or download the project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your-actual-openai-api-key-here
   ```

4. **Start the application**
   ```bash
   npm start
   ```
   
   This will start both the backend server (port 3001) and frontend development server (port 5173).

### Manual Setup (Alternative)

If you prefer to run frontend and backend separately:

1. **Start the backend server**
   ```bash
   npm run backend
   ```

2. **Start the frontend development server** (in a new terminal)
   ```bash
   npm run dev
   ```

## API Endpoints

### Metrics Data
- `GET /api/metrics-data?days=1` - Get metrics for the last N days
- `GET /api/metrics-data?startDate=2025-01-01&endDate=2025-01-31` - Get metrics for date range

### AI Query
- `POST /api/ai-query` - Process natural language queries about metrics
  ```json
  {
    "query": "Who made the most dials last week?"
  }
  ```

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express
- **AI**: OpenAI GPT-4o
- **Icons**: Lucide React

## Project Structure

```
├── src/
│   ├── api/
│   │   └── metricsService.ts    # API service functions
│   ├── App.tsx                  # Main application component
│   └── main.tsx                 # Application entry point
├── backend/
│   ├── server.js                # Express server with AI endpoints
│   └── api-server.js           # Trellus API integration
└── package.json
```

## How It Works

1. **Data Fetching**: The application fetches metrics data from the Trellus API
2. **AI Processing**: When a user submits a query:
   - OpenAI extracts the date range and intent from the natural language query
   - The system fetches the relevant metrics data for that date range
   - OpenAI analyzes the data and provides a conversational answer
3. **Display**: Results are shown in an easy-to-read format with the original query, date range, and AI-generated insights

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required for AI query functionality)

## Notes

- The AI query feature requires a valid OpenAI API key
- The application connects to the Trellus API for metrics data
- All AI processing happens server-side for security
