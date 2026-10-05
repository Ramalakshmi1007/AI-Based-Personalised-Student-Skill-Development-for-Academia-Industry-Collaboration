const seed = {
  user: {
    name: "Aarav Mehta",
    email: "student@path2placement.dev",
    role: "student",
    targetRole: "Frontend Engineer",
    college: "Demo Institute of Technology",
    skills: ["JavaScript", "React", "SQL", "DSA"],
  },
  resume: {
    score: 74,
    role: "Frontend Engineer",
    text:
      "Built React dashboards, REST APIs, MongoDB models, authentication, and responsive interfaces. Led a college project with measurable performance improvements.",
    skills: ["React", "Node.js", "MongoDB", "REST APIs", "Teamwork"],
    missing: ["Testing", "System design", "Accessibility"],
    feedback:
      "Your resume has strong project coverage. Add measurable impact, tighten the summary, and mirror the target role keywords more deliberately.",
  },
  interviews: [
    { role: "Frontend Engineer", domain: "React", difficulty: "Medium", score: 82, date: "Oct 01" },
    { role: "Software Developer", domain: "DSA", difficulty: "Hard", score: 68, date: "Sep 27" },
  ],
  topics: [
    { name: "Arrays and Strings", type: "Coding", progress: 0, difficulty: "Easy" },
    { name: "Operating Systems", type: "Theory", progress: 0, difficulty: "Medium" },
    { name: "DBMS Transactions", type: "Theory", progress: 0, difficulty: "Medium" },
    { name: "React Performance", type: "Web", progress: 0, difficulty: "Hard" },
    { name: "Aptitude Speed Math", type: "Aptitude", progress: 0, difficulty: "Easy" },
    { name: "HR Storytelling", type: "Interview", progress: 0, difficulty: "Medium" },
  ],
  studyPlan: [
    { day: "Monday", focus: "DSA patterns", tasks: ["Sliding window", "Two pointers", "3 LeetCode medium"], done: 2 },
    { day: "Tuesday", focus: "DBMS + SQL", tasks: ["Joins", "Normalization", "Query practice"], done: 1 },
    { day: "Wednesday", focus: "Mock interview", tasks: ["React round", "Review feedback", "Refine resume bullets"], done: 0 },
  ],
  companies: [
    { name: "Google", pattern: "DSA depth, system design, projects", readiness: 61 },
    { name: "Microsoft", pattern: "Problem solving, CS fundamentals", readiness: 68 },
    { name: "Amazon", pattern: "Leadership principles, DSA", readiness: 73 },
    { name: "TCS", pattern: "Aptitude, Java, SQL, HR", readiness: 79 },
  ],
  users: [
    { name: "Aarav Mehta", role: "Student", status: "Active", score: 74 },
    { name: "Diya Shah", role: "Student", status: "Active", score: 88 },
  ],
  chats: [
    { from: "ai", text: "Hi. Ask me for a study plan, skill roadmap, interview questions, company prep, or resume advice." },
  ],
};

const appVersion = "path2placement-v2";
const savedState = JSON.parse(localStorage.getItem("careerforge-state") || "null");
const state = normalizeState(savedState || seed);
let active = localStorage.getItem("careerforge-active") || "home";
let authed = localStorage.getItem("careerforge-authed") === "true";
let theme = localStorage.getItem("careerforge-theme") || "light";
let interview = null;

const navItems = [
  ["home", "⌂", "Home"],
  ["dashboard", "◫", "Dashboard"],
  ["resume", "▤", "Resume Intelligence"],
  ["interview", "◉", "Mock Interviews"],
  ["prep", "▦", "Preparation Hub"],
  ["assistant", "✦", "Career Assistant"],
  ["analytics", "↗", "Analytics"],
  ["profile", "●", "Profile"],
];

if (!navItems.some(([id]) => id === active)) active = "home";
localStorage.setItem("careerforge-version", appVersion);

const questions = [
  "Explain a React performance issue you solved and how you measured the result.",
  "Design a schema for a placement-prep platform with interviews, resumes, and progress tracking.",
  "Tell me about a time you disagreed with a teammate and still delivered the project.",
  "Solve this verbally: find the longest substring without repeating characters.",
  "What would you improve in your resume for a frontend engineer role?",
  "How would you debug a slow API response in a full-stack project?",
  "Explain normalization in DBMS with a placement interview example.",
  "Describe how authentication works with tokens and protected routes.",
  "How do you decide between SQL and MongoDB for a project?",
  "Walk me through one project from problem statement to final result.",
  "What accessibility checks would you add before shipping a React page?",
  "Explain event delegation in JavaScript.",
];

