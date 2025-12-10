let currentUrl = '';

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function scanPage() {
  const tab = await getCurrentTab();
  currentUrl = tab.url;
  
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('resultsState').style.display = 'none';
  document.getElementById('safeState').style.display = 'none';
  
  const safeList = await chrome.storage.local.get(['safeList']);
  const safeSites = safeList.safeList || [];
  
  if (safeSites.includes(currentUrl)) {
    showSafeState();
    return;
  }
  
  setTimeout(async () => {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: analyzePageContent
      });
      
      displayResults(result.result);
    } catch (error) {
      console.error('Scan error:', error);
      displayResults({
        trustScore: 50,
        riskLevel: 'medium',
        redFlags: ['Unable to fully scan page'],
        analysis: 'Limited scan completed. Some elements may not be accessible.'
      });
    }
  }, 1500);
}

function analyzePageContent() {
  const content = document.body.innerText.toLowerCase();
  const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
  const url = window.location.href.toLowerCase();
  
  let score = 100;
  const flags = [];
  let riskLevel = 'safe';
  
  const scamKeywords = [
    'urgent', 'act now', 'limited time', 'guaranteed income', 'work from home',
    'easy money', 'click here now', 'verify your account', 'suspended account',
    'confirm your identity', 'wire transfer', 'bitcoin', 'cryptocurrency investment',
    'double your money', 'risk free', 'no experience needed', 'earn $$$',
    'congratulations you won', 'claim your prize', 'free money'
  ];
  
  const suspiciousPatterns = [
    /\b\d{16}\b/,
    /password/i,
    /ssn|social security/i,
    /bank account/i,
    /routing number/i
  ];
  
  scamKeywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 2) {
      score -= 10;
      flags.push(`Multiple instances of suspicious phrase: "${keyword}"`);
    }
  });
  
  if (url.includes('login') || url.includes('signin') || url.includes('account')) {
    if (!url.startsWith('https://')) {
      score -= 30;
      flags.push('Insecure connection (no HTTPS) on login/account page');
    }
  }
  
  const suspiciousDomains = links.filter(link => {
    try {
      const linkUrl = new URL(link);
      return linkUrl.hostname.includes('-') && linkUrl.hostname.split('-').length > 3;
    } catch {
      return false;
    }
  });
  
  if (suspiciousDomains.length > 3) {
    score -= 15;
    flags.push(`${suspiciousDomains.length} suspicious-looking domain names detected`);
  }
  
  const shortLinks = links.filter(link => 
    link.includes('bit.ly') || link.includes('tinyurl') || link.includes('t.co')
  );
  
  if (shortLinks.length > 0) {
    score -= 10;
    flags.push(`${shortLinks.length} shortened URLs detected (may hide destination)`);
  }
  
  if (content.includes('paypal') && !url.includes('paypal.com')) {
    score -= 20;
    flags.push('Mentions PayPal but not on official PayPal domain');
  }
  
  if (content.includes('bank') && !url.includes('bank')) {
    score -= 15;
    flags.push('Banking-related content on non-banking domain');
  }
  
  const urgencyWords = ['urgent', 'immediately', 'act now', 'expires today'];
  const urgencyCount = urgencyWords.filter(word => content.includes(word)).length;
  if (urgencyCount >= 2) {
    score -= 15;
    flags.push('High-pressure urgency tactics detected');
  }
  
  score = Math.max(0, Math.min(100, score));
  
  if (score >= 70) riskLevel = 'safe';
  else if (score >= 50) riskLevel = 'low';
  else if (score >= 30) riskLevel = 'medium';
  else riskLevel = 'high';
  
  if (flags.length === 0) {
    flags.push('No obvious red flags detected');
  }
  
  let analysis = '';
  if (riskLevel === 'safe') {
    analysis = 'This page appears relatively safe. However, always exercise caution with personal information.';
  } else if (riskLevel === 'low') {
    analysis = 'Minor concerns detected. Be cautious and verify information before taking action.';
  } else if (riskLevel === 'medium') {
    analysis = 'Multiple warning signs detected. Exercise extreme caution. Do not share sensitive information.';
  } else {
    analysis = '⚠️ HIGH RISK: This page shows multiple scam indicators. Avoid sharing any personal or financial information.';
  }
  
  return { trustScore: score, riskLevel, redFlags: flags, analysis };
}

