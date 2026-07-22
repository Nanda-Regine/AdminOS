/*!
 * mm-feedback.js — Mirembe Muse universal feedback widget.
 *
 * Drop ONE line into any app and user feedback flows straight into JarvisOS
 * (engineering_feedback -> AI triage -> Engineering Feedback wing):
 *
 *   <script src="https://jarvis.mirembemuse.co.za/mm-feedback.js" data-app="varsityos" defer></script>
 *
 * Attributes on the script tag:
 *   data-app     (required) app key: varsityos | adminos | k53drillmaster |
 *                sanyubotanicals | theselvesofus | bbmothership | stokvelos | jarvisos
 *   data-color   (optional) accent colour, default #D4A843
 *   data-origin  (optional) JarvisOS origin; defaults to where this script is served from
 *
 * No dependencies. Posts to {origin}/api/engineering/feedback (CORS-enabled, anonymous).
 */
(function () {
  var script = document.currentScript
  if (!script) return
  var APP = (script.getAttribute('data-app') || 'jarvisos').toLowerCase()
  var COLOR = script.getAttribute('data-color') || '#D4A843'
  var ORIGIN = script.getAttribute('data-origin') || new URL(script.src).origin
  var ENDPOINT = ORIGIN + '/api/engineering/feedback'

  // Stable anonymous id (no PII) so repeat submitters can be clustered.
  var submitter = ''
  try {
    submitter = localStorage.getItem('mm_fb_id') || ''
    if (!submitter) { submitter = 'a' + Math.abs(Date.now() ^ (Math.random() * 1e9 | 0)).toString(36); localStorage.setItem('mm_fb_id', submitter) }
  } catch (e) {}

  var TYPES = [
    { k: 'bug', t: '🐞 Bug' }, { k: 'feature', t: '💡 Idea' },
    { k: 'frustration', t: '😤 Frustration' }, { k: 'positive', t: '💚 Love it' }, { k: 'general', t: '💬 General' },
  ]

  function el(tag, style, text) { var e = document.createElement(tag); if (style) e.setAttribute('style', style); if (text != null) e.textContent = text; return e }

  var open = false, type = 'general', panel

  var btn = el('button', 'position:fixed;right:18px;bottom:18px;z-index:2147483000;border:none;cursor:pointer;' +
    'background:' + COLOR + ';color:#0A0A0F;font:600 13px system-ui,sans-serif;padding:11px 16px;border-radius:999px;' +
    'box-shadow:0 6px 22px rgba(0,0,0,0.35);', '💬 Feedback')
  btn.setAttribute('aria-label', 'Send feedback')

  function close() { open = false; if (panel) panel.remove(); panel = null; btn.style.display = 'block' }

  function render() {
    panel = el('div', 'position:fixed;right:18px;bottom:18px;z-index:2147483001;width:320px;max-width:calc(100vw - 36px);' +
      'background:#0F0F13;border:1px solid ' + COLOR + '55;border-radius:18px;padding:18px;font-family:system-ui,sans-serif;' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.5);')

    var head = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;')
    head.appendChild(el('div', 'color:#FEF3C7;font-weight:700;font-size:15px;', 'Share your feedback'))
    var x = el('button', 'background:none;border:none;color:#ffffff70;font-size:18px;cursor:pointer;', '✕')
    x.onclick = close; head.appendChild(x); panel.appendChild(head)

    var chips = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;')
    TYPES.forEach(function (ty) {
      var c = el('button', chipStyle(ty.k === type), ty.t)
      c.onclick = function () { type = ty.k; refreshChips() }
      c._k = ty.k; chips.appendChild(c)
    })
    panel._chips = chips; panel.appendChild(chips)

    var ta = el('textarea', 'width:100%;box-sizing:border-box;padding:11px;border-radius:12px;font-size:14px;resize:vertical;' +
      'outline:none;background:#ffffff0d;border:1px solid #ffffff1f;color:#FEF3C7;min-height:88px;')
    ta.placeholder = 'What would you like us to know?'; ta.maxLength = 2000; panel.appendChild(ta)

    var msg = el('div', 'color:#F87171;font-size:12px;margin-top:8px;display:none;'); panel.appendChild(msg)

    var send = el('button', 'width:100%;margin-top:12px;padding:12px;border:none;border-radius:12px;cursor:pointer;' +
      'background:' + COLOR + ';color:#0A0A0F;font-weight:700;font-size:14px;', 'Send feedback')
    send.onclick = function () {
      var text = (ta.value || '').trim(); if (!text) return
      send.disabled = true; send.textContent = 'Sending…'
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: APP, feedback_type: type, content: text.slice(0, 2000), submitter_id: submitter || undefined }) })
        .then(function (r) {
          if (r.ok) { panel.innerHTML = '<div style="text-align:center;padding:22px 0;"><div style="font-size:38px;">💚</div>' +
            '<div style="color:#FEF3C7;font-weight:700;margin-top:8px;">Thank you</div>' +
            '<div style="color:#ffffff80;font-size:13px;margin-top:4px;">Your feedback reached the team.</div></div>'
            setTimeout(close, 1800) }
          else throw new Error('bad')
        })
        .catch(function () { send.disabled = false; send.textContent = 'Send feedback'; msg.style.display = 'block'; msg.textContent = "Couldn't send — please try again." })
    }
    panel.appendChild(send)
    document.body.appendChild(panel); ta.focus()
  }

  function chipStyle(active) {
    return 'padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer;' +
      (active ? 'background:' + COLOR + ';color:#0A0A0F;border:1px solid ' + COLOR + ';font-weight:700;'
              : 'background:#ffffff0d;color:#ffffff99;border:1px solid #ffffff1f;')
  }
  function refreshChips() { if (!panel) return; Array.prototype.forEach.call(panel._chips.children, function (c) { c.setAttribute('style', chipStyle(c._k === type)) }) }

  btn.onclick = function () { if (open) return; open = true; btn.style.display = 'none'; render() }

  function mount() { document.body.appendChild(btn) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount()
})();
