/**
 * AI Prompts for the Dashboard application
 */

/**
 * Generates a prompt for extracting date ranges and intent from natural language queries
 * @param {string} query - The user's natural language query
 * @returns {string} The formatted prompt for OpenAI
 */
export function getDateExtractionPrompt(query) {
  return `
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
}

/**
 * Generates a prompt for analyzing sales metrics data and providing conversational answers
 * @param {string} query - The user's original query
 * @param {Object} dateInfo - Object containing startDate, endDate, and intent
 * @param {Object} metricsData - The metrics data to analyze
 * @returns {string} The formatted analysis prompt for OpenAI
 */
export function getAnalysisPrompt(query, dateInfo, metricsData) {
  return `
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
}
