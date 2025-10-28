import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'SDR _ Meetings Booked (Responses).xlsx');

/**
 * Process Excel sheet data and extract meeting information
 * @param {Date} startDate - Filter meetings from this date
 * @param {Date} endDate - Filter meetings to this date
 * @returns {Object} Processed meeting data grouped by user name
 */
export function processExcelData(startDate = null, endDate = null) {
  try {
    // Check if file exists
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.warn('Excel file not found:', EXCEL_FILE_PATH);
      return {};
    }

    // Read the Excel file
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Processing ${data.length} rows from Excel sheet`);
    
    // Process and group data by user name
    const userMeetings = {};
    
    data.forEach((row, index) => {
      try {
        const userName = row['Name'];
        const sourceOfLead = row['Source of Lead'];
        const meetingDate = row['Meeting Booked (date of the cold call conversion)'];
        const leadName = row['Lead Name (individual you were speaking to)'];
        const company = row['Company Name'];
        const currentStage = row['Current Stage'];
        const timestamp = row['Timestamp'];
        
        // Skip rows without essential data
        if (!userName || !sourceOfLead) {
          console.log(`Skipping row ${index}: missing userName or sourceOfLead`);
          return;
        }
        
        // Parse meeting date - use timestamp if meeting date is not available
        let parsedMeetingDate = null;
        let dateToUse = meetingDate || timestamp;
        
        
        if (dateToUse) {
          // Handle Excel date formats
          if (typeof dateToUse === 'number') {
            // Excel serial date number
            parsedMeetingDate = new Date((dateToUse - 25569) * 86400 * 1000);
          } else {
            // String or Date object
            parsedMeetingDate = new Date(dateToUse);
          }
          
          // Check if date is valid
          if (isNaN(parsedMeetingDate.getTime())) {
            console.log(`Invalid date for ${userName}: ${dateToUse}`);
            parsedMeetingDate = null;
          } else {
            // Apply date filter if provided
            if (startDate && parsedMeetingDate < startDate) {
              console.log(`Filtering out ${userName}: date ${parsedMeetingDate.toISOString().split('T')[0]} is before ${startDate.toISOString().split('T')[0]}`);
              return;
            }
            if (endDate && parsedMeetingDate > endDate) {
              console.log(`Filtering out ${userName}: date ${parsedMeetingDate.toISOString().split('T')[0]} is after ${endDate.toISOString().split('T')[0]}`);
              return;
            }
          }
        }
        
        // Normalize user name (handle case variations and extra spaces)
        const normalizedUserName = userName.trim().toLowerCase();
        
        // Initialize user if not exists
        if (!userMeetings[normalizedUserName]) {
          userMeetings[normalizedUserName] = {
            originalName: userName.trim(),
            meetings: [],
            totalCount: 0
          };
        }
        
        // Add meeting details - only Source of Lead and timestamp
        const meetingDetail = {
          source: sourceOfLead,
          timestamp: timestamp ? new Date(timestamp).toISOString() : 'N/A',
          date: parsedMeetingDate ? parsedMeetingDate.toISOString().split('T')[0] : 'N/A'
        };
        
        userMeetings[normalizedUserName].meetings.push(meetingDetail);
        userMeetings[normalizedUserName].totalCount++;
        
        
      } catch (error) {
        console.error(`Error processing row ${index}:`, error);
      }
    });
    
    console.log(`Processed meetings for ${Object.keys(userMeetings).length} users:`);
    Object.keys(userMeetings).forEach(key => {
      console.log(`  ${userMeetings[key].originalName}: ${userMeetings[key].totalCount} meetings`);
    });
    return userMeetings;
    
  } catch (error) {
    console.error('Error processing Excel file:', error);
    return {};
  }
}

/**
 * Match Excel user names with Trellus API user names
 * @param {Array} trellasUsers - Users from Trellus API
 * @param {Object} excelMeetings - Processed Excel meeting data
 * @returns {Object} Mapping of Trellus user IDs to Excel meeting data
 */
export function matchUsersWithExcelData(trellasUsers, excelMeetings) {
  const userMapping = {};
  
  console.log('Excel users available:', Object.keys(excelMeetings));
  
  trellasUsers.forEach(user => {
    // Skip if user data is incomplete
    if (!user || !user.user_name || !user.user_id) {
      return;
    }
    
    const trellasName = user.user_name.toLowerCase().trim();
    
    // Try exact match first
    if (excelMeetings[trellasName]) {
      console.log(`Exact match found: ${user.user_name} -> ${excelMeetings[trellasName].originalName}`);
      userMapping[user.user_id] = excelMeetings[trellasName];
      return;
    }
    
    // Try fuzzy matching for name variations
    const possibleMatches = Object.keys(excelMeetings).filter(excelName => {
      // Split names and check for partial matches
      const trellasNameParts = trellasName.split(' ');
      const excelNameParts = excelName.split(' ');
      
      // Check if first and last names match
      if (trellasNameParts.length >= 2 && excelNameParts.length >= 2) {
        const trellasFirst = trellasNameParts[0];
        const trellasLast = trellasNameParts[trellasNameParts.length - 1];
        const excelFirst = excelNameParts[0];
        const excelLast = excelNameParts[excelNameParts.length - 1];
        
        return trellasFirst === excelFirst && trellasLast === excelLast;
      }
      
      // Check for substring matches
      return trellasName.includes(excelName) || excelName.includes(trellasName);
    });
    
    if (possibleMatches.length > 0) {
      // Use the first match found
      console.log(`Fuzzy match found: ${user.user_name} -> ${excelMeetings[possibleMatches[0]].originalName}`);
      userMapping[user.user_id] = excelMeetings[possibleMatches[0]];
    }
  });
  
  console.log(`Matched ${Object.keys(userMapping).length} users between Trellus and Excel data`);
  return userMapping;
}

/**
 * Get summary statistics for Excel data
 * @param {Object} excelMeetings - Processed Excel meeting data
 * @returns {Object} Summary statistics
 */
export function getExcelDataSummary(excelMeetings) {
  const totalUsers = Object.keys(excelMeetings).length;
  const totalMeetings = Object.values(excelMeetings).reduce((sum, user) => sum + user.totalCount, 0);
  
  const sourceBreakdown = {};
  Object.values(excelMeetings).forEach(user => {
    user.meetings.forEach(meeting => {
      sourceBreakdown[meeting.source] = (sourceBreakdown[meeting.source] || 0) + 1;
    });
  });
  
  return {
    totalUsers,
    totalMeetings,
    sourceBreakdown
  };
}
