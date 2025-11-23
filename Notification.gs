/**
 * AWARD-WINNING NOTIFICATION SYSTEM
 * Clean, Professional Email Templates
 */

// SMART NOTIFICATION ENGINE
const NotificationEngine = {
  PRIORITY_LEVELS: {
    CRITICAL: { 
      icon: '🚨', 
      color: '#dc2626', 
      escalateAfter: 15,
      soundProfile: 'urgent',
      requiresAck: true 
    },
    HIGH: { 
      icon: '🔴', 
      color: '#ef4444', 
      escalateAfter: 30,
      soundProfile: 'alert' 
    },
    MEDIUM: { 
      icon: '🟡', 
      color: '#f59e0b', 
      escalateAfter: 60,
      soundProfile: 'notice' 
    },
    LOW: { 
      icon: '🟢', 
      color: '#10b981', 
      escalateAfter: null,
      soundProfile: 'chime' 
    }
  },

  calculatePriority(patientData, action) {
    if (patientData.priority === 'Urgent') return 'CRITICAL';
    
    const keywords = ['emergency', 'critical', 'urgent', 'immediate', 'stat', 'asap'];
    const allNotes = [
      patientData.reason || '',
      patientData.outreachNote || '',
      patientData.gardenNotes || '',
      patientData.officeNote || ''
    ].join(' ').toLowerCase();
    
    const hasUrgentKeyword = keywords.some(k => allNotes.includes(k));
    
    if (hasUrgentKeyword) return 'HIGH';
    if (action === 'Submit to Pharmacy') return 'MEDIUM';
    return 'LOW';
  },

  trackNotification(notificationId, priority, recipients) {
    const cache = CacheService.getScriptCache();
    const data = {
      id: notificationId,
      priority: priority,
      sent: new Date().toISOString(),
      recipients: recipients,
      acknowledged: false
    };
    cache.put(`NOTIF_${notificationId}`, JSON.stringify(data), 3600);
  }
};

// HELPER: Field Icons
function getFieldIcon(field) {
  const iconMap = {
    'Patient Name': '👤', 'PRN': '🆔', 'Phone': '📞', 'Medication': '💊',
    'Provider': '🩺', 'Pharmacy': '🏥', 'Insurance': '🛡️', 'Status': '📊',
    'Priority': '🚨', 'Address': '🏠', 'DOB': '📅', 'Sex': '⚧'
  };
  return iconMap[field] || '📌';
}