function displayResults(results) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('resultsState').style.display = 'block';
  
  const scoreElement = document.getElementById('trustScore');
  scoreElement.textContent = results.trustScore;
  scoreElement.className = 'trust-score';
  
  if (results.trustScore >= 70) scoreElement.classList.add('high');
  else if (results.trustScore >= 50) scoreElement.classList.add('medium');
  else scoreElement.classList.add('low');
  
  const riskBadge = document.getElementById('riskBadge');
  const riskLabels = {
    safe: '✅ Safe',
    low: '⚠️ Low Risk',
    medium: '⚠️ Medium Risk',
    high: '🚨 High Risk'
  };
  riskBadge.textContent = riskLabels[results.riskLevel];
  riskBadge.className = `risk-badge ${results.riskLevel}`;
  
  const flagsList = document.getElementById('redFlagsList');
  flagsList.innerHTML = '';
  flagsList.className = results.riskLevel === 'safe' ? 'flags-list safe' : 'flags-list';
  results.redFlags.forEach(flag => {
    const li = document.createElement('li');
    li.textContent = flag;
    flagsList.appendChild(li);
  });
  
  document.getElementById('riskDetails').textContent = results.analysis;
  
  const scanData = {
    url: currentUrl,
    timestamp: new Date().toISOString(),
    score: results.trustScore,
    risk: results.riskLevel
  };
  
  chrome.storage.local.get(['scanHistory'], (data) => {
    const history = data.scanHistory || [];
    history.unshift(scanData);
    chrome.storage.local.set({ scanHistory: history.slice(0, 50) });
  });
}

function showSafeState() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('resultsState').style.display = 'none';
  document.getElementById('safeState').style.display = 'flex';
}

document.getElementById('rescanBtn').addEventListener('click', scanPage);

document.getElementById('markSafeBtn').addEventListener('click', async () => {
  const safeList = await chrome.storage.local.get(['safeList']);
  const safeSites = safeList.safeList || [];
  
  if (!safeSites.includes(currentUrl)) {
    safeSites.push(currentUrl);
    await chrome.storage.local.set({ safeList: safeSites });
  }
  
  showSafeState();
});

document.getElementById('removeSafeBtn').addEventListener('click', async () => {
  const safeList = await chrome.storage.local.get(['safeList']);
  const safeSites = safeList.safeList || [];
  
  const filtered = safeSites.filter(url => url !== currentUrl);
  await chrome.storage.local.set({ safeList: filtered });
  
  scanPage();
});

document.getElementById('upgradeBtn').addEventListener('click', () => {
  alert('Premium features coming soon!\n\n✨ Real-time AI scanning\n💰 Financial fraud detection\n📊 Scan history dashboard\n🚨 Early scam warnings\n⚡ Priority AI checks');
});

document.getElementById('historyBtn').addEventListener('click', () => {
  chrome.storage.local.get(['scanHistory'], (data) => {
    const history = data.scanHistory || [];
    if (history.length === 0) {
      alert('No scan history yet.');
    } else {
      const recent = history.slice(0, 5).map((item, i) => 
        `${i + 1}. Score: ${item.score} | Risk: ${item.risk}\n   ${new URL(item.url).hostname}`
      ).join('\n\n');
      alert(`Recent Scans:\n\n${recent}\n\n(Premium: View full history dashboard)`);
    }
  });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  alert('Settings:\n\n✓ Auto-scan on page load\n✓ Show notifications\n✓ Scan sensitivity level\n\n(Premium features available in full version)');
});

scanPage();