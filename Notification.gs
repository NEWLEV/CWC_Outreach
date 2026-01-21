/**
 * AWARD-WINNING NOTIFICATION SYSTEM
 * Features: Emojis, Clean Layout, Internal Chat Logging
 */

var NotificationEngine = {
  PRIORITY_LEVELS: {
    CRITICAL: { icon: '🚨', color: '#dc2626', soundProfile: 'urgent' },
    HIGH: { icon: '🔴', color: '#ef4444', soundProfile: 'alert' },
    MEDIUM: { icon: '🟡', color: '#f59e0b', soundProfile: 'notice' },
    LOW: { icon: '🟢', color: '#10b981', soundProfile: 'chime' }
  },

  calculatePriority(patientData, action) {
    if ((patientData.priority || '').toString().toLowerCase() === 'urgent') return 'CRITICAL';
    const keywords = ['emergency', 'critical', 'urgent', 'stat', 'asap'];
    const allNotes = [patientData.reason||'', patientData.outreachNote||'', patientData.gardenNotes||'', patientData.officeNote||''].join(' ').toLowerCase();
    if (keywords.some(k => allNotes.includes(k))) return 'HIGH';
    if (action === 'Submit to Pharmacy') return 'MEDIUM';
    return 'LOW';
  },

  trackNotification(notificationId, priority, recipients) {
    const cache = CacheService.getScriptCache();
    cache.put(`NOTIF_${notificationId}`, JSON.stringify({id: notificationId, sent: new Date().toISOString()}), 3600);
  }
};

// HELPER: Mask SSN
function maskSSN(ssn) {
  if (!ssn) return 'N/A';
  const ssnStr = String(ssn).replace(/\D/g, ''); 
  if (ssnStr.length < 4) return ssn; 
  return `***-**-${ssnStr.slice(-4)}`;
}

// EMAIL TEMPLATE WITH ALL FIELDS
function createEnhancedEmailTemplate(title, patientData, changes, action, priority) {
  const pInfo = NotificationEngine.PRIORITY_LEVELS[priority] || NotificationEngine.PRIORITY_LEVELS.LOW;
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy 'at' h:mm a");
  const appUrl = ScriptApp.getService().getUrl();
  
  // Format fields
  const dob = patientData.dob ? Utilities.formatDate(new Date(patientData.dob), Session.getScriptTimeZone(), "MM/dd/yyyy") : 'N/A';
  const ssn = maskSSN(patientData.ssn);
  
  // Helper for default 'N/A'
  const v = (val) => val || 'N/A';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        .field-label { color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
        .field-value { color: #1f2937; font-size: 14px; font-weight: 600; margin-bottom: 12px; }
        .section-title { color: #111827; font-size: 15px; font-weight: 700; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; margin-top: 15px; }
        .note-box { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 10px; font-size: 13px; color: #374151; }
      </style>
    </head>
    <body style="margin:0; padding:20px; background:#f3f4f6; font-family: sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: ${pInfo.color}; padding: 25px; color: white;">
          <h1 style="margin:0; font-size: 22px;">${pInfo.icon} ${title}</h1>
          <p style="margin:5px 0 0; opacity:0.9; font-size: 13px;">${timestamp}</p>
        </div>

        <div style="padding: 30px;">
          <!-- Patient Info -->
          <h3 class="section-title">👤 Patient Information</h3>
          <table width="100%">
            <tr>
              <td width="50%"><div class="field-label">Name</div><div class="field-value">${v(patientData.patientName)}</div></td>
              <td width="50%"><div class="field-label">PRN</div><div class="field-value">${v(patientData.prn)}</div></td>
            </tr>
            <tr>
              <td width="50%"><div class="field-label">DOB</div><div class="field-value">${dob}</div></td>
              <td width="50%"><div class="field-label">SSN</div><div class="field-value" style="font-family:monospace;">${ssn}</div></td>
            </tr>
            <tr>
              <td width="50%"><div class="field-label">Phone</div><div class="field-value">${v(patientData.phoneNumber)}</div></td>
              <td width="50%"><div class="field-label">Sex</div><div class="field-value">${v(patientData.sex)}</div></td>
            </tr>
            <tr>
              <td colspan="2"><div class="field-label">Address</div><div class="field-value">${v(patientData.address)}</div></td>
            </tr>
          </table>

          <!-- Clinical Info -->
          <h3 class="section-title">💊 Clinical Details</h3>
          <table width="100%">
            <tr>
              <td width="50%"><div class="field-label">Medication</div><div class="field-value">${v(patientData.medicationDetails)}</div></td>
              <td width="50%"><div class="field-label">Pharmacy</div><div class="field-value">${v(patientData.pharmacy)}</div></td>
            </tr>
            <tr>
              <td width="50%"><div class="field-label">Provider</div><div class="field-value">${v(patientData.provider)}</div></td>
              <td width="50%"><div class="field-label">Status</div><div class="field-value">${v(patientData.workflowStatus)}</div></td>
            </tr>
            <tr>
              <td colspan="2"><div class="field-label">Reason</div><div class="field-value">${v(patientData.reason)}</div></td>
            </tr>
          </table>

          <!-- Insurance -->
          <h3 class="section-title">🛡️ Insurance</h3>
          <table width="100%">
             <tr>
               <td width="50%"><div class="field-label">Insurance</div><div class="field-value">${v(patientData.insuranceName)}</div></td>
               <td width="50%"><div class="field-label">Policy ID</div><div class="field-value">${v(patientData.insuranceId)}</div></td>
             </tr>
          </table>

          <!-- Notes -->
          <h3 class="section-title">📝 Notes</h3>
          ${patientData.outreachNote ? `<div style="margin-bottom:10px;"><div class="field-label">Outreach Note</div><div class="note-box">${patientData.outreachNote}</div></div>` : ''}
          ${patientData.officeNote ? `<div style="margin-bottom:10px;"><div class="field-label">Office Note</div><div class="note-box">${patientData.officeNote}</div></div>` : ''}
          ${patientData.gardenNotes ? `<div style="margin-bottom:10px;"><div class="field-label">Pharmacy Note</div><div class="note-box" style="border-left-color:${pInfo.color}">${patientData.gardenNotes}</div></div>` : ''}

          <!-- Footer -->
          <div style="margin-top: 30px; text-align: center;">
            <a href="${appUrl}" style="background: ${pInfo.color}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display:inline-block;">Open Dashboard</a>
          </div>
        </div>
        
        <div style="background:#1f2937; color:#9ca3af; padding:15px; text-align:center; font-size:11px;">
           Protected Health Information (PHI) - Do not forward.
        </div>
      </div>
    </body>
    </html>
  `;
}

function sendNotificationEmail(recipients, patientData, title, changes) {
  const clean = [...new Set(recipients)].filter(isValidEmail);
  if (clean.length === 0) return;
  const priority = NotificationEngine.calculatePriority(patientData, title);
  const htmlBody = createEnhancedEmailTemplate(title, patientData, changes, title, priority);
  try {
    MailApp.sendEmail({
      to: clean.join(','),
      subject: `${NotificationEngine.PRIORITY_LEVELS[priority].icon} ${title}: ${patientData.patientName}`,
      htmlBody: htmlBody,
      name: 'CWC Notification System'
    });
  } catch (e) { console.log('Email Error: ' + e.message); }
}

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()); }
