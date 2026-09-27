/* =====================================================================
   Business Result Placement Test v3 — ENGINE
   Flow: Reading (30 items, 6 per level) -> Listening (adaptive, 2 blocks)
         -> receptive placement -> Writing (task at level)
         -> Speaking (live ElevenLabs examiner, at/up/down blocks)
         -> candidate result + examiner confirmation (rubrics).
   Model (Dr. Abir, 27 Sep 2026): Reading + Listening set the band;
   Writing + Speaking can lower it, or raise it by at most one band.
   ===================================================================== */
(function () {
  "use strict";
  const { CONFIG, TIERS, CEFR_DESCRIPTORS, BAND_WORDS, SPEAKING_RUBRIC, WRITING_RUBRIC, BANK, READING } = window.BRT;
  const MAX_T = 5;

  /* ---------------- online services ----------------
     n8n base can be overridden with ?n8n=https://... (saved to localStorage). */
  const ONLINE = (function () {
    let base = "https://monglish.app.n8n.cloud";
    try {
      const q = new URLSearchParams(location.search).get("n8n");
      if (q) localStorage.setItem("brt_n8n", q);
      base = localStorage.getItem("brt_n8n") || base;
    } catch (e) {}
    return {
      base,
      result:   base + "/webhook/bus3-result",    // v3 workflow "Business English Placement v3 (TEST)"
      writing:  base + "/webhook/bus3-writing",   // AI writing marking (Claude, 0-4 x4 against task level)
      speaking: base + "/webhook/bus3-speaking",  // recorded-answer fallback; live calls arrive via ElevenLabs post-call
      flag:     base + "/webhook/bus3-flag",      // mic failure -> urgent row
      report:   base + "/webhook/bus3-report",    // examiner final placement
      agentId:  "agent_7001kygg4k5efy0tj5yes5mfydh9" // ElevenLabs "Business English Examiner"
    };
  })();
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  /* ---------------- staff test mode ----------------
     Open the page with ?test (or ?test=SOHA). The attempt is still sent to n8n,
     but labelled so it cannot be read as a candidate placement. */
  const TEST = (function () {
    try { const p = new URLSearchParams(location.search); return p.has("test") ? (p.get("test") || "Dr. Abir Wafa") : null; }
    catch (e) { return null; }
  })();
  const TEST_LABEL = "TEST TRIAL - " + (TEST || "");

  /* single-use password list from v2, kept for CONFIG.requirePassword */
  const licensePasswords = ["X7P9Q2","T9F3L8","J4Y8M1","Q2Z7B5","H8W3N9","P5R2T6","K9L4V3","C3M7Q8","F6J1Z4","N2B5K9","Z4T8R2","M7X3F6","R5C9P1","L8J2W7","V1P6N3","S9F4K2","Y3Q7M8","W5L9B4","A7D2C6","E3H8T1","G9Q6K5","D4X1N8","U6B7M3","P1R9C4","K8M2W6","Q7L4H1","J5V3T9","B3N8Z2","F9C1L7","X2Y6H4","R7T5K8","W1Q9M4","M6D8P3","T5G2C9","H4R7X1","S9V6L3","C2Z5W8","P8K1J4","N7F3B6","V1X8R2","K4M3Y7","D9H6Q1","J3P8F5","Y7T4W2","F1V9L6","M8C2R3","L6Q7N1","E5K3Z9","B9D4T2","X3G6H8","T7B2W4","A8P5L9","H2C9M6","R1J8Q3","Z6F4N1","C7L3P5","W2M9T7","P5D7X1","G1R6V8","J8B4C2","M6Q1H5","Y3T9K7","S4W2F8","V7L8D1","K2N3P9","B8C6R4","D1Z7M5","E4V9X2","F3H1Q6","P6G8L4","J2T7M8","R9W5K1","H8X3C7","U5L1F2","Q3B7P9","Z4C8R6","W9M2D1","C1F6T8","A7Y3H5","G4N9K2","M5Q2Z7","T8B6L4","D3H7V2","E9P1C6","K7M3X4","L4W8R3","S2T6N9","P9D5F1","B7G4Q8","H3C2M5","V8X7T1","R6F9K4","M4Q1W8","A5H3B7","J9P6L2","C6D4T8","W1M7F3","Y2G5Q9","P8L3C1","X7T9R4"];
  const PW_TEST_KEY = "X7P9Q2";

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = x => String(x == null ? "" : x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clampT = t => Math.max(1, Math.min(MAX_T, t));
  const top = () => window.scrollTo({ top: 0, behavior: "smooth" });

  /* ---------------- state ---------------- */
  const S = {
    student: {}, attemptId: "", startedAt: 0, timer: null,
    reading: null,              // {score, answered, coverage, provisional, tier, te, answers}
    listen: null,               // active staircase
    listening: null,            // {blocks:[{tier,correct,total,pct}], te, correct, total, perObj}
    prov: null,                 // receptive placement {tier, pos, sub, te, teR, teL, gap}
    writingText: "", writingUpload: null, aiWriting: null,
    asked: [], fallbackTranscript: "", micTries: 0, notPlayed: 0,
    teacher: { writing: [null, null, null, null], speaking: [null, null, null, null] },
    final: null
  };

  /* ---------------- navigation ---------------- */
  function show(id) {
    $$(".screen").forEach(s => s.classList.add("hidden"));
    $("#screen-" + id).classList.remove("hidden");
    top();
  }
  function setTab(skill) {
    const order = ["reading", "listening", "writing", "speaking"];
    const idx = order.indexOf(skill);
    $("#skillTabs").classList.remove("hidden");
    $$(".skill-tab").forEach(t => {
      const i = order.indexOf(t.dataset.skill);
      t.classList.toggle("active", i === idx);
      t.classList.toggle("done", idx === -1 ? true : i < idx);
    });
  }

  /* ---------------- start ---------------- */
  function init() {
    $("#testDate").value = new Date().toISOString().split("T")[0];
    if (TEST) $("#testBadgeSlot").innerHTML = `<span class="test-badge">TEST TRIAL — not a candidate result</span>`;
    show(CONFIG.requirePassword ? "login" : "start");
  }
  $("#loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const pwd = $("#loginPassword").value.trim(), err = $("#loginError");
    err.classList.add("hidden");
    const fail = m => { err.textContent = m; err.classList.remove("hidden"); };
    if (!licensePasswords.includes(pwd)) return fail("Invalid exam password.");
    const key = "exam_license_used_" + pwd;
    if (pwd !== PW_TEST_KEY && localStorage.getItem(key) === "true") return fail("This exam password has already been used on this device.");
    if (pwd !== PW_TEST_KEY) localStorage.setItem(key, "true");
    S.student.password = pwd;
    show("start");
  });
  $("#infoForm").addEventListener("submit", e => {
    e.preventDefault();
    const err = $("#startError"); err.classList.add("hidden");
    const name = $("#studentName").value.trim();
    let date = $("#testDate").value;
    if (!date) { date = new Date().toISOString().split("T")[0]; $("#testDate").value = date; }
    if (!name) { err.textContent = "Please enter your full name."; err.classList.remove("hidden"); $("#studentName").focus(); return; }
    if (!$("#consent").checked) { err.textContent = "Please tick the consent box to continue."; err.classList.remove("hidden"); return; }
    S.student = Object.assign(S.student, { name, date, company: $("#company").value.trim(), job: $("#jobTitle").value.trim() });
    S.attemptId = (TEST ? "TEST-" : "BE-") + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    show("intro");
  });
  $("#introGo").addEventListener("click", startReading);

  function startTimer() {
    S.startedAt = Date.now();
    S.timer = setInterval(() => {
      const el = Math.floor((Date.now() - S.startedAt) / 1000);
      $("#timer").textContent = `Time: ${String(Math.floor(el / 60)).padStart(2, "0")}:${String(el % 60).padStart(2, "0")}`;
    }, 1000);
  }
  const elapsedMin = () => Math.round((Date.now() - S.startedAt) / 60000);

  /* =====================================================================
     READING — 30 items (6 per CEFR level) from the approved 60; bands 0-6/7-13/14-20/21-27/28-30
     ===================================================================== */
  function startReading() {
    setTab("reading");
    $("#hdrName").textContent = S.student.name;
    $("#hdrDate").textContent = S.student.date;
    const form = $("#readingForm"); form.innerHTML = "";
    READING.forEach((q, i) => {
      const d = document.createElement("div"); d.className = "question-container";
      d.innerHTML = `<div class="question-number">Question ${i + 1} of ${READING.length}</div>
        <div class="question-text">${esc(q.question)}</div>
        <div class="options">${q.options.map((o, k) => `<label class="option"><input type="radio" name="q${i}" value="${k}"><span>${String.fromCharCode(65 + k)}. ${esc(o)}</span></label>`).join("")}</div>`;
      form.appendChild(d);
    });
    form.addEventListener("change", updateProgress);
    updateProgress(); startTimer(); show("reading");
  }
  function countAnswered() { return READING.filter((_, i) => document.querySelector(`input[name="q${i}"]:checked`)).length; }
  function updateProgress() {
    const a = countAnswered(), pct = Math.round(a / READING.length * 100);
    $("#progressText").textContent = `Answered: ${a} / ${READING.length}`;
    $("#progressPct").textContent = pct + "%";
    $("#progressFill").style.width = pct + "%";
  }
  function tierForScore(score) {
    for (let t = 1; t <= MAX_T; t++) if (score >= TIERS[t].min && score <= TIERS[t].max) return t;
    return 1;
  }
  let readingConfirmed = false;
  $("#readingSubmit").addEventListener("click", e => {
    e.preventDefault();
    const answered = countAnswered();
    const min = Math.ceil(READING.length * CONFIG.minCoverage);
    if (answered < min && !readingConfirmed) {
      readingConfirmed = true;
      $("#readingWarn").innerHTML = `<div class="warning-message">You have answered ${answered} of ${READING.length}. Unanswered questions count as wrong. Press Submit again to continue anyway.</div>`;
      return;
    }
    let score = 0; const answers = [];
    READING.forEach((q, i) => {
      const sel = document.querySelector(`input[name="q${i}"]:checked`);
      const a = sel ? +sel.value : -1; answers.push(a);
      if (a === q.correct) score++;
    });
    const tier = tierForScore(score), T = TIERS[tier];
    const pos = (score - T.min) / (T.max - T.min + 1);          // 0..<1 inside the band
    S.reading = { score, answered, coverage: answered / READING.length, provisional: answered < min,
                  tier, te: tier + pos, answers, minutes: elapsedMin(), profile: readingProfile(answers) };
    startListening();
  });

  /* Per-level reading profile: correct/total for each CEFR level, the highest level
     securely passed (this and every level below at >= 2/3), and a flag when a higher
     level is clearly stronger than a lower one (a sign of guessing). */
  const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
  function readingProfile(answers) {
    const by = {};
    LEVELS.forEach(l => by[l] = [0, 0]);
    READING.forEach((q, i) => { const l = q.lvl || "?"; if (!by[l]) by[l] = [0, 0]; by[l][1]++; if (answers[i] === q.correct) by[l][0]++; });
    let secure = "below A1";
    for (const l of LEVELS) { const [c, t] = by[l]; if (t && c / t >= 2 / 3) secure = l; else break; }
    let uneven = false;
    LEVELS.forEach((lo, i) => LEVELS.slice(i + 1).forEach(hi => {
      const [cl, tl] = by[lo], [ch, th] = by[hi];
      if (tl && th && ch / th - cl / tl >= 0.5) uneven = true;
    }));
    const text = LEVELS.filter(l => by[l][1]).map(l => `${l} ${by[l][0]}/${by[l][1]}`).join(" · ");
    return { by, secure, uneven, text };
  }

  /* =====================================================================
     LISTENING — ONE exercise (5 scored items) at the reading-implied tier.
     Ability = tier + (pct-60)/40, so it confirms or nudges the reading band.
     (Old 2-block staircase below is commented out. It chose block 2 as:
       >=60% (3+/5) -> one tier up · 40% -> one down · <=20% -> two down.
     At the top, a strong block is confirmed one tier below; at the floor a
     weak block ends the section.
     ===================================================================== */
  function startListening() {
    S.listen = { tier: S.reading.tier, blocks: [], visited: {}, perObj: [] };
    loadListening();
  }
  function loadListening() {
    const L = S.listen, task = BANK[L.tier].listening;
    setTab("listening");
    L.task = task; L.played = 0; L.tStart = Date.now();
    stopAudio();
    $("#listenCounter").textContent = `One exercise · set at your reading level`;
    $("#listenTitle").textContent = task.title;
    $("#listenInstruction").textContent = task.instruction;
    const box = $("#listenRows"); box.innerHTML = "";
    task.items.forEach((it, i) => {
      /* choices shown UNDER each question (like Reading), not in a dropdown */
      const row = document.createElement("div");
      row.className = "listen-q" + (it.example ? " example" : "");
      const opts = it.example ? it.options.slice() : shuffle(it.options.slice());
      row.innerHTML = `<div class="lq-head"><span class="num">${i + 1}</span>
          <span class="stem">${esc(it.q)}${it.example ? '<span class="eg">example</span>' : ""}</span></div>
        <div class="options" role="radiogroup" aria-label="Answers for question ${i + 1}">${opts.map((o, k) =>
          `<label class="option"><input type="radio" name="l${i}" value="${esc(o)}"${it.example ? " disabled" : ""}${it.example && o === it.answer ? " checked" : ""}><span>${String.fromCharCode(65 + k)}. ${esc(o)}</span></label>`).join("")}
        </div>`;
      box.appendChild(row);
    });
    setupPlayer(task);
    show("listening");
  }

  /* ---- audio: recorded mp3, with a browser-voice fallback for testing ---- */
  let audioEl = null, ttsActive = false;
  function stopAudio() {
    if (audioEl) { try { audioEl.pause(); } catch (e) {} }
    if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
    ttsActive = false;
  }
  function setupPlayer(task) {
    const L = S.listen, btn = $("#playBtn"), info = $("#replayInfo");
    let useTTS = false;
    $("#ttsNote").classList.add("hidden");
    audioEl = new Audio(task.audioSrc);
    audioEl.preload = "auto";
    audioEl.addEventListener("error", () => { useTTS = true; $("#ttsNote").classList.remove("hidden"); });
    info.textContent = `Press ▶ Play to listen. You can play it ${CONFIG.maxReplays + 1} times.`;
    btn.disabled = false;
    btn.onclick = () => {
      if (L.played >= CONFIG.maxReplays + 1) return;
      L.played++;
      if (!useTTS && audioEl) {
        try { audioEl.currentTime = 0; } catch (e) {}
        audioEl.play().catch(() => { useTTS = true; $("#ttsNote").classList.remove("hidden"); speakScript(task); });
      } else speakScript(task);
      const left = CONFIG.maxReplays + 1 - L.played;
      info.textContent = left > 0 ? `Plays left: ${left}` : "No plays left";
      if (left <= 0) btn.disabled = true;
    };
  }
  /* Browser-voice rendering of the script (testing only - replaced by the mp3s). */
  function pickVoices() {
    const vs = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => /en[-_]US/i.test(v.lang));
    const female = vs.find(v => /female|samantha|zira|aria|jenny|google us english/i.test(v.name)) || vs[0];
    const male = vs.find(v => /male|david|guy|davis|alex|fred/i.test(v.name) && v !== female) || vs[1] || vs[0];
    return { NARR: male, M: male, M2: male, W: female, W2: vs.find(v => v !== female && v !== male) || female };
  }
  const NUM_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six"];
  function speakScript(task) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel(); ttsActive = true;
    const V = pickVoices();
    const q = [{ who: "NARR", text: task.title + ". " + task.instruction }];
    task.items.forEach((it, i) => {
      q.push({ who: "NARR", text: NUM_WORDS[i + 1] + (it.example ? ". Example." : ".") });
      it.script.forEach(l => q.push(l));
    });
    q.forEach(l => {
      const u = new SpeechSynthesisUtterance(l.text);
      u.lang = "en-US"; u.rate = 0.95;
      u.voice = V[l.who] || null;
      u.pitch = l.who === "W2" ? 1.25 : l.who === "M2" ? 0.8 : 1;
      speechSynthesis.speak(u);
    });
  }

  $("#listenNext").addEventListener("click", e => {
    e.preventDefault();
    const L = S.listen, task = L.task;
    let correct = 0, total = 0;
    task.items.forEach((it, i) => {
      if (it.example) return;
      total++;
      const sel = document.querySelector(`#listenRows input[name="l${i}"]:checked`);
      const v = sel ? sel.value : "";
      const ok = v === it.answer;
      if (ok) correct++;
      L.perObj.push({ obj: it.obj, tier: L.tier, correct: ok });
    });
    if (L.played === 0) S.notPlayed++;
    stopAudio();
    const pct = Math.round(correct / total * 100);
    L.blocks.push({ tier: L.tier, correct, total, pct, seconds: Math.round((Date.now() - L.tStart) / 1000) });
    L.visited[L.tier] = pct;
    return finishListening();   // ONE exercise at the reading level (27 Sep 2026)
    /* previous 2-block staircase, kept for reference:
    const cur = L.tier;
    let next = pct >= CONFIG.masteryBar ? cur + 1 : pct >= 40 ? cur - 1 : cur - 2;
    next = clampT(next);
    if (next === cur || L.visited[next] != null) {
      const below = cur - 1;
      if (pct >= CONFIG.masteryBar && below >= 1 && L.visited[below] == null) next = below;
      else return finishListening();
    }
    L.tier = next; loadListening(); */
  });

  /* ability on the tier scale: 60% at tier t == t.0, 100% == t+1, 20% == t-1 */
  const abil = (t, p) => t + (Math.max(0, Math.min(100, p)) - 60) / 40;
  function finishListening() {
    const L = S.listen, b = L.blocks;
    let te = b.length > 1 ? 0.45 * abil(b[0].tier, b[0].pct) + 0.55 * abil(b[1].tier, b[1].pct) : abil(b[0].tier, b[0].pct);
    te = Math.max(1, Math.min(MAX_T + 0.99, te));
    const correct = b.reduce((a, x) => a + x.correct, 0), total = b.reduce((a, x) => a + x.total, 0);
    S.listening = { blocks: b, te, correct, total, pct: Math.round(correct / total * 100), perObj: L.perObj };
    computeProvisional();
    sendResult();
    renderResults();
  }

  /* =====================================================================
     RECEPTIVE PLACEMENT — Reading + Listening, equal weight (30/30)
     ===================================================================== */
  const SUBS = ["lower", "secure", "upper"];
  function computeProvisional() {
    const teR = S.reading.te, teL = S.listening.te;
    const te = Math.max(1, Math.min(MAX_T + 0.99, (teR + teL) / 2));
    const tier = Math.min(MAX_T, Math.floor(te));
    const pos = te - tier;
    S.prov = { tier, pos, sub: pos < 1 / 3 ? 0 : pos < 2 / 3 ? 1 : 2, te, teR, teL, gap: Math.abs(teR - teL) };
  }
  function sendResult() {
    const R = S.reading, Ls = S.listening, P = S.prov, T = TIERS[P.tier];
    const body = {
      attemptId: S.attemptId, student: TEST ? TEST_LABEL : S.student.name, enteredName: S.student.name,
      test: !!TEST, testDate: S.student.date, company: S.student.company, jobTitle: S.student.job,
      // v2 fields, unchanged meaning
      mcqScore: R.score, answered: R.answered, totalItems: READING.length,
      coverage: Math.round(R.coverage * 100) + "%", provisional: R.provisional,
      readingBand: "Business Result " + TIERS[R.tier].name,
      readingByLevel: R.profile.text, readingSecureUpTo: R.profile.secure,
      // v3 fields
      listeningScore: `${Ls.correct}/${Ls.total}`, listeningPct: Ls.pct,
      listeningBlocks: Ls.blocks.map(b => `T${b.tier}:${b.correct}/${b.total}`).join(" "),
      level: "Business Result " + T.name,
      cefrIndicative: R.provisional ? "WITHHELD \u2014 insufficient reading coverage" : T.cefr,
      placementBasis: "Reading + Listening (receptive), pending examiner confirmation",
      splitProbeRequired: !!T.probe, minutes: elapsedMin()
    };
    post(ONLINE.result, body)
      .then(() => { $("#saveStatus").innerHTML = '<div class="success-message">✅ Your reading and listening have been recorded.</div>'; })
      .catch(() => { $("#saveStatus").innerHTML = `<div class="warning-message">⚠️ Could not reach the server. Please tell your examiner: reading ${R.score}/${READING.length}, listening ${Ls.correct}/${Ls.total}.</div>`; });
  }
  function renderResults() {
    const R = S.reading, Ls = S.listening, P = S.prov, T = TIERS[P.tier];
    const first = S.student.name.split(/\s+/)[0];
    $("#resName").textContent = first ? ", " + first : "";
    $("#resReading").textContent = `${R.score}/${READING.length}`;
    $("#resListening").textContent = `${Ls.correct}/${Ls.total}`;
    const badge = $("#resBadge");
    if (R.provisional) {
      badge.textContent = `PROVISIONAL — only ${R.answered}/${READING.length} reading items attempted. Your examiner will confirm your level.`;
      badge.className = "performance-badge level-pre-intermediate";
    } else {
      badge.textContent = `Suggested course: Business Result ${T.name} · CEFR ${T.cefr} (indicative)`;
      badge.className = "performance-badge " + T.cls;
    }
    $("#resLadder").innerHTML = '<div class="ladder-title">Course \u2194 indicative CEFR \u2014 your suggested level</div>' +
      Object.keys(TIERS).map(k => {
        const t = TIERS[k], on = +k === P.tier && !R.provisional;
        return `<div class="ladder-row${on ? " active" : ""}"><span class="ladder-cefr">${t.cefr}</span><span class="ladder-name">${t.name}</span>${on ? '<span class="ladder-you">\u25c0 YOU</span>' : ""}</div>`;
      }).join("");
    setTab("writing"); $$(".skill-tab").forEach(t => t.classList.remove("active"));
    show("results");
  }
  $("#toWriting").addEventListener("click", goWriting);

  /* =====================================================================
     WRITING — task at the receptive tier
     ===================================================================== */
  function goWriting() {
    setTab("writing");
    const t = S.prov.tier, w = BANK[t].writing;
    S.writeTier = t;
    const T = TIERS[t], mins = [0, 10, 15, 20, 25, 30][t] || 20;
    $("#writeScorePill").textContent = `Your score: Reading ${S.reading.score}/${READING.length} · Listening ${S.listening.correct}/${S.listening.total}`;
    $("#writeLevel").textContent = `Business Result ${T.name} (CEFR ${T.cefr}, indicative)`;
    $("#writeInfoLength").textContent = `${w.words[0]}–${w.words[1]} words`;
    $("#writeInfoTime").textContent = `about ${mins} minutes`;
    $("#writeStarter").textContent = (w.starter || "").replace(/\n/g, " / ");
    $("#writeMeta").textContent = "Your task";
    $("#writeTask").textContent = w.task;
    $("#writeInstruction").textContent = w.instruction;
    $("#writePoints").innerHTML = w.points.map(p => `<li>${esc(p)}</li>`).join("");
    $("#writeArea").value = "";
    updateWords();
    show("writing");
  }
  function wordCount(s) { const t = String(s || "").trim(); return t ? t.split(/\s+/).length : 0; }
  function updateWords() {
    const n = wordCount($("#writeArea").value), w = BANK[S.writeTier].writing;
    const el = $("#wordCount");
    el.textContent = `${n} words (aim for ${w.words[0]}–${w.words[1]})`;
    el.classList.toggle("ok", n >= w.words[0]);
  }
  $("#writeArea").addEventListener("input", updateWords);
  $("#writeUpload").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0], pv = $("#uploadPreview");
    if (!f) { S.writingUpload = null; pv.innerHTML = ""; return; }
    S.writingUpload = { name: f.name, size: f.size, type: f.type || "", dataUrl: null };
    pv.innerHTML = `<span class="file-chip">📄 ${esc(f.name)} (${Math.max(1, Math.round(f.size / 1024))} KB)</span>`;
    if (f.size <= 8 * 1024 * 1024) {
      const rd = new FileReader();
      rd.onload = () => {
        S.writingUpload.dataUrl = rd.result;
        pv.innerHTML = /^image\//.test(f.type)
          ? `<img src="${rd.result}" alt="Uploaded handwriting" class="upload-thumb"><span class="file-chip">🖼️ ${esc(f.name)} — attached ✓</span>`
          : `<span class="file-chip">📄 ${esc(f.name)} — attached ✓</span>`;
      };
      rd.readAsDataURL(f);
    } else pv.innerHTML += `<div class="notice warn">This file is over 8 MB and cannot be sent. Please give it to your examiner.</div>`;
  });
  let writeConfirmed = false;
  $("#writeDone").addEventListener("click", e => {
    e.preventDefault();
    const w = BANK[S.writeTier].writing;
    let text = $("#writeArea").value.trim();
    if (text === (w.starter || "").trim()) text = "";
    const n = wordCount(text);
    if (!S.writingUpload && n < Math.round(w.words[0] * 0.5) && !writeConfirmed) {
      writeConfirmed = true;
      $("#writeWarn").innerHTML = `<div class="warning-message">Your answer is quite short (${n} words). Add more if you can, or press Finish again to continue.</div>`;
      return;
    }
    S.writingText = text;
    sendWriting();
    goSpeaking();
  });
  /* AI marking via n8n. Expected reply (optional):
     { ok:true, status:"marked", scores:[0-4 x4], total:0-16, feedback:"..." } */
  function sendWriting() {
    const P = S.prov, T = TIERS[S.writeTier], w = BANK[S.writeTier].writing;
    const body = {
      attemptId: S.attemptId, student: TEST ? TEST_LABEL : S.student.name, test: !!TEST,
      level: "Business Result " + T.name, cefr: T.cefr, tier: S.writeTier,
      task: w.task, instruction: w.instruction, contentPoints: w.points, targetWords: w.words,
      text: S.writingText, wordCount: wordCount(S.writingText),
      rubric: WRITING_RUBRIC.map(r => ({ criterion: r.c, focus: r.d })),
      scale: "Rate each criterion 0-4 AGAINST THE TASK LEVEL: " + BAND_WORDS.map((b, i) => i + "=" + b).join(", "),
      imageDataUrl: (S.writingUpload && S.writingUpload.dataUrl) || "",
      imageType: (S.writingUpload && S.writingUpload.type) || "", uploadName: (S.writingUpload && S.writingUpload.name) || ""
    };
    try {
      post(ONLINE.writing, body).then(r => r.json()).then(d => {
        if (d && d.ok) { S.aiWriting = d; if (!$("#screen-finish").classList.contains("hidden")) buildExaminerPanel(); }
      }).catch(() => {});
    } catch (e) {}
  }

  /* =====================================================================
     SPEAKING — live ElevenLabs examiner, adaptive
     The ladder is resolved HERE: the agent receives ready-made blocks
     (at level, stay, one up, one down) and only judges which block to use.
     Tier 1: the "up" block is the A1/A2 split probe.
     ===================================================================== */
  const numbered = arr => arr.map((q, i) => `${i + 1}) ${q}`).join("  ");
  function speakingBlocks(t) {
    const sp = BANK[t].speaking, up = Math.min(MAX_T, t + 1), down = Math.max(1, t - 1);
    const at = sp.prompts.slice(0, 3), stay = sp.prompts.slice(3);   // stay may be empty -> examiner uses follow-ups
    const fresh = arr => arr.filter(q => !at.includes(q) && !stay.includes(q));   // never repeat a question
    return {
      at, stay,
      up: t === 1 ? sp.probe : (t === MAX_T ? [] : fresh(BANK[up].speaking.prompts.slice(0, 3))),
      down: t === 1 ? [] : fresh(BANK[down].speaking.prompts.slice(0, 3)),
      upName: t === 1 ? "A1/A2 split probe" : TIERS[up].name, downName: t === 1 ? "none" : TIERS[down].name
    };
  }
  function goSpeaking() {
    setTab("speaking");
    S.speakTier = S.prov.tier;
    S.asked = []; $("#liveQuestions").innerHTML = ""; $("#liveWaiting").classList.remove("hidden");
    S.micTries = 0; const mn = $("#micNotice"); mn.classList.add("hidden"); mn.innerHTML = "";
    $("#micIssueBtn").disabled = false;
    const B = speakingBlocks(S.speakTier);
    $("#fallbackQuestions").innerHTML = B.at.concat(B.stay).map((q, i) => `<div class="speaking-question"><h4>Question ${i + 1}</h4><p>${esc(q)}</p></div>`).join("");
    show("speaking");
  }
  function renderLiveQuestion(text, number, level, prev) {
    const clean = String(text || "").trim();
    if (!clean || S.asked.some(q => q.text === clean)) return;
    const lv = Number(level) >= 1 && Number(level) <= MAX_T ? Number(level) : null;
    S.asked.push({ n: Number(number) || S.asked.length + 1, text: clean, level: lv, prev: String(prev || ""), at: new Date().toISOString() });
    $("#liveWaiting").classList.add("hidden");
    $$("#liveQuestions li.current").forEach(li => li.classList.remove("current"));
    const li = document.createElement("li"); li.className = "current"; li.textContent = clean;
    $("#liveQuestions").appendChild(li);
    try { li.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
  }
  $("#talkBtn").addEventListener("click", () => {
    const box = $("#avatarBox");
    if (S.convo) return;                      // a call is already running
    const t = S.speakTier, T = TIERS[t], B = speakingBlocks(t);
    const dv = {
      candidate_name: S.student.name || "there", attemptId: S.attemptId, test: TEST ? "yes" : "no",
      job_title: S.student.job || "", company: S.student.company || "",
      course: "Business Result " + T.name, cefr: T.cefr, descriptor: CEFR_DESCRIPTORS[T.anchor] || "",
      course_up: B.upName, course_down: B.downName,
      questions_at: numbered(B.at), questions_stay: B.stay.length ? numbered(B.stay) : "none",
      questions_up: B.up.length ? numbered(B.up) : "none", questions_down: B.down.length ? numbered(B.down) : "none",
      start_level: String(t),
      call_id: S.attemptId + "-" + Date.now()   // one ladder per examiner call (next_question service)
    };
    /* PER-ANSWER ADAPTIVE LADDER: all five levels, questions from the criteria document.
       The examiner starts at start_level and moves one level after each answer. */
    for (let L = 1; L <= MAX_T; L++) {
      const sp = BANK[L].speaking, TL = TIERS[L];
      dv["level_" + L] = `${TL.name} (CEFR ${TL.cefr}): ${CEFR_DESCRIPTORS[TL.anchor] || ""}`;
      dv["questions_" + L] = L === MAX_T
        ? "No separate questions. Ask a more demanding version of a level 3 or level 4 topic, or ask the candidate to justify, compare or evaluate something they said."
        : numbered(sp.prompts.concat(L === 1 && sp.probe ? sp.probe : []));
    }
    box.classList.remove("hidden");
    box.innerHTML = `<div class="call-status" id="callStatus">Connecting… allow the microphone if your browser asks.</div>
      <button type="button" class="secondary-button" id="endCallBtn">End the call</button>`;
    const btn = $("#talkBtn"), setCall = m => { const el = $("#callStatus"); if (el) el.textContent = m; };
    btn.disabled = true; btn.textContent = "🎙️ Connecting…";
    $("#endCallBtn").onclick = async () => { if (S.convo) { try { await S.convo.endSession(); } catch (e) {} } };
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const { Conversation } = await import("https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.25.0/+esm");
        S.convo = await Conversation.startSession({
          agentId: ONLINE.agentId, connectionType: "websocket", dynamicVariables: dv,
          clientTools: { display_question: ({ question, number, level, previous_answer }) => { renderLiveQuestion(question, number, level, previous_answer); return "shown"; } },
          onConnect: () => { setCall("Connected. The examiner will speak first — then answer naturally."); btn.textContent = "🎙️ In conversation"; },
          onModeChange: ({ mode }) => setCall(mode === "speaking" ? "🔊 The examiner is speaking…" : "🎙️ Your turn — speak now."),
          onDisconnect: () => {
            S.convo = null; btn.disabled = false; btn.textContent = "🎙️ Talk to the examiner again";
            setCall("The call has ended. If the examiner said goodbye, click “I have finished speaking” below.");
            const e = $("#endCallBtn"); if (e) e.remove();
          },
          onError: e => setCall("Connection problem: " + ((e && e.message) || e) + ". Press the button to try again, or use “My microphone isn't working”.")
        });
      } catch (e) {
        S.convo = null; btn.disabled = false; btn.textContent = "🎙️ Talk to the examiner";
        const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setCall(denied ? "The microphone is blocked. Click the 🎤 icon in the address bar, choose Allow, then press the button again."
                       : "Could not start the call (" + ((e && e.message) || e) + "). Check your internet connection and try again.");
      }
    })();
  });
  /* mic failure: 3 tries, then flag the attempt URGENT for a human examiner */
  $("#micIssueBtn").addEventListener("click", () => {
    S.micTries++;
    const box = $("#micNotice"); box.classList.remove("hidden");
    if (S.micTries < 3) {
      box.className = "notice warn";
      box.innerHTML = `Let's try again (try ${S.micTries} of 3). Click the 🎤 icon in your browser's address bar, choose <b>Allow</b>, then press <b>Talk to the examiner</b> again. Chrome or Edge work best.`;
      return;
    }
    box.className = "notice err";
    box.innerHTML = `⚠️ Your microphone is blocked. An examiner will contact you to do the speaking test. Please click <b>Submit</b> now.`;
    try { post(ONLINE.flag, { attemptId: S.attemptId, test: !!TEST, reason: "microphone blocked after 3 tries" }).catch(() => {}); } catch (e) {}
    S.micFlagged = true;
    if (S.convo) { try { S.convo.endSession(); } catch (_) {} S.convo = null; }
    const av = $("#avatarBox"); av.classList.add("hidden"); av.innerHTML = "";
    $("#speakDone").innerHTML = "<span>Submit →</span>"; $("#micIssueBtn").disabled = true;
  });

  /* fallback: in-browser recording of the at-level questions (v2 method) */
  let recognition = null, recognizing = false;
  $("#recordBtn").addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, btn = $("#recordBtn"), st = $("#recordStatus");
    if (!recognizing) {
      if (!SR) { typeFallback(); return; }
      recognition = new SR(); recognition.lang = "en-US"; recognition.continuous = true; recognition.interimResults = true;
      $("#transcriptWrap").classList.remove("hidden");
      recognition.onresult = e => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) S.fallbackTranscript += t + " "; else interim += t;
        }
        $("#transcript").textContent = (S.fallbackTranscript + interim).trim() || "Listening…";
      };
      recognition.onerror = e => { st.textContent = "⚠️ " + e.error; if (/not-allowed/.test(e.error)) typeFallback(); };
      recognition.onend = () => { if (recognizing) { try { recognition.start(); } catch (_) {} } };
      try { recognition.start(); } catch (_) {}
      recognizing = true; btn.textContent = "⏹️ Stop Recording"; btn.classList.add("recording");
      st.textContent = "🔴 Recording… answer each question aloud.";
    } else {
      recognizing = false; try { recognition.stop(); } catch (_) {}
      btn.textContent = "🎙️ Start Recording"; btn.classList.remove("recording");
      st.textContent = "✅ Stopped. Press again to add more.";
    }
  });
  function typeFallback() {
    const w = $("#transcriptWrap"); w.classList.remove("hidden");
    w.innerHTML = '<div class="notice warn">Voice transcription isn\'t available in this browser (use Chrome or Edge). You can type your answers instead.</div><textarea id="typeFallback" class="form-input" style="min-height:160px;font-family:inherit"></textarea>';
    $("#recordBtn").style.display = "none";
    $("#typeFallback").addEventListener("input", e => { S.fallbackTranscript = e.target.value; });
  }

  $("#speakDone").addEventListener("click", e => {
    e.preventDefault();
    if (S.convo) { try { S.convo.endSession(); } catch (_) {} S.convo = null; }
    if (recognizing) { recognizing = false; try { recognition.stop(); } catch (_) {} }
    const tr = (S.fallbackTranscript || "").trim();
    if (tr.length > 1) {
      const T = TIERS[S.speakTier];
      post(ONLINE.speaking, { attemptId: S.attemptId, student_name: TEST ? TEST_LABEL : S.student.name, test: !!TEST,
        level: "Business Result " + T.name, cefr: T.cefr, mode: "recorded-fallback", transcript: tr,
        rubric: SPEAKING_RUBRIC.map(r => ({ criterion: r.c, focus: r.d })) }).catch(() => {});
    }
    finishCandidate();
  });

  /* =====================================================================
     CANDIDATE RESULT (receptive only) + EXAMINER PANEL
     ===================================================================== */
  function finishCandidate() {
    if (S.timer) clearInterval(S.timer);
    setTab("done");
    const P = S.prov, T = TIERS[P.tier], first = S.student.name.split(/\s+/)[0];
    $("#candidateResult").innerHTML = `
      <div class="results-screen">
        <h2 class="score-message">Thank you${first ? ", " + esc(first) : ""}! 🎉</h2>
        <p class="subtitle">You have completed all four parts of the placement test.</p>
        <div class="score-grid">
          <div class="score-tile"><div class="v">${S.reading.score}/${READING.length}</div><div class="l">Reading &amp; grammar</div></div>
          <div class="score-tile"><div class="v">${S.listening.correct}/${S.listening.total}</div><div class="l">Listening</div></div>
        </div>
        <div class="performance-badge ${T.cls}">Suggested course: Business Result ${esc(T.name)} · CEFR ${T.cefr} (indicative)</div>
        <p class="subtitle" style="margin-top:12px">Your examiner will review your writing and speaking and confirm your course. You may close this window.</p>
        ${S.micFlagged ? '<div class="warning-message">An examiner will contact you to complete the speaking test.</div>' : ""}
      </div>`;
    buildExaminerPanel();
    show("finish");
    saveLocal();
  }

  /* rough typed-text suggestion when no AI mark has come back (0-4 x4) */
  function suggestWriting(text, tier) {
    const t = String(text || "").trim(); if (!t) return [0, 0, 0, 0];
    const w = BANK[tier].writing, n = wordCount(t);
    const words = t.toLowerCase().match(/[a-z']+/g) || [];
    const uniq = new Set(words).size, ttr = uniq / Math.max(1, words.length);
    const sents = t.split(/[.!?]+/).filter(s => s.trim().split(/\s+/).length >= 3).length;
    const links = ["because", "however", "although", "so", "therefore", "also", "first", "finally", "in addition", "as a result", "but", "while", "whereas"].filter(g => new RegExp("\\b" + g + "\\b", "i").test(t)).length;
    const c1 = n >= w.words[0] ? 3 : n >= w.words[0] * 0.7 ? 2 : n >= w.words[0] * 0.4 ? 1 : 0;
    const c2 = Math.min(3, (sents >= 3 ? 1 : 0) + (links >= 2 ? 1 : 0) + (/\n/.test(t) ? 1 : 0));
    const c3 = ttr >= 0.6 && uniq >= w.words[0] * 0.5 ? 3 : ttr >= 0.5 ? 2 : uniq >= 10 ? 1 : 0;
    return [c1, c2, c3, Math.min(2, c1)]; // accuracy cannot be judged automatically: capped at 2
  }
  function buildExaminerPanel() {
    const wt = S.writeTier, st = S.speakTier;
    $("#wLevel").textContent = `Writing — ${TIERS[wt].name} task: ${BANK[wt].writing.task}`;
    $("#sLevel").textContent = `Speaking — started at ${TIERS[st].name}`;
    const note = $("#writeAiNote"); note.classList.remove("hidden");
    if (S.aiWriting && Array.isArray(S.aiWriting.scores) && S.aiWriting.scores.length === 4) {
      S.teacher.writing = S.aiWriting.scores.map(v => Math.max(0, Math.min(4, +v || 0)));
      note.textContent = `🤖 AI marked this writing ${S.teacher.writing.reduce((a, b) => a + b, 0)}/16. ${String(S.aiWriting.feedback || "").slice(0, 280)} — check and adjust.`;
    } else if (S.writingText) {
      S.teacher.writing = suggestWriting(S.writingText, wt);
      note.textContent = "✨ Rough suggestion from the typed text (length, linking, range; accuracy capped at 2). No AI mark received yet — please rate every criterion yourself.";
    } else if (S.writingUpload) {
      S.teacher.writing = [null, null, null, null];
      note.textContent = "📎 Handwritten work uploaded — please read it and rate each criterion.";
    } else { S.teacher.writing = [0, 0, 0, 0]; note.textContent = "No writing was submitted."; }
    let html = S.writingText ? esc(S.writingText) : "";
    if (S.writingUpload) {
      if (S.writingUpload.dataUrl && /^image\//.test(S.writingUpload.type)) html += `<img src="${S.writingUpload.dataUrl}" class="upload-thumb" alt="Uploaded writing">`;
      html += `<div class="file-chip">📎 ${esc(S.writingUpload.name)}</div>`;
    }
    $("#writingResponse").innerHTML = html || "(no writing submitted)";
    $("#askedBox").innerHTML = S.asked.length
      ? "<strong>Questions the examiner asked:</strong><br>" + S.asked.map(q => `${q.n}. ${q.level ? "[L" + q.level + "] " : ""}${esc(q.text)}${q.prev && q.prev !== "none" ? " <em>(previous answer: " + esc(q.prev) + ")</em>" : ""}`).join("<br>") + `<br><em>Settled near: ${esc(askedLevel())}</em>`
      : (S.fallbackTranscript.trim() ? "<strong>Recorded answers (fallback):</strong><br>" + esc(S.fallbackTranscript) : (S.micFlagged ? "⚠️ Microphone blocked — speaking to be done with a human examiner." : "(no live questions were recorded — check the ElevenLabs conversation log)"));
    renderRubric("#writeRubric", WRITING_RUBRIC, "writing");
    renderRubric("#speakRubric", SPEAKING_RUBRIC, "speaking");
    $("#probeWrap").classList.toggle("hidden", !TIERS[S.prov.tier].probe);
    $("#probeRule").textContent = "Probe questions: " + BANK[1].speaking.probe.join(" / ");
  }
  function askedLevel() {
    const lv = S.asked.map(q => q.level).filter(Boolean);
    if (lv.length) return `${TIERS[lv[lv.length - 1]].name} (adaptive path ${lv.join(" → ")})`;
    let best = null, hits = 0;
    for (let t = 1; t <= MAX_T; t++) {
      const set = BANK[t].speaking.prompts.concat(BANK[t].speaking.probe || []);
      const h = S.asked.filter(q => set.includes(q.text)).length;
      if (h > hits) { hits = h; best = TIERS[t].name; }
    }
    return best || "unclear (questions reworded)";
  }
  function renderRubric(sel, rubric, key) {
    const tbl = $(sel);
    tbl.innerHTML = `<tr><th>Criterion</th><th>Rating (0–4)</th></tr>` + rubric.map((r, ri) => `
      <tr><td><strong>${r.c}</strong><div class="desc">${r.d}</div></td>
      <td><div class="pick">${[0, 1, 2, 3, 4].map(v => `<label title="${BAND_WORDS[v]}"><input type="radio" name="${key}-${ri}" value="${v}"${S.teacher[key][ri] === v ? " checked" : ""}>${v}</label>`).join("")}</div></td></tr>`).join("");
    tbl.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
      const [k, i] = inp.name.split("-"); S.teacher[k][+i] = +inp.value;
    }));
  }

  /* ---------------- final placement: productive confirmation ----------------
     Three-of-four rule per skill:
       below = 3+ criteria rated <=1 · above = 3+ criteria rated 4.
     Both below          -> down one band (Low confidence).
     One below           -> down one step within the band (x lower/secure/upper);
                            already "lower" -> flagged for re-test, band kept.
     One below, one above-> disagreement: band kept, re-test flagged.
     Both above          -> up ONE band maximum, examiner to confirm.
     Unrated             -> receptive placement stands, flagged.            */
  function verdict(arr) {
    if (arr.some(v => v == null)) return "unrated";
    if (arr.filter(v => v <= 1).length >= 3) return "below";
    if (arr.filter(v => v === 4).length >= 3) return "above";
    return "at";
  }
  function computeFinal() {
    const P = S.prov, flags = [];
    let tier = P.tier, sub = P.sub, conf = "High";
    const lower = c => { const o = ["High", "Medium", "Low"]; if (o.indexOf(c) > o.indexOf(conf)) conf = c; };
    const vW = verdict(S.teacher.writing), vS = verdict(S.teacher.speaking);
    if (vW === "unrated" || vS === "unrated") { flags.push(`${vW === "unrated" ? "Writing" : ""}${vW === "unrated" && vS === "unrated" ? " and " : ""}${vS === "unrated" ? "Speaking" : ""} not fully rated — placement rests on Reading + Listening only.`); lower("Medium"); }
    const below = [vW, vS].filter(v => v === "below").length, above = [vW, vS].filter(v => v === "above").length;
    if (below === 2) {
      if (tier > 1) { tier--; sub = 2; flags.push("Writing and Speaking both below the receptive level — placed one band lower."); }
      else flags.push("Writing and Speaking both below level at the lowest band — start with strong support.");
      lower("Low");
    } else if (below === 1 && above === 1) {
      flags.push("Writing and Speaking disagree by two steps (one below, one above) — re-test the weaker skill before confirming."); lower("Low");
    } else if (below === 1) {
      if (sub > 0) { sub--; flags.push(`${vW === "below" ? "Writing" : "Speaking"} below level — placed lower within the band.`); }
      else flags.push(`${vW === "below" ? "Writing" : "Speaking"} below level and already at the bottom of the band — re-test before confirming.`);
      lower("Medium");
    } else if (above === 2) {
      if (tier < MAX_T) { tier++; sub = 0; flags.push("Writing and Speaking both above level — raised ONE band on productive evidence. Examiner to confirm."); lower("Medium"); }
      else flags.push("Writing and Speaking above level at the top band — C1 claim should rest on the oral stage.");
    }
    if (P.gap >= 1.5) { flags.push(`Reading and Listening differ by ${P.gap.toFixed(1)} bands — targeted confirmation recommended.`); lower("Low"); }
    else if (P.gap >= 1) { flags.push("Noticeable Reading/Listening difference — verify with the candidate."); lower("Medium"); }
    if (S.reading.profile && S.reading.profile.uneven) { flags.push(`Uneven reading profile (${S.reading.profile.text}) — a higher level is much stronger than a lower one; possible guessing.`); lower("Medium"); }
    if (S.reading.provisional) { flags.push(`Only ${S.reading.answered}/${READING.length} reading items attempted (below 80%) — placement provisional.`); lower("Low"); }
    if (S.notPlayed) flags.push(`${S.notPlayed} listening exercise(s) submitted without pressing Play.`);
    if (S.micFlagged) { flags.push("Microphone blocked — speaking still to be done with a human examiner."); lower("Low"); }
    const probe = $("#probeResult").value;
    if (TIERS[tier].probe && !TIERS[S.speakTier].probe) {
      flags.push("Lowered into the 0\u201312 band by Writing/Speaking; the split probe was not administered \u2014 examiner to set Pre-elementary vs Elementary."); lower("Medium");
    } else if (TIERS[tier].probe) {
      if (!probe) { flags.push("A1/A2 split probe decision not entered."); lower("Medium"); }
      else if (probe === "Recheck") { flags.push("All probe answers fluent — re-check the written attempt for under-performance."); lower("Low"); }
    }
    if (tier === MAX_T) flags.push("Written C1 items test idiom and collocation only — confirm C1 from the speaking stage.");

    const pctOf = arr => arr.some(v => v == null) ? null : Math.round(arr.reduce((a, b) => a + b, 0) / 16 * 100);
    const Rp = Math.round(S.reading.score / READING.length * 100), Lp = S.listening.pct, Wp = pctOf(S.teacher.writing), Sp = pctOf(S.teacher.speaking);
    const W = CONFIG.weights;
    const weighted = (Wp == null || Sp == null) ? null : Math.round(Rp * W.reading + Lp * W.listening + Wp * W.writing + Sp * W.speaking);
    const po = S.listening.perObj;
    const T = TIERS[tier];
    S.final = {
      attemptId: S.attemptId, test: !!TEST, student: S.student, date: new Date().toISOString(),
      course: "Business Result " + T.name + (T.probe && (probe === "Pre-elementary" || probe === "Elementary") ? " → " + probe : ""),
      cefr: T.cefr, tier, position: SUBS[sub], receptiveTier: P.tier, confidence: conf, flags,
      scores: { reading: `${S.reading.score}/${READING.length}`, readingPct: Rp, listening: `${S.listening.correct}/${S.listening.total}`, listeningPct: Lp,
                writing: S.teacher.writing, writingPct: Wp, speaking: S.teacher.speaking, speakingPct: Sp, weighted },
      verdicts: { writing: vW, speaking: vS }, probe: probe || null,
      readingProfile: S.reading.profile, listeningBlocks: S.listening.blocks, readingTe: +P.teR.toFixed(2), listeningTe: +P.teL.toFixed(2),
      strengths: [...new Set(po.filter(o => o.correct).map(o => o.obj))], gaps: [...new Set(po.filter(o => !o.correct).map(o => o.obj))],
      writingTask: BANK[S.writeTier].writing.task, writingText: S.writingText, askedQuestions: S.asked,
      notes: $("#examinerNotes").value.trim()
    };
    return S.final;
  }
  $("#computeBtn").addEventListener("click", () => {
    const F = computeFinal(), T = TIERS[F.tier];
    const fmt = (arr, pct) => arr.some(v => v == null) ? "not rated" : `${arr.join(" · ")} = ${arr.reduce((a, b) => a + b, 0)}/16 (${pct}%)`;
    $("#reportRoot").innerHTML = `
      <div class="report">
        <h3>Final placement</h3>
        <div class="placement-hero">
          <div class="course-chip" style="background:${T.color}">${esc(F.course)}<br><span style="font-size:14px">CEFR ${T.cefr} (indicative) · ${F.position}</span></div>
          <div><div>Confidence: <span class="conf ${F.confidence}">${F.confidence}</span></div>
          <div class="subtitle" style="font-size:14px;margin-top:6px">Receptive placement: ${esc(TIERS[F.receptiveTier].name)} · Writing ${F.verdicts.writing} · Speaking ${F.verdicts.speaking}</div></div>
        </div>
        <h3>Scores</h3>
        <table class="kv">
          <tr><td>Reading &amp; grammar</td><td>${F.scores.reading} (${F.scores.readingPct}%) — band ${esc(TIERS[S.reading.tier].name)}</td></tr>
          <tr><td>Reading by level</td><td>${esc(S.reading.profile.text)} — secure up to <strong>${esc(S.reading.profile.secure)}</strong></td></tr>
          <tr><td>Listening</td><td>${F.scores.listening} (${F.scores.listeningPct}%) — ${F.listeningBlocks.map(b => `${esc(TIERS[b.tier].name)} ${b.correct}/${b.total}`).join(", ")}</td></tr>
          <tr><td>Writing (Task · Org · Range · Acc)</td><td>${fmt(F.scores.writing, F.scores.writingPct)}</td></tr>
          <tr><td>Speaking (Range · Acc · Flu · Int)</td><td>${fmt(F.scores.speaking, F.scores.speakingPct)}</td></tr>
          <tr><td>Weighted overall (30/30/20/20)</td><td>${F.scores.weighted == null ? "—" : F.scores.weighted + "%"}</td></tr>
        </table>
        <h3>Flags for the examiner</h3>
        ${F.flags.length ? `<ul class="flag-list">${F.flags.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "<p>None.</p>"}
        <h3>Listening objectives</h3>
        <p><strong>Secure:</strong> ${esc(F.strengths.join(", ") || "—")}<br><strong>To develop:</strong> ${esc(F.gaps.join(", ") || "—")}</p>
        ${F.notes ? `<h3>Examiner notes</h3><p>${esc(F.notes)}</p>` : ""}
        <p class="subtitle" style="font-size:12px;margin-top:16px">CEFR levels are indicative, aligned to OUP's published mapping for Business Result, not certified. Monglish International Academy · Edulixa.</p>
      </div>`;
    $("#reportActions").classList.remove("hidden");
    post(ONLINE.report, Object.assign({}, F, { student: TEST ? TEST_LABEL : S.student.name, enteredName: S.student.name, writingText: undefined })).catch(() => {});
    saveLocal();
  });
  $("#printBtn").addEventListener("click", () => window.print());
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(S.final || computeFinal(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `placement-${(S.student.name || "candidate").replace(/\s+/g, "_")}-${S.student.date}.json`; a.click();
  });
  $("#newBtn").addEventListener("click", () => { location.href = location.pathname + (TEST ? "?test=" + encodeURIComponent(TEST) : ""); });

  function saveLocal() {
    try {
      const all = JSON.parse(localStorage.getItem("brt_results") || "[]");
      const rec = { attemptId: S.attemptId, name: S.student.name, date: S.student.date, reading: S.reading && S.reading.score,
                    listening: S.listening && `${S.listening.correct}/${S.listening.total}`, provisional: S.prov && TIERS[S.prov.tier].name,
                    final: S.final && S.final.course };
      const i = all.findIndex(r => r.attemptId === S.attemptId);
      if (i >= 0) all[i] = rec; else all.push(rec);
      localStorage.setItem("brt_results", JSON.stringify(all.slice(-200)));
    } catch (e) {}
  }

  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
  init();
})();
