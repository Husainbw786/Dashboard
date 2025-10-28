/**
 * Team data processor using JSON data
 * Processes team assignments and creates name-to-team mapping
 */

// Team assignments data
const TEAM_DATA = {
  "Vaibhav Shresth": "Botzilla",
  "Tanay Patekar": "Alphabot",
  "Shashank Giri": "Alphabot",
  "Tina Bidikikar": "Botzilla",
  "Deepika Saxena": "Botzilla",
  "Garima Bisht": "Botzilla",
  "Rahul Mathur": "Botzilla",
  "Suhani Jain": "Botzilla",
  "Himanshu Malviya": "Botzilla",
  "Shantanu Rajgire": "Alphabot",
  "Tushar Sandhu": "Alphabot",
  "Lovish Sahota": "Alphabot",
  "HARSH RAJ": "Botzilla",
  "Shivani V S": "Alphabot",
  "Shravani Neelam": "Botzilla",
  "uddeshya Saxena": "Alphabot",
  "Ankit Kumar Patel": "Botzilla",
  "Mohmmad Junaid": "Botzilla",
  "Nihal Rathod": "Alphabot",
  "Harsh Sharda": "Alphabot",
  "Nisha Singh": "Botzilla",
  "Aditi Soni": "Botzilla",
  "Yeshomini Raghuwanshi": "Botzilla",
  "Harshit Parwani": "Botzilla",
  "Rohit Tanwar": "Alphabot",
  "Pavitra Rai": "Botzilla",
  "Avani Lakhotia": "Alphabot",
  "Abhishek Joshi": "Botzilla",
  "Vishvajit Jadhav": "Botzilla",
  "krishnraj singh rathod": "Botzilla",
  "Aashima Soni": "Botzilla",
  "Sakshi Choudhary": "Alphabot",
  "Jasleen Kaur": "Botzilla",
  "Aastha Jain": "Botzilla",
  "Raghav Bhardwaj": "Botzilla",
  "zahid hasan": "Alphabot",
  "chandramani ": "Botzilla",
  "Harsh Joshi": "Botzilla",
  "Anjali Pandey": "Botzilla",
  "Sakshi Jaiswal": "Alphabot",
  "Sakshi Patidar": "Botzilla",
  "Saurabh Dabi": "Botzilla",
  "Anusha Khare": "Botzilla",
  "Naresh Lohani": "Botzilla",
  "Jison Nongmeikapam": "Botzilla",
  "Saloni K": "Botzilla",
  "Atharv Bhoot": "Alphabot",
  "Ishaan Garg": "Alphabot",
  "Karishma Sankhala": "Alphabot",
  "Riya Rastogi": "Alphabot",
  "Rohit Pagare": "Alphabot",
  "Nilesh Rathore": "Botzilla",
  "Muskaan Bhatia": "Alphabot",
  "Harsh Srivastava": "Botzilla",
  "Digvijay Suryawanshi": "Alphabot",
  "Shivam Bhatnagar": "Botzilla",
  "Suyog Shewale": "Alphabot",
  "Simran Subba Nembang": "Botzilla",
  "Bhakti Atul Landge": "Alphabot",
  "Anish Alam": "Alphabot",
  "Anika Garg": "Alphabot",
  "Eureka Baranwal": "Alphabot",
  "Siddhant Singh": "Botzilla",
  "Pallavi Bharti": "Alphabot",
  "Pranali Chaudhari": "Alphabot",
  "Shivam Kapil": "Botzilla",
  "Khushi Malviya": "Botzilla",
  "Adarsh Kaushal": "Botzilla"
};

/**
 * Process team data from JSON and create a name-to-team mapping
 */
export function processTeamData() {
  try {
    // Create name-to-team mapping from JSON data
    const nameToTeamMap = new Map();
    
    Object.entries(TEAM_DATA).forEach(([name, team]) => {
      nameToTeamMap.set(name.trim(), team);
    });
    
    console.log(`Created team mapping for ${nameToTeamMap.size} members from JSON data`);
    
    // Count team members
    const teamCounts = {};
    nameToTeamMap.forEach((team) => {
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    });
    
    console.log('Team distribution:');
    Object.entries(teamCounts).forEach(([team, count]) => {
      console.log(`  ${team}: ${count} members`);
    });
    
    return nameToTeamMap;
  } catch (error) {
    console.error('Error processing team data:', error);
    return new Map();
  }
}

/**
 * Get team name for a specific user
 */
export function getTeamForUser(nameToTeamMap, userName) {
  if (!userName) return 'Unknown';
  
  // Direct match
  if (nameToTeamMap.has(userName)) {
    return nameToTeamMap.get(userName);
  }
  
  // Try partial matching (case insensitive)
  const lowerUserName = userName.toLowerCase();
  for (const [name, team] of nameToTeamMap.entries()) {
    if (name.toLowerCase().includes(lowerUserName) || lowerUserName.includes(name.toLowerCase())) {
      return team;
    }
  }
  
  return 'Unknown';
}

/**
 * Debug function to inspect Team Data structure
 */
export function debugTeamDataFile() {
  try {
    console.log('Team Data JSON Structure:');
    console.log('Total members:', Object.keys(TEAM_DATA).length);
    
    // Count team members
    const teamCounts = {};
    Object.values(TEAM_DATA).forEach((team) => {
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    });
    
    console.log('Team distribution:');
    Object.entries(teamCounts).forEach(([team, count]) => {
      console.log(`  ${team}: ${count} members`);
    });
    
    console.log('First 5 team assignments:');
    Object.entries(TEAM_DATA).slice(0, 5).forEach(([name, team], index) => {
      console.log(`  ${index + 1}. ${name} -> ${team}`);
    });
    
  } catch (error) {
    console.error('Error debugging team data:', error);
  }
}
