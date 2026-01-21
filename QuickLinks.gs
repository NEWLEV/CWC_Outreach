/**
 * QUICK LINKS MANAGER
 * Manages floating quick links menu from the "Links" sheet
 */

/**
 * Retrieves quick links from the Links sheet
 * Returns links filtered by user role
 */
function getQuickLinks() {
  try {
    const ss = getSafeSpreadsheet();
    const linksSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.LINKS);
    
    if (!linksSheet) {
      Logger.log('Links sheet not found');
      return [];
    }
    
    const data = linksSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return []; // No data or only headers
    }
    
    const headers = data[0];
    const links = [];
    
    // Expected columns: Link Label, Link URL, Link Icon, Link Order, Role, Active
    const labelCol = headers.indexOf('Link Label');
    const urlCol = headers.indexOf('Link URL');
    const iconCol = headers.indexOf('Link Icon');
    const orderCol = headers.indexOf('Link Order');
    const roleCol = headers.indexOf('Role');
    const activeCol = headers.indexOf('Active');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isActive = activeCol >= 0 ? (row[activeCol] === true || row[activeCol] === 'TRUE') : true;
      
      if (!isActive) continue; // Skip inactive links
      
      if (labelCol >= 0 && urlCol >= 0 && row[labelCol] && row[urlCol]) {
        links.push({
          label: row[labelCol],
          url: row[urlCol],
          icon: iconCol >= 0 ? (row[iconCol] || '🔗') : '🔗',
          order: orderCol >= 0 ? (parseInt(row[orderCol]) || 999) : 999,
          role: roleCol >= 0 ? (row[roleCol] || 'ALL') : 'ALL'
        });
      }
    }
    
    // Sort by order
    links.sort((a, b) => a.order - b.order);
    
    return links;
    
  } catch (error) {
    Logger.log('Error reading quick links: ' + error.toString());
    return [];
  }
}
