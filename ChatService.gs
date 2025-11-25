/**
 * CORE CHAT SERVICE
 * Centralizes all chat logic for Sidebar <-> Google Chat sync.
 * Uses ScriptProperties for storage (NO SPREADSHEET).
 */

const CHAT_PROP_KEY = 'CWC_CHAT_HISTORY';
const MAX_HISTORY_LENGTH = 30; // Keep last 30 messages in memory

/**
 * Called by Sidebar when user sends a message.
 * 1. Sends to Outreach Webhook.
 * 2. Saves to Script Properties.
 */
function postOutreachMessage(text) {
  const userEmail = Session.getActiveUser().getEmail();
  const userName = userEmail.split('@')[0]; // Short name
  
  // 1. Send to Google Chat Webhook
  const webhookText = `*${userName}* (Sidebar): ${text}`;
  sendChatWebhookNotification(webhookText, 'outreach');

  // 2. Log to Internal History (Script Properties)
  logChatMessage(userName, text);
  
  // 3. Return updated history
  return getChatHistory();
}

/**
 * Shared logging function used by BOTH:
 * - postOutreachMessage (Sidebar users)
 * - GoogleChatBot.gs (Incoming Google Chat users)
 * - System Notifications
 */
function logChatMessage(sender, message) {
  if (!message) return;
  
  const lock = LockService.getScriptLock();
  try {
    // Wait up to 2 seconds for other processes to finish
    if (lock.tryLock(2000)) {
      const props = PropertiesService.getScriptProperties();
      const json = props.getProperty(CHAT_PROP_KEY);
      let history = json ? JSON.parse(json) : [];
      
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd HH:mm");
      
      // Add new message
      history.push({
        time: timestamp,
        sender: sender,
        text: message
      });
      
      // Trim to max length (FIFO) to prevent memory overflow
      if (history.length > MAX_HISTORY_LENGTH) {
        history = history.slice(history.length - MAX_HISTORY_LENGTH);
      }
      
      // Save back
      props.setProperty(CHAT_PROP_KEY, JSON.stringify(history));
    }
  } catch (e) {
    console.error("Chat Log Error: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retrieve history for the sidebar.
 */
function getChatHistory() {
  try {
    const props = PropertiesService.getScriptProperties();
    const json = props.getProperty(CHAT_PROP_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error("Get History Error: " + e.message);
    return [];
  }
}

// Helper alias for client polling
function pollChat() {
  return getChatHistory();
}

// Helper to manually clear chat (run from editor if needed)
function clearChatHistory() {
  PropertiesService.getScriptProperties().deleteProperty(CHAT_PROP_KEY);
}
