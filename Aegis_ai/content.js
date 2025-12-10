let pageAnalyzed = false;

function showWarningBanner(riskLevel) {
  if (riskLevel === 'high' && !document.querySelector('.aegis-warning-banner')) {
    const banner = document.createElement('div');
    banner.className = 'aegis-warning-banner';
    banner.innerHTML = `
      <strong>🚨 Aegis.ai Warning: High Risk Detected</strong>
      <p>This page shows multiple scam indicators. Avoid sharing personal or financial information.</p>
      <button class="aegis-close-banner">×</button>
    `;
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    banner.querySelector('.aegis-close-banner').addEventListener('click', () => {
      banner.remove();
    });
    
    setTimeout(() => {
      if (banner.parentElement) {
        banner.style.transition = 'opacity 0.3s';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeComplete') {
    showWarningBanner(request.riskLevel);
  }
});