const roleProfiles = [
  {
    match: ["frontend", "front end", "react", "ui", "web developer"],
    title: "Frontend Engineer",
    keywords: ["html", "css", "javascript", "react", "api", "accessibility", "performance", "testing", "git", "responsive"],
    tools: ["HTML", "CSS", "JavaScript", "React", "REST APIs", "Git", "Testing", "Accessibility"],
  },
  {
    match: ["backend", "back end", "node", "api", "server"],
    title: "Backend Engineer",
    keywords: ["node", "express", "api", "sql", "mongodb", "authentication", "security", "docker", "testing", "scalability"],
    tools: ["Node.js", "Express", "SQL", "MongoDB", "Authentication", "Docker", "Testing", "Security"],
  },
  {
    match: ["data", "analyst", "analytics", "scientist"],
    title: "Data Analyst",
    keywords: ["sql", "excel", "python", "tableau", "statistics", "dashboard", "visualization", "cleaning", "insights", "reporting"],
    tools: ["SQL", "Excel", "Python", "Tableau", "Statistics", "Dashboards", "Data Cleaning", "Reporting"],
  },
  {
    match: ["cyber", "security", "information security"],
    title: "Cybersecurity Analyst",
    keywords: ["linux", "network", "firewall", "risk", "authentication", "encryption", "monitoring", "incident", "security", "bash"],
    tools: ["Linux", "Networking", "Firewalls", "Authentication", "Encryption", "Monitoring", "Bash", "Risk Analysis"],
  },
  {
    match: ["java", "software", "developer", "sde"],
    title: "Software Developer",
    keywords: ["java", "python", "dsa", "sql", "oop", "git", "testing", "api", "database", "debugging"],
    tools: ["DSA", "OOP", "Java", "Python", "SQL", "Git", "Testing", "Debugging"],
  },
];

const fallbackRoleProfile = {
  title: "Placement Role",
  keywords: ["project", "team", "problem", "technology", "impact", "testing", "sql", "git", "communication", "leadership"],
  tools: ["Projects", "Problem Solving", "SQL", "Git", "Testing", "Communication", "Teamwork", "Leadership"],
};

const questionTemplates = {
  "Online Assessment": {
    count: 10,
    mcq: true,
    stems: [
      "Which skill is most important for a {role} candidate during screening?",
      "Which resume point best matches a {role} opening?",
      "What should you do first when a {role} problem statement is unclear?",
      "Which project detail gives the strongest placement signal?",
      "Which practice routine is best before an online assessment?",
      "Which metric improves an ATS match for {role}?",
      "Which tool should be revised for this role?",
      "What is the best way to handle a timed question?",
      "Which answer style works best for role-based MCQs?",
      "What should you review after each assessment attempt?",
    ],
  },
  "Telephonic Interview": {
    count: 5,
    stems: [
      "Introduce yourself for a {role} opportunity in under one minute.",
      "Why are you interested in {role} work?",
      "Explain one project that proves you can perform as a {role}.",
      "What is one weakness you are improving for this role?",
      "How would you explain a technical concept to a non-technical interviewer?",
    ],
  },
  "Tech Interview": {
    count: 10,
    stems: [
      "Explain the most important fundamentals for a {role}.",
      "Design a small system or module used by a {role}.",
      "Debug a failing feature related to {tool}. What steps do you take?",
      "Compare two tools or approaches commonly used in {role} work.",
      "Walk through a project where you used {tool}.",
      "What testing strategy would you use for a {role} project?",
      "How do you improve performance or reliability in this role?",
      "Explain a data structure, API, or workflow relevant to {role}.",
      "What tradeoff did you make in a technical project?",
      "How would you prepare this project for deployment or review?",
    ],
  },
  HR: {
    count: 7,
    stems: [
      "Tell me about yourself and your career goal.",
      "Why should we hire you for a {role} position?",
      "Tell me about a time you worked in a team.",
      "Describe a challenge you faced and how you handled it.",
      "What are your strengths and areas for improvement?",
      "Where do you see yourself in the next two years?",
      "Why do you want to join this company?",
    ],
  },
};

const difficultyGuide = {
  Easy: "Keep the answer direct and focused on fundamentals.",
  Medium: "Include reasoning, examples, and one tradeoff.",
  Hard: "Add edge cases, metrics, alternatives, and a clear decision.",
};

