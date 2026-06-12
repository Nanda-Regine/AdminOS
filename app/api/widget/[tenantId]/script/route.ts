import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/widget/[tenantId]/script
// Serves the embeddable chat widget JavaScript.
// Businesses add <script src="https://app.adminOS.co.za/api/widget/TENANT_ID/script"></script>
// to their websites.
//
// Security: No auth required (public endpoint), but tenantId is validated.
// Widget conversations are stored as anonymous social messages.
export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params

  // Validate tenant exists and has social_inbox addon
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, plan')
    .eq('id', tenantId)
    .single()

  if (!tenant) return new NextResponse('Not found', { status: 404 })

  // Check addon entitlement
  const { data: addon } = await supabaseAdmin
    .from('addon_subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('addon_slug', 'social_inbox')
    .eq('status', 'active')
    .maybeSingle()

  // Allow scale/partner plans without explicit addon too
  const isPaidUp = addon || ['scale', 'partner'].includes(tenant.plan ?? '')
  if (!isPaidUp) {
    return new NextResponse('/* Upgrade to activate the chat widget */', {
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.adminOS.co.za'

  const js = buildWidgetScript({
    tenantId,
    tenantName: tenant.name ?? 'Chat with us',
    apiBase:    appUrl,
  })

  return new NextResponse(js, {
    headers: {
      'Content-Type':  'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

function buildWidgetScript({ tenantId, tenantName, apiBase }: {
  tenantId:   string
  tenantName: string
  apiBase:    string
}): string {
  // Self-contained IIFE — no external dependencies
  return `/* AdminOS Chat Widget — ${JSON.stringify(tenantName)} */
(function(w, d) {
  'use strict';
  var TENANT = ${JSON.stringify(tenantId)};
  var API    = ${JSON.stringify(apiBase)};
  var NAME   = ${JSON.stringify(tenantName)};
  var STORAGE_KEY = 'adminos_widget_session_' + TENANT;

  // Don't double-mount
  if (w.__adminosWidget) return;
  w.__adminosWidget = true;

  function getSessionId() {
    var id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = 'ws-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  }

  var sessionId = getSessionId();
  var isOpen = false;
  var messages = [];
  var pollTimer = null;
  var lastMessageId = null;

  // Inject styles
  var style = d.createElement('style');
  style.textContent = [
    '#adminos-widget-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#1a56db;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.25);font-size:24px;z-index:99998;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;}',
    '#adminos-widget-btn:hover{transform:scale(1.08);}',
    '#adminos-widget-panel{position:fixed;bottom:90px;right:24px;width:340px;max-width:calc(100vw - 48px);height:480px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);z-index:99999;display:flex;flex-direction:column;overflow:hidden;transform:scale(0.9) translateY(20px);opacity:0;pointer-events:none;transition:all 0.2s;}',
    '#adminos-widget-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
    '.aw-header{background:#1a56db;color:#fff;padding:14px 16px;font-weight:600;font-size:14px;flex-shrink:0;}',
    '.aw-header small{display:block;font-size:11px;font-weight:400;opacity:0.85;margin-top:2px;}',
    '.aw-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}',
    '.aw-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4;}',
    '.aw-msg.visitor{align-self:flex-end;background:#1a56db;color:#fff;border-bottom-right-radius:4px;}',
    '.aw-msg.agent{align-self:flex-start;background:#f1f5f9;color:#111;border-bottom-left-radius:4px;}',
    '.aw-msg .ts{font-size:10px;opacity:0.6;margin-top:4px;}',
    '.aw-input-row{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;flex-shrink:0;}',
    '.aw-input-row input{flex:1;border:1px solid #ddd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;}',
    '.aw-input-row input:focus{border-color:#1a56db;}',
    '.aw-input-row button{background:#1a56db;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:600;}',
    '.aw-input-row button:hover{background:#1648c0;}',
    '.aw-name-form{padding:16px;display:flex;flex-direction:column;gap:10px;}',
    '.aw-name-form input{border:1px solid #ddd;border-radius:8px;padding:10px 12px;font-size:13px;outline:none;}',
    '.aw-name-form input:focus{border-color:#1a56db;}',
    '.aw-name-form button{background:#1a56db;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:14px;font-weight:600;}',
    '.aw-badge{position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;display:none;}',
  ].join('');
  d.head.appendChild(style);

  // Build DOM
  var btn = d.createElement('button');
  btn.id = 'adminos-widget-btn';
  btn.innerHTML = '<span id="aw-btn-icon">&#x1F4AC;</span><div class="aw-badge" id="aw-badge">0</div>';
  btn.setAttribute('aria-label', 'Open chat');

  var panel = d.createElement('div');
  panel.id = 'adminos-widget-panel';

  var header = d.createElement('div');
  header.className = 'aw-header';
  header.innerHTML = '<span>' + escHtml(NAME) + '</span><small>We usually reply quickly</small>';

  var msgsDiv = d.createElement('div');
  msgsDiv.className = 'aw-messages';
  msgsDiv.id = 'aw-messages';

  var inputRow = d.createElement('div');
  inputRow.className = 'aw-input-row';
  var inputEl = d.createElement('input');
  inputEl.type = 'text';
  inputEl.placeholder = 'Type a message...';
  inputEl.maxLength = 500;
  var sendBtn = d.createElement('button');
  sendBtn.textContent = 'Send';
  inputRow.appendChild(inputEl);
  inputRow.appendChild(sendBtn);

  // Name collection form shown on first message
  var nameFormDiv = d.createElement('div');
  nameFormDiv.className = 'aw-name-form';
  nameFormDiv.id = 'aw-name-form';
  nameFormDiv.innerHTML = '<p style="font-size:13px;color:#555;">Hi! What\\'s your name?</p>';
  var nameInput = d.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Your name';
  nameInput.maxLength = 80;
  var startBtn = d.createElement('button');
  startBtn.textContent = 'Start chatting';
  nameFormDiv.appendChild(nameInput);
  nameFormDiv.appendChild(startBtn);

  panel.appendChild(header);
  panel.appendChild(msgsDiv);
  panel.appendChild(nameFormDiv);
  panel.appendChild(inputRow);

  d.body.appendChild(btn);
  d.body.appendChild(panel);

  var visitorName = localStorage.getItem('adminos_widget_name_' + TENANT) || null;
  if (visitorName) {
    nameFormDiv.style.display = 'none';
    inputRow.style.display = 'flex';
  } else {
    inputRow.style.display = 'none';
    nameFormDiv.style.display = 'flex';
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    } catch(e) { return ''; }
  }

  function renderMessages() {
    msgsDiv.innerHTML = '';
    messages.forEach(function(m) {
      var div = d.createElement('div');
      div.className = 'aw-msg ' + (m.from === 'visitor' ? 'visitor' : 'agent');
      div.innerHTML = '<span>' + escHtml(m.text) + '</span><div class="ts">' + formatTime(m.created_at) + '</div>';
      msgsDiv.appendChild(div);
    });
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }

  function sendMessage(text) {
    if (!text.trim()) return;
    var msg = { from: 'visitor', text: text, created_at: new Date().toISOString(), id: Date.now() };
    messages.push(msg);
    renderMessages();

    fetch(API + '/api/widget/' + TENANT + '/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        visitor_name: visitorName,
        message: text,
        last_message_id: lastMessageId,
      }),
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.message_id) lastMessageId = data.message_id;
    }).catch(function() {});
  }

  function pollReplies() {
    if (!isOpen || !lastMessageId) return;
    fetch(API + '/api/widget/' + TENANT + '/message?session_id=' + sessionId + '&after=' + encodeURIComponent(lastMessageId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.replies && data.replies.length > 0) {
          var badge = d.getElementById('aw-badge');
          data.replies.forEach(function(r) {
            if (!messages.find(function(m) { return m.id === r.id; })) {
              messages.push({ from: 'agent', text: r.content, created_at: r.created_at, id: r.id });
              if (!isOpen && badge) { badge.style.display = 'flex'; badge.textContent = String(messages.filter(function(m){ return m.from === 'agent' && !m.seen; }).length); }
            }
            lastMessageId = r.id;
          });
          if (isOpen) renderMessages();
        }
      }).catch(function() {});
  }

  startBtn.addEventListener('click', function() {
    var name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    visitorName = name;
    localStorage.setItem('adminos_widget_name_' + TENANT, name);
    nameFormDiv.style.display = 'none';
    inputRow.style.display = 'flex';
    inputEl.focus();
  });

  nameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') startBtn.click();
  });

  sendBtn.addEventListener('click', function() {
    sendMessage(inputEl.value);
    inputEl.value = '';
    inputEl.focus();
  });

  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { sendMessage(inputEl.value); inputEl.value = ''; }
  });

  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('open');
      var badge = d.getElementById('aw-badge');
      if (badge) badge.style.display = 'none';
      renderMessages();
      if (visitorName) inputEl.focus();
      else nameInput.focus();
      if (!pollTimer) pollTimer = setInterval(pollReplies, 8000);
    } else {
      panel.classList.remove('open');
    }
  });

  // Initial poll after 5s if user has existing session
  if (visitorName) {
    setTimeout(function() { if (!pollTimer) pollTimer = setInterval(pollReplies, 8000); }, 5000);
  }

})(window, document);`;
}
