import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Excel processor for Google Sheet data
 * Processes the "SDR _ Meetings Booked (Responses).xlsx" file
 */

const EXCEL_FILE_PATH = path.join(process.cwd(), 'SDR _ Meetings Booked (Responses).xlsx');

/**
 * Parse the Excel file and extract relevant data
 * Expected columns: Name, Timestamp, Source of Lead
 */
export function processExcelFile() {
  try {
    // Check if file exists
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.warn('Excel file not found:', EXCEL_FILE_PATH);
      return [];
    }

    // Read the Excel file
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Loaded ${rawData.length} rows from Excel file`);
    console.log('Sample row:', rawData[0]);
    
    // Process and normalize the data
    const processedData = rawData.map(row => {
      // Try to find name column (case insensitive)
      const nameColumn = findColumn(row, ['name', 'Name', 'NAME', 'User', 'user', 'USER']);
      const timestampColumn = findColumn(row, ['timestamp', 'Timestamp', 'TIMESTAMP', 'Date', 'date', 'DATE', 'Created', 'created']);
      const sourceColumn = findColumn(row, ['source', 'Source', 'SOURCE', 'Source of Lead', 'source of lead', 'Lead Source', 'lead source']);
      
      return {
        name: nameColumn ? String(nameColumn).trim() : null,
        timestamp: timestampColumn ? parseTimestamp(timestampColumn) : null,
        sourceOfLead: sourceColumn ? String(sourceColumn).trim() : null,
        originalRow: row // Keep original for debugging
      };
    }).filter(row => row.name && row.timestamp); // Filter out rows without name or timestamp
    
    console.log(`Processed ${processedData.length} valid rows`);
    
    return processedData;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    return [];
  }
}

/**
 * Find a column value by trying multiple possible column names
 */
function findColumn(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  return null;
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  
  try {
    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a string, try to parse it
    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    // If it's a number (Excel date serial number)
    if (typeof timestamp === 'number') {
      // Excel date serial number to JavaScript Date
      const excelDate = new Date((timestamp - 25569) * 86400 * 1000);
      if (!isNaN(excelDate.getTime())) {
        return excelDate;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to parse timestamp:', timestamp, error);
    return null;
  }
}

/**
 * Filter Excel data by date range and name
 */
export function filterExcelData(excelData, startDate, endDate, userName = null) {
  return excelData.filter(row => {
    // Date filter
    if (row.timestamp) {
      const rowDate = new Date(row.timestamp);
      if (rowDate < startDate || rowDate > endDate) {
        return false;
      }
    }
    
    // Name filter (if provided)
    if (userName && row.name) {
      // Case insensitive partial match
      return row.name.toLowerCase().includes(userName.toLowerCase()) ||
             userName.toLowerCase().includes(row.name.toLowerCase());
    }
    
    return true;
  });
}

/**
 * Get meeting count from Excel data for a specific user and date range
 */
export function getMeetingCountFromExcel(excelData, userName, startDate, endDate) {
  const filtered = filterExcelData(excelData, startDate, endDate, userName);
  return filtered.length;
}

/**
 * Get detailed meeting data for a specific user and date range
 */
export function getMeetingDetailsFromExcel(excelData, userName, startDate, endDate) {
  const filtered = filterExcelData(excelData, startDate, endDate, userName);
  
  return filtered.map(row => ({
    timestamp: row.timestamp,
    sourceOfLead: row.sourceOfLead,
    name: row.name
  })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by timestamp desc
}

/**
 * Get all unique names from Excel data
 */
export function getUniqueNamesFromExcel(excelData) {
  const names = new Set();
  excelData.forEach(row => {
    if (row.name) {
      names.add(row.name.trim());
    }
  });
  return Array.from(names).sort();
}

/**
 * Debug function to inspect Excel file structure
 */
export function debugExcelFile() {
  try {
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.log('Excel file not found:', EXCEL_FILE_PATH);
      return;
    }

    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    console.log('Sheet names:', workbook.SheetNames);
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Total rows:', rawData.length);
    console.log('Column names:', Object.keys(rawData[0] || {}));
    console.log('First 3 rows:');
    rawData.slice(0, 3).forEach((row, index) => {
      console.log(`Row ${index + 1}:`, row);
    });
    
  } catch (error) {
    console.error('Error debugging Excel file:', error);
  }
}
