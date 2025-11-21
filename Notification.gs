/**
 * Email handling & Smart Chat Notification Triggers.
 * UPDATED: Includes "Always Show" Debugging for Empty Fields
 */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function sendNotificationEmail(recipients, patientData, title, changes) {
  const cleanRecipients = [...new Set(recipients)].filter(isValidEmail);
  const emailHtml = createRichEmailTemplate(patientData, title, changes);
  
  if (cleanRecipients.length > 0) {
    MailApp.sendEmail({
      to: cleanRecipients.join(','),
      subject: `${title}: ${patientData.patientName || 'Patient'}`,
      htmlBody: emailHtml
    });
  }
  const chatCard = createChatCard(patientData, title, changes);
  sendWebhookNotification(null, chatCard);
}

function sendCWCNewEntryAlert(range, headers, headerMap) {
  try {
    const data = [headers, ...range.getDisplayValues()];
    const patient = getUnifiedPatientData(data, headerMap, false)[0]; 
    const recipients = getRecipients().cwc.join(',');
    if(recipients) {
      const emailHtml = createRichEmailTemplate(patient, "New Medication Request", []);
      MailApp.sendEmail({
        to: recipients,
        subject: `New Request: ${patient.patientName}`,
        htmlBody: emailHtml
      });
    }
    const chatCard = createChatCard(patient, "New Medication Request", null);
    sendWebhookNotification(null, chatCard);
  } catch(e) {
    Logger.log("New Entry Alert Error: " + e.message);
    sendWebhookNotification(` 🚨 Error generating card for New Entry: ${e.message}`);
  }
}

function sendWebhookNotification(text, cardPayload) {
  if (!CONFIG.CHAT_WEBHOOK_URL) return;
  try {
    let payload;
    if (cardPayload) payload = cardPayload; 
    else payload = { text: text || "Notification" }; 

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(CONFIG.CHAT_WEBHOOK_URL, options);
  } catch (e) {
    Logger.log("Webhook Failed: " + e.message);
  }
}