const skillKnowledge = [
  { keys: ["react", "frontend", "web", "javascript", "html"], title: "Frontend and web roles", tools: ["JavaScript", "HTML", "AJAX", "React-style component thinking", "Git", "GitHub"], advice: "Build UI projects with reusable components, API integration, routing, form validation, accessibility checks, and performance measurement." },
  { keys: ["backend", "api", "node", "server"], title: "Backend and API roles", tools: ["Structured query language SQL", "PostgreSQL", "MongoDB-style databases", "Docker", "Apache Tomcat", "Git"], advice: "Practice REST design, authentication, database modeling, error handling, logging, deployment basics, and clear API documentation." },
  { keys: ["database", "dbms", "sql", "data"], title: "Database skills", tools: ["Structured query language SQL", "Microsoft SQL Server", "Oracle Database", "PostgreSQL", "Amazon DynamoDB"], advice: "Prepare joins, indexes, normalization, transactions, query optimization, and one project where data design improved reliability." },
  { keys: ["cloud", "aws", "devops", "deployment"], title: "Cloud and deployment skills", tools: ["Amazon Web Services AWS software", "Amazon EC2", "Amazon S3", "AWS CloudFormation", "Docker", "Ansible"], advice: "Learn deployment flow, environment variables, basic networking, storage, monitoring, and how cloud choices affect cost and scale." },
  { keys: ["security", "cyber", "auth", "login"], title: "Security skills", tools: ["Firewall software", "Linux", "Bash", "Git", "Access management software", "Intrusion detection systems"], advice: "Cover password hashing, token handling, least privilege, input validation, secure headers, and common web risks." },
  { keys: ["analytics", "excel", "tableau", "powerpoint", "office"], title: "Productivity and analytics skills", tools: ["Microsoft Excel", "Microsoft PowerPoint", "Tableau", "Google Analytics", "Microsoft Office software"], advice: "Show that you can clean data, summarize insights, make readable dashboards, and communicate decisions clearly." },
  { keys: ["project", "management", "jira", "team"], title: "Team workflow skills", tools: ["Atlassian JIRA", "Atlassian Confluence", "Microsoft Project", "Slack", "GitHub"], advice: "Explain sprint planning, task tracking, documentation, code review, and how you handled tradeoffs in team projects." },
];

const planTopics = {
  Coding: [
    ["Arrays and Strings", "Easy"],
    ["Hash Maps", "Easy"],
    ["Recursion and Backtracking", "Medium"],
    ["Dynamic Programming", "Hard"],
  ],
  Theory: [
    ["Operating Systems", "Medium"],
    ["DBMS Transactions", "Medium"],
    ["Computer Networks", "Medium"],
    ["OOP Principles", "Easy"],
  ],
  Aptitude: [
    ["Speed Math", "Easy"],
    ["Logical Reasoning", "Medium"],
    ["Data Interpretation", "Medium"],
    ["Verbal Ability", "Easy"],
  ],
  Interview: [
    ["HR Storytelling", "Medium"],
    ["Project Walkthrough", "Medium"],
    ["Communication Clarity", "Easy"],
    ["Confidence Practice", "Easy"],
  ],
  Web: [
    ["React Performance", "Hard"],
    ["REST API Integration", "Medium"],
    ["Accessibility Checks", "Medium"],
    ["JavaScript Fundamentals", "Easy"],
  ],
  Company: [
    ["Google DSA Patterns", "Hard"],
    ["Microsoft CS Fundamentals", "Medium"],
    ["Amazon Leadership Principles", "Medium"],
    ["Service Company Aptitude", "Easy"],
  ],
};

function normalizeState(value) {
  const merged = structuredClone(seed);
  Object.assign(merged, value || {});
  merged.user = { ...seed.user, ...(value?.user || {}) };
  merged.resume = { ...seed.resume, ...(value?.resume || {}) };
  merged.resume.role = merged.resume.role || merged.user.targetRole;
  merged.resume.text = merged.resume.text || seed.resume.text;
  merged.topics = (value?.topics || seed.topics).map((topic) => ({
    ...topic,
    progress: Number.isFinite(topic.progress) ? topic.progress : 0,
  }));
  return merged;
}

function save() {
  localStorage.setItem("careerforge-version", appVersion);
  localStorage.setItem("careerforge-state", JSON.stringify(state));
  localStorage.setItem("careerforge-active", active);
  localStorage.setItem("careerforge-theme", theme);
}

function el(id) {
  return document.getElementById(id);
}

function app() {
  document.documentElement.dataset.theme = theme;
  if (!authed) {
    renderAuth();
    return;
  }

  el("app").innerHTML = `
    <div class="shell">
      <aside class="rail" id="rail">
        <div class="brand">
          <img class="logo-img" src="./src/assets/college-logo.jpeg" alt="College logo" />
          <div>
            <h1>Path2Placement</h1>
            <p>Placement command center</p>
          </div>
        </div>
        <nav class="nav">
          ${navItems
            .map(([id, glyph, label]) => `<button class="${active === id ? "active" : ""}" data-nav="${id}"><span class="glyph">${glyph}</span>${label}</button>`)
            .join("")}
        </nav>
        <div class="rail-footer">
          <div class="user-pill">
            <strong>${state.user.name}</strong>
            <p class="muted">${state.user.targetRole}</p>
          </div>
          <button class="ghost" id="logout">Sign out</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="row">
            <button class="icon-btn mobile-menu" id="menu" title="Open navigation">☰</button>
            <div>
              <h2>${title()}</h2>
              <span class="muted">${subtitle()}</span>
            </div>
          </div>
          <div class="row">
            <span class="chip">Streak ${streak()} days</span>
            <button class="icon-btn" id="theme" title="Toggle theme">${theme === "dark" ? "☀" : "☾"}</button>
          </div>
        </header>
        <section class="content">${routes[active]?.() || routes.home()}</section>
      </main>
    </div>
  `;

  bindShell();
  bindRoute();
}

