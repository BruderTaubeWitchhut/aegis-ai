chrome.runtime.onInstalled.addListener(() => {
  console.log('Aegis.ai installed successfully');
  
  chrome.storage.local.set({
    safeList: [],
    scanHistory: [],
    settings: {
      autoScan: true,
      showNotifications: true,
      sensitivity: 'medium'
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get(['settings'], (data) => {
      if (data.settings && data.settings.autoScan) {
        console.log('Auto-scan triggered for:', tab.url);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanComplete') {
    if (request.riskLevel === 'high' || request.riskLevel === 'medium') {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'analyzeComplete',
        riskLevel: request.riskLevel
      });
    }
  }
});