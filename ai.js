/*
 * Path2Placement on-device AI engine (no network, no API keys).
 *
 * Three algorithms:
 *  1. Resume Intelligence  - TF-IDF + cosine similarity, skill-graph matching,
 *                            fuzzy keyword matching, impact & structure analysis.
 *  2. Answer Evaluation    - multi-signal NLP scoring of interview answers
 *                            (relevance, depth, STAR/structure, evidence, delivery).
 *  3. Assistant Intent NLU - typo-tolerant intent classifier (TF-IDF kNN + centroid
 *                            cosine) with entity extraction and context-aware replies.
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* NLP primitives                                                      */
  /* ------------------------------------------------------------------ */

  const STOP = new Set(
    ("a an the and or but if then else of to in on at by for with from as is are was were be been being it its " +
      "this that these those i me my we our you your they their he she his her them do does did done have has had " +
      "will would can could should may might must not no so than too very just about into over under also etc via " +
      "per using use used within without while when where which who whom what how why please tell give want need " +
      "explain describe")
      .split(" ")
  );

  // Multi-word / alias phrases collapsed to a single canonical token.
  const PHRASES = [
    [/node\s*\.?\s*js/g, " nodejs "],
    [/react\s*\.?\s*js/g, " react "],
    [/express\s*\.?\s*js/g, " express "],
    [/next\s*\.?\s*js/g, " nextjs "],
    [/c\+\+/g, " cpp "],
    [/c#/g, " csharp "],
    [/\brest(?:ful)?\s*apis?\b/g, " api "],
    [/\bapis\b/g, " api "],
    [/machine learning/g, " ml "],
    [/data structures?(?:\s*(?:and|&)\s*algorithms?)?/g, " dsa "],
    [/\balgorithms?\b/g, " dsa "],
    [/object[\s-]*oriented(?: programming)?/g, " oop "],
    [/\boops\b/g, " oop "],
    [/mongo\s*db/g, " mongodb "],
    [/postgres(?:ql)?/g, " postgresql "],
    [/\bmy\s*sql\b/g, " mysql "],
    [/\bjs\b/g, " javascript "],
    [/\bts\b/g, " typescript "],
    [/ci\s*\/\s*cd/g, " cicd "],
    [/\b(?:unit|integration|e2e)\s+tests?\b|\bjest\b|\bmocha\b|\bjunit\b|\bpytest\b|\bcypress\b/g, " testing "],
    [/\bweb\s*accessibility\b|\ba11y\b|\bwcag\b|\baria\b/g, " accessibility "],
    [/\bfront[\s-]?end\b/g, " frontend "],
    [/\bback[\s-]?end\b/g, " backend "],
    [/\bfull[\s-]?stack\b/g, " fullstack "],
    [/\bno[\s-]?sql\b/g, " nosql "],
    [/\bcvs?\b|\brésumé\b/g, " resume "],
  ];

  function normalize(text) {
    let t = " " + String(text || "").toLowerCase() + " ";
    for (const [re, rep] of PHRASES) t = t.replace(re, rep);
    return t;
  }

  // Light suffix stemmer (good enough for matching, not linguistics).
  function stem(w) {
    if (w.length > 5 && /(ing|ed)$/.test(w)) return w.replace(/(ing|ed)$/, "");
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  function tokens(text, keepStop) {
    return normalize(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !/^\d+$/.test(w) && (keepStop || !STOP.has(w)))
      .map(stem);
  }

  function buildIndex(docs) {
    const df = new Map();
    docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
    const N = docs.length;
    const idf = (t) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
    return {
      df,
      idf,
      vec(toks) {
        const tf = new Map();
        toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
        const v = new Map();
        tf.forEach((c, t) => v.set(t, (1 + Math.log(c)) * idf(t)));
        return v;
      },
    };
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    a.forEach((x, t) => {
      na += x * x;
      const y = b.get(t);
      if (y) dot += x * y;
    });
    b.forEach((y) => (nb += y * y));
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  // Bounded Levenshtein distance (returns max+1 when exceeded).
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const pct = (n) => Math.round(clamp(n, 0, 1) * 100);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ------------------------------------------------------------------ */
  /* Skill knowledge graph                                               */
  /* ------------------------------------------------------------------ */

  const SKILLS = {
    JavaScript: ["javascript", "es6", "ecmascript"],
    TypeScript: ["typescript"],
    React: ["react", "redux", "jsx", "nextjs"],
    HTML: ["html", "html5"],
    CSS: ["css", "css3", "sass", "tailwind", "bootstrap"],
    "Node.js": ["nodejs"],
    Express: ["express"],
    "REST APIs": ["api", "graphql", "endpoint"],
    SQL: ["sql", "mysql", "postgresql", "oracle"],
    MongoDB: ["mongodb", "nosql"],
    Python: ["python", "pandas", "numpy", "django", "flask"],
    Java: ["java", "spring", "hibernate"],
    "C++": ["cpp"],
    DSA: ["dsa", "leetcode"],
    OOP: ["oop"],
    Git: ["git", "github", "gitlab"],
    Docker: ["docker", "kubernetes", "container"],
    "Cloud (AWS/Azure)": ["aws", "azure", "gcp", "cloud"],
    Linux: ["linux", "unix", "bash", "shell"],
    Testing: ["testing", "tdd"],
    Authentication: ["authentication", "jwt", "oauth", "auth"],
    Security: ["security", "encryption", "firewall", "owasp"],
    Accessibility: ["accessibility"],
    Performance: ["performance", "optimization", "optimized", "latency"],
    "Machine Learning": ["ml", "tensorflow", "pytorch"],
    Excel: ["excel"],
    Tableau: ["tableau", "powerbi"],
    Statistics: ["statistics", "regression"],
    "CI/CD": ["cicd", "jenkins"],
    Agile: ["agile", "scrum", "jira"],
    Teamwork: ["team", "collaboration", "collaborated", "teamwork"],
    Leadership: ["led", "lead", "mentored", "captain", "leadership"],
    Communication: ["communication", "presented", "presentation"],
  };

  // stemmed alias -> skill display name
  const ALIAS_TO_SKILL = new Map();
  Object.entries(SKILLS).forEach(([name, aliases]) =>
    aliases.forEach((a) => ALIAS_TO_SKILL.set(stem(a), name))
  );
  // skill name -> Set of stemmed aliases (the "group")
  const SKILL_GROUPS = new Map(Object.entries(SKILLS).map(([n, a]) => [n, new Set(a.map(stem))]));

  // Extra "this implies that" relations for role keywords.
  const RELATED = {
    database: ["sql", "mongodb", "postgresql", "mysql", "nosql"],
    responsive: ["mobile", "adaptive", "media", "tailwind", "bootstrap"],
    scalability: ["scalable", "scale", "throughput", "load", "cache", "caching"],
    insights: ["insight", "analysis", "analyz", "analysed"],
    cleaning: ["clean", "preprocess", "wrangl", "pandas"],
    reporting: ["report", "dashboard"],
    dashboards: ["dashboard", "chart"],
    visualization: ["visual", "chart", "dashboard", "tableau"],
    monitoring: ["monitor", "logging", "alert", "siem"],
    incident: ["incident", "breach", "response"],
    risk: ["risk", "threat", "vulnerability"],
    network: ["network", "tcp", "dns", "http"],
    debugging: ["debug", "troubleshoot", "fixed", "bug"],
    performance: ["optimiz", "latency", "faster", "speed", "lighthouse"],
    project: ["project", "capstone", "built", "developed"],
    problem: ["problem", "solv", "challenge"],
    technology: ["stack", "framework", "tool"],
    impact: ["improv", "reduc", "increas", "saved"],
    team: ["team", "collaborat", "group"],
    communication: ["present", "document", "communicat"],
    leadership: ["led", "lead", "mentor", "captain", "organiz"],
    security: ["secure", "encrypt", "owasp", "xss", "csrf", "hash"],
    authentication: ["auth", "jwt", "oauth", "login", "session"],
    api: ["endpoint", "graphql", "rest", "backend"],
    express: ["nodejs"],
    node: ["nodejs"],
  };

  const ACTION_VERBS = new Set(
    ("built created developed designed implemented led managed optimized improved reduced increased deployed " +
      "automated launched architected delivered migrated integrated analyzed achieved established mentored " +
      "organized streamlined refactored engineered")
      .split(" ")
      .map((w) => stem(w))
  );

  /* ------------------------------------------------------------------ */
  /* Shared config (role corpus)                                         */
  /* ------------------------------------------------------------------ */

  let ROLE_PROFILES = [];
  let ROLE_DOCS = []; // [{title, tokens}]

  function roleDocTokens(p) {
    // Weight tools double so the document resembles a "ideal resume skills section".
    return tokens([...p.keywords, ...p.tools, ...p.tools, ...p.keywords].join(" "));
  }

  function init(config) {
    ROLE_PROFILES = (config && config.roleProfiles) || [];
    ROLE_DOCS = ROLE_PROFILES.map((p) => ({ title: p.title, tokens: roleDocTokens(p), profile: p }));
    buildIntentModel();
  }

  /* keyword presence with exact / related / fuzzy credit */
  function keywordCredit(keyword, tokenSet, tokenList) {
    const k = stem(tokens(keyword)[0] || keyword.toLowerCase());
    if (tokenSet.has(k)) return 1;
    for (const rel of RELATED[keyword.toLowerCase()] || RELATED[k] || []) {
      const r = stem(rel);
      if (tokenSet.has(r) || tokenList.some((t) => t.startsWith(r) && r.length >= 4)) return 0.7;
    }
    // same skill group (e.g. "tailwind" supports "css")
    for (const group of SKILL_GROUPS.values()) {
      if (group.has(k)) {
        for (const a of group) if (a !== k && tokenSet.has(a)) return 0.6;
      }
    }
    if (k.length >= 6) {
      for (const t of tokenSet) if (lev(k, t, 1) <= 1) return 0.9; // typo tolerance
    }
    return 0;
  }

  /* ------------------------------------------------------------------ */
  /* 1. RESUME INTELLIGENCE                                              */
  /* ------------------------------------------------------------------ */

  const SECTION_PATTERNS = {
    Summary: /\b(summary|objective|profile|about me)\b/i,
    Education: /\b(education|b\.?tech|b\.?e\.?|bachelor|degree|cgpa|gpa|university|college)\b/i,
    Experience: /\b(experience|internship|intern|work history|employment)\b/i,
    Projects: /\b(projects?|capstone|built|developed)\b/i,
    Skills: /\b(skills|technologies|tech stack|tools)\b/i,
    Achievements: /\b(achievements?|certifications?|awards?|hackathon|published)\b/i,
  };

  function analyzeResume(text, role, profile) {
    const raw = String(text || "");
    const toks = tokens(raw);
    const allToks = tokens(raw, true);
    const tokenSet = new Set(toks);
    const words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
    const prof = profile || { keywords: [], tools: [], title: role };

    // (a) Keyword / skill coverage with graded credit
    const required = [...new Set([...prof.keywords, ...prof.tools.map((t) => t.toLowerCase())])]
      .filter((k) => tokens(k).length === 1)
      .slice(0, 16);
    const credits = required.map((k) => ({ k, c: keywordCredit(k, tokenSet, toks) }));
    const coverage = credits.length ? credits.reduce((s, x) => s + x.c, 0) / credits.length : 0;
    const missing = credits.filter((x) => x.c < 0.6).map((x) => cap(x.k));

    // (b) Semantic similarity (TF-IDF cosine) to the target role document
    const targetTokens = roleDocTokens(prof);
    const corpus = [toks, targetTokens, ...ROLE_DOCS.map((d) => d.tokens)];
    const index = buildIndex(corpus);
    const resumeVec = index.vec(toks);
    const similarityRaw = cosine(resumeVec, index.vec(targetTokens));
    const similarity = clamp(similarityRaw / 0.45, 0, 1); // 0.45 cosine ~ an excellent match

    // (c) Impact: quantified results + strong action verbs
    const quantified = (raw.match(/\b\d+(?:\.\d+)?\s*(?:%|x\b|k\b|\+|ms\b|users|hours|days|projects|students|requests)|\$\s?\d+|\b\d{2,}\b/gi) || []).length;
    const verbs = toks.filter((t) => ACTION_VERBS.has(t)).length;
    const impact = clamp(0.6 * Math.min(1, quantified / 3) + 0.4 * Math.min(1, verbs / 4), 0, 1);

    // (d) Structure: sections present + sensible length
    const sectionsFound = Object.entries(SECTION_PATTERNS).filter(([, re]) => re.test(raw)).map(([n]) => n);
    const lengthFactor = words < 120 ? words / 120 : words <= 700 ? 1 : Math.max(0.6, 1 - (words - 700) / 1500);
    const structure = 0.6 * Math.min(1, sectionsFound.length / 5) + 0.4 * lengthFactor;

    // (e) Keyword-stuffing guard
    const freq = new Map();
    toks.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));
    const stuffed = [...freq.entries()].filter(([t, c]) => c >= 7 && required.some((r) => stem(r.toLowerCase()) === t));
    const uniqRatio = allToks.length ? new Set(allToks).size / allToks.length : 1;
    const stuffingPenalty = stuffed.length || (words > 30 && uniqRatio < 0.3) ? 0.08 : 0;

    const finalRaw = 0.4 * coverage + 0.25 * similarity + 0.2 * impact + 0.15 * structure - stuffingPenalty;
    const score = words < 5 ? 15 : Math.round(clamp(15 + finalRaw * 85, 15, 98));

    // Best-fit roles by combined coverage + cosine
    const roleFit = ROLE_DOCS.map((d) => {
      const req = [...new Set([...d.profile.keywords])];
      const cov = req.reduce((s, k) => s + keywordCredit(k, tokenSet, toks), 0) / (req.length || 1);
      const sim = clamp(cosine(resumeVec, index.vec(d.tokens)) / 0.45, 0, 1);
      return { title: d.title, fit: pct(0.6 * cov + 0.4 * sim) };
    })
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 3);

    // Detected skills across the whole skill graph
    const found = new Set();
    toks.forEach((t) => ALIAS_TO_SKILL.has(t) && found.add(ALIAS_TO_SKILL.get(t)));
    const skills = [...found].slice(0, 12);

    // Suggestions: driven by the weakest dimensions
    const dims = [
      ["coverage", coverage],
      ["impact", impact],
      ["structure", structure],
      ["similarity", similarity],
    ].sort((a, b) => a[1] - b[1]);
    const suggestions = [];
    const topMissing = missing.slice(0, 4);
    for (const [dim] of dims) {
      if (dim === "coverage" && topMissing.length)
        suggestions.push(`Keyword gap: ${prof.title} postings expect ${topMissing.join(", ")}. Add them only where they truthfully match your work.`);
      if (dim === "impact")
        suggestions.push(
          quantified < 2
            ? "Quantify your results (e.g. \"cut page load time by 40%\", \"served 500+ users\"). Only " + quantified + " measurable figure(s) found."
            : `Start more bullets with strong verbs (built, optimized, led). ${verbs} found so far.`
        );
      if (dim === "structure") {
        const lacking = Object.keys(SECTION_PATTERNS).filter((n) => !sectionsFound.includes(n));
        suggestions.push(
          words < 120
            ? `Resume is short (${words} words). Expand projects with problem, approach and result. Missing sections: ${lacking.slice(0, 3).join(", ") || "none"}.`
            : `Add clear section headings for: ${lacking.slice(0, 3).join(", ") || "all sections present"}.`
        );
      }
      if (dim === "similarity")
        suggestions.push(`Your wording is semantically ${pct(similarityRaw / 0.45)}% aligned with ${prof.title} profiles. Mirror the language of target job descriptions in your project bullets.`);
    }
    if (stuffingPenalty) suggestions.unshift("Keyword stuffing detected - repeating terms hurts ATS ranking and reads poorly. Use each keyword in context once or twice.");
    if (roleFit[0] && roleFit[0].title !== prof.title && roleFit[0].fit - (roleFit.find((r) => r.title === prof.title)?.fit || 0) >= 10)
      suggestions.push(`This resume currently reads closer to ${roleFit[0].title} (${roleFit[0].fit}% fit). Retarget the summary if you want ${prof.title}.`);

    return {
      score,
      skills: skills.length ? skills : ["Projects", "Communication"],
      missing: missing.slice(0, 6),
      suggestions: suggestions.slice(0, 5),
      breakdown: {
        "Skill coverage": pct(coverage),
        "Role similarity (TF-IDF)": pct(similarity),
        "Impact & action verbs": pct(impact),
        "Structure & length": pct(structure),
      },
      roleFit,
      wordCount: words,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 2. INTERVIEW ANSWER EVALUATION                                      */
  /* ------------------------------------------------------------------ */

  const REASONING_RE = /\b(because|therefore|trade-?offs?|however|instead|whereas|compared to|alternatively|so that|which means|as a result|edge cases?|complexity|drawbacks?|benefits?|chose|decided|depends on|downside|pros and cons)\b/gi;
  const FILLER_RE = /\b(um+|uh+|you know|basically|actually|kind of|sort of|literally|i guess)\b/gi;
  const STAR = {
    Situation: /\b(when|during|at (?:my|the)|in (?:my|our)|situation|project|internship|our team|we were|there was|last (?:year|semester))\b/i,
    Task: /\b(task|goal|responsib\w*|needed to|had to|objective|was asked|my role|aim(?:ed)?|deadline)\b/i,
    Action: /\b(i (?:built|created|decided|implemented|led|wrote|designed|organi[sz]ed|analy[sz]ed|fixed|proposed|worked|developed|used|tried|researched|divided)|my approach|i took|so i|then i)\b/i,
    Result: /\b(result(?:ed)?|outcome|achieved|improved|reduced|increased|delivered|learn(?:ed|t)|as a result|which led|ended up|finally|\d+\s*%)\b/i,
  };
  const EXAMPLE_RE = /\b(for example|for instance|e\.g\.|such as|in my project|i used|i built|in one project|at my internship)\b/i;

  const LENGTH_TARGET = { Easy: [25, 120], Medium: [40, 160], Hard: [60, 220] };
  const TERM_TARGET = { Easy: 2, Medium: 3, Hard: 5 };
  const REASON_TARGET = { Easy: 1, Medium: 2, Hard: 3 };

  function evaluateAnswer(answer, question, opts) {
    const o = opts || {};
    const difficulty = o.difficulty || "Medium";
    const profile = o.profile || { keywords: [], tools: [] };
    const text = String(answer || "").trim();
    const words = text ? text.split(/\s+/) : [];
    const wc = words.length;

    const behavioral =
      /^(HR|Telephonic Interview)$/.test(o.type || "") ||
      /\b(tell me about|a time|challenge|strengths?|weakness(?:es)?|why should|why do you want|yourself|disagree)\b/i.test(question || "");

    if (wc < 5) {
      return {
        score: 1,
        mode: behavioral ? "behavioral" : "technical",
        wordCount: wc,
        parts: { Relevance: 0, "Depth & reasoning": 0, Structure: 0, Evidence: 0, Delivery: 0 },
        strengths: [],
        improvements: ["Your answer is too short to evaluate. Aim for 3-5 sentences with a clear point and an example."],
        missingConcepts: [],
      };
    }

    const ansToks = tokens(text);
    const ansSet = new Set(ansToks);
    const qToks = tokens(question || "").filter((t) => !["role", "interview", "project"].includes(t));
    const refToks = [...qToks, ...tokens([...profile.keywords, ...profile.tools].join(" "))];

    // Relevance: TF-IDF cosine against question+role concepts, plus direct question-term overlap
    const index = buildIndex([ansToks, refToks, ...ROLE_DOCS.map((d) => d.tokens)]);
    const cos = cosine(index.vec(ansToks), index.vec(refToks));
    const qHits = qToks.filter((t) => ansSet.has(t) || [...ansSet].some((a) => a.length > 5 && t.length > 5 && lev(a, t, 1) <= 1)).length;
    const overlap = qToks.length ? Math.min(1, qHits / Math.max(1, qToks.length * 0.4)) : 0.5;
    const relevance = clamp(0.65 * Math.min(1, cos / 0.3) + 0.35 * overlap, 0, 1);

    // Technical depth: distinct skill terms + reasoning language
    const termSet = new Set();
    ansToks.forEach((t) => ALIAS_TO_SKILL.has(t) && termSet.add(ALIAS_TO_SKILL.get(t).toLowerCase()));
    profile.keywords.concat(profile.tools).forEach((k) => keywordCredit(k.toLowerCase(), ansSet, ansToks) >= 0.9 && termSet.add(k.toLowerCase()));
    const reasoning = (text.match(REASONING_RE) || []).length;
    const reasonScore = Math.min(1, reasoning / REASON_TARGET[difficulty]);
    // Behavioural answers are judged on reasoning, not tech vocabulary.
    const depth = behavioral ? reasonScore : 0.6 * Math.min(1, termSet.size / TERM_TARGET[difficulty]) + 0.4 * reasonScore;

    // Structure: STAR for behavioural, approach->reasoning->example->result for technical
    let structure, starHit = [];
    const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 3).length;
    if (behavioral) {
      starHit = Object.entries(STAR).filter(([, re]) => re.test(text)).map(([k]) => k);
      structure = 0.8 * (starHit.length / 4) + 0.2 * Math.min(1, sentences / 4);
    } else {
      const parts = [
        /\b(first|start|approach|step|we can|i would|you can|define|is a|is the)\b/i.test(text),
        reasoning > 0,
        EXAMPLE_RE.test(text),
        STAR.Result.test(text) || /\b(finally|in summary|overall|so)\b/i.test(text),
      ];
      structure = 0.8 * (parts.filter(Boolean).length / 4) + 0.2 * Math.min(1, sentences / 4);
    }

    // Evidence: numbers/metrics and concrete examples
    const nums = (text.match(/\b\d+(?:\.\d+)?\s*(?:%|ms|s|x|k|users|hours|days|times|seconds)?/g) || []).length;
    const evidence = 0.5 * Math.min(1, nums / 2) + 0.5 * (EXAMPLE_RE.test(text) ? 1 : 0);

    // Delivery: length window, lexical diversity (anti-padding), filler words
    const [minW, maxW] = LENGTH_TARGET[difficulty];
    const lenScore = wc < minW ? wc / minW : wc <= maxW ? 1 : Math.max(0.6, 1 - (wc - maxW) / (maxW * 2));
    const allToks = tokens(text, true);
    const diversity = allToks.length ? new Set(allToks).size / allToks.length : 0;
    const fillers = (text.match(FILLER_RE) || []).length;
    const delivery = 0.55 * lenScore + 0.25 * Math.min(1, diversity / 0.55) + 0.2 * (1 - Math.min(1, (fillers / wc) * 10));

    const total = behavioral
      ? 0.3 * relevance + 0.1 * depth + 0.3 * structure + 0.2 * evidence + 0.1 * delivery
      : 0.3 * relevance + 0.25 * depth + 0.2 * structure + 0.15 * evidence + 0.1 * delivery;
    let score = clamp(Math.round(total * 10), 1, 10);
    if (relevance < 0.12) score = Math.min(score, 3); // off-topic / gibberish cap
    if (diversity < 0.3 && wc > 25) score = Math.min(score, 3); // repetition padding

    const parts = {
      Relevance: pct(relevance),
      "Depth & reasoning": pct(depth),
      Structure: pct(structure),
      Evidence: pct(evidence),
      Delivery: pct(delivery),
    };

    const strengths = [];
    const improvements = [];
    if (relevance >= 0.7) strengths.push("Directly addresses the question.");
    else if (relevance < 0.45) improvements.push("Answer the question more directly - restate the key term from the question in your first sentence.");
    if (depth >= 0.7) strengths.push(behavioral || !termSet.size ? "Explains the reasoning behind decisions." : `Good technical vocabulary (${[...termSet].slice(0, 3).join(", ")}).`);
    else improvements.push(reasoning < REASON_TARGET[difficulty] || behavioral ? "Explain your reasoning: use words like \"because\", \"trade-off\", \"instead of\" to show how you decide." : "Mention more specific tools or concepts from the role.");
    if (structure >= 0.7) strengths.push(behavioral ? "Clear STAR-style story." : "Well-organised: approach, reasoning, example.");
    else if (behavioral) {
      const lacking = Object.keys(STAR).filter((k) => !starHit.includes(k));
      improvements.push(`Use the STAR method - your answer is missing: ${lacking.join(", ")}.`);
    } else improvements.push("Structure it as approach -> reasoning -> example -> conclusion.");
    if (evidence >= 0.6) strengths.push("Backs claims with examples or numbers.");
    else improvements.push("Add a concrete example or a measurable result (e.g. \"reduced load time by 30%\").");
    if (wc < minW) improvements.push(`Too brief for a ${difficulty} question (${wc} words; aim for ${minW}-${maxW}).`);
    if (wc > maxW * 1.5) improvements.push("A bit long - tighten to the key points.");
    if (fillers >= 3) improvements.push(`Reduce filler words (${fillers} found).`);

    const missingConcepts = behavioral
      ? []
      : profile.keywords.concat(profile.tools.map((t) => t.toLowerCase()))
          .filter((k, i, arr) => arr.indexOf(k) === i && keywordCredit(k, ansSet, ansToks) < 0.6)
          .slice(0, 3)
          .map(cap);

    return { score, mode: behavioral ? "behavioral" : "technical", wordCount: wc, parts, strengths: strengths.slice(0, 2), improvements: improvements.slice(0, 3), missingConcepts };
  }

  /* ------------------------------------------------------------------ */
  /* 3. ASSISTANT: INTENT CLASSIFIER + CONTEXT-AWARE RESPONSES           */
  /* ------------------------------------------------------------------ */

  const INTENT_EXAMPLES = {
    greeting: ["hi", "hello there", "hey assistant", "good morning", "good evening"],
    thanks: ["thanks", "thank you so much", "great that helps", "awesome thanks a lot"],
    resume: [
      "improve my resume", "resume tips", "how to write strong resume bullets", "my ats score is low",
      "make my cv better", "what keywords to add in resume", "review my resume", "what should i add in my cv",
    ],
    study_plan: [
      "make a study plan", "plan my week", "daily schedule for placement preparation", "what should i study today",
      "create a timetable", "roadmap for placements in 30 days", "how do i start preparing", "give me a preparation plan",
    ],
    skill_roadmap: [
      "roadmap for react", "how to learn sql", "skills needed for backend developer", "what should i learn for data analyst",
      "how to learn aws", "skills required for the job", "which tools should i learn", "how do i become a frontend developer",
    ],
    interview_tips: [
      "interview tips", "how to crack technical interview", "hr interview questions", "how to answer tell me about yourself",
      "behavioral questions star method", "how to prepare for interview", "telephonic round tips", "i am nervous before my interview",
    ],
    company_prep: [
      "google preparation", "how to prepare for amazon", "microsoft interview pattern", "tcs infosys wipro hiring process",
      "company wise preparation", "product company versus service company", "what does google ask",
    ],
    progress_review: [
      "how am i doing", "show my progress", "analyze my performance", "what are my weak areas",
      "am i ready for placements", "check my readiness", "where should i improve", "what are my weaknesses",
    ],
    dsa_help: [
      "how to practice dsa", "leetcode strategy", "coding problems practice", "data structures and algorithms preparation",
      "best way to solve coding questions", "dynamic programming tips", "arrays and strings practice",
    ],
    aptitude_help: [
      "aptitude preparation", "quantitative aptitude tips", "logical reasoning practice", "speed math tricks",
      "verbal ability preparation", "online assessment tips", "timed test strategy",
    ],
  };

  const COMPANIES = {
    google: { name: "Google", kind: "product", pattern: "DSA depth, system design, strong projects", focus: ["Graphs and DP", "System design basics", "Project deep-dive"] },
    microsoft: { name: "Microsoft", kind: "product", pattern: "Problem solving and CS fundamentals", focus: ["OS and DBMS", "Trees and linked lists", "Clean code explanation"] },
    amazon: { name: "Amazon", kind: "product", pattern: "Leadership principles plus DSA", focus: ["14 Leadership Principles stories (STAR)", "Arrays, heaps, graphs", "OOP design"] },
    tcs: { name: "TCS", kind: "service", pattern: "Aptitude, programming basics, SQL, HR", focus: ["Aptitude timed sets", "Java/Python basics", "HR storytelling"] },
    infosys: { name: "Infosys", kind: "service", pattern: "Aptitude, logical reasoning, coding basics", focus: ["Reasoning and verbal", "Basic coding", "Communication"] },
    wipro: { name: "Wipro", kind: "service", pattern: "Aptitude, essay, coding basics, HR", focus: ["Aptitude", "Written communication", "Coding basics"] },
    accenture: { name: "Accenture", kind: "service", pattern: "Cognitive and technical assessment, communication", focus: ["Cognitive tests", "Pseudo-code", "Communication round"] },
    cognizant: { name: "Cognizant", kind: "service", pattern: "Aptitude, coding and communication", focus: ["Aptitude", "Coding basics", "HR"] },
  };

  let INTENT_MODEL = null;

  function buildIntentModel() {
    const examples = [];
    Object.entries(INTENT_EXAMPLES).forEach(([intent, list]) => list.forEach((e) => examples.push({ intent, toks: tokens(e) })));
    const index = buildIndex(examples.map((e) => e.toks));
    examples.forEach((e) => (e.vec = index.vec(e.toks)));
    const centroids = {};
    examples.forEach((e) => {
      const c = (centroids[e.intent] = centroids[e.intent] || new Map());
      e.vec.forEach((w, t) => c.set(t, (c.get(t) || 0) + w));
    });
    const vocab = [...index.df.keys()];
    INTENT_MODEL = { examples, index, centroids, vocab };
  }

  // Typo-tolerant token correction against the intent vocabulary.
  function correctToken(t) {
    if (INTENT_MODEL.index.df.has(t) || t.length < 4) return t;
    const max = t.length >= 7 ? 2 : 1;
    let best = t, bestD = max + 1;
    for (const v of INTENT_MODEL.vocab) {
      const d = lev(t, v, max);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function classify(text) {
    if (!INTENT_MODEL) buildIntentModel();
    const toks = tokens(text).map(correctToken);
    const qvec = INTENT_MODEL.index.vec(toks);
    const scores = {};
    INTENT_MODEL.examples.forEach((e) => {
      const s = cosine(qvec, e.vec);
      scores[e.intent] = Math.max(scores[e.intent] || 0, s);
    });
    Object.keys(INTENT_EXAMPLES).forEach((intent) => {
      const cen = cosine(qvec, INTENT_MODEL.centroids[intent]);
      scores[intent] = 0.6 * (scores[intent] || 0) + 0.4 * cen;
    });
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return { intent: ranked[0][0], confidence: ranked[0][1], runnerUp: ranked[1], tokens: toks };
  }

  function detectCompany(text) {
    const words = String(text || "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
    for (const w of words) {
      for (const key of Object.keys(COMPANIES)) {
        if (w === key || (w.length >= 5 && lev(w, key, 1) <= 1)) return COMPANIES[key];
      }
    }
    return null;
  }

  function detectSkill(text) {
    for (const t of tokens(text)) if (ALIAS_TO_SKILL.has(t)) return ALIAS_TO_SKILL.get(t);
    return null;
  }

  /* ---- response builders (use the learner's live data) ---- */

  const bullets = (arr) => arr.map((x) => `• ${x}`).join("\n");

  function weakestTopics(ctx, n) {
    return [...(ctx.topics || [])].sort((a, b) => a.progress - b.progress).slice(0, n);
  }

  function buildProgress(ctx) {
    const learning = ctx.topics && ctx.topics.length ? Math.round(ctx.topics.reduce((s, t) => s + t.progress, 0) / ctx.topics.length) : 0;
    const metrics = [
      ["resume", ctx.resume.score, "Run Resume Intelligence and fix the lowest dimension first."],
      ["mock interviews", ctx.interviewAvg, "Do a mock interview and apply the feedback on structure and examples."],
      ["topic practice", learning, "Open the Preparation Hub and mark practice on your weakest topic."],
    ].sort((a, b) => a[1] - b[1]);
    const weakest = weakestTopics(ctx, 2).map((t) => `${t.name} (${t.progress}%)`);
    let resumeGap = "";
    if (ctx.resume.breakdown) {
      const [label, val] = Object.entries(ctx.resume.breakdown).sort((a, b) => a[1] - b[1])[0];
      resumeGap = `Weakest resume dimension: ${label} (${val}%).`;
    }
    return [
      `Readiness snapshot for ${ctx.role}:`,
      bullets([`Resume ATS: ${ctx.resume.score}/100`, `Mock interview average: ${ctx.interviewAvg}%`, `Topic completion: ${learning}%`]),
      resumeGap,
      weakest.length ? `Weakest topics: ${weakest.join(", ")}.` : "",
      `Priority: ${metrics[0][0]} is your lowest signal. ${metrics[0][2]}`,
    ].filter(Boolean).join("\n");
  }

  function buildStudyPlan(ctx) {
    const tasks = [];
    weakestTopics(ctx, 3).forEach((t) => tasks.push(`Practice ${t.name} (${t.type}, ${t.progress}% done) - 60 min plus 10 questions`));
    (ctx.resume.missing || []).slice(0, 2).forEach((m) => tasks.push(`Learn ${m} basics and add one truthful, measurable bullet to your resume`));
    if (ctx.interviewAvg < 80) tasks.push(`Take a ${ctx.role} mock interview and review the feedback`);
    if (ctx.resume.score < 85) tasks.push("Rewrite 3 resume bullets: action verb + technology + number");
    ["Timed mixed practice set (aptitude + coding)", "Revise notes and redo yesterday's mistakes", "Full mock round and weekly review"].forEach((t) => tasks.push(t));
    return `Personalised 5-day plan for ${ctx.role} (ordered by your weakest areas):\n` +
      tasks.slice(0, 5).map((t, i) => `Day ${i + 1}: ${t}`).join("\n");
  }

  function buildResume(ctx) {
    const lines = [`Your ATS score is ${ctx.resume.score}/100 for ${ctx.role}.`];
    if (ctx.resume.breakdown) {
      const sorted = Object.entries(ctx.resume.breakdown).sort((a, b) => a[1] - b[1]);
      lines.push(`Lowest area: ${sorted[0][0]} (${sorted[0][1]}%).`);
    }
    if ((ctx.resume.missing || []).length) lines.push(`Missing keywords: ${ctx.resume.missing.slice(0, 4).join(", ")}.`);
    lines.push("Bullet formula: action verb + technology + what you did + measurable result.");
    lines.push("Example: \"Optimized React dashboard rendering with memoization, cutting load time by 35%.\"");
    return lines.join("\n");
  }

  function buildCompany(company, ctx) {
    const known = (ctx.companies || []).find((c) => c.name.toLowerCase() === company.name.toLowerCase());
    const weak = weakestTopics(ctx, 1)[0];
    const lines = [`${company.name} (${company.kind} company): ${company.pattern}.`];
    if (known) lines.push(`Your current readiness: ${known.readiness}%.`);
    lines.push("Focus areas:\n" + bullets(company.focus));
    if (weak) lines.push(`Based on your data, close this gap first: ${weak.name} (${weak.progress}%).`);
    return lines.join("\n");
  }

  function buildSkill(skill, text, ctx) {
    const lower = text.toLowerCase();
    const match = (ctx.skillKnowledge || []).find((k) => k.keys.some((key) => lower.includes(key))) ||
      (ctx.skillKnowledge || []).find((k) => skill && k.keys.some((key) => skill.toLowerCase().includes(key)));
    const have = (ctx.resume.skills || []).map((s) => s.toLowerCase());
    if (match) {
      const gaps = match.tools.filter((t) => !have.some((h) => t.toLowerCase().includes(h)));
      return `${match.title} roadmap:\n${bullets(["Revise fundamentals", `Build one small project using ${match.tools.slice(0, 3).join(", ")}`, "Practise explaining it out loud"])}\n${match.advice}` +
        (gaps.length ? `\nNot yet visible in your resume: ${gaps.slice(0, 3).join(", ")}.` : "");
    }
    return `Roadmap for ${skill || ctx.role}: learn the fundamentals, build one project that uses it end-to-end, add a measurable result to your resume, then practise 5 interview questions on it.`;
  }

  const TIPS = {
    hr: "HR rounds: use STAR (Situation, Task, Action, Result) for every story. Prepare 3 stories: teamwork, conflict, failure-and-learning. Keep each under 90 seconds.",
    tech: "Technical rounds: clarify the problem, state your approach, mention a trade-off, then give a concrete example from a project. Think aloud.",
    tele: "Telephonic rounds: speak slowly, keep a one-minute intro ready, have your resume open and smile - it changes your tone.",
  };

  function buildInterview(text, ctx) {
    const l = text.toLowerCase();
    const base = /\bhr\b|behaviou?r|yourself|star/.test(l) ? TIPS.hr : /phone|telephon/.test(l) ? TIPS.tele : TIPS.tech;
    return `${base}\nYour mock interview average is ${ctx.interviewAvg}%. ${ctx.interviewAvg < 75 ? "Practise answers with an example and a number in each one." : "Keep raising the difficulty to Hard."}`;
  }

  function respond(text, ctx) {
    if (!INTENT_MODEL) buildIntentModel();
    const cls = classify(text);
    const company = detectCompany(text);
    const skill = detectSkill(text);
    let intent = cls.intent;
    let confidence = cls.confidence;

    // Entity-driven overrides and follow-up handling
    if (company && confidence < 0.55) { intent = "company_prep"; confidence = Math.max(confidence, 0.5); }
    if (confidence < 0.16) {
      if (skill) { intent = ctx.lastIntent === "interview_tips" ? "interview_tips" : "skill_roadmap"; confidence = 0.3; }
      else if (ctx.lastIntent && tokens(text).length <= 3) { intent = ctx.lastIntent; confidence = 0.2; }
    }

    let reply;
    if (confidence < 0.16) {
      reply = "I'm not sure I understood that. I can help with:\n" +
        bullets(["\"How am I doing?\" - personalised readiness review", "\"Plan my week\" - study plan from your weak areas", "\"Improve my resume\" - ATS gap advice", "\"How to prepare for Amazon\" - company playbooks", "\"Roadmap for SQL\" - skill roadmaps"]);
      return { text: reply, intent: "unknown", confidence };
    }

    switch (intent) {
      case "greeting": reply = `Hi! I'm tracking your ${ctx.role} preparation (ATS ${ctx.resume.score}, mocks ${ctx.interviewAvg}%). Ask "how am I doing?" or "plan my week" to start.`; break;
      case "thanks": reply = "Happy to help! Want a study plan or a readiness check next?"; break;
      case "resume": reply = buildResume(ctx); break;
      case "study_plan": reply = buildStudyPlan(ctx); break;
      case "skill_roadmap": reply = buildSkill(skill, text, ctx); break;
      case "interview_tips": reply = buildInterview(text, ctx); break;
      case "company_prep":
        reply = company ? buildCompany(company, ctx) : "Product companies (Google, Microsoft, Amazon) lean on DSA, CS fundamentals and project depth. Service companies (TCS, Infosys, Wipro) lean on aptitude, SQL/programming basics and HR. Tell me a company name for a tailored plan."; break;
      case "progress_review": reply = buildProgress(ctx); break;
      case "dsa_help": reply = `DSA plan: learn patterns, not problems.\n${bullets(["Week 1: arrays, strings, hash maps", "Week 2: two pointers, sliding window, stacks", "Week 3: trees, recursion, binary search", "Week 4: graphs and DP basics"])}\nSolve 2-3 problems a day and write down why each approach works.`; break;
      case "aptitude_help": reply = `Aptitude plan:\n${bullets(["Daily 20 min speed math (percentages, ratios, time and work)", "3 reasoning sets per week with a timer", "Review every wrong answer in a mistake log"])}\nAccuracy first, then speed.`; break;
      default: reply = buildProgress(ctx);
    }
    if (confidence < 0.26 && intent !== "unknown") reply = `I think you're asking about ${intent.replace(/_/g, " ")}.\n` + reply;
    return { text: reply, intent, confidence };
  }

  global.AI = { init, analyzeResume, evaluateAnswer, classify, respond, _internals: { tokens, cosine, lev, buildIndex } };
  if (typeof module !== "undefined" && module.exports) module.exports = global.AI;
})(typeof window !== "undefined" ? window : globalThis);