function renderAuth() {
  el("app").innerHTML = `
    <section class="auth-screen">
      <div class="auth-art">
        <img class="logo-img auth-logo" src="./src/assets/college-logo.jpeg" alt="College logo" />
        <h1>Learn, Prepare and Step into your career</h1>
        <p>One workspace for everything you need before Placement</p>
        <div class="row">
          <span class="tag strong">ATS scoring</span>
          <span class="tag">Mock interviews</span>
          <span class="tag">Company prep</span>
          <span class="tag">Analytics</span>
        </div>
      </div>
      <form class="auth-box" id="authForm">
        <h2>Welcome back</h2>
        <p class="muted">Use any email and password to enter the demo workspace.</p>
        <div class="grid">
          <div class="field"><label>Email</label><input required type="email" value="${state.user.email}" /></div>
          <div class="field"><label>Password</label><input required type="password" value="placement123" /></div>
          <button class="primary">Enter Path2Placement</button>
          <button class="ghost" type="button" id="resetDemo">Forgot password</button>
        </div>
      </form>
    </section>
  `;
  el("authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    authed = true;
    localStorage.setItem("careerforge-authed", "true");
    app();
  });
  el("resetDemo").addEventListener("click", () => alert("Password reset flow placeholder: token email, verify, and reset screen."));
}

function bindShell() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      active = button.dataset.nav;
      save();
      app();
    });
  });
  el("logout").addEventListener("click", () => {
    authed = false;
    localStorage.setItem("careerforge-authed", "false");
    app();
  });
  el("theme").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    save();
    app();
  });
  el("menu")?.addEventListener("click", () => el("rail").classList.toggle("open"));
}

function bindRoute() {
  const binders = {
    resume: bindResume,
    interview: bindInterview,
    prep: bindPrep,
    assistant: bindAssistant,
    profile: bindProfile,
  };
  binders[active]?.();
}

function title() {
  return navItems.find(([id]) => id === active)?.[2] || "Home";
}

function subtitle() {
  const copy = {
    home: "Turning Preparation into Opportunity",
    dashboard: "Your current preparation pulse",
    resume: "ATS score, skills, gaps, and feedback",
    interview: "Generate questions and evaluate answers",
    prep: "Coding, theory, aptitude, and company tracks",
    assistant: "Career guidance chat sandbox",
    analytics: "Progress, streaks, and readiness signals",
    profile: "Student profile and preferences",
  };
  return copy[active];
}

function streak() {
  return Math.max(4, Math.round(avg(state.topics.map((topic) => topic.progress)) / 10));
}

