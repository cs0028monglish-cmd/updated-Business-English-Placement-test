/* =====================================================================
   Business Result Placement Test v3 — QUESTION BANK + CONFIG
   ---------------------------------------------------------------------
   Edit content here; app.js holds the engine and should not need changing.

   READING  : 30 items - six per CEFR level (A1..C1) - chosen from the approved 60-item
              v2 paper (items verbatim; `src` = original number). Linear, easiest first.
   LISTENING: ORIGINAL business scripts, one exercise per tier (6 items,
              item 1 is the worked example and is not scored -> /5).
              Audio: audio/listen-N.mp3 (ElevenLabs, American voices).
              If an mp3 is missing the app reads the script with the
              browser's en-US voice so the test still runs (testing only).
   WRITING  : one task per tier, chosen from the receptive placement.
   SPEAKING : questions per tier; the live examiner gets three blocks
              (at level, one up, one down) - resolved in app.js.
   Tier 1..5 = the five Option B bands.
   Content for tiers 1-4 is written from business/content (Monglish syllabi
   and club layouts) - see CONTENT-ALIGNMENT.md.
   ===================================================================== */

const CONFIG = {
  weights:      { listening: 0.30, reading: 0.30, writing: 0.20, speaking: 0.20 },
  minCoverage:  0.80,      // reading: below 24/30 attempted -> PROVISIONAL
  masteryBar:   60,        // listening block "secure" at >= 3/5
  maxReplays:   2,         // 1 play + 2 replays
  requirePassword: false,  // single-use exam-password gate (list kept in app.js)
  rubricMax:    4          // productive rubric: 0-4 per criterion, 4 criteria -> /16
};

/* Reading raw score (out of 30) -> tier. Option B bands (19 Sep 2026) halved for the 30-item paper (27 Sep 2026):
   0-6 / 7-13 / 14-20 / 21-27 / 28-30. Six items per level, so a secure B1 candidate (A1+A2 + ~4 of 6 B1) scores ~16. */
const TIERS = {
  1:{ name:"Pre-elementary / Elementary", cefr:"A1\u2192A2", anchor:"A1", min:0,  max:6,  cls:"level-elementary",         color:"#5b4bd6", probe:true },
  2:{ name:"Pre-intermediate",            cefr:"A2",        anchor:"A2", min:7,  max:13, cls:"level-pre-intermediate",   color:"#c23b5c" },
  3:{ name:"Intermediate",                cefr:"B1",        anchor:"B1", min:14, max:20, cls:"level-intermediate",       color:"#b4540a" },
  4:{ name:"Upper-intermediate",          cefr:"B2",        anchor:"B2", min:21, max:27, cls:"level-upper-intermediate", color:"#1f6fa8" },
  5:{ name:"Advanced",                    cefr:"C1",        anchor:"C1", min:28, max:30, cls:"level-advanced",           color:"#0f695c" }
};

/* CEFR Spoken Production self-assessment descriptors (reference for the examiner). */
const CEFR_DESCRIPTORS = {
  A1:"I can use simple phrases and sentences to describe where I live and people I know.",
  A2:"I can use a series of phrases and sentences to describe in simple terms my family and other people, living conditions, my educational background and my present or most recent job.",
  B1:"I can connect phrases in a simple way in order to describe experiences and events, my dreams, hopes and ambitions. I can briefly give reasons and explanations for opinions and plans.",
  B2:"I can present clear, detailed descriptions on a wide range of subjects related to my field of interest. I can explain a viewpoint on a topical issue giving the advantages and disadvantages of various options.",
  C1:"I can present clear, detailed descriptions of complex subjects integrating sub-themes, developing particular points and rounding off with an appropriate conclusion."
};

/* PRODUCTIVE RUBRICS — each criterion is rated AGAINST THE TASK LEVEL.
   0 = no evidence · 1 = clearly below level · 2 = borderline
   3 = secure at level · 4 = above level.
   Three-of-four rule (app.js): a skill is "below" when 3+ criteria are <=1,
   "above" when 3+ criteria are 4. NOTE: this is the rubric proposed in the
   CEFR Alignment Proposal and is still awaiting Dr. Abir's approval. */
