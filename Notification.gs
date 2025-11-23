/**
 * AWARD-WINNING NOTIFICATION SYSTEM
 * Advanced Email & Alert Management with Smart Escalation
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

// HELPER: Create Info Card for Email
function createInfoCard(icon, label, value) {
  if (!value || value === '-- Select --' || value === '') return '';
  return `
    <div style="padding: 10px; background: white; border-radius: 6px;">
      <div style="display: flex; align-items: center;">
        <span style="font-size: 16px; margin-right: 8px;">${icon}</span>
        <div>
          <p style="margin: 0; color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${label}
          </p>
          <p style="margin: 2px 0 0 0; color: #374151; font-size: 13px; font-weight: 600;">
            ${value}
          </p>
        </div>
      </div>
    </div>
  `;
}

// BEAUTIFUL EMAIL TEMPLATE
function createEnhancedEmailTemplate(title, patientData, changes, action, priority) {
  const priorityInfo = NotificationEngine.PRIORITY_LEVELS[priority];
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM dd, yyyy 'at' h:mm a");
  const appUrl = ScriptApp.getService().getUrl();
  
  // Generate Changes Table
  const changesHTML = changes && changes.length > 0 ? changes.map(c => `
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 12px; color: #6b7280; font-size: 14px;">
        ${getFieldIcon(c.field)} ${c.field}
      </td>
      <td style="padding: 12px; color: #9ca3af; font-size: 14px; text-decoration: line-through;">
        ${c.oldValue || 'Empty'}
      </td>
      <td style="padding: 12px; color: #10b981; font-weight: 600; font-size: 14px;">
        ${c.newValue || 'Cleared'}
      </td>
    </tr>
  `).join('') : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      </style>
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
      
      <div style="padding: 40px 20px; min-height: 100vh;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
          
          <!-- Priority Banner -->
          <div style="background: ${priorityInfo.color}; color: white; padding: 15px 25px; text-align: center;">
            <span style="font-size: 24px; margin-right: 10px;">${priorityInfo.icon}</span>
            <span style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
              ${priority} PRIORITY
            </span>
          </div>
          
          <!-- Header -->
          <div style="padding: 35px 30px 25px; border-bottom: 2px solid #f3f4f6;">
            <h1 style="margin: 0 0 8px 0; color: #1f2937; font-size: 28px; font-weight: 800;">
              ${title}
            </h1>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              ${timestamp} • ${patientData.creatorEmail || 'System'}
            </p>
          </div>
          
          <!-- Patient Card -->
          <div style="padding: 25px 30px;">
            <div style="background: linear-gradient(135deg, #f6f8fb 0%, #f0f4f8 100%); border-radius: 12px; padding: 20px;">
              
              <!-- Patient Header -->
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                  <span style="color: white; font-size: 20px; font-weight: bold;">
                    ${patientData.patientName ? patientData.patientName.charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
                <div>
                  <h2 style="margin: 0; color: #1f2937; font-size: 20px; font-weight: 700;">
                    ${patientData.patientName || 'Unknown Patient'}
                  </h2>
                  <p style="margin: 3px 0 0 0; color: #6b7280; font-size: 14px;">
                    PRN: <strong>${patientData.prn || 'Not Set'}</strong>
                    ${patientData.phoneNumber ? ` • 📞 ${patientData.phoneNumber}` : ''}
                  </p>
                </div>
              </div>
              
              <!-- Info Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px;">
                ${createInfoCard('📋', 'Reason', patientData.reason)}
                ${createInfoCard('💊', 'Pharmacy', patientData.pharmacy)}
                ${createInfoCard('🩺', 'Provider', patientData.provider)}
                ${createInfoCard('🧪', 'Medication', patientData.medicationDetails)}
              </div>
              
              <!-- Notes -->
              ${patientData.outreachNote || patientData.gardenNotes ? `
                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px;">
                  <h3 style="margin: 0 0 10px 0; color: #4b5563; font-size: 14px; font-weight: 600; text-transform: uppercase;">
                    📝 Notes
                  </h3>
                  <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    ${patientData.outreachNote || patientData.gardenNotes || 'No notes available'}
                  </p>
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Changes Table -->
          ${changesHTML ? `
            <div style="padding: 0 30px 25px;">
              <h3 style="color: #374151; font-size: 16px; font-weight: 700; margin-bottom: 15px;">
                📊 Changes Made
              </h3>
              <div style="background: #fafafa; border-radius: 10px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse;">
                  ${changesHTML}
                </table>
              </div>
            </div>
          ` : ''}
          
          <!-- Action Button -->
          <div style="padding: 0 30px 30px; text-align: center;">
            <a href="${appUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
              Open Dashboard →
            </a>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">
              CWC Notification System • Continental Wellness Center
            </p>
            <p style="margin: 0; color: #9ca3af; font-size: 11px;">
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
      subject: `${NotificationEngine.PRIORITY_LEVELS[priority].icon} [${priority}] ${title}: ${patientData.patientName}`,
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
  
  // Rich message format
  let msg = `${priorityInfo.icon} ${isUrgent ? '🔥 ' : ''}*${title}*\n`;
  msg += `👤 *${patientData.patientName}* (PRN: ${patientData.prn})\n`;
  msg += `📧 By: ${patientData.creatorEmail || 'Unknown'}\n`;
  msg += `⚡ Priority: *${priority}*\n`;
  msg += `────────────────\n`;
  
  if (title === "Pharmacy Update") {
    msg += `💊 *Pharmacy Update Details:*\n`;
    msg += `• Status: ${patientData.status || 'N/A'}\n`;
    msg += `• Needs Script: ${patientData.needsScript || 'N/A'}\n`;
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
        subject: `${NotificationEngine.PRIORITY_LEVELS[priority].icon} New Entry: ${patient.patientName}`,
        htmlBody: htmlBody,
        name: 'CWC Notification System'
      });
    }

    const isUrgent = (patient.priority || '').toString().toLowerCase() === 'urgent';
    let chatMsg = `📝 ${isUrgent ? '🔥 ' : ''}*New Entry Received*\n`;
    chatMsg += `👤 *${patient.patientName}* (PRN: ${patient.prn})\n`;
    chatMsg += `📧 By: ${patient.creatorEmail}\n`;
    chatMsg += `• Reason: ${patient.reason}\n`;
    chatMsg += `• Priority: ${patient.priority}\n`;

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