function createRichEmailTemplate(data, title, changes) {
  const colors = {
    headerBg: "#1a4f8b", 
    headerText: "#ffffff",
    sectionHeaderBg: "#f8f9fa",
    sectionHeaderBorder: "#1a4f8b",
    highlightBg: "#fff9c4",
    text: "#333333",
    label: "#5f6368",
    changeHighlightBg: "#e3f2fd",
    changeHighlightText: "#1565c0",
    missingData: "#d32f2f" // Red for missing data
  };

  const changedFields = new Set((changes || []).map(c => c.field.toLowerCase().trim()));

  // UPDATED: Logic to ALWAYS render, but show "No Data" if empty
  const renderRow = (label, value) => {
    let displayValue = value;
    let displayStyle = `font-weight: 500; color: ${colors.text};`;

    // 1. Handle Empty Data
    if (value === undefined || value === null || String(value).trim() === '') {
       displayValue = '(No Data)';
       displayStyle = `color: ${colors.missingData}; font-style: italic; font-size: 12px;`;
    } 
    
    // 2. Handle Highlighting (Only if data exists)
    const isChanged = changedFields.has(label.toLowerCase().trim());
    if (isChanged && displayValue !== '(No Data)') {
      displayValue = `<span style="background-color: ${colors.changeHighlightBg}; color: ${colors.changeHighlightText}; padding: 2px 5px; border-radius: 3px; font-weight: bold;">${value}</span>`;
    }

    return `
      <tr>
        <td style="padding: 8px 0; color: ${colors.label}; font-weight: 700; width: 35%; vertical-align: top; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #eee;">${label}</td>
        <td style="padding: 8px 0; width: 65%; font-size: 14px; border-bottom: 1px solid #eee; ${displayStyle}">${displayValue}</td>
      </tr>`;
  };

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 650px; margin: 20px auto; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${colors.headerBg}; color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 700;">${title}</h1>
          <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Continental Wellness Center</p>
        </div>
        <div style="padding: 30px;">
          
          <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 10px 0; color: ${colors.sectionHeaderBorder}; border-left: 4px solid ${colors.sectionHeaderBorder}; padding-left: 12px; font-size: 16px;"> 👤 Patient Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${renderRow('Patient Name', data.patientName)}
              ${renderRow('PRN', data.prn)}
              ${renderRow('Social Security', data.ssn)}
              ${renderRow('Date of Birth', data.dob ? new Date(data.dob).toLocaleDateString() : '')}
              ${renderRow('Sex', data.sex)}
              ${renderRow('Phone', data.phoneNumber)}
              ${renderRow('Address', data.address)}
            </table>
          </div>

          <div style="margin-bottom: 30px; background-color: ${colors.sectionHeaderBg}; padding: 15px; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: ${colors.sectionHeaderBorder}; font-size: 16px;"> 💊 Clinical & Medication</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${renderRow('Medication', data.medicationDetails)}
              ${renderRow('Provider', data.provider)}
              ${renderRow('Pharmacy', data.pharmacy)}
              ${renderRow('Reason', data.reason)}
              ${renderRow('Priority', data.priority)}
              ${renderRow('Status', data.status)}
              ${renderRow('Insurance', data.insuranceName)}
              ${renderRow('Insurance ID', data.insuranceId)}
            </table>
          </div>

          <div style="margin-bottom: 30px;">
             <h3 style="margin: 0 0 10px 0; color: ${colors.sectionHeaderBorder}; border-left: 4px solid ${colors.sectionHeaderBorder}; padding-left: 12px; font-size: 16px;"> ⚕️ Pharmacy Action</h3>
             <table style="width: 100%; border-collapse: collapse;">
               ${renderRow('Need Script?', data.needsScript)}
               ${renderRow('Updated Policy #', data.policyNumber)}
               ${renderRow('Updated Insurance', data.insuranceDetail)}
               ${renderRow('Pharmacy Notes', data.gardenNotes)}
             </table>
          </div>

          <div style="background-color: ${colors.highlightBg}; padding: 20px; border-radius: 8px; border: 1px solid #faeec5;">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #e65100; text-transform: uppercase; font-size: 12px;"> 📝 Additional Notes</h4>
            ${data.outreachNote ? `<div style="margin-bottom:10px; font-size:14px; line-height:1.5;"><strong>Outreach Note:</strong><br>${data.outreachNote}</div>` : ''}
            ${data.officeNote ? `<div style="margin-bottom:10px; font-size:14px; line-height:1.5;"><strong>Office Note:</strong><br>${data.officeNote}</div>` : ''}
            <div style="margin-top: 15px; font-size: 11px; color: #777; border-top: 1px solid #faeec5; padding-top: 10px; text-align: right;">
              Update By: <strong>${data.creatorEmail || 'System'}</strong>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 40px;">
             <a href="https://script.google.com/macros/s/AKfycbyROQ5zPepkmGpy6Z9fwmib34LMFSNJ28Iz0XXRAH6t3UfKYU7SB99T3e9GibTh73am/exec" 
                style="background-color: ${colors.headerBg}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                Open Outreach App
             </a>
          </div>
        </div>
      </div>
    </body>
    </html>`;
}

function createChatCard(data, title, changes) {
  const isUrgent = (data.priority || '').toString().toLowerCase() === 'urgent';
  let headerIcon = "https://fonts.gstatic.com/s/i/googlematerialicons/local_hospital/v6/black-48dp/2x/gm_local_hospital_black_48dp.png"; 
  if (title.includes("Pharmacy")) headerIcon = "https://fonts.gstatic.com/s/i/googlematerialicons/medication/v6/black-48dp/2x/gm_medication_black_48dp.png";
  else if (title.includes("Outreach")) headerIcon = "https://fonts.gstatic.com/s/i/googlematerialicons/record_voice_over/v6/black-48dp/2x/gm_record_voice_over_black_48dp.png";
  else if (isUrgent) headerIcon = "https://fonts.gstatic.com/s/i/googlematerialicons/error/v6/black-48dp/2x/gm_error_black_48dp.png"; 

  const createWidget = (topLabel, content) => {
    if (!content || content === '-' || content.toString().trim() === '') return null;
    return { "textParagraph": { "text": `<b>${topLabel}:</b> ${content}` } };
  };

  const sections = [];
  sections.push({
    "header": "👤 Patient Details",
    "widgets": [
      createWidget("Name", data.patientName),
      createWidget("PRN", data.prn),
      createWidget("DOB", data.dob ? new Date(data.dob).toLocaleDateString() : null)
    ].filter(w => w !== null)
  });

  const clinicalWidgets = [
    createWidget("Medication", data.medicationDetails),
    createWidget("Pharmacy", data.pharmacy),
    createWidget("Status", data.status),
    createWidget("Ins Updated", data.insuranceDetail),
    createWidget("Needs Script", data.needsScript)
  ].filter(w => w !== null);

  if (clinicalWidgets.length > 0) sections.push({ "header": "💊 Clinical & Pharmacy", "widgets": clinicalWidgets });

  const noteWidgets = [
    createWidget("Reason", data.reason),
    createWidget("Outreach Note", data.outreachNote),
    createWidget("Pharmacy Note", data.gardenNotes)
  ].filter(w => w !== null);

  if (noteWidgets.length > 0) sections.push({ "header": "📝 Notes", "widgets": noteWidgets });

  if (changes && changes.length > 0) {
    const changeText = changes.map(c => `• ${c.field}: ${c.oldValue} ➔ ${c.newValue}`).join("<br>");
    sections.push({ "header": "🔄 Updates Made", "widgets": [{ "textParagraph": { "text": changeText } }] });
  }

  return {
    "cardsV2": [{
        "cardId": "updateCard" + new Date().getTime(),
        "card": {
          "header": {
            "title": (isUrgent ? "🔥 URGENT: " : "") + title,
            "subtitle": `By: ${data.creatorEmail || 'Unknown'}`,
            "imageUrl": headerIcon,
            "imageType": "CIRCLE"
          },
          "sections": sections
        }
    }]
  };
}