const BAND_WORDS = ["No evidence","Below level","Borderline","Secure at level","Above level"];
const SPEAKING_RUBRIC = [
  { c:"Range",                 d:"Vocabulary and structures for the task level" },
  { c:"Accuracy",              d:"Control of grammar; errors do not block meaning" },
  { c:"Fluency & coherence",   d:"Extended turns, linking, manageable hesitation" },
  { c:"Interaction & task",    d:"Answers the question asked, develops it, responds to follow-ups" }
];
const WRITING_RUBRIC = [
  { c:"Task achievement",      d:"All content points covered; right length and purpose" },
  { c:"Organisation & cohesion", d:"Logical order, paragraphing, linking devices" },
  { c:"Range",                 d:"Business vocabulary and structures for the level" },
  { c:"Accuracy & register",   d:"Grammar, spelling, appropriate business tone" }
];

/* ---------- listening helpers ---------- */
const L = (who, text) => ({ who, text });   // who: NARR | M | W | M2 | W2

const BANK = {
  /* ===== TIER 1 — Pre-elementary / Elementary (A1→A2) =====
     Source: Business Course Syllabus_Elementary (Starter + Elementary), Sessions 1–7;
     Speak Business Club Elementary S1–S3; Business Writing Club Elementary S1. */
  1: {
    listening: {
      obj:"introductions, spelling, numbers, company information", audioSrc:"audio/listen-1.mp3",
      title:"Meeting people at a trade fair",
      instruction:"Listen to six short conversations. Choose the correct answer.",
      source:"Elementary syllabus S1 (introductions, spelling, numbers), S2 (email addresses, departments), S3 (products, times)",
      items:[
        { example:true, q:"Where is David from?", options:["Canada","China","the USA"], answer:"Canada", obj:"countries",
          script:[L("W","Hello. I'm Sara. Where are you from?"),L("M","Hi, Sara. I'm David. I'm from Canada.")] },
        { q:"Which department is Tom in?", options:["Sales","Finance","IT"], answer:"Sales", obj:"departments",
          script:[L("W","Tom, what department are you in?"),L("M","I'm in the Sales department. My friend is in IT.")] },
        { q:"What is the woman's surname?", options:["Novak","Nowak","Novac"], answer:"Novak", obj:"spelling",
          script:[L("M","What's your surname, please?"),L("W","It's Novak. N - O - V - A - K.")] },
        { q:"What does Ahmed's company make?", options:["medicines","machines","magazines"], answer:"medicines", obj:"products (present simple he/she/it)",
          script:[L("W","Ahmed, what does your company make?"),L("M2","We make medicines. Our office is in Cairo.")] },
        { q:"What is Lisa's email address?", options:["lisa.b@globex.com","lisa.p@globex.com","lisa.b@glopex.com"], answer:"lisa.b@globex.com", obj:"email addresses",
          script:[L("M","Lisa, what's your email address?"),L("W","It's lisa dot B, at globex dot com. Globex is G - L - O - B - E - X.")] },
        { q:"When is the product presentation?", options:["Thursday at 2:30","Tuesday at 2:30","Thursday at 12:30"], answer:"Thursday at 2:30", obj:"days and times",
          script:[L("W","When is the product presentation?"),L("M","It's on Thursday. At two thirty.")] }
      ]
    },
    writing: {
      task:"An email to your new team", words:[25,40],
      source:"Business Writing Club Elementary S1 (introducing yourself in an email); Elementary syllabus S1–S2",
      instruction:"You have a new job. Write a short email to the people in your new team.",
      points:["Say hello.","Write your name and your job.","Write the name of your company and what it does.","Say goodbye."],
      starter:"Hello everyone,\nMy name is ______. I am a ______."
    },
    speaking: {
      source:"criteria of Speaking Placement Test - Pre-elementary / Elementary questions (all 10, verbatim)",
      prompts:["What's your name?","Which country are you from? Where are you from?","What's your job?","What does your company produce or provide?","What time do you start work? Tell me about your typical day.","What do you do in your free time?","Tell me about your family, your home or your interests."],
      probe:["When did you join the company?","What project are you working on at the moment?","When is your next holiday? Where are you going to go?"]
    }
  },

  /* ===== TIER 2 — Pre-intermediate (A2) =====
     Source: Business Course Syllabus_Pre-intermediate Units 3, 6, 7, 8, 14;
     Speaking Club Pre-int S4 (hotel negotiation) & S5 (order complaint call);
     Writing Club Pre-int S4 (hotel reservation). */
  2: {
    listening: {
      obj:"arrangements, orders, complaints, delays", audioSrc:"audio/listen-2.mp3",
      title:"Calls and messages",
      instruction:"Listen to six business phone calls and voicemail messages. Choose the correct answer for each one.",
      source:"Pre-int syllabus U3 Visiting, U7 Travel (present continuous for arrangements), U8 Orders, U14 Time management; Speaking Club S4, S5",
      items:[
        { example:true, q:"Where will Karim meet Ms. Lopez?", options:["at the airport","at the hotel","at the office"], answer:"at the airport", obj:"arranging a visit",
          script:[L("M","Hello Ms. Lopez, it's Karim from Nile Tech. Just to confirm your visit on Tuesday: I'll pick you up at the airport at nine fifteen, and we'll drive to the office together.")] },
        { q:"When is Mark meeting the client?", options:["Wednesday morning","Tuesday morning","Wednesday afternoon"], answer:"Wednesday morning", obj:"future arrangements",
          script:[L("W","Mark, are you free for a call on Wednesday?"),L("M","Sorry, I'm flying to Riyadh on Tuesday afternoon, and I'm meeting the client on Wednesday morning. How about Thursday?")] },
        { q:"What are the payment terms?", options:["within 30 days","within 13 days","on delivery"], answer:"within 30 days", obj:"orders & payment terms",
          script:[L("M","OK, I'll take five hundred units at that price."),L("W","Great. We'll deliver next week, and payment is within thirty days of the invoice.")] },
        { q:"What is the problem with the order?", options:["The headphones have a sound problem.","The headphones are the wrong colour.","The headphones arrived very late."], answer:"The headphones have a sound problem.", obj:"complaints",
          script:[L("W","Hello, I'm calling regarding my recent order. I ordered twenty headphones for our office, but there seems to be a problem with the sound."),L("M","I'm sorry to hear that. We'll arrange a replacement for you.")] },
        { q:"What does the hotel offer?", options:["15% off for three nights","10% off for fifteen rooms","free breakfast for three nights"], answer:"15% off for three nights", obj:"negotiating a booking",
          script:[L("M","We need ten rooms. Would you be willing to give us a discount?"),L("W","We can offer fifteen percent if you stay for three nights. Breakfast is ten dollars extra."),L("M","That sounds reasonable. I think we have a deal.")] },
        { q:"Why is the report late?", options:["The system went down.","Sam was ill yesterday.","The sales figures were wrong."], answer:"The system went down.", obj:"explaining delays (past continuous)",
          script:[L("M2","Hi, it's Sam. Sorry the report is late. I was finishing it yesterday when the system went down, so I lost the last part. I'll send it by twelve.")] }
      ]
    },
    writing: {
      task:"An email to book hotel rooms", words:[60,80],
      source:"Business Writing Club Pre-intermediate S4 (hotel reservation); Pre-int syllabus U7 Travel",
      instruction:"Your manager and two colleagues are going to a business event next month. Write an email to a hotel to book rooms for them.",
      points:["Say who you are and why you are writing.","Give the dates and the number of rooms.","Ask about the price and what the hotel has (for example, Wi-Fi or breakfast).","Ask the hotel to answer, and end your email."],
      starter:"Dear Sir or Madam,\nI would like to book ______"
    },
    speaking: {
      source:"NOT in the criteria document (it gives only the Pre-intermediate descriptor). v2 set, matches the descriptor: experiences, ambitions, reasons, a book or film - REVIEW",
      prompts:["Tell me about your educational background.","Describe your current or most recent job.","What are your dreams and ambitions for the future?","Describe a memorable experience from your past.","Tell me about a book or film you enjoyed recently.","What are your hopes for your career?","Why did you choose your current field of work?"]
    }
  },

  /* ===== TIER 3 — Intermediate (B1) =====
     Source: Business Course Syllabus_Intermediate U3 Projects, U5 Customers, U9 Logistics, U10 Facilities;
     Speaking Club Int S5 (facilities & perks); Writing Club Int S5 (proposals). */
  3: {
    listening: {
      obj:"project updates", audioSrc:"audio/listen-3.mp3",
      title:"A project update meeting",
      instruction:"Listen to a team meeting about a new website with Karen, the manager, and her colleagues Omar and Lucy. There are six parts. Choose the correct answer for each part.",
      source:"Intermediate syllabus U3 Projects (progress, updating teammates, timelines), U9 Logistics",
      items:[
        { example:true, q:"What has been finished?", options:["the design","the building of the website","the testing"], answer:"the design", obj:"progress (present perfect)",
          script:[L("W","OK, let's start. The main thing today is the new website. Omar, how's it going?"),L("M","Pretty well. The design has been finished, and the developers started building the site last week.")] },
        { q:"Why has the photo shoot been postponed?", options:["The photographer is ill.","The budget for photos was cut.","The website design has changed."], answer:"The photographer is ill.", obj:"reasons",
          script:[L("M","The only problem is the photos. The photographer we booked is ill, so the photo shoot has been postponed until next month.")] },
        { q:"When will the website probably launch?", options:["in the middle of June","on the first of June","at the start of next month"], answer:"in the middle of June", obj:"timelines",
          script:[L("W","Does that affect the launch date?"),L("M","A little. We were aiming for the first of June, but realistically, we're launching in the middle of June.")] },
        { q:"What does Lucy suggest?", options:["using last year's photos for now","booking a new photographer next week","delaying the launch until July"], answer:"using last year's photos for now", obj:"suggestions",
          script:[L("W2","Karen, can I suggest something?"),L("W","Yes, Lucy, go ahead."),L("W2","Instead of waiting, we could use some photos from last year's catalogue for now, and replace them later."),L("W","That's a good idea. It would save time.")] },
        { q:"Why is the project under budget?", options:["The developers worked faster than expected.","The photo shoot has been cancelled completely.","They found a cheaper designer for the site."], answer:"The developers worked faster than expected.", obj:"budget",
          script:[L("W","What about costs? Are we still within budget?"),L("M","Yes. Actually, we're about ten percent under budget, because the developers finished the first stage faster than we expected.")] },
        { q:"What will Lucy do before she emails the customers?", options:["wait until the date is confirmed","check the photos with Omar first","ask Karen for the customer list"], answer:"wait until the date is confirmed", obj:"action points",
          script:[L("W","Great. Lucy, could you send our customers an email next week about the new site?"),L("W2","Sure. But I'll wait until we have a confirmed date before I send it.")] }
      ]
    },
    writing: {
      task:"Proposal email: improving workplace facilities", words:[110,140],
      source:"Business Writing Club Intermediate S5 (writing proposals); Speaking Club Int S5 (facilities & perks); Int syllabus U10 Facilities",
      instruction:"Staff turnover in your department has increased and your manager has asked for ideas. Write a formal email proposing improvements to workplace facilities or employee benefits.",
      points:["Explain the current problem and its effect.","Propose two improvements (for example, collaborative spaces, recognition programmes, flexible hours).","Explain the results you expect, linking your ideas (therefore, as a result, however).","Make a clear recommendation and close formally."],
      starter:"Dear ______,\nI am writing to propose ______"
    },
    speaking: {
      source:"criteria of Speaking Placement Test - Intermediate questions (verbatim)",
      prompts:["Give a short presentation about your company. For example, its history, products and locations.","What have been some of the big changes at your company recently? What have been the results? What's your opinion on the changes?","How has technology changed your life in recent years, at work and at home? Do you think it's a good thing?"]
    }
  },

  /* ===== TIER 4 — Upper-intermediate (B2) =====
     Source: Business_Result_Upper_Intermediate_Syllabus U6 Making decisions, U7 Outsourcing, U8 Employees;
     SpeakBusiness Club Upper-int S5 (making decisions), S6–S7 (meetings);
     Writing Club Upper-int S5 (workplace conflict report). */
  4: {
    listening: {
      obj:"decisions & negotiation with an outsourcing partner", audioSrc:"audio/listen-4.mp3",
      title:"A problem with an outsourcing partner",
      instruction:"Listen to two managers, Rachel and Daniel, discussing the company that handles their deliveries. There are six parts. Choose the best answer for each part.",
      source:"Upper-int syllabus U6 Making decisions, U7 Outsourcing; Speaking Club Upper-int S5 (decisions: a course of action, the ball is in their court)",
      items:[
        { example:true, q:"What has happened three times this quarter?", options:["late deliveries","price increases","staff complaints"], answer:"late deliveries", obj:"detail",
          script:[L("W","Daniel, it's Rachel. Have you seen the latest figures from Brightline?"),L("M","I have. That's the third late delivery this quarter, and every time we've had to pay the warehouse staff overtime.")] },
        { q:"How does Rachel feel about Brightline's response?", options:["dissatisfied, because it was vague","satisfied with the apology","surprised by the compensation offered"], answer:"dissatisfied, because it was vague", obj:"attitude",
          script:[L("W","I raised it with their account manager, but frankly the response was pretty vague. Lots of apologies, nothing concrete."),L("M","So, no guarantee it won't happen again.")] },
        { q:"Why don't they end the outsourcing contract now?", options:["Breaking the contract would be expensive.","No other partner can deliver before March.","They are waiting for a better offer from Brightline."], answer:"Breaking the contract would be expensive.", obj:"reasoning",
          script:[L("M","The obvious course of action is to bring in a new partner, but we're locked into the contract until March, and breaking it would mean a penalty."),L("W","Which would probably cost us more than the overtime.")] },
        { q:"What condition does Daniel add to Rachel's idea?", options:["The discount must be big enough to matter.","The clause must apply from March onwards.","Brightline must agree to it by Friday."], answer:"The discount must be big enough to matter.", obj:"conditions",
          script:[L("W","What if we renegotiated instead? We could ask for a clause that gives us a discount every time a delivery is late."),L("M","That might work, as long as the discount is big enough to actually hurt them.")] },
        { q:"Why does Rachel want to keep the talks confidential?", options:["She doesn't want Brightline to think they've decided.","The alternative partners have asked for secrecy.","Their director has not approved the talks yet."], answer:"She doesn't want Brightline to think they've decided.", obj:"inference",
          script:[L("M","In the meantime, I'd like to start talking to one or two alternative partners. Quietly, so we're not starting from zero in March."),L("W","Agreed, but let's keep it confidential. Let's not jump to conclusions, and I don't want Brightline thinking we've already made up our minds.")] },
        { q:"What will they do next Wednesday?", options:["review the proposal and the shortlist","meet Brightline's account manager again","sign the contract with a new partner"], answer:"review the proposal and the shortlist", obj:"action points",
          script:[L("W","So, I'll draft the renegotiation proposal by Friday, and you'll put together a shortlist. Then the ball is in their court. Shall we review both next Wednesday?"),L("M","Works for me.")] }
      ]
    },
    writing: {
      task:"Workplace conflict report", words:[160,200],
      source:"Business Writing Club Upper-intermediate S5 (conflict report: Introduction → Background → Action taken so far → Conclusion → Recommendations); S3 (proposal language)",
      instruction:"Two members of your team are in conflict: one feels micromanaged and the other says deadlines are being missed. Team performance is falling. Write a report for the senior management team.",
      points:["Introduction: state the purpose of the report.","Background: describe the situation and its effect on the team.","Action taken so far: say what has already been done.","Conclusion and recommendations: propose clear next steps and justify them."],
      starter:"Introduction\nThe purpose of this report is to ______"
    },
    speaking: {
      source:"criteria of Speaking Placement Test - Upper-intermediate questions (verbatim)",
      prompts:["How important are teams where you work? What are some ways to motivate a team?","How much do you deal with people from other countries? Give examples. Do different cultures do business in different ways?","Think of a problem you had to deal with recently. What happened? How did you solve it? Do you think you could have approached it differently?"]
    }
  },

  /* ===== TIER 5 — Advanced (C1) =====
     NOTE: no Monglish Advanced syllabus or club layout was supplied. Content extends the
     Upper-intermediate club themes (change, decisions, persuasive proposals) to C1. */
  5: {
    listening: {
      obj:"extended discourse, stance & implication", audioSrc:"audio/listen-5.mp3",
      title:"A business podcast",
      instruction:"Listen to an interview with Helen Marsh, CEO of a logistics company, about flexible working. There are six parts. Choose the best answer for each part.",
      items:[
        { example:true, q:"What originally prompted the change to flexible working?", options:["losing senior staff to competitors","a long-term strategic plan","saving money on office space"], answer:"losing senior staff to competitors", obj:"cause",
          script:[L("M","Helen, your company was one of the first in the sector to go fully flexible. Was that a strategic decision, or a reaction to circumstances?"),L("W","Honestly? It started as a reaction. We'd lost three senior engineers in six months to competitors offering remote work, and we simply couldn't afford to keep losing people.")] },
        { q:"What does Helen imply about the first year?", options:["It showed how much decisions relied on informal contact.","It was seamless once the engineers came back.","It made decisions faster by removing meetings."], answer:"It showed how much decisions relied on informal contact.", obj:"implication",
          script:[L("M","And now?"),L("W","Now it's genuinely part of the strategy, though I'd be lying if I said it had been seamless. That first year exposed how much of our decision-making relied on people bumping into each other in corridors.")] },
        { q:"What is Helen's view of the critics' argument?", options:["They confuse culture with being physically together.","They are completely right about culture.","Culture only matters when people are watched."], answer:"They confuse culture with being physically together.", obj:"stance",
          script:[L("M","Critics say flexibility erodes company culture."),L("W","I think that conflates culture with proximity. Culture is what people do when no one is watching; you don't build it just by putting desks close together. That said, I'd concede that new joiners do lose out.")] },
        { q:"How has the company responded to the problem for new employees?", options:["three office days a week with a mentor at first","a three-month online programme with a mentor","letting new starters choose their office days"], answer:"three office days a week with a mentor at first", obj:"detail",
          script:[L("W","So we've made the first three months different. New starters are in the office at least three days a week, paired with a mentor, and that part is non-negotiable.")] },
        { q:"Why is Helen cautious about the productivity figures?", options:["What is easy to measure may not matter most.","The headline figures were calculated wrongly.","Collaboration numbers have fallen across teams."], answer:"What is easy to measure may not matter most.", obj:"evaluation",
          script:[L("M","Has productivity suffered?"),L("W","The headline numbers are up, but I'm wary of reading too much into them. What we can measure easily, tickets closed, deliveries dispatched, isn't necessarily what matters most, like the quality of collaboration across teams.")] },
        { q:"What is Helen's recommendation to other companies?", options:["Adopt it only if you will redesign how work is done.","Adopt it, but keep people working as before.","Avoid it; it gives the worst of both worlds."], answer:"Adopt it only if you will redesign how work is done.", obj:"conclusion",
          script:[L("M","Final question: would you recommend the model to others?"),L("W","With a caveat. It works if you're prepared to redesign how work is done, not just where. Companies that simply send people home and carry on as before tend to get the worst of both worlds.")] }
      ]
    },
    writing: {
      task:"Proposal to senior management", words:[200,250],
      instruction:"Write a proposal to your senior management team recommending ONE significant change to how your organisation works (for example: a four-day week, a new market, an AI tool, a restructure).",
      points:["Present the change and the reason it is needed now.","Develop two or three supporting arguments with evidence or examples.","Acknowledge the main objection and respond to it.","Conclude with a clear, persuasive recommendation in an appropriate register."],
      starter:"Proposal: ______\nPurpose"
    },
    speaking: {
      source:"criteria of Speaking Placement Test - Advanced: mix and match all of the above (Upper-intermediate + Intermediate questions)",
      prompts:["How important are teams where you work? What are some ways to motivate a team?","How much do you deal with people from other countries? Give examples. Do different cultures do business in different ways?","Think of a problem you had to deal with recently. What happened? How did you solve it? Do you think you could have approached it differently?","Give a short presentation about your company. For example, its history, products and locations.","What have been some of the big changes at your company recently? What have been the results? What's your opinion on the changes?","How has technology changed your life in recent years, at work and at home? Do you think it's a good thing?"]
    }
  }
};