function avg(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentRole() {
  return state.user.targetRole.trim() || "Placement Role";
}

function getRoleProfile(role = currentRole()) {
  const lower = role.toLowerCase();
  return roleProfiles.find((profile) => profile.match.some((term) => lower.includes(term))) || {
    ...fallbackRoleProfile,
    title: role,
  };
}

function analyzeResumeForRole(resumeText, role) {
  const profile = getRoleProfile(role);
  const text = resumeText.toLowerCase();
  const matched = profile.keywords.filter((keyword) => text.includes(keyword));
  const missing = profile.keywords.filter((keyword) => !text.includes(keyword));
  const hasMetrics = /\b\d+%?|\b(increased|reduced|improved|optimized|built|led|created|deployed)\b/i.test(resumeText);
  const hasProjects = /\b(project|built|developed|implemented|designed)\b/i.test(resumeText);
  const score = Math.min(98, Math.max(34, 38 + matched.length * 6 + (hasMetrics ? 10 : 0) + (hasProjects ? 8 : 0)));
  const skills = matched.length ? matched.map(titleCase) : ["Projects", "Communication"];
  const suggestions = [
    missing.length ? `Add role keywords such as ${missing.slice(0, 4).map(titleCase).join(", ")}.` : "Your resume already includes the major role keywords.",
    hasMetrics ? "Good: you included measurable or action-oriented impact." : "Add numbers such as users, time saved, accuracy, speed, or percentage improvement.",
    hasProjects ? "Keep project bullets tied to the target role responsibilities." : "Add at least one project that clearly proves hands-on experience.",
    `For ${role}, emphasize ${profile.tools.slice(0, 4).join(", ")} where they truthfully match your work.`,
  ];
  return { score, skills, missing: missing.slice(0, 6).map(titleCase), suggestions };
}

function titleCase(value) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function makeInterviewQuestions(role, type, difficulty) {
  const profile = getRoleProfile(role);
  const config = questionTemplates[type] || questionTemplates["Tech Interview"];
  const pool = config.stems.map((stem, index) => {
    const tool = profile.tools[index % profile.tools.length];
    const text = `${stem.replaceAll("{role}", role).replaceAll("{tool}", tool)} ${difficultyGuide[difficulty]}`;
    if (!config.mcq) return text;
    const correct = index % 4;
    const options = [
      `Revise ${tool} fundamentals and practice role-specific examples.`,
      "Memorize unrelated definitions without applying them.",
      "Ignore the target role and answer generally.",
      "Skip review and only attempt random questions.",
    ];
    return {
      text,
      options,
      answer: correct === 0 ? 0 : 0,
    };
  });
  return pool.slice(0, config.count);
}

function buildPrepTopics(track, role = currentRole()) {
  const profile = getRoleProfile(role);
  const toolA = profile.tools[0] || role;
  const toolB = profile.tools[1] || "core concepts";
  const toolC = profile.tools[2] || "projects";
  const topics = {
    Coding: [
      [`${role} coding basics`, [`Basics of arrays`, `Array problems for ${role}`, "Hash map patterns", "Timed coding set"], "Easy"],
      ["Problem solving patterns", ["Two pointers", "Sliding window", "Recursion practice", "Mixed interview problems"], "Medium"],
      ["Role-based DSA revision", ["Sorting and searching", "Stack and queue use cases", "Trees or graphs", "Final timed mock"], "Hard"],
    ],
    Theory: [
      [`${role} fundamentals`, [`${toolA} basics`, `${toolB} concepts`, `${toolC} use cases`, "Interview summary notes"], "Easy"],
      ["CS foundation", ["OOP principles", "DBMS basics", "Operating systems", "Computer networks"], "Medium"],
      ["Deep revision", ["Tradeoffs", "Common mistakes", "Scenario questions", "Final revision"], "Hard"],
    ],
    Aptitude: [
      ["Quantitative aptitude", ["Percentages", "Ratios", "Time and work", "Timed section"], "Easy"],
      ["Reasoning practice", ["Series", "Puzzles", "Syllogisms", "Mixed practice"], "Medium"],
      ["Placement test drill", ["Data interpretation", "Verbal ability", "Full mock", "Mistake review"], "Medium"],
    ],
    Interview: [
      [`${role} introduction`, ["Self intro", "Career goal", "Project pitch", "Role fit answer"], "Easy"],
      ["Project storytelling", ["Problem statement", "Your contribution", "Technical choices", "Impact"], "Medium"],
      ["Communication polish", ["Concise answers", "Follow-up handling", "Confidence practice", "Final mock"], "Medium"],
    ],
    Web: [
      [`${toolA} project readiness`, [`${toolA} basics`, `${toolA} project feature`, "Testing checklist", "Performance review"], "Medium"],
      [`${toolB} integration`, ["API or data flow", "Error handling", "Responsive UI", "Deployment notes"], "Medium"],
      ["Portfolio polish", ["Project README", "Screenshots", "Metrics", "Demo script"], "Easy"],
    ],
    Company: [
      ["Product company track", ["DSA patterns", "CS fundamentals", "Project deep dive", "Mock round"], "Hard"],
      ["Service company track", ["Aptitude", "SQL or programming basics", "HR preparation", "Communication"], "Easy"],
      ["Final placement sprint", ["Resume review", "Company FAQs", "Timed mock", "Mistake log"], "Medium"],
    ],
  };

  return (topics[track] || topics.Coding).map(([name, steps, difficulty]) => ({
    name: steps[0],
    planTitle: name,
    steps,
    stepIndex: 0,
    type: track,
    difficulty,
    role,
    progress: 0,
  }));
}

function planPreview(track) {
  return buildPrepTopics(track)
    .map((topic) => `${topic.planTitle}: ${topic.steps.join(" → ")}`)
    .join("<br>");
}

const routes = {
  home: () => `
    <section class="hero">
      <div>
        <span class="eyebrow">AI placement preparation platform</span>
        <h2>Turning Preparation into Opportunity</h2>
        <p>One workspace for everything you need before Placement</p>
        <div class="row">
          <button class="primary" data-nav="dashboard">Open dashboard</button>
          <button class="secondary" data-nav="resume">Analyze resume</button>
          <button class="ghost" data-nav="interview">Start mock interview</button>
        </div>
      </div>
      <div class="orbit">
        <div class="spread"><span class="tag strong">Live readiness</span><strong>${readiness()}%</strong></div>
        <div class="grid">
          ${["Resume", "Interview", "Coding", "Theory"].map((label, index) => metricLine(label, [state.resume.score, interviewAvg(), topicType("Coding"), topicType("Theory")][index])).join("")}
        </div>
      </div>
    </section>
  `,
  dashboard: () => `
    <div class="grid cols-4">
      ${metric("ATS Score", state.resume.score, "Resume strength")}
      ${metric("Interview Avg", interviewAvg(), "Recent mock score")}
      ${metric("Learning", avg(state.topics.map((t) => t.progress)), "Topic completion")}
      ${metric("Readiness", readiness(), "Placement signal")}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <section class="panel">
        <div class="spread"><h3>Today’s Focus</h3><span class="chip">AI recommended</span></div>
        <div class="timeline">
          ${todayFocus()}
        </div>
      </section>
      <section class="panel">
        <h3>Company Readiness</h3>
        <div class="list">${state.companies.map((company) => `<div class="item spread"><div><strong>${company.name}</strong><p class="muted">${company.pattern}</p></div><span class="tag">${company.readiness}%</span></div>`).join("")}</div>
      </section>
    </div>
  `,
  resume: () => `
    <div class="grid cols-2">
      <section class="panel">
        <h3>Analyze Resume</h3>
        <p class="muted">Paste the resume text. Path2Placement compares it with the target role saved in Profile.</p>
        <div class="grid">
          <div class="field"><label>Saved target role</label><input id="targetRole" value="${currentRole()}" readonly /></div>
          <div class="field"><label>Resume text</label><textarea id="resumeText">${escapeHtml(state.resume.text)}</textarea></div>
          <button class="primary" id="analyzeResume">Run analysis</button>
        </div>
      </section>
      <section class="panel">
        <div class="spread"><h3>ATS Report</h3><strong>${state.resume.score}/100</strong></div>
        <p class="muted">Current analysis for: ${escapeHtml(state.resume.role || state.user.targetRole)}</p>
        ${meter(state.resume.score)}
        <h4>Extracted skills</h4>
        <div class="row">${state.resume.skills.map((skill) => `<span class="tag">${skill}</span>`).join("")}</div>
        <h4>Missing skills</h4>
        <div class="row">${state.resume.missing.map((skill) => `<span class="tag">${skill}</span>`).join("")}</div>
        <h4>Resume suggestions</h4>
        <div class="list">${(state.resume.suggestions || [state.resume.feedback]).map((item) => `<div class="item">${escapeHtml(item)}</div>`).join("")}</div>
        <p class="muted">${state.resume.feedback}</p>
      </section>
    </div>
  `,
  interview: () => `
    <div class="grid cols-2">
      <section class="panel">
        <h3>Mock Interview Studio</h3>
        <div class="grid">
          <div class="field"><label>Saved target role</label><input id="interviewRole" value="${currentRole()}" readonly /></div>
          <div class="field"><label>Interview type</label><select id="interviewType"><option>Online Assessment</option><option>Telephonic Interview</option><option>Tech Interview</option><option>HR</option></select></div>
          <div class="field"><label>Difficulty</label><select id="interviewDifficulty"><option>Medium</option><option>Easy</option><option>Hard</option></select></div>
          <button class="primary" id="startInterview">Start interview</button>
        </div>
      </section>
      <section class="panel" id="interviewPanel">
        ${interviewView()}
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h3>Interview History</h3>
      <table class="table"><thead><tr><th>Role</th><th>Interview type</th><th>Difficulty</th><th>Score</th><th>Date</th></tr></thead><tbody>
        ${state.interviews.map((row) => `<tr><td>${row.role}</td><td>${row.type || row.domain}</td><td>${row.difficulty}</td><td>${row.score}</td><td>${row.date}</td></tr>`).join("")}
      </tbody></table>
    </section>
  `,
  prep: () => `
    <div class="grid cols-3">
      ${["Coding", "Theory", "Aptitude", "Interview", "Web", "Company"].map((track) => `<section class="panel"><div class="spread"><h3>${track}</h3><span class="tag">${track === "Company" ? "10 firms" : `${topicType(track)}%`}</span></div><p class="muted">${trackCopy(track)}</p><button class="secondary prep-action" data-track="${track}">See Plan</button></section>`).join("")}
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="spread"><h3>Topic Progress</h3><span class="chip">Target role: ${escapeHtml(currentRole())}</span></div>
      <p class="muted">Open a plan, then Mark Practice to save progress and move each item to its next subtopic.</p>
      ${state.activePrepTrack ? `<div class="item"><strong>${state.activePrepTrack} plan</strong><p class="muted">${planPreview(state.activePrepTrack)}</p></div>` : ""}
      <div class="list">${state.topics.map((topic, index) => `<div class="item"><div class="spread"><div><strong>${topic.name}</strong><p class="muted">${topic.planTitle || topic.type} ${topic.role ? `for ${escapeHtml(topic.role)}` : ""}</p></div><span class="tag">${topic.type} · ${topic.difficulty} · ${topic.progress}%</span></div>${meter(topic.progress)}<button class="ghost topic-plus" data-index="${index}">Mark practice</button></div>`).join("")}</div>
    </section>
  `,
  assistant: () => `
    <section class="panel chat">
      <div class="messages" id="messages">${state.chats.map((chat) => `<div class="bubble ${chat.from === "user" ? "user" : ""}">${chat.text}</div>`).join("")}</div>
      <form class="row" id="chatForm">
        <input id="chatInput" placeholder="Ask about Google prep, DBMS, resume bullets, interview questions..." />
        <button class="primary">Send</button>
      </form>
    </section>
  `,
  analytics: () => `
    <div class="grid cols-3">
      ${metric("Resume Momentum", state.resume.score + 4, "Projected after fixes")}
      ${metric("Skill Growth", avg(state.topics.map((t) => t.progress)) + 7, "This month")}
      ${metric("Confidence", Math.min(96, interviewAvg() + 8), "Mock interview trend")}
    </div>
    <section class="panel" style="margin-top:16px">
      <h3>Weekly Analytics</h3>
      <div class="grid cols-4">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => `<div class="card"><span class="muted">${day}</span><strong style="display:block;font-size:28px">${[42, 55, 72, 63, 80, 76, 91][index]}%</strong>${meter([42, 55, 72, 63, 80, 76, 91][index])}</div>`).join("")}</div>
    </section>
  `,
  profile: () => `
    <section class="panel">
      <h3>Profile</h3>
      <div class="grid cols-2">
        <div class="field"><label>Name</label><input id="profileName" value="${state.user.name}" /></div>
        <div class="field"><label>Email</label><input id="profileEmail" value="${state.user.email}" /></div>
        <div class="field"><label>Target role</label><input id="profileRole" value="${state.user.targetRole}" /></div>
        <div class="field"><label>College</label><input id="profileCollege" value="${state.user.college}" /></div>
      </div>
      <h4>Skills</h4>
      <div class="row">${state.user.skills.map((skill) => `<span class="tag">${skill}</span>`).join("")}</div>
      <button class="primary" id="saveProfile" style="margin-top:16px">Save profile</button>
    </section>
  `,
};

function metric(label, value, hint) {
  return `<section class="panel metric"><span class="muted">${label}</span><strong>${value}${Number(value) <= 100 ? "%" : ""}</strong>${meter(Math.min(100, value))}<span class="muted">${hint}</span></section>`;
}

function feature(name, copy, route) {
  return `<section class="card"><h3>${name}</h3><p class="muted">${copy}</p><button class="secondary" data-nav="${route}">Open</button></section>`;
}

function metricLine(label, value) {
  return `<div><div class="spread"><span>${label}</span><strong>${value}%</strong></div>${meter(value)}</div>`;
}

function meter(value) {
  return `<div class="meter" style="--value:${Math.max(0, Math.min(100, Math.round(value)))}%"><span></span></div>`;
}

function readiness() {
  return avg([state.resume.score, interviewAvg(), avg(state.topics.map((topic) => topic.progress))]);
}

function todayFocus() {
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const plan = state.studyPlan.find((item) => item.day === dayName) || state.studyPlan[0];
  return `<div class="item"><strong>${dayName}: ${plan.focus}</strong><p class="muted">${plan.tasks.join(" · ")}</p>${meter((plan.done / plan.tasks.length) * 100)}</div>`;
}

function interviewAvg() {
  return avg(state.interviews.map((item) => item.score));
}

function topicType(type) {
  const matching = state.topics.filter((topic) => topic.type === type);
  return matching.length ? avg(matching.map((topic) => topic.progress)) : avg(state.topics.map((topic) => topic.progress));
}

function trackCopy(track) {
  const copy = {
    Coding: "DSA patterns, Blind 75 style practice, LeetCode and GFG recommendations.",
    Theory: "OS, DBMS, CN, OOPs, SQL, JavaScript, React, Node.js, and concise notes.",
    Aptitude: "Speed math, logical reasoning, verbal ability, and company test drills.",
    Interview: "HR stories, communication practice, confidence scoring, and feedback loops.",
    Web: "Frontend, backend, REST APIs, performance, accessibility, and deployment prep.",
    Company: "Company-wise patterns, interview experiences, FAQs, coding focus, and tips.",
  };
  return copy[track];
}

function interviewView() {
  if (!interview) {
    return `<h3>Session</h3><p class="muted">Start an interview to receive generated questions, answer scoring, feedback, and a final report.</p>`;
  }
  const done = interview.index >= interview.questions.length;
  if (done) {
    return `<h3>Final Report</h3><strong style="font-size:40px">${interview.score}%</strong><p class="muted">Strong structure. Add more concrete examples and tighter technical depth.</p><button class="secondary" id="saveInterview">Save result</button>`;
  }
  const current = interview.questions[interview.index];
  const questionText = typeof current === "string" ? current : current.text;
  if (interview.mode === "mcq") {
    return `<span class="tag">${interview.index + 1}/${interview.questions.length}</span><p class="question">${questionText}</p><div class="list">${current.options.map((option, index) => `<label class="item row"><input type="radio" name="mcqAnswer" value="${index}" style="width:auto;min-height:auto" />${option}</label>`).join("")}</div><button class="primary" id="submitAnswer" style="margin-top:10px">Submit answer</button>`;
  }
  return `<span class="tag">${interview.index + 1}/${interview.questions.length}</span><p class="question">${questionText}</p><textarea id="answerText" placeholder="Type your answer..."></textarea><button class="primary" id="submitAnswer" style="margin-top:10px">Submit answer</button>`;
}

function bindResume() {
  el("analyzeResume").addEventListener("click", () => {
    const rawText = el("resumeText").value.trim();
    const role = currentRole();
    const analysis = analyzeResumeForRole(rawText, role);
    state.resume.score = analysis.score;
    state.resume.role = role;
    state.resume.text = rawText;
    state.resume.skills = analysis.skills;
    state.resume.missing = analysis.missing;
    state.resume.suggestions = analysis.suggestions;
    state.resume.feedback = `ATS score generated against the saved Profile target role: ${role}.`;
    save();
    app();
  });
}

function bindInterview() {
  el("startInterview").addEventListener("click", () => {
    interview = {
      role: currentRole(),
      type: el("interviewType").value,
      difficulty: el("interviewDifficulty").value,
      questions: makeInterviewQuestions(currentRole(), el("interviewType").value, el("interviewDifficulty").value),
      mode: el("interviewType").value === "Online Assessment" ? "mcq" : "text",
      index: 0,
      points: 0,
      score: 0,
    };
    app();
  });
  el("submitAnswer")?.addEventListener("click", () => {
    let score = 0;
    if (interview.mode === "mcq") {
      const chosen = document.querySelector("input[name='mcqAnswer']:checked");
      score = chosen && Number(chosen.value) === interview.questions[interview.index].answer ? 10 : 0;
    } else {
      const answer = el("answerText").value.trim();
      const difficultyBoost = interview.difficulty === "Hard" ? 2 : interview.difficulty === "Easy" ? 0 : 1;
      score = Math.min(10, Math.max(2, Math.round(answer.length / 30) + difficultyBoost + (answer.match(/\b(because|measured|tradeoff|example|result|role|project)\b/gi)?.length || 0)));
    }
    interview.points += score;
    interview.index += 1;
    interview.score = Math.round((interview.points / (interview.questions.length * 10)) * 100);
    app();
  });
  el("saveInterview")?.addEventListener("click", () => {
    state.interviews.unshift({
      role: interview.role,
      type: interview.type,
      difficulty: interview.difficulty,
      score: interview.score,
      date: "Today",
    });
    interview = null;
    save();
    app();
  });
}

function bindPrep() {
  document.querySelectorAll(".topic-plus").forEach((button) => {
    button.addEventListener("click", () => {
      const topic = state.topics[Number(button.dataset.index)];
      const steps = topic.steps || [topic.name];
      topic.stepIndex = Math.min((topic.stepIndex || 0) + 1, steps.length - 1);
      topic.name = steps[topic.stepIndex];
      topic.progress = Math.min(100, Math.round(((topic.stepIndex + 1) / steps.length) * 100));
      save();
      app();
    });
  });
  document.querySelectorAll(".prep-action").forEach((button) => {
    button.addEventListener("click", () => {
      const track = button.dataset.track;
      state.activePrepTrack = track;
      state.topics = buildPrepTopics(track, currentRole());
      save();
      app();
    });
  });
}

function bindAssistant() {
  el("messages").scrollTop = el("messages").scrollHeight;
  el("chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = el("chatInput");
    const text = input.value.trim();
    if (!text) return;
    state.chats.push({ from: "user", text });
    state.chats.push({ from: "ai", text: assistantReply(text) });
    save();
    app();
  });
}

