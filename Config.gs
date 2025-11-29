/**
 * CONFIGURATION
 * FIXED: Added ID column, proper sound profile for new entries
 */
const CONFIG = {
  ADMIN_EMAIL: "pierremontalvo@continentalwellnesscenter.com",

  // RESTORED WEBHOOK URL
  CHAT_WEBHOOK_URL: "https://chat.googleapis.com/v1/spaces/AAQA-bmmN08/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=h-wWfHSSZAYqxnxr_6-oajjHqX3qCOND4ojY7TixtGE",

  EXTERNAL_SHEETS: [
    { id: "1F8xSwdQgJzS9jUq6X2YoVTlaqP0Ryc24uyTwKisfeNI", sheetName: "Mail", label: "MAIL" },
    { id: "1QJqa9EAUOkq0DgSFyaiiEKDW7sfeWLKHRZw_vUTzkzo", sheetName: "Data", label: "MEDS IN OFFICE" }
  ],

  SHEET_NAMES: {
    ACTIVE: "Form Responses 1",
    ARCHIVED: "Archived Data",
    AUDIT_LOG: "Audit Log",
    SETTINGS: "Settings",
    SECURITY: "Security",
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
    id: 'ID',  // ADDED: Unique record identifier
    timestamp: 'Timestamp',
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

  AUDIT_LOG_HEADERS: ['Timestamp', 'User', 'Row', 'Action', 'Field', 'Old Value', 'New Value'],

  // Notification Settings
  NOTIFICATION_SETTINGS: {
    ENABLE_DESKTOP: true,
    ENABLE_SOUND: true,
    BATCH_DELAY: 60000,
    ESCALATION_ENABLED: true,
    PRIORITY_COLORS: {
      CRITICAL: '#dc2626',
      HIGH: '#ef4444',
      MEDIUM: '#f59e0b',
      LOW: '#10b981'
    }
  },

  // Dashboard Settings  
  DASHBOARD_REFRESH: 30000,
  ACTIVITY_LIMIT: 20,
  KPI_ANIMATION_DURATION: 1000,
  
  // Sound Alert Data URI - A clear notification chime
  SOUND_ALERT_DATA: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkJOOhHdwa3B5hpGZmpiPgnZua3J/jJifoZyRhXlxcHiEkZujpaKZjYF2cXN8iZOdpKaglo2DeHV1fIWSmp+hnpiPh394eH2FjpWYmZeUjoeCfnx+g4qQlJaVko2IhIF/f4KGi46RkY+NioeDgYGChoeKjI2MioiGhIOCgoOFh4mKioqIhoWEg4ODhIWGh4iIh4aFhIODg4OEhYaGhoaFhISDg4ODg4SFhYWFhYSEg4ODg4ODhISEhISEhIODg4ODg4ODg4SDg4ODg4ODg4ODg4ODg4ODg4OD",
  
  // Sound profiles for different alert types
  SOUND_PROFILES: {
    urgent: "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU",
    alert: "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU",
    notice: "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU",
    chime: "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU",
    newEntry: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkJOOhHdwa3B5hpGZmpiPgnZua3J/jJifoZyRhXlxcHiEkZujpaKZjYF2cXN8iZOdpKaglo2DeHV1fIWSmp+hnpiPh394eH2FjpWYmZeUjoeCfnx+g4qQlJaVko2IhIF/f4KGi46RkY+NioeDgYGChoeKjI2MioiGhIOCgoOFh4mKioqIhoWEg4ODhIWGh4iIh4aFhIODg4OEhYaGhoaFhISDg4ODg4SFhYWFhYSEg4ODg4ODhISEhISEhIODg4ODg4ODg4SDg4ODg4ODg4ODg4ODg4ODg4OD"
  }
};
