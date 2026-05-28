/**
 * Edupath SMS — GA4 Analytics
 * Measurement ID: G-R1BJBG5MCP
 * Tracks: county searches, pricing attention, registration funnel, referral sources
 */

(function () {
  'use strict';

  const GA_ID = 'G-R1BJBG5MCP'; // ← your Measurement ID

  // ── Helpers ──────────────────────────────────────────────────────────────
  function gtagEvent(name, params) {
    if (typeof gtag !== 'function') return;
    gtag('event', name, Object.assign({ page_path: window.location.pathname }, params));
  }

  function getUTM() {
    try { return JSON.parse(sessionStorage.getItem('ep_utm') || '{}'); } catch { return {}; }
  }

  function classifyReferral(source, referrer) {
    const s = (source || '').toLowerCase();
    const r = (referrer || '').toLowerCase();
    if (['facebook', 'fb', 'instagram', 'twitter', 'x', 'linkedin', 'tiktok', 'whatsapp', 'youtube'].some(n => s.includes(n) || r.includes(n))) return 'social';
    if (['google', 'bing', 'yahoo', 'duckduckgo'].some(n => s.includes(n) || r.includes(n))) return s ? 'paid_search' : 'organic_search';
    if (s.includes('agent') || s.includes('ref')) return 'agent_referral';
    if (s || r) return 'referral';
    return 'direct';
  }

  // ── 1. UTM & Referral Capture ─────────────────────────────────────────────
  (function captureUTM() {
    const p = new URLSearchParams(window.location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      if (p.get(k)) utm[k] = p.get(k);
    });
    if (Object.keys(utm).length) {
      sessionStorage.setItem('ep_utm', JSON.stringify(utm));
      gtagEvent('referral_source_captured', {
        ...utm,
        referral_type: classifyReferral(utm.utm_source, document.referrer)
      });
    } else if (document.referrer && !document.referrer.includes('edupath.co.ke')) {
      const ref_type = classifyReferral('', document.referrer);
      sessionStorage.setItem('ep_utm', JSON.stringify({ utm_source: document.referrer, referral_type: ref_type }));
      gtagEvent('organic_visit', { referrer: document.referrer, referral_type: ref_type });
    }

    // Agent link: ?agent=AGENTCODE or ?ref=CODE
    const agentId = p.get('agent') || p.get('ref');
    if (agentId) {
      sessionStorage.setItem('ep_agent', agentId);
      gtagEvent('agent_link_visit', { agent_id: agentId, ...utm });
    }
  })();

  // ── 2. Scroll Depth ───────────────────────────────────────────────────────
  (function trackScrollDepth() {
    const milestones = [25, 50, 75, 90, 100];
    const reached = new Set();
    window.addEventListener('scroll', function () {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = Math.round((window.scrollY / total) * 100);
      milestones.forEach(m => {
        if (pct >= m && !reached.has(m)) {
          reached.add(m);
          gtagEvent('scroll_depth', { depth_percent: m });
        }
      });
    }, { passive: true });
  })();

  // ── 3. Section Visibility ─────────────────────────────────────────────────
  (function trackSections() {
    const sections = ['#hero', '#features', '#portals', '#pricing', '#wa', '#register', '#testimonials', '#faq'];
    const seen = new Set();
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !seen.has(e.target.id)) {
          seen.add(e.target.id);
          gtagEvent('section_viewed', { section_id: e.target.id });
        }
      });
    }, { threshold: 0.25 });
    sections.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) obs.observe(el);
    });
  })();

  // ── 4. Pricing Section Attention ─────────────────────────────────────────
  (function trackPricing() {
    const pricing = document.getElementById('pricing');
    if (!pricing) return;

    // Time spent in pricing section
    let enterTime = null;
    const sectionObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          enterTime = Date.now();
        } else if (enterTime) {
          const secs = Math.round((Date.now() - enterTime) / 1000);
          if (secs >= 2) gtagEvent('pricing_section_attention', { time_seconds: secs });
          enterTime = null;
        }
      });
    }, { threshold: 0.3 });
    sectionObs.observe(pricing);

    // Per-card hover attention
    pricing.querySelectorAll('.prcard').forEach(card => {
      const plan = (card.querySelector('.pplan') || card.querySelector('[class*="plan"]'))?.textContent?.trim() || 'unknown';
      const price = card.querySelector('.pprice')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const isBest = card.classList.contains('best');
      let hoverStart = null;

      card.addEventListener('mouseenter', () => { hoverStart = Date.now(); });
      card.addEventListener('mouseleave', () => {
        if (!hoverStart) return;
        const secs = Math.round((Date.now() - hoverStart) / 1000);
        if (secs >= 2) gtagEvent('pricing_card_attention', { plan, price, is_featured: isBest, time_seconds: secs });
        hoverStart = null;
      });

      // Pricing CTA clicks
      const btn = card.querySelector('.pbtn');
      if (btn) {
        btn.addEventListener('click', () => {
          gtagEvent('pricing_cta_click', {
            plan,
            price,
            is_featured: isBest,
            button_text: btn.textContent.trim(),
            ...getUTM()
          });
        });
      }
    });
  })();

  // ── 5. Hero & Nav CTA Clicks ──────────────────────────────────────────────
  (function trackCTAs() {
    document.querySelectorAll('.btnhero, .btnheroo').forEach(btn => {
      btn.addEventListener('click', () => {
        gtagEvent('hero_cta_click', {
          button_text: btn.textContent.trim(),
          button_type: btn.classList.contains('btnhero') ? 'primary' : 'secondary',
          ...getUTM()
        });
      });
    });
    document.querySelectorAll('#nav .btnp, #nav .btng').forEach(btn => {
      btn.addEventListener('click', () => {
        gtagEvent('nav_cta_click', {
          button_text: btn.textContent.trim(),
          button_type: btn.classList.contains('btnp') ? 'primary' : 'ghost'
        });
      });
    });
  })();

  // ── 6. Registration Funnel Tracking ──────────────────────────────────────
  (function trackRegistration() {
    const regSection = document.getElementById('register');
    if (!regSection) return;
    const form = regSection.querySelector('form') || regSection.querySelector('.regcard');
    if (!form) return;

    const touched = new Set();
    let formStarted = false;
    let submitted = false;

    // Field focus = funnel step
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('focus', () => {
        formStarted = true;
        const name = field.name || field.id || field.getAttribute('placeholder') || field.tagName.toLowerCase();
        if (!touched.has(name)) {
          touched.add(name);
          gtagEvent('registration_field_started', {
            field_name: name,
            funnel_step: touched.size,
            total_fields: form.querySelectorAll('input, select, textarea').length
          });
        }
      });
    });

    // County selection — most important geographic signal
    form.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', () => {
        const val = sel.value;
        if (!val) return;
        const name = sel.name || sel.id || '';
        // Identify county dropdown by name/id or by option values matching Kenyan counties
        const isCounty = name.toLowerCase().includes('county') || val.toLowerCase().includes('county') ||
          ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'kiambu', 'machakos', 'uasin gishu'].some(c => val.toLowerCase().includes(c));
        if (isCounty) {
          gtagEvent('county_selected', { county: val, ...getUTM() });
        } else {
          gtagEvent('plan_selected_in_form', { plan: val, field: name });
        }
      });
    });

    // Submit = conversion
    const submitBtn = form.querySelector('.btnsub') || form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (submitted) return;
        submitted = true;
        const agentId = sessionStorage.getItem('ep_agent') || null;
        const county = Array.from(form.querySelectorAll('select')).find(s =>
          s.name?.toLowerCase().includes('county') || [...s.options].some(o => o.value?.toLowerCase().includes('nairobi'))
        )?.value || 'unknown';
        const plan = Array.from(form.querySelectorAll('select')).find(s =>
          s.name?.toLowerCase().includes('plan') || s.name?.toLowerCase().includes('tier')
        )?.value || 'unknown';

        gtagEvent('registration_submit', {
          county,
          plan,
          fields_completed: touched.size,
          agent_id: agentId,
          ...getUTM()
        });
        // Mark as conversion
        if (typeof gtag === 'function') {
          gtag('event', 'conversion', { send_to: GA_ID });
        }
      });
    }

    // Drop-off: left page after starting form but not submitting
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && formStarted && !submitted && touched.size > 0) {
        const lastField = [...touched].pop();
        gtagEvent('registration_abandoned', {
          fields_completed: touched.size,
          last_field: lastField,
          funnel_completion_pct: Math.round((touched.size / Math.max(form.querySelectorAll('input, select, textarea').length, 1)) * 100)
        });
      }
    });
  })();

  // ── 7. Blog / Internal Link Clicks ───────────────────────────────────────
  (function trackInternalLinks() {
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('/blog') || href.includes('edupath.co.ke/blog')) {
        a.addEventListener('click', () => {
          gtagEvent('blog_link_click', { destination: href, link_text: a.textContent.trim().substring(0, 60) });
        });
      }
    });
  })();

  // ── 8. Time on Page (engagement quality) ─────────────────────────────────
  (function trackEngagement() {
    const start = Date.now();
    const milestones = [30, 60, 120, 180]; // seconds
    const fired = new Set();
    setInterval(() => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      milestones.forEach(m => {
        if (elapsed >= m && !fired.has(m)) {
          fired.add(m);
          gtagEvent('time_on_page', { seconds: m });
        }
      });
    }, 10000);
  })();

})();