// CLEAN PROFESSIONAL EMAIL TEMPLATE
function createEnhancedEmailTemplate(title, patientData, changes, action, priority) {
  const priorityInfo = NotificationEngine.PRIORITY_LEVELS[priority];
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy 'at' h:mm a");
  const appUrl = ScriptApp.getService().getUrl();
  
  // Format DOB if exists
  let formattedDOB = patientData.dob || '';
  if (formattedDOB) {
    try {
      const dobDate = new Date(formattedDOB);
      formattedDOB = Utilities.formatDate(dobDate, Session.getScriptTimeZone(), "MM/dd/yyyy");
    } catch(e) {
      // Keep original if parsing fails
    }
  }
  
  // Build sections based on available data
  const hasPatientInfo = patientData.patientName && patientData.patientName !== '';
  const hasPRN = patientData.prn && patientData.prn !== '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      </style>
    </head>
    <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
      
      <!-- Wrapper -->
      <div style="padding: 20px; background: #f5f5f5;">
        
        <!-- Main Container -->
        <div style="max-width: 650px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
          
          <!-- Header with Priority -->
          <div style="background: ${priorityInfo.color}; padding: 20px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">
                    ${priorityInfo.icon} ${title}
                  </h1>
                  <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                    ${timestamp}
                  </p>
                </td>
                <td align="right">
                  <span style="background: rgba(255,255,255,0.2); color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                    ${priority} PRIORITY
                  </span>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Body Content -->
          <div style="padding: 30px;">
            
            <!-- Patient Header Section -->
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <h2 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px; font-weight: 700;">
                Patient Information
              </h2>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%">
                    <p style="margin: 0 0 8px 0;">
                      <span style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Patient Name</span><br>
                      <strong style="color: #1a1a1a; font-size: 16px;">${hasPatientInfo ? patientData.patientName : 'Not Provided'}</strong>
                    </p>
                  </td>
                  <td width="50%">
                    <p style="margin: 0 0 8px 0;">
                      <span style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">PRN</span><br>
                      <strong style="color: #1a1a1a; font-size: 16px;">${hasPRN ? patientData.prn : 'Not Provided'}</strong>
                    </p>
                  </td>
                </tr>
                ${patientData.priority ? `
                <tr>
                  <td colspan="2" style="padding-top: 10px;">
                    <p style="margin: 0;">
                      <span style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Priority Status</span><br>
                      <strong style="color: ${patientData.priority === 'Urgent' ? '#dc2626' : '#1a1a1a'}; font-size: 14px;">
                        ${patientData.priority === 'Urgent' ? '🔥 URGENT' : '📋 Standard'}
                      </strong>
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Demographics Section -->
            ${(formattedDOB || patientData.sex || patientData.phoneNumber || patientData.address) ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1a1a1a; font-size: 14px; font-weight: 700; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0;">
                📋 Demographics
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${formattedDOB || patientData.sex ? `
                <tr>
                  ${formattedDOB ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Date of Birth</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${formattedDOB}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                  ${patientData.sex ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Sex</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.sex}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                </tr>
                ` : ''}
                ${patientData.phoneNumber || patientData.ssn ? `
                <tr>
                  ${patientData.phoneNumber ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Phone Number</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.phoneNumber}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                  ${patientData.ssn ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Social Security</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.ssn}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                </tr>
                ` : ''}
                ${patientData.address ? `
                <tr>
                  <td colspan="2" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Address</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.address}</strong>
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>
            ` : ''}
            
            <!-- Clinical Information Section -->
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1a1a1a; font-size: 14px; font-weight: 700; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0;">
                💊 Clinical Information
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${patientData.reason ? `
                <tr>
                  <td colspan="2" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Reason for Outreach</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.reason}</strong>
                  </td>
                </tr>
                ` : ''}
                ${patientData.medicationDetails || patientData.status ? `
                <tr>
                  ${patientData.medicationDetails ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Medication</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.medicationDetails}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                  ${patientData.status ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Prescription Status</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.status}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                </tr>
                ` : ''}
                ${patientData.provider || patientData.pharmacy ? `
                <tr>
                  ${patientData.provider ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Provider</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.provider}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                  ${patientData.pharmacy ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Pharmacy</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.pharmacy}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                </tr>
                ` : ''}
                ${patientData.needsScript ? `
                <tr>
                  <td colspan="2" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Needs Script</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.needsScript}</strong>
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Insurance Information Section -->
            ${(patientData.insuranceName || patientData.insuranceId || patientData.insuranceDetail || patientData.policyNumber) ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1a1a1a; font-size: 14px; font-weight: 700; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0;">
                🛡️ Insurance Information
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${patientData.insuranceName || patientData.insuranceId ? `
                <tr>
                  ${patientData.insuranceName ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Insurance</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.insuranceName}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                  ${patientData.insuranceId ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Insurance ID</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.insuranceId}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                </tr>
                ` : ''}
                ${patientData.insuranceDetail || patientData.policyNumber ? `
                <tr>
                  ${patientData.insuranceDetail ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Updated Insurance</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.insuranceDetail}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                  ${patientData.policyNumber ? `
                  <td width="50%" style="padding-bottom: 12px;">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Policy Number</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.policyNumber}</strong>
                  </td>
                  ` : '<td width="50%"></td>'}
                </tr>
                ` : ''}
              </table>
            </div>
            ` : ''}
            
            <!-- Notes Section -->
            ${(patientData.outreachNote || patientData.officeNote || patientData.gardenNotes) ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1a1a1a; font-size: 14px; font-weight: 700; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0;">
                📝 Notes
              </h3>
              ${patientData.outreachNote ? `
              <div style="margin-bottom: 12px;">
                <span style="color: #666; font-size: 11px; text-transform: uppercase;">Outreach Note</span><br>
                <div style="color: #1a1a1a; font-size: 14px; line-height: 1.5; margin-top: 4px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                  ${patientData.outreachNote}
                </div>
              </div>
              ` : ''}
              ${patientData.officeNote ? `
              <div style="margin-bottom: 12px;">
                <span style="color: #666; font-size: 11px; text-transform: uppercase;">Office Notes</span><br>
                <div style="color: #1a1a1a; font-size: 14px; line-height: 1.5; margin-top: 4px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                  ${patientData.officeNote}
                </div>
              </div>
              ` : ''}
              ${patientData.gardenNotes ? `
              <div style="margin-bottom: 12px;">
                <span style="color: #666; font-size: 11px; text-transform: uppercase;">Pharmacy Notes</span><br>
                <div style="color: #1a1a1a; font-size: 14px; line-height: 1.5; margin-top: 4px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                  ${patientData.gardenNotes}
                </div>
              </div>
              ` : ''}
            </div>
            ` : ''}
            
            <!-- Action Information -->
            <div style="background: #f0f7ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Submitted By</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.creatorEmail || 'System'}</strong>
                  </td>
                  <td align="right">
                    <span style="color: #666; font-size: 11px; text-transform: uppercase;">Workflow Status</span><br>
                    <strong style="color: #1a1a1a; font-size: 14px;">${patientData.workflowStatus || action}</strong>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0 20px 0;">
              <a href="${appUrl}" style="display: inline-block; padding: 14px 32px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Open Dashboard →
              </a>
            </div>
            
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">
              CWC Notification System • Continental Wellness Center
            </p>
            <p style="margin: 0; color: #999; font-size: 11px;">
              This is an automated notification. Do not reply to this email.
            </p>
          </div>
          
        </div>
      </div>
    </body>
    </html>
  `;
}

// MAIN NOTIFICATION FUNCTION
function sendNotificationEmail(recipients, patientData, title, changes) {
  const cleanRecipients = [...new Set(recipients)].filter(isValidEmail);
  if (cleanRecipients.length === 0) return;
  
  const priority = NotificationEngine.calculatePriority(patientData, title);
  const notificationId = Utilities.getUuid();
  const htmlBody = createEnhancedEmailTemplate(title, patientData, changes, title, priority);
  
  try {
    MailApp.sendEmail({
      to: cleanRecipients.join(','),
      subject: `${NotificationEngine.PRIORITY_LEVELS[priority].icon} ${title}: ${patientData.patientName || 'Patient Record'}`,
      htmlBody: htmlBody,
      name: 'CWC Notification System'
    });
    
    NotificationEngine.trackNotification(notificationId, priority, cleanRecipients);
    sendEnhancedWebhookNotification(title, patientData, priority);
    
  } catch (e) {
    Logger.log('Notification Error: ' + e.message);
    sendErrorEmail('sendNotificationEmail', e);
  }
}

// ENHANCED WEBHOOK FOR GOOGLE CHAT
function sendEnhancedWebhookNotification(title, patientData, priority) {
  if (!CONFIG.CHAT_WEBHOOK_URL) return;
  
  const priorityInfo = NotificationEngine.PRIORITY_LEVELS[priority];
  const isUrgent = priority === 'CRITICAL' || priority === 'HIGH';
  
  let msg = `${priorityInfo.icon} ${isUrgent ? '🔥 ' : ''}*${title}*\n`;
  msg += `👤 *${patientData.patientName || 'Patient'}* (PRN: ${patientData.prn || 'N/A'})\n`;
  msg += `📧 By: ${patientData.creatorEmail || 'Unknown'}\n`;
  msg += `⚡ Priority: *${priority}*\n`;
  msg += `────────────────\n`;
  
  if (title === "Pharmacy Update") {
    msg += `💊 *Pharmacy Update Details:*\n`;
    if (patientData.status) msg += `• Status: ${patientData.status}\n`;
    if (patientData.needsScript) msg += `• Needs Script: ${patientData.needsScript}\n`;
    if (patientData.insuranceDetail) msg += `• Updated Ins: ${patientData.insuranceDetail}\n`;
    if (patientData.gardenNotes) msg += `• Note: ${patientData.gardenNotes}\n`;
  } else {
    msg += `📋 *Clinical Details:*\n`;
    if (patientData.reason) msg += `• Reason: ${patientData.reason}\n`;
    if (patientData.medicationDetails) msg += `• Meds: ${patientData.medicationDetails}\n`;
    if (patientData.pharmacy) msg += `• Pharmacy: ${patientData.pharmacy}\n`;
    if (patientData.outreachNote) msg += `• Note: ${patientData.outreachNote}\n`;
  }
  
  sendWebhookNotification(msg);
}

function sendWebhookNotification(text) {
  if (!CONFIG.CHAT_WEBHOOK_URL || !text) return;
  
  try {
    const payload = { text: text };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    UrlFetchApp.fetch(CONFIG.CHAT_WEBHOOK_URL, options);
    Logger.log("Webhook notification sent");
  } catch (e) {
    Logger.log("Webhook Failed: " + e.message);
  }
}

// NEW ENTRY ALERT
function sendCWCNewEntryAlert(range, headers, headerMap) {
  try {
    const data = [headers, ...range.getDisplayValues()];
    const patient = getUnifiedPatientData(data, headerMap, false)[0]; 
    const recipients = getRecipients().cwc;
    
    if(recipients && recipients.length > 0) {
      const priority = NotificationEngine.calculatePriority(patient, 'New Entry');
      const htmlBody = createEnhancedEmailTemplate('New Entry Received', patient, [], 'New Entry', priority);
      
      MailApp.sendEmail({
        to: recipients.join(','),
        subject: `${NotificationEngine.PRIORITY_LEVELS[priority].icon} New Entry: ${patient.patientName || 'Patient Record'}`,
        htmlBody: htmlBody,
        name: 'CWC Notification System'
      });
    }

    const isUrgent = (patient.priority || '').toString().toLowerCase() === 'urgent';
    let chatMsg = `📝 ${isUrgent ? '🔥 ' : ''}*New Entry Received*\n`;
    chatMsg += `👤 *${patient.patientName || 'Patient'}* (PRN: ${patient.prn || 'N/A'})\n`;
    chatMsg += `📧 By: ${patient.creatorEmail || 'Unknown'}\n`;
    if (patient.reason) chatMsg += `• Reason: ${patient.reason}\n`;
    if (patient.priority) chatMsg += `• Priority: ${patient.priority}\n`;

    sendWebhookNotification(chatMsg);
  } catch(e) {
    Logger.log("New Entry Alert Error: " + e.message);
  }
}

function formatChangesHTML(changes) {
  if(!changes || !changes.length) return 'No specific fields logged.';
  let rows = changes.map(c => 
    `<tr><td>${c.field}</td><td>${c.oldValue}</td><td>${c.newValue}</td></tr>`
  ).join('');
  return `<table border="1" style="border-collapse:collapse; width:100%;">
    <thead><tr><th>Field</th><th>Old</th><th>New</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}
