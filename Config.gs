/**

 * Configuration file for the Transactional Patient Notification App.

 * All constants, sheet names, and column mappings are defined here.

 *

 * Version: 2.0.0 (Transactional System)

 */

const CONFIG = {

  SHEET_NAMES: {

    ACTIVE: "Form Responses 1", // The main sheet with consolidated data

    ARCHIVED: "Archived Data", // Sheet where processed records are moved

    SETTINGS: "Email Settings",  // Sheet to manage recipient emails

    AUDIT_LOG: "Audit Log" // NEW: Sheet to log all changes

  },

 

  // Column definitions based on the unified data model.

  COLUMNS: {

    // --- Key Identifier Columns ---

    TIMESTAMP: { header: "Timestamp", index: 1 },

    PATIENT_NAME: { header: "Patient Name", index: 3 },

    DOB: { header: "Date of Birth", index: 8 },

    PRN: { header: "PRN", index: 13 }, // Used for record linking

   

    // --- Contact & Address ---

    EMAIL_ADDRESS: { header: "Email Address", index: 2 },

    PHONE_NUMBER: { header: "Current Phone Number (Not CWC Number)", index: 6 },

    ADDRESS: { header: "Address", index: 5 },

   

    // --- Medication & Treatment ---

    MEDICATION_DETAILS: { header: "Medication Name(s) and Dosage(s)", index: 10 },

    PROVIDER: { header: "Provider", index: 11 },

    PHARMACY: { header: "PHARMACY", index: 14 },

   

    // --- Status & Notes ---

    STATUS: { header: "Prescription Status", index: 15 },

    OUTREACH_NOTE: { header: "Outreach Note", index: 8 },

    GARDEN_NOTES: { header: "Garden Notes", index: 17 },

    OFFICE_NOTE: { header: "Any additional notes or instructions?", index: 14 },

    REASON: { header: "Reason", index: 22 },

   

    // --- Insurance ---

    INSURANCE_NAME: { header: "Insurance Name", index: 12 },

    INSURANCE_ID: { header: "Insurance Identification Number", index: 13 },

    NEEDS_SCRIPT: { header: "Needs Script?", index: 18 },

    INSURANCE_DETAIL: { header: "Updated Insurance", index: 19 },

    POLICY_NUMBER: { header: "Updated Policy Number", index: 20 },



    // --- NEW Transactional Workflow Columns ---

    // **IMPORTANT**: You MUST replace "Ready to Send to Pharmacy" with this new column.

    WORKFLOW_STATUS: { header: "Workflow Status" }, // Replaces "Ready to Send"

    NOTIFICATION_SENT: { header: "Notification Sent Timestamp" } // Kept from before

  },

 

  // List of header names that trigger "Review Required" flag on *manual* onEdit.

  CRITICAL_COLUMNS_TO_WATCH: [

    "Prescription Status",

    "Garden Notes",

    "Outreach Note",

    "Reason",

    "Needs Script?",

    "Updated Insurance",

    "Updated Policy Number",

    "PHARMACY",

    "PRN",

    "Medication Name(s) and Dosage(s)",

    "Any additional notes or instructions?"

  ],

 

  // Flags used in the "Workflow Status" column

  FLAGS: {

    NEW_ENTRY: "New Entry (Pending CWC)",

    REVIEW_REQUIRED: "CWC Review Required",

    SUBMITTED_TO_PHARMACY: "Submitted to Pharmacy",

    PHARMACY_UPDATE: "Pharmacy Update (Pending CWC)",

    CWC_UPDATE_SENT: "Outreach Update Sent"

  },

 

  // UI Colors for Workflow Status

  COLORS: {

    NEW_ENTRY: "#FCE5CD", // Light Orange

    REVIEW_REQUIRED: "#FFF2CC", // Light Yellow

    SUBMITTED_TO_PHARMACY: "#D9EAD3", // Light Green

    PHARMACY_UPDATE: "#C9DAF8" // Light Blue

  },

 

  // Email Addresses

  ADMIN_EMAIL_FOR_ERRORS: "pierremontalvo@continentalwellnesscenter.com",

 

  // List for *internal CWC* notifications (e.g., "New form submitted")

  INTERNAL_RECIPIENTS: [

    "pierremontalvo@continentalwellnesscenter.com"

  ],



  // Settings for Email Recipient Management sheet

  SETTINGS_SHEET: {

    NAME: "Email Settings",

    PHARMACY_RANGE: "A2:A", // Pharmacy emails in column A

    OUTREACH_RANGE: "B2:B"  // NEW: Outreach emails in column B

  },

 

  // Default fallbacks if sheet is empty

  DEFAULT_RECIPIENTS: {

    PHARMACY: [

      "pierremontalvo@continentalwellnesscenter.com"

    ],

    OUTREACH: [

      "pierremontalvo@continentalwellnesscenter.com"

    ],

    CWC_INTERNAL: [

      "pierremontalvo@continentalwellnesscenter.com"

    ]

  }

};