function assistantReply(text) {
  const lower = text.toLowerCase();
  const match = skillKnowledge.find((item) => item.keys.some((key) => lower.includes(key)));
  if (lower.includes("resume")) {
    const tools = match ? match.tools.slice(0, 4).join(", ") : state.resume.skills.join(", ");
    return `For your resume, highlight role-matched tools such as ${tools}. Keep each bullet in this shape: action, technology, result, measurable impact.`;
  }
  if (lower.includes("google") || lower.includes("microsoft") || lower.includes("amazon")) {
    return "For product-company prep, prioritize DSA patterns, CS fundamentals, one deep project walkthrough, and timed mock interviews. Add company-specific stories for tradeoffs, ownership, and measurable outcomes.";
  }
  if (lower.includes("plan") || lower.includes("roadmap") || lower.includes("prepare")) {
    const focus = match || skillKnowledge[0];
    return `${focus.title} roadmap: first revise fundamentals, then build one small project using ${focus.tools.slice(0, 3).join(", ")}, then practice interview explanations. ${focus.advice}`;
  }
  if (match) {
    return `${match.title}: important tools from the attached skills data include ${match.tools.join(", ")}. ${match.advice}`;
  }
  return "I can help better if you mention a role, tool, company, or topic. For example: React roadmap, SQL interview questions, AWS skills, resume keywords, or Amazon preparation.";
}

function bindProfile() {
  el("saveProfile").addEventListener("click", () => {
    const previousRole = state.user.targetRole;
    state.user.name = el("profileName").value;
    state.user.email = el("profileEmail").value;
    state.user.targetRole = el("profileRole").value;
    state.user.college = el("profileCollege").value;
    if (previousRole !== state.user.targetRole) {
      state.resume.role = state.user.targetRole;
      state.activePrepTrack = state.activePrepTrack || "Coding";
      state.topics = buildPrepTopics(state.activePrepTrack, state.user.targetRole);
    }
    save();
    app();
  });
}

app();
