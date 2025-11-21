/**
 * Central configuration.
 */
const CONFIG = {
  ADMIN_EMAIL: "pierremontalvo@continentalwellnesscenter.com",

  // WEBHOOK for Notifications (Google Chat Space)
  CHAT_WEBHOOK_URL: "https://chat.googleapis.com/v1/spaces/AAAAjVEzFx8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=tfyhta4FHkdp4ySX9cxkQCu5wicUvSE4yseB-dZThHA",

  // External Sheets to scan for statuses
  EXTERNAL_SHEETS: [
    { 
      id: "1F8xSwdQgJzS9jUq6X2YoVTlaqP0Ryc24uyTwKisfeNI", 
      sheetName: "Mail", 
      label: "MAIL" 
    },
    { 
      id: "1QJqa9EAUOkq0DgSFyaiiEKDW7sfeWLKHRZw_vUTzkzo", 
      sheetName: "Data", 
      label: "MEDS IN OFFICE" 
    }
  ],

  SHEET_NAMES: {
    ACTIVE: "Form Responses 1",
    ARCHIVED: "Archived Data",
    AUDIT_LOG: "Audit Log",
    SETTINGS: "Settings",
    CHAT_LOG: "Chat Log"
  },

  ROLES: {
    CWC: 'CWC',
    PHARMACY: 'PHARMACY'
  },

  FLAGS: {
    NEW_ENTRY: "New Entry",
    REVIEW_REQUIRED: "Review Required",
    SUBMITTED_TO_PHARMACY: "Submitted to Pharmacy",
    PHARMACY_UPDATE: "Pharmacy Update Received",
    CWC_UPDATE_SENT: "Outreach Update Sent"
  },

  COLUMNS_BY_NAME: {
    timestamp: 'Timestamp',
    
    // UPDATED: Changed to match your new Sheet Header
    creatorEmail: 'CWC Staff', 
    
    priority: 'Priority', 

    patientName: 'Patient Name',
    sex: 'Sex',
    dob: 'Date of Birth',
    ssn: 'Social Security', 
    prn: 'PRN',
    phoneNumber: 'Current Phone Number (Not CWC Number)',
    address: 'Address',

    medicationDetails: 'Medication',
    provider: 'Provider',
    pharmacy: 'Pharmacy',
    status: 'Prescription Status',
    needsScript: 'Need Script?',

    reason: 'Reason',
    outreachNote: 'Outreach Note',
    officeNote: 'Additional Notes',
    gardenNotes: 'Pharmacy Notes',

    insuranceName: 'Insurance',
    insuranceId: 'Insurance ID',
    insuranceDetail: 'Updated Insurance',
    policyNumber: 'Updated Policy Number',

    workflowStatus: 'Workflow Status',
    sentTimestamp: 'Notification Sent Timestamp'
  },

  AUDIT_LOG_HEADERS: ['Timestamp', 'User', 'Row', 'Action', 'Field', 'Old Value', 'New Value']
};