/* ---------- READING: 30 of the approved 60 items, 6 per level (inserted by _build/assemble.py) ---------- */
const READING = [
    { lvl:"A1", src:1, question: "My name ___ Richard Smith.", options: ["is", "are", "am"], correct: 0 },
    { lvl:"A1", src:3, question: "___ company is Microsoft.", options: ["She", "She's", "Her"], correct: 2 },
    { lvl:"A1", src:5, question: "BMW ___ cars.", options: ["produces", "provides", "employs"], correct: 0 },
    { lvl:"A1", src:7, question: "Person 1: Do you work for an English company?\nPerson 2: No, I ___. It's French.", options: ["do", "doesn't", "don't"], correct: 2 },
    { lvl:"A1", src:8, question: "Person 1: ___ you spell that, please?\nPerson 2: Sure. It's A-L-A-N.", options: ["Can", "Do", "Are"], correct: 0 },
    { lvl:"A1", src:9, question: "There ___ four international airports near London.", options: ["is", "are", "have"], correct: 1 },
    { lvl:"A2", src:10, question: "A: ___ you like a coffee?\nB: Yes, please.", options: ["Do", "Could", "Would"], correct: 2 },
    { lvl:"A2", src:12, question: "Can we ___ a meeting?", options: ["available", "appoint", "arrange"], correct: 2 },
    { lvl:"A2", src:13, question: "Our products are ___ than our main competitors.", options: ["cheap", "cheaper", "cheapest"], correct: 1 },
    { lvl:"A2", src:15, question: "What ___ on at the moment?", options: ["are you working", "do you work", "did you work"], correct: 0 },
    { lvl:"A2", src:21, question: "When ___ the company?", options: ["joined you", "did you join", "did you joined"], correct: 1 },
    { lvl:"A2", src:23, question: "First of all, I ___ you a little bit about me.", options: ["tell", "'m going to tell", "'m telling"], correct: 1 },
    { lvl:"B1", src:24, question: "English ___ all over the world.", options: ["speaks", "has spoken", "is spoken"], correct: 2 },
    { lvl:"B1", src:25, question: "Did you ___ the deadline?", options: ["get", "reach", "meet"], correct: 2 },
    { lvl:"B1", src:26, question: "I ___ him here recently.", options: ["didn't see", "haven't seen", "don't see"], correct: 1 },
    { lvl:"B1", src:29, question: "I'll call you back as soon as I ___ something.", options: ["'m hearing", "'ll hear", "hear"], correct: 2 },
    { lvl:"B1", src:30, question: "You ___ press this button. It's dangerous.", options: ["mustn't", "don't have to", "needn't"], correct: 0 },
    { lvl:"B1", src:33, question: "If we changed the colour, we ___ more.", options: ["sell", "'ll sell", "'d sell"], correct: 2 },
    { lvl:"B2", src:35, question: "He ___ to leave the company by his boss.", options: ["'s been asked", "'s asked", "asked"], correct: 0 },
    { lvl:"B2", src:38, question: "___ the delays with the trains, we all still arrived on time.", options: ["Although", "Even though", "Despite"], correct: 2 },
    { lvl:"B2", src:42, question: "If you don't like this idea, then come ___ with something better.", options: ["across", "in", "up"], correct: 2 },
    { lvl:"B2", src:45, question: "Do you know what time ___?", options: ["is it", "it is", "does it"], correct: 1 },
    { lvl:"B2", src:52, question: "There's a real ___ in the market for this kind of service, I think.", options: ["gap", "break", "miss"], correct: 0 },
    { lvl:"B2", src:56, question: "If you ___ I'm sure you would have got the job.", options: ["applied", "would apply", "had applied"], correct: 2 },
    { lvl:"C1", src:49, question: "Many women feel that they hit a glass ___ on the corporate ladder.", options: ["roof", "attic", "ceiling"], correct: 2 },
    { lvl:"C1", src:54, question: "The pros definitely ___ the cons.", options: ["outcome", "outweigh", "outlook"], correct: 1 },
    { lvl:"C1", src:57, question: "Am I getting my point ___ clearly enough?", options: ["along", "across", "around"], correct: 1 },
    { lvl:"C1", src:58, question: "There isn't a ___ of purpose to the meeting.", options: ["feel", "sense", "reason"], correct: 1 },
    { lvl:"C1", src:59, question: "Let me ___ you in on some of the background.", options: ["fill", "pack", "add"], correct: 0 },
    { lvl:"C1", src:60, question: "It's difficult to ___ what the reaction might be to this proposal.", options: ["weigh", "gauge", "measure"], correct: 1 }
];

window.BRT = { CONFIG, TIERS, CEFR_DESCRIPTORS, BAND_WORDS, SPEAKING_RUBRIC, WRITING_RUBRIC, BANK, READING };
