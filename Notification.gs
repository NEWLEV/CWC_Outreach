/**
 * Email handling & Chat Notification Triggers.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function sendNotificationEmail(recipients, patientData, title, changes) {
  const cleanRecipients = [...new Set(recipients)].filter(isValidEmail);
  
  let subjectIcon = " 🏥 ";
  if (title === "Outreach Update") subjectIcon = " 📢 ";
  else if (title === "Submit to Pharmacy") subjectIcon = " 💊 ";
  else if (title === "Pharmacy Update") subjectIcon = " ⚕️ ";
  
  // 1. Send Email
  if (cleanRecipients.length > 0) {
    const html = `
      <html>
      <body style="font-family:sans-serif; color:#333;">
      <div style="padding:20px; background:#f9f9f9; border:1px solid #ddd;">
      <h2 style="color:#2c3e50;">${subjectIcon} ${title}</h2>
      <p><strong>Patient:</strong> ${patientData.patientName} (PRN: ${patientData.prn})</p>
      <div style="background:#fff; padding:15px; margin:10px 0; border-left:4px solid #3498db;">
      ${formatChangesHTML(changes)}
      </div>
      <p style="font-size:12px; color:#777;">View the full record in the Outreach App.</p>
      </div>
      </body>
      </html>`;
    
    MailApp.sendEmail({
      to: cleanRecipients.join(','),
      subject: `${title}: ${patientData.patientName}`,
      htmlBody: html
    });
  }

  // 2. Construct Smart Chat Message
  const isUrgent = (patientData.priority || '').toString().toLowerCase() === 'urgent';
  const fire = isUrgent ? "🔥 " : "";
  
  // Header: Name First, then PRN
  let msg = `${subjectIcon} ${fire}*${title}*\n`;
  msg += `👤 *${patientData.patientName}* (PRN: ${patientData.prn})\n`;
  msg += `📧 By: ${patientData.creatorEmail || 'Unknown'}\n`;
  msg += `────────────────\n`;

  // Role-Specific Information
  if (title === "Pharmacy Update") {
    // Pharmacy updating: Show relevant pharmacy fields
    msg += `💊 *Pharmacy Update Details:*\n`;
    msg += `• Status: ${patientData.status}\n`;
    msg += `• Needs Script: ${patientData.needsScript}\n`;
    msg += `• Updated Ins: ${patientData.insuranceDetail}\n`;
    msg += `• Pharmacy Note: ${patientData.gardenNotes}\n`;
  } else {
    // CWC updating: Show full clinical context
    msg += `📋 *Clinical Details:*\n`;
    msg += `• Reason: ${patientData.reason}\n`;
    msg += `• Meds: ${patientData.medicationDetails}\n`;
    msg += `• Pharmacy: ${patientData.pharmacy}\n`;
    msg += `• Priority: ${patientData.priority}\n`;
    if (patientData.outreachNote) msg += `• Outreach Note: ${patientData.outreachNote}\n`;
  }

  sendWebhookNotification(msg);
}

function sendCWCNewEntryAlert(range, headers, headerMap) {
  try {
    const data = [headers, ...range.getDisplayValues()];
    // Re-use utility to ensure we get correct PRN mapping
    const patient = getUnifiedPatientData(data, headerMap, false)[0]; 
    const recipients = getRecipients().cwc.join(',');
    
    if(recipients) {
      MailApp.sendEmail({
        to: recipients,
        subject: `New Entry: ${patient.patientName}`,
        body: `New patient submitted.\nName: ${patient.patientName}\nPRN: ${patient.prn}\nReason: ${patient.reason}`
      });
    }

    const isUrgent = (patient.priority || '').toString().toLowerCase() === 'urgent';
    const fire = isUrgent ? "🔥 " : "";

    // Chat for New Entry
    let chatMsg = `📝 ${fire}*New Entry Received*\n`;
    chatMsg += `👤 *${patient.patientName}* (PRN: ${patient.prn})\n`;
    chatMsg += `📧 By: ${patient.creatorEmail}\n`;
    chatMsg += `────────────────\n`;
    chatMsg += `• Reason: ${patient.reason}\n`;
    chatMsg += `• Priority: ${patient.priority}\n`;

    sendWebhookNotification(chatMsg);

  } catch(e) {
    Logger.log("New Entry Alert Error: " + e.message);
  }
}

function formatChangesHTML(changes) {
  if(!changes || !changes.length) return 'No specific fields logged.';
  let rows = changes.map(c => `<tr><td>${c.field}</td><td>${c.oldValue}</td><td>${c.newValue}</td></tr>`).join('');
  return `<table border="1" style="border-collapse:collapse; width:100%;"><thead><tr><th>Field</th><th>Old</th><th>New</th></tr></thead><tbody>${rows}</tbody></table>`;
}
