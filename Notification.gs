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

// HELPER: Mask SSN
function maskSSN(ssn) {
  if (!ssn) return null;
  const ssnStr = String(ssn).replace(/\D/g, ''); // Remove non-digits
  if (ssnStr.length < 4) return ssn; // Return as is if too short
  return `***-**-${ssnStr.slice(-4)}`;
}

// HELPER: Format Date
function formatDateSafe(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "MM/dd/yyyy");
  } catch (e) {
    return dateStr;
  }
}

// CLEAN PROFESSIONAL EMAIL TEMPLATE
function createEnhancedEmailTemplate(title, patientData, changes, action, priority) {
  const priorityInfo = NotificationEngine.PRIORITY_LEVELS[priority];
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy 'at' h:mm a");
  const appUrl = ScriptApp.getService().getUrl();
  
  // Process Data Fields
  const dob = formatDateSafe(patientData.dob);
  const ssn = maskSSN(patientData.ssn);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .field-label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 2px 0; font-weight: 600; }
        .field-value { color: #1f2937; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; line-height: 1.4; }
        .section-title { color: #111827; font-size: 15px; font-weight: 700; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
        .note-box { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 10px 15px; border-radius: 4px; margin-bottom: 12px; }
        .note-text { color: #374151; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
        td { vertical-align: top; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: 'Inter', sans-serif;">
      
      <div style="max-width: 650px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: ${priorityInfo.color}; padding: 25px 30px;">
          <table width="100%">
            <tr>
              <td>
                <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                  ${priorityInfo.icon} ${title}
                </h1>
                <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 500;">${timestamp}</p>
              </td>
              <td align="right">
                <span style="background: rgba(255,255,255,0.2); color: white; padding: 6px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
                  ${priority} PRIORITY
                </span>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 30px;">

          <!-- 1. Patient Information -->
          <div style="margin-bottom: 30px;">
            <h3 class="section-title">👤 Patient Information</h3>
            <table width="100%">
              <tr>
                <td width="50%">
                  <div class="field-label">Patient Name</div>
                  <div class="field-value" style="font-size: 16px; color: #111827;">${patientData.patientName || 'N/A'}</div>
                </td>
                <td width="50%">
                  <div class="field-label">PRN</div>
                  <div class="field-value" style="font-size: 16px; color: #111827;">${patientData.prn || 'N/A'}</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- 2. Demographics -->
          ${(dob || patientData.sex || patientData.phoneNumber || ssn || patientData.address) ? `
          <div style="margin-bottom: 30px;">
            <h3 class="section-title">📋 Demographics</h3>
            <table width="100%">
              <tr>
                <td width="50%">
                  ${dob ? `<div class="field-label">Date of Birth</div><div class="field-value">${dob}</div>` : ''}
                  ${patientData.sex ? `<div class="field-label">Sex</div><div class="field-value">${patientData.sex}</div>` : ''}
                </td>
                <td width="50%">
                  ${ssn ? `<div class="field-label">Social Security</div><div class="field-value" style="font-family: monospace;">${ssn}</div>` : ''}
                  ${patientData.phoneNumber ? `<div class="field-label">Phone</div><div class="field-value">${patientData.phoneNumber}</div>` : ''}
                </td>
              </tr>
              ${patientData.address ? `
              <tr>
                <td colspan="2">
                  <div class="field-label">Address</div>
                  <div class="field-value">${patientData.address}</div>
                </td>
              </tr>` : ''}
            </table>
          </div>
          ` : ''}

          <!-- 3. Clinical Information -->
          <div style="margin-bottom: 30px;">
            <h3 class="section-title">💊 Clinical Information</h3>
            <table width="100%">
              <tr>
                <td width="50%">
                  ${patientData.medicationDetails ? `<div class="field-label">Medication</div><div class="field-value">${patientData.medicationDetails}</div>` : ''}
                  ${patientData.provider ? `<div class="field-label">Provider</div><div class="field-value">${patientData.provider}</div>` : ''}
                  ${patientData.reason ? `<div class="field-label">Reason</div><div class="field-value">${patientData.reason}</div>` : ''}
                </td>
                <td width="50%">
                  ${patientData.pharmacy ? `<div class="field-label">Pharmacy</div><div class="field-value">${patientData.pharmacy}</div>` : ''}
                  ${patientData.status ? `<div class="field-label">Status</div><div class="field-value">${patientData.status}</div>` : ''}
                  ${patientData.needsScript ? `<div class="field-label">Needs Script?</div><div class="field-value">${patientData.needsScript}</div>` : ''}
                </td>
              </tr>
            </table>
          </div>

          <!-- 4. Insurance Information -->
          ${(patientData.insuranceName || patientData.insuranceId || patientData.insuranceDetail || patientData.policyNumber) ? `
          <div style="margin-bottom: 30px;">
            <h3 class="section-title">🛡️ Insurance</h3>
            <table width="100%">
              <tr>
                <td width="50%">
                  ${patientData.insuranceName ? `<div class="field-label">Insurance Name</div><div class="field-value">${patientData.insuranceName}</div>` : ''}
                  ${patientData.insuranceDetail ? `<div class="field-label">Updated Insurance</div><div class="field-value">${patientData.insuranceDetail}</div>` : ''}
                </td>
                <td width="50%">
                  ${patientData.insuranceId ? `<div class="field-label">Insurance ID</div><div class="field-value">${patientData.insuranceId}</div>` : ''}
                  ${patientData.policyNumber ? `<div class="field-label">Policy #</div><div class="field-value">${patientData.policyNumber}</div>` : ''}
                </td>
              </tr>
            </table>
          </div>
          ` : ''}

          <!-- 5. Notes -->
          ${(patientData.outreachNote || patientData.officeNote || patientData.gardenNotes) ? `
          <div style="margin-bottom: 30px;">
            <h3 class="section-title">📝 Notes</h3>
            
            ${patientData.outreachNote ? `
            <div style="margin-bottom: 10px;">
              <div class="field-label">Outreach Note</div>
              <div class="note-box"><div class="note-text">${patientData.outreachNote}</div></div>
            </div>` : ''}

            ${patientData.officeNote ? `
            <div style="margin-bottom: 10px;">
              <div class="field-label">Office Note</div>
              <div class="note-box" style="border-left-color: #60a5fa;"><div class="note-text">${patientData.officeNote}</div></div>
            </div>` : ''}

            ${patientData.gardenNotes ? `
            <div style="margin-bottom: 10px;">
              <div class="field-label">Pharmacy Note</div>
              <div class="note-box" style="border-left-color: #34d399;"><div class="note-text">${patientData.gardenNotes}</div></div>
            </div>` : ''}
          </div>
          ` : ''}

          <!-- Footer Action -->
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
            <div style="margin-bottom: 15px; font-size: 13px; color: #4b5563;">
              <strong>Submitted By:</strong> ${patientData.creatorEmail || 'System'} &nbsp;|&nbsp; 
              <strong>Status:</strong> ${patientData.workflowStatus || action}
            </div>
            <a href="${appUrl}" style="display: inline-block; background: ${priorityInfo.color}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; transition: opacity 0.2s;">
              Open Dashboard
            </a>
          </div>

        </div>
        
        <div style="background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; font-size: 11px;">
          <p style="margin: 0;">CWC Notification System • Protected Health Information (PHI)</p>
          <p style="margin: 4px 0 0 0;">Do not forward this email to unauthorized personnel.</p>
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
    // REMOVED: This was causing the duplicate text-based webhook notification.
    // sendEnhancedWebhookNotification(title, patientData, priority); 
    
  } catch (e) {
    Logger.log('Notification Error: ' + e.message);
    sendErrorEmail('sendNotificationEmail', e);
  }
}

// ENHANCED WEBHOOK FOR GOOGLE CHAT
function sendEnhancedWebhookNotification(title, patientData, priority) {
  const webhookUrl = getNotificationWebhookUrl(); 
  if (!webhookUrl) return;
  
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
  
  sendChatWebhookNotification(msg);
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

    sendChatWebhookNotification(chatMsg); 
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
