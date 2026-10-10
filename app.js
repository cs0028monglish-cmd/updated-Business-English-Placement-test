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
  /* v4 (10 Oct 2026) - Academic Team PDF "Oral & Writing Placement Test".
     Order (Dr. Abir, 10 Oct): Reading -> Listening -> WRITING (at the reading + listening level)
     -> SPEAKING last (starts at the R+L level, +/-1 from the writing mark; live adaptive examiner,
     or recorded answers to the questions for the candidate's level) -> thank-you + tips.
     The candidate never sees a score or a level; everything is recorded in n8n -> Excel. */
  const { CONFIG, TIERS, CEFR_DESCRIPTORS, BAND_WORDS, SPEAKING_RUBRIC, WRITING_RUBRIC, DECISION, BANK, READING } = window.BRT;
  const EXAMINER = (function () { try { const p = new URLSearchParams(location.search); return p.has("examiner"); } catch (e) { return false; } })();
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
    /* v4 (10 Oct 2026): STAGING services - workflow "Business English Placement v4 (STAGING)".
       The live v3 services (bus3-*) and the live examiner agent are not used by this build. */
    return {
      base,
      result:   base + "/webhook/bus4-result",    // reading + listening -> new row
      speaking: base + "/webhook/bus4-speaking",  // transcript of the live interview (sent by this page) -> AI marks 5 x 1-5 (/25)
      writing:  base + "/webhook/bus4-writing",   // AI marks 4 x 1-5 (/20) at the level the interview settled on
      next:     base + "/webhook/bus4-next",      // adaptive question service (peek = where the interview settled)
      flag:     base + "/webhook/bus4-flag",      // mic failure -> urgent row
      report:   base + "/webhook/bus4-report",    // optional examiner override (staff mode only)
      agentId:  "agent_5501m4jyqjdrf089yzbqm2y1ccrv"            // ElevenLabs "Business English Examiner v4 (STAGING)"
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
    turns: [], callId: "", convId: "", aiSpeaking: null, settled: null, clips: [], recQs: [],
    teacher: { writing: [null, null, null, null], speaking: [null, null, null, null, null] },
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
    try { if (new URLSearchParams(location.search).get("from") === "deck") $("#backLink").classList.remove("hidden"); } catch (e) {}
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
      splitProbeRequired: !!T.probe, minutes: elapsedMin(),
      receptiveTier: P.tier, readingTe: +P.teR.toFixed(2), listeningTe: +P.teL.toFixed(2), rlGap: +P.gap.toFixed(2),
      readingUneven: !!R.profile.uneven, listeningNotPlayed: S.notPlayed,
      listeningSecure: [...new Set(Ls.perObj.filter(o => o.correct).map(o => o.obj))].join(", "),
      listeningToDevelop: [...new Set(Ls.perObj.filter(o => !o.correct).map(o => o.obj))].join(", ")
    };
    /* candidate sees no score - only that the answers were saved */
    post(ONLINE.result, body)
      .then(() => { $("#saveStatus").innerHTML = '<div class="success-message">✅ Your reading and listening answers have been saved.</div>'; })
      .catch(() => { $("#saveStatus").innerHTML = '<div class="warning-message">⚠️ We could not reach the server. Please tell your examiner, then continue.</div>'; });
  }
  /* After listening: a short "well done" step. No score and no level are shown. */
  function renderResults() {
    const first = S.student.name.split(/\s+/)[0];
    $("#resName").textContent = first ? ", " + first : "";
    setTab("writing"); $$(".skill-tab").forEach(t => t.classList.remove("active"));
    show("results");
  }
  $("#toWriting").addEventListener("click", goWriting);

  /* =====================================================================
     WRITING (stage 3) - set at the reading + listening level. Its AI mark
     decides where the speaking interview starts (one level up or down).
     ===================================================================== */
  function goWriting() {
    const t = S.prov.tier, w = BANK[t].writing;
    S.writeTier = t; S.writeWhy = "reading + listening level";
    setTab("writing");
    $("#writeInfoLength").textContent = `${w.words[0]}–${w.words[1]} words`;
    $("#writeInfoTime").textContent = `${w.minutes || 15}–${(w.minutes || 15) + 5} minutes`;
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
  $("#writeDone").addEventListener("click", async e => {
    e.preventDefault();
    const btn = $("#writeDone");
    if (btn.disabled) return;
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
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Saving your writing…</span>';
    await Promise.race([sendWriting(), new Promise(res => setTimeout(res, 35000))]);
    btn.disabled = false; btn.innerHTML = "<span>Finish writing</span>";
    goSpeaking();
  });
  /* AI marking via n8n (4 criteria x 1-5 against the level, /20). */
  function sendWriting() {
    const T = TIERS[S.writeTier], w = BANK[S.writeTier].writing;
    const body = {
      attemptId: S.attemptId, student: TEST ? TEST_LABEL : S.student.name, test: !!TEST,
      level: "Business Result " + T.name, cefr: T.cefr, tier: S.writeTier, tierReason: S.writeWhy || "",
      receptiveTier: S.prov.tier,
      task: w.task, instruction: w.instruction, contentPoints: w.points, targetWords: w.words,
      grammarFocus: w.focus, targetStructures: (BANK[S.writeTier].speaking.grammar || []),
      text: S.writingText, wordCount: wordCount(S.writingText),
      rubric: WRITING_RUBRIC.map(r => ({ criterion: r.c, focus: r.d })),
      imageDataUrl: (S.writingUpload && S.writingUpload.dataUrl) || "",
      imageType: (S.writingUpload && S.writingUpload.type) || "", uploadName: (S.writingUpload && S.writingUpload.name) || ""
    };
    return post(ONLINE.writing, body).then(r => r.json()).then(d => { if (d && d.ok) S.aiWriting = d; return d; }).catch(() => null);
  }

  /* =====================================================================
     SPEAKING (last stage) - adaptive and scalable.
     Start level = reading + listening level, moved ONE level up or down by
     the writing mark (writing 18-20/20 -> up, 11 or less -> down).
     Live examiner: steps up or down after every answer (n8n bus4-next).
     Recorded option (voice not clear / mic trouble): the candidate records
     an answer to each question shown AT THEIR LEVEL; n8n transcribes the
     audio (ElevenLabs Scribe) and Claude marks it with the same rubric.
     ===================================================================== */
  const numbered = arr => arr.map((q, i) => `${i + 1}) ${q}`).join("  ");
  function levelQuestions(L) {
    const sp = BANK[L].speaking, p = sp.prompts.slice();
    if (L === 1 && sp.readAloud) return p.slice(0, 2).concat(sp.readAloud, p.slice(2));
    return p;
  }
  function recordedSet(L) {          // questions shown for the recorded option: one per topic set, 5 in all
    const sp = BANK[L].speaking;
    if (L === 1 && sp.readAloud) return [sp.sets[0].qs[0], sp.sets[1].qs[0]].concat(sp.readAloud);
    const out = [];
    for (let i = 0; out.length < 5; i++) { let added = false; sp.sets.forEach(s => { if (s.qs[i] && out.length < 5) { out.push(s.qs[i]); added = true; } }); if (!added) break; }
    return out;
  }
  function passageHtml() {
    const ps = BANK[1].speaking.passage || [];
    return `<div class="passage"><h4>📖 Read this text aloud</h4>${ps.map(p => `<p>${esc(p)}</p>`).join("")}</div>`;
  }
  function speakingStart() {
    let t = S.prov.tier, why = "reading + listening level";
    const tot = S.aiWriting && Number(S.aiWriting.total);
    if (tot && tot >= DECISION.writing.above[0] && t < MAX_T) { t++; why = "one level up - strong writing"; }
    else if (tot && tot <= DECISION.writing.below[1] && t > 1) { t--; why = "one level down - writing below level"; }
    return { t, why };
  }
  function goSpeaking() {
    setTab("speaking");
    const st = speakingStart(); S.speakTier = st.t; S.speakWhy = st.why;
    S.asked = []; S.turns = []; S.clips = [];
    $("#liveQuestions").innerHTML = ""; $("#liveWaiting").classList.remove("hidden");
    const pb = $("#passageBox"); pb.classList.add("hidden"); pb.innerHTML = "";
    S.micTries = 0; const mn = $("#micNotice"); mn.classList.add("hidden"); mn.innerHTML = "";
    $("#micIssueBtn").disabled = false;
    S.recQs = recordedSet(S.speakTier);
    $("#recordList").innerHTML = S.recQs.map((q, i) => `
      <div class="rec-q" data-i="${i}">
        <div class="rec-head"><span class="num">${i + 1}</span><span class="stem">${esc(q)}</span></div>
        ${/text on your screen/i.test(q) ? passageHtml() : ""}
        <div class="rec-ctrl">
          <button type="button" class="record-btn rec-btn" data-i="${i}">🎙️ Record answer</button>
          <span class="rec-status" id="recStatus${i}"></span>
          <audio class="rec-audio hidden" id="recAudio${i}" controls></audio>
        </div>
      </div>`).join("");
    $$("#recordList .rec-btn").forEach(b => b.addEventListener("click", () => toggleClip(+b.dataset.i, b)));
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
    if (/text on your screen/i.test(clean)) { const pb = $("#passageBox"); pb.innerHTML = passageHtml(); pb.classList.remove("hidden"); }
    try { li.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
  }

  /* ---- recorded answers (MediaRecorder, max 2 minutes per answer) ---- */
  let rec = null, recChunks = [], recIdx = -1, recTimer = null;
  async function toggleClip(i, btn) {
    if (rec && rec.state === "recording") {
      const was = recIdx; rec.stop();
      if (was !== i) return;            // pressing another question's button just stops the current one
      return;
    }
    if (S.convo) { try { await S.convo.endSession(); } catch (_) {} }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { $("#recStatus" + i).textContent = "⚠️ The microphone is blocked. Click the 🎤 icon in the address bar and choose Allow."; return; }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    recChunks = []; recIdx = i;
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) recChunks.push(ev.data); };
    rec.onstop = () => {
      clearTimeout(recTimer); stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recChunks, { type: rec.mimeType || "audio/webm" });
      const fr = new FileReader();
      fr.onload = () => {
        S.clips[i] = { n: i + 1, question: S.recQs[i], level: S.speakTier, audioDataUrl: fr.result, seconds: Math.round(blob.size / 4000) };
        const a = $("#recAudio" + i); a.src = URL.createObjectURL(blob); a.classList.remove("hidden");
        $("#recStatus" + i).textContent = "✅ Saved — you can listen, or record again.";
      };
      fr.readAsDataURL(blob);
      btn.textContent = "🎙️ Record again"; btn.classList.remove("recording"); recIdx = -1;
    };
    rec.start(1000);
    btn.textContent = "⏹️ Stop"; btn.classList.add("recording");
    $("#recStatus" + i).textContent = "🔴 Recording… answer the question, then press Stop.";
    recTimer = setTimeout(() => { if (rec && rec.state === "recording") rec.stop(); }, 120000);
  }

  /* The page sends the speaking evidence itself: live transcript, or recorded clips. */
  function sendSpeaking() {
    const live = S.turns.filter(t => String(t.message || "").trim());
    const clips = (S.clips || []).filter(Boolean);
    if (!live.length && !clips.length) return Promise.resolve(null);
    const T = TIERS[S.speakTier], useClips = clips.length > 0 && live.filter(t => t.role === "user").length < 3;
    const body = {
      attemptId: S.attemptId, student: TEST ? TEST_LABEL : S.student.name, enteredName: S.student.name, test: !!TEST,
      mode: useClips ? "recorded-answers" : "live-examiner", call_id: useClips ? "" : S.callId, conversationId: S.convId,
      receptiveTier: S.prov.tier, startLevel: S.speakTier, startReason: S.speakWhy || "", course: "Business Result " + T.name, cefr: T.cefr,
      turns: useClips ? [] : live, asked: useClips ? clips.map(c => ({ n: c.n, level: c.level, text: c.question })) : S.asked,
      clips: useClips ? clips.map(c => ({ n: c.n, question: c.question, level: c.level, audioDataUrl: c.audioDataUrl })) : []
    };
    S.speakingPromise = post(ONLINE.speaking, body).then(r => r.json())
      .then(d => { if (d && d.ok) { S.aiSpeaking = d; if (d.settledLevel) S.settled = Number(d.settledLevel); } return d; })
      .catch(() => null);
    return S.speakingPromise;
  }
  $("#talkBtn").addEventListener("click", () => {
    const box = $("#avatarBox");
    if (S.convo) return;
    const t = S.speakTier, T = TIERS[t];
    if (!S.callId) S.callId = S.attemptId + "-" + Date.now();   // ONE ladder per attempt, kept across reconnects
    const dv = {
      candidate_name: S.student.name || "there", attemptId: S.attemptId, test: TEST ? "yes" : "no",
      job_title: S.student.job || "", company: S.student.company || "",
      course: "Business Result " + T.name, cefr: T.cefr, descriptor: CEFR_DESCRIPTORS[T.anchor] || "",
      start_level: String(t), call_id: S.callId
    };
    for (let L = 1; L <= MAX_T; L++) {
      const sp = BANK[L].speaking, TL = TIERS[L];
      dv["level_" + L] = `${TL.name} (CEFR ${TL.cefr}). Grammar focus: ${(sp.grammar || []).join("; ")}`;
      dv["questions_" + L] = numbered(levelQuestions(L));
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
          onMessage: m => {
            const msg = m && (m.message || m.text);
            if (!msg) return;
            const role = m.role ? (m.role === "agent" ? "agent" : "user") : (m.source === "ai" ? "agent" : "user");
            S.turns.push({ role, message: String(msg), at: new Date().toISOString() });
          },
          onConnect: () => { setCall("Connected. The examiner will speak first — then answer naturally."); btn.textContent = "🎙️ In conversation"; },
          onModeChange: ({ mode }) => setCall(mode === "speaking" ? "🔊 The examiner is speaking…" : "🎙️ Your turn — speak now."),
          onDisconnect: () => {
            S.convo = null; btn.disabled = false; btn.textContent = "🎙️ Talk to the examiner again";
            setCall("The call has ended. If the examiner said goodbye, click “Finish the test” below.");
            const e = $("#endCallBtn"); if (e) e.remove();
          },
          onError: e => setCall("Connection problem: " + ((e && e.message) || e) + ". Try again, or record your answers below.")
        });
        try { S.convId = (S.convo.getId && S.convo.getId()) || S.convId; } catch (e) {}
      } catch (e) {
        S.convo = null; btn.disabled = false; btn.textContent = "🎙️ Talk to the examiner";
        const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setCall(denied ? "The microphone is blocked. Click the 🎤 icon in the address bar, choose Allow, then press the button again."
                       : "Could not start the call (" + ((e && e.message) || e) + "). You can record your answers below instead.");
      }
    })();
  });
  /* mic failure: 3 tries, then flag the attempt URGENT for a human examiner */
  $("#micIssueBtn").addEventListener("click", () => {
    S.micTries++;
    const box = $("#micNotice"); box.classList.remove("hidden");
    if (S.micTries < 3) {
      box.className = "notice warn";
      box.innerHTML = `Let's try again (try ${S.micTries} of 3). Click the 🎤 icon in your browser's address bar, choose <b>Allow</b>, then try the examiner or the recorded answers again. Chrome or Edge work best.`;
      return;
    }
    box.className = "notice err";
    box.innerHTML = `⚠️ Your microphone is blocked. An examiner will contact you to do the speaking test. Please click <b>Finish the test</b> now.`;
    try { post(ONLINE.flag, { attemptId: S.attemptId, test: !!TEST, reason: "microphone blocked after 3 tries" }).catch(() => {}); } catch (e) {}
    S.micFlagged = true;
    if (S.convo) { try { S.convo.endSession(); } catch (_) {} S.convo = null; }
    const av = $("#avatarBox"); av.classList.add("hidden"); av.innerHTML = "";
    $("#micIssueBtn").disabled = true;
  });

  let finishConfirmed = false;
  $("#speakDone").addEventListener("click", async e => {
    e.preventDefault();
    const btn = $("#speakDone");
    if (btn.disabled) return;
    if (rec && rec.state === "recording") rec.stop();
    const liveAnswers = S.turns.filter(t => t.role === "user").length, clips = (S.clips || []).filter(Boolean).length;
    if (!liveAnswers && !clips && !S.micFlagged && !finishConfirmed) {
      finishConfirmed = true;
      $("#speakStatus").innerHTML = '<div class="warning-message">You have not answered any speaking questions yet. Talk to the examiner, or record your answers below. Press Finish again to end the test without speaking.</div>';
      return;
    }
    if (clips && clips < S.recQs.length && !liveAnswers && !finishConfirmed) {
      finishConfirmed = true;
      $("#speakStatus").innerHTML = `<div class="warning-message">You have recorded ${clips} of ${S.recQs.length} answers. Record the others if you can, or press Finish again to send what you have.</div>`;
      return;
    }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Sending your answers…</span>';
    if (S.convo) { try { await S.convo.endSession(); } catch (_) {} S.convo = null; }
    await new Promise(r => setTimeout(r, 400));
    await Promise.race([sendSpeaking(), new Promise(res => setTimeout(res, 90000))]);
    btn.disabled = false; btn.innerHTML = "<span>Finish the test</span>";
    finishCandidate();
  });

  /* =====================================================================
     THANK-YOU + TIPS (no score, no level) + examiner panel (staff mode only)
     ===================================================================== */
  const GENERIC_TIPS = {
    reading: "Read one short business text every day (an email, a news item or a report) and note five useful phrases from it.",
    listening: "Listen to short business audio, such as podcasts, phone calls or meetings, two or three times, and write down the key details you hear.",
    speaking: "Practise answering questions about your job and your company aloud for two minutes, then record yourself and listen back.",
    writing: "Plan before you write: list your main points, put them in order, and check your grammar and spelling at the end."
  };
  function tipList() {
    const tips = [];
    const add = (skill, arr) => (Array.isArray(arr) ? arr : []).filter(Boolean).slice(0, 2).forEach(t => tips.push({ skill, t: String(t) }));
    add("Speaking", S.aiSpeaking && S.aiSpeaking.tips);
    if (!tips.some(x => x.skill === "Speaking")) tips.push({ skill: "Speaking", t: GENERIC_TIPS.speaking });
    add("Writing", S.aiWriting && S.aiWriting.tips);
    if (!tips.some(x => x.skill === "Writing")) tips.push({ skill: "Writing", t: GENERIC_TIPS.writing });
    const gaps = [...new Set((S.listening ? S.listening.perObj : []).filter(o => !o.correct).map(o => o.obj.replace(/\s*\(.*\)$/, "")))];
    tips.push({ skill: "Listening", t: gaps.length ? `When you listen, focus on ${gaps.slice(0, 3).join(", ")}. ${GENERIC_TIPS.listening}` : GENERIC_TIPS.listening });
    tips.push({ skill: "Reading", t: GENERIC_TIPS.reading });
    return tips;
  }
  function finishCandidate() {
    if (S.timer) clearInterval(S.timer);
    setTab("done");
    const first = S.student.name.split(/\s+/)[0];
    $("#candidateResult").innerHTML = `
      <div class="results-screen">
        <h2 class="score-message">Thank you${first ? ", " + esc(first) : ""}! 🎉</h2>
        <p class="subtitle">You have completed all four parts of the placement test. Your answers have been sent to our Academic Team, who will contact you about your course.</p>
        ${S.micFlagged ? '<div class="warning-message">An examiner will contact you to complete the speaking part.</div>' : ""}
        <div class="tips-box">
          <h3>Tips to keep improving</h3>
          <ul class="tips-list">${tipList().map(x => `<li><span class="tip-skill">${esc(x.skill)}</span><span>${esc(x.t)}</span></li>`).join("")}</ul>
        </div>
        <p class="subtitle" style="margin-top:12px">You may now close this window.</p>
      </div>`;
    const panel = $("#examinerPanel");
    if (EXAMINER) { panel.classList.remove("hidden"); buildExaminerPanel(); } else { panel.classList.add("hidden"); panel.innerHTML = ""; }
    show("finish");
    saveLocal();
  }

  /* ---------------- decision rule (PDF page 9) - mirrors n8n "Compute Final" ----------------
     Speaking /25 at the level tested: 22-25 above -> one level up (examiner to confirm)
     18-21 place (no criterion below 3) · 14-17 borderline -> the writing decides
     13 or less -> one level lower. Writing /20: 18-20 above · 12-17 confirms · 11 or less below.
     Approved model (27 Sep): productive skills may raise the reading + listening level by ONE at most. */
  function decide(o) {
    const D = DECISION, flags = [];
    let conf = "High";
    const lower = c => { const ord = ["High", "Medium", "Low"]; if (ord.indexOf(c) > ord.indexOf(conf)) conf = c; };
    const sum = a => a.reduce((x, y) => x + y, 0);
    const L = o.spLevel || o.recTier;
    let final = L, spBand = "missing", wrBand = "missing";
    const spOk = Array.isArray(o.sp) && o.sp.length === 5 && o.sp.every(v => v >= 1);
    const wrOk = Array.isArray(o.wr) && o.wr.length === 4 && o.wr.every(v => v >= 1);
    if (spOk) {
      const t = sum(o.sp), mn = Math.min(...o.sp);
      spBand = t >= D.speaking.above[0] ? "above" : t >= D.speaking.place[0] ? (mn >= D.speaking.minCriterionToPlace ? "place" : "borderline")
             : t >= D.speaking.borderline[0] ? "borderline" : "below";
    }
    if (wrOk) {
      const t = sum(o.wr);
      wrBand = t >= D.writing.above[0] ? "above" : t >= D.writing.confirm[0] ? "confirm" : "below";
      if (o.wrTier && o.wrTier !== L) flags.push(`Writing was set at level ${o.wrTier}; the interview settled at level ${L}.`);
    }
    if (spBand === "missing") { final = o.recTier; flags.push("No speaking evidence - placement rests on reading + listening; speaking to be done with an examiner."); lower("Low"); }
    else if (spBand === "above") {
      if (wrBand === "below") { final = L; flags.push("Speaking above level but writing below - kept at the level tested."); lower("Medium"); }
      else if (L < MAX_T) { final = L + 1; flags.push("Speaking 22-25 at the level tested - placed one level up; examiner to confirm."); lower("Medium"); }
      else final = L;
    } else if (spBand === "place") {
      final = L;
      if (wrBand === "below") { flags.push("Writing below the placed level - examiner to review."); lower("Medium"); }
      if (wrBand === "missing") { flags.push("No writing submitted."); lower("Medium"); }
    } else if (spBand === "borderline") {
      lower("Medium");
      if (wrBand === "below") { final = Math.max(1, L - 1); flags.push("Borderline speaking and writing below level - placed one level lower."); }
      else if (wrBand === "missing") { final = L; flags.push("Borderline speaking and no writing to decide - examiner to decide."); lower("Low"); }
      else { final = L; flags.push("Borderline speaking - the writing task confirmed the level."); }
    } else {
      final = Math.max(1, L - 1); flags.push("Speaking 13 or less at the level tested - placed one level lower.");
      if (wrBand === "above" || wrBand === "confirm") { flags.push("Writing was at or above level - examiner to check."); lower("Medium"); }
    }
    if (final > o.recTier + 1) { flags.push(`Interview evidence suggests level ${final}; capped at one above reading + listening (level ${o.recTier + 1}) - examiner to confirm.`); final = o.recTier + 1; lower("Medium"); }
    if (o.gap >= 1.5) { flags.push("Reading and listening differ by 1.5 levels or more."); lower("Low"); }
    else if (o.gap >= 1) { flags.push("Noticeable reading/listening difference."); lower("Medium"); }
    if (o.uneven) { flags.push("Uneven reading profile - possible guessing."); lower("Medium"); }
    if (o.provisional) { flags.push("Reading coverage below 80% - provisional."); lower("Low"); }
    if (o.micFlagged) { flags.push("URGENT: microphone blocked."); lower("Low"); }
    if (spOk) flags.push("Pronunciation estimated by AI from the transcript - examiner to confirm.");
    return { final, spBand, wrBand, confidence: conf, flags, spTotal: spOk ? sum(o.sp) : null, wrTotal: wrOk ? sum(o.wr) : null };
  }

  function buildExaminerPanel() {
    const panel = $("#examinerPanel");
    const spLv = S.settled || (S.aiSpeaking && S.aiSpeaking.settledLevel) || S.writeTier || S.prov.tier;
    $("#wLevel").textContent = `Writing — level ${S.writeTier} ${TIERS[S.writeTier].name} task: ${BANK[S.writeTier].writing.task} (${S.writeWhy || ""})`;
    $("#sLevel").textContent = `Speaking — started at level ${S.speakTier} ${TIERS[S.speakTier].name}; settled at level ${spLv}`;
    const clamp5 = v => Math.max(1, Math.min(5, Math.round(+v || 1)));
    S.teacher.writing = (S.aiWriting && Array.isArray(S.aiWriting.scores) && S.aiWriting.scores.length === 4) ? S.aiWriting.scores.map(clamp5) : [null, null, null, null];
    S.teacher.speaking = (S.aiSpeaking && Array.isArray(S.aiSpeaking.scores) && S.aiSpeaking.scores.length === 5) ? S.aiSpeaking.scores.map(clamp5) : [null, null, null, null, null];
    const note = $("#writeAiNote"); note.classList.remove("hidden");
    note.textContent = S.aiWriting ? `🤖 AI: ${S.aiWriting.total}/20 — ${String(S.aiWriting.feedback || "").slice(0, 300)}` : "No AI writing mark received — rate each criterion yourself.";
    let html = S.writingText ? esc(S.writingText) : "";
    if (S.writingUpload) {
      if (S.writingUpload.dataUrl && /^image\//.test(S.writingUpload.type)) html += `<img src="${S.writingUpload.dataUrl}" class="upload-thumb" alt="Uploaded writing">`;
      html += `<div class="file-chip">📎 ${esc(S.writingUpload.name)}</div>`;
    }
    $("#writingResponse").innerHTML = html || "(no writing submitted)";
    $("#askedBox").innerHTML = (S.aiSpeaking ? `<strong>🤖 AI: ${S.aiSpeaking.total}/25</strong> — ${esc(String(S.aiSpeaking.feedback || "").slice(0, 300))}<br>` : "")
      + (S.asked.length ? "<strong>Questions asked:</strong><br>" + S.asked.map(q => `${q.n}. ${q.level ? "[L" + q.level + "] " : ""}${esc(q.text)}`).join("<br>")
         : (S.micFlagged ? "⚠️ Microphone blocked — speaking to be done with a human examiner." : "(no live questions recorded)"));
    renderRubric("#writeRubric", WRITING_RUBRIC, "writing");
    renderRubric("#speakRubric", SPEAKING_RUBRIC, "speaking");
  }
  function renderRubric(sel, rubric, key) {
    const tbl = $(sel);
    tbl.innerHTML = `<tr><th>Criterion</th><th>Score (1–5)</th></tr>` + rubric.map((r, ri) => `
      <tr><td><strong>${r.c}</strong><div class="desc">${r.d}</div></td>
      <td><div class="pick">${[1, 2, 3, 4, 5].map(v => `<label title="${BAND_WORDS[v]}"><input type="radio" name="${key}-${ri}" value="${v}"${S.teacher[key][ri] === v ? " checked" : ""}>${v}</label>`).join("")}</div></td></tr>`).join("");
    tbl.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
      const [k, i] = inp.name.split("-"); S.teacher[k][+i] = +inp.value;
    }));
  }
  function computeFinal() {
    const spLv = S.settled || (S.aiSpeaking && S.aiSpeaking.settledLevel) || S.writeTier || S.prov.tier;
    const r = decide({ recTier: S.prov.tier, spLevel: +spLv, sp: S.teacher.speaking.some(v => v == null) ? null : S.teacher.speaking,
      wrTier: S.writeTier, wr: S.teacher.writing.some(v => v == null) ? null : S.teacher.writing,
      provisional: S.reading.provisional, gap: S.prov.gap, uneven: S.reading.profile.uneven, micFlagged: S.micFlagged });
    const T = TIERS[r.final];
    S.final = {
      attemptId: S.attemptId, test: !!TEST, student: S.student, date: new Date().toISOString(),
      course: "Business Result " + T.name, cefr: T.cefr, tier: r.final, receptiveTier: S.prov.tier, speakingLevel: +spLv,
      confidence: r.confidence, flags: r.flags, speakingBand: r.spBand, writingBand: r.wrBand,
      scores: { reading: `${S.reading.score}/${READING.length}`, listening: `${S.listening.correct}/${S.listening.total}`,
                writing: S.teacher.writing, writingTotal: r.wrTotal, speaking: S.teacher.speaking, speakingTotal: r.spTotal },
      notes: $("#examinerNotes").value.trim()
    };
    return S.final;
  }
  $("#computeBtn").addEventListener("click", () => {
    const F = computeFinal(), T = TIERS[F.tier];
    const fmt = (arr, max) => arr.some(v => v == null) ? "not rated" : `${arr.join(" · ")} = ${arr.reduce((a, b) => a + b, 0)}/${max}`;
    $("#reportRoot").innerHTML = `
      <div class="report">
        <h3>Final placement (examiner)</h3>
        <div class="placement-hero">
          <div class="course-chip" style="background:${T.color}">${esc(F.course)}<br><span style="font-size:14px">CEFR ${T.cefr} (indicative)</span></div>
          <div><div>Confidence: <span class="conf ${F.confidence}">${F.confidence}</span></div>
          <div class="subtitle" style="font-size:14px;margin-top:6px">Reading + listening: level ${F.receptiveTier} · Interview settled: level ${F.speakingLevel} · Speaking ${F.speakingBand} · Writing ${F.writingBand}</div></div>
        </div>
        <table class="kv">
          <tr><td>Reading &amp; grammar</td><td>${F.scores.reading} — by level: ${esc(S.reading.profile.text)}</td></tr>
          <tr><td>Listening</td><td>${F.scores.listening}</td></tr>
          <tr><td>Speaking (Flu · Gram · Voc · Pron · Int)</td><td>${fmt(F.scores.speaking, 25)}</td></tr>
          <tr><td>Writing (Task · Struct · Coh · Voc)</td><td>${fmt(F.scores.writing, 20)}</td></tr>
        </table>
        <h3>Flags</h3>
        ${F.flags.length ? `<ul class="flag-list">${F.flags.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "<p>None.</p>"}
        ${F.notes ? `<h3>Examiner notes</h3><p>${esc(F.notes)}</p>` : ""}
      </div>`;
    $("#reportActions").classList.remove("hidden");
    post(ONLINE.report, Object.assign({}, F, { student: TEST ? TEST_LABEL : S.student.name, enteredName: S.student.name })).catch(() => {});
    saveLocal();
  });
  $("#printBtn").addEventListener("click", () => window.print());
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(S.final || computeFinal(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `placement-${(S.student.name || "candidate").replace(/\s+/g, "_")}-${S.student.date}.json`; a.click();
  });
  $("#newBtn").addEventListener("click", () => { location.href = location.pathname + location.search; });

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
