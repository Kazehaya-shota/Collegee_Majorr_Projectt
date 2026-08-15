export type InterviewSetup = {
  company: string;
  role: string;
  experience: string;
  focus: string;
  jobDescription: string;
};

export type InterviewQuestion = {
  id: string;
  category: 'Introduction' | 'Technical' | 'Problem solving' | 'Behavioural' | 'Role fit' | 'Follow-up';
  prompt: string;
  cue: string;
};

export type InterviewPlan = {
  title: string;
  companyNote: string;
  estimatedMinutes: number;
  questions: InterviewQuestion[];
};

export type Resource = {
  type: 'Watch' | 'Read' | 'Practice' | 'Official';
  title: string;
  description: string;
  url: string;
  source: string;
};

export type InterviewFeedback = {
  score: number;
  readiness: string;
  summary: string;
  strengths: string[];
  growthAreas: Array<{ title: string; note: string }>;
  nextSteps: string[];
  categoryScores: Array<{ label: string; score: number }>;
};

export const companies = [
  'Accenture', 'Adobe', 'Airbnb', 'Amazon', 'American Express', 'Apple', 'Atlassian', 'Barclays', 'BCG', 'Capgemini',
  'Cisco', 'Cognizant', 'Deloitte', 'EY', 'Flipkart', 'Google', 'Goldman Sachs', 'HCLTech', 'IBM', 'Infosys',
  'Intel', 'JPMorgan Chase', 'KPMG', 'Larsen & Toubro', 'Mastercard', 'McKinsey & Company', 'Meta', 'Microsoft',
  'Morgan Stanley', 'Netflix', 'Oracle', 'PayPal', 'PwC', 'Qualcomm', 'Razorpay', 'Reliance Industries', 'Samsung',
  'Salesforce', 'Siemens', 'Spotify', 'Swiggy', 'TCS', 'Tech Mahindra', 'Uber', 'Unilever', 'Walmart', 'Wipro',
  'Zoho', 'Zomato',
];
export const roles = ['Software Engineer', 'Data Analyst', 'Product Manager', 'Business Analyst', 'UX / UI Designer', 'Consultant', 'Marketing Associate', 'Custom role'];
export const focuses = ['Full interview loop', 'Technical depth', 'Behavioural storytelling', 'Case / problem solving', 'Communication confidence'];

function clipped(value: unknown, fallback: string, limit: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
}

export function parseInterviewSetup(value: unknown): InterviewSetup {
  const setup = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    company: clipped(setup.company, 'General interview', 80),
    role: clipped(setup.role, 'Graduate role', 100),
    experience: clipped(setup.experience, 'Student / fresher', 70),
    focus: clipped(setup.focus, 'Full interview loop', 70),
    jobDescription: clipped(setup.jobDescription, '', 4_000),
  };
}

function text(value: unknown, fallback: string, limit: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
}

export function parseInterviewPlan(value: unknown): InterviewPlan {
  if (!value || typeof value !== 'object') throw new Error('The interview plan was invalid.');
  const data = value as Record<string, unknown>;
  // Keep earlier in-progress practice sessions reviewable while new sessions use 12 questions.
  if (!Array.isArray(data.questions) || data.questions.length < 4) throw new Error('The interview needs more questions.');
  const validCategories = new Set<InterviewQuestion['category']>(['Introduction', 'Technical', 'Problem solving', 'Behavioural', 'Role fit', 'Follow-up']);
  return {
    title: text(data.title, 'Your adaptive practice interview', 120),
    companyNote: text(data.companyNote, 'A focused practice session tuned to your chosen role.', 220),
    estimatedMinutes: Math.min(55, Math.max(28, Math.round(Number(data.estimatedMinutes) || 35))),
    questions: data.questions.slice(0, 12).map((question, index) => {
      const item = (question && typeof question === 'object' ? question : {}) as Record<string, unknown>;
      const category = text(item.category, index === 0 ? 'Introduction' : 'Role fit', 30) as InterviewQuestion['category'];
      return {
        id: `q-${index + 1}`,
        category: validCategories.has(category) ? category : 'Role fit',
        prompt: text(item.prompt, `Tell me about a project that prepared you for ${index === 0 ? 'this role' : 'this kind of work'}.`, 500),
        cue: text(item.cue, 'Use a clear example, your specific contribution, and the result.', 180),
      };
    }),
  };
}

export function createResilientInterviewFeedback(setup: InterviewSetup, answers: string[]): InterviewFeedback {
  const words = answers.map((answer) => answer.trim().split(/\s+/).filter(Boolean).length);
  const averageWords = words.length ? Math.round(words.reduce((total, count) => total + count, 0) / words.length) : 0;
  const detailedAnswers = answers.filter((answer) => /\b(i|my|we)\b/i.test(answer) && /\b(result|impact|learned|improved|built|led|delivered|reduced|increased)\b/i.test(answer)).length;
  const score = Math.min(88, Math.max(58, 60 + Math.min(14, Math.round(averageWords / 11)) + Math.min(12, detailedAnswers * 3)));
  const needsEvidence = detailedAnswers < Math.ceil(Math.max(answers.length, 1) / 2);
  return {
    score,
    readiness: score >= 78 ? 'Strong foundation' : 'Building interview momentum',
    summary: `You completed a focused ${setup.role} practice interview for ${setup.company}. Your report is ready now, with the strongest gains coming from sharper examples and clearer outcomes.`,
    strengths: [
      averageWords >= 65 ? 'You gave considered answers with enough context to show your thinking.' : 'You completed every stage of the practice interview and kept your answers focused.',
      detailedAnswers ? 'You brought personal experience into parts of the conversation instead of answering in generalities.' : 'You established a useful first draft of the stories you want to tell in a real interview.',
    ],
    growthAreas: [
      { title: 'Make the impact visible', note: needsEvidence ? 'For each key story, name the situation, your exact action, and a concrete result—number it when possible.' : 'Keep finishing strong answers with the measurable outcome or lesson that came from your decision.' },
      { title: 'Lead with your point', note: 'Start with the direct answer in one sentence, then add the context and example. It makes your reasoning easier to follow.' },
    ],
    nextSteps: ['Choose two project stories and rehearse them using situation, action, and result.', `Review the role requirements for ${setup.role}, then run another full interview loop.`, 'Record a 90-second answer to “Tell me about yourself” and remove any unnecessary setup.'],
    categoryScores: [
      { label: 'Clarity', score: Math.min(90, score + (averageWords >= 55 ? 3 : -2)) },
      { label: 'Structure', score: Math.max(52, score - (needsEvidence ? 7 : 1)) },
      { label: 'Role knowledge', score: Math.min(90, score + 1) },
      { label: 'Impact', score: Math.max(50, score - (needsEvidence ? 9 : 3)) },
    ],
  };
}

export function parseInterviewFeedback(value: unknown): InterviewFeedback {
  if (!value || typeof value !== 'object') throw new Error('The feedback was invalid.');
  const data = value as Record<string, unknown>;
  const score = Math.min(100, Math.max(0, Math.round(Number(data.score) || 0)));
  const asList = (input: unknown, fallback: string[]) => Array.isArray(input)
    ? input.slice(0, 4).map((item) => text(item, '', 180)).filter(Boolean)
    : fallback;
  const categoryScores = Array.isArray(data.categoryScores) ? data.categoryScores.slice(0, 4).map((item, index) => {
    const scoreItem = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return { label: text(scoreItem.label, ['Clarity', 'Structure', 'Role knowledge', 'Impact'][index], 40), score: Math.min(100, Math.max(0, Math.round(Number(scoreItem.score) || 0))) };
  }) : [];
  const growthAreas = Array.isArray(data.growthAreas) ? data.growthAreas.slice(0, 3).map((item, index) => {
    const growth = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return { title: text(growth.title, `Focus area ${index + 1}`, 70), note: text(growth.note, 'Add a concrete example and show the result of your decisions.', 220) };
  }) : [];
  return {
    score,
    readiness: text(data.readiness, score >= 75 ? 'Strong foundation' : 'Building momentum', 70),
    summary: text(data.summary, 'You completed the mock. Use the focused next steps below before your next round.', 450),
    strengths: asList(data.strengths, ['You stayed engaged through the full practice run.']),
    growthAreas: growthAreas.length ? growthAreas : [{ title: 'Evidence', note: 'Add one concrete example, action, and outcome to each important answer.' }],
    nextSteps: asList(data.nextSteps, ['Rehearse your two strongest project stories aloud.', 'Run another mock after a short focused study session.']),
    categoryScores: categoryScores.length ? categoryScores : [{ label: 'Clarity', score }, { label: 'Structure', score: Math.max(0, score - 4) }, { label: 'Role knowledge', score: Math.max(0, score - 7) }],
  };
}

export function resourceShelf(setup: InterviewSetup): Resource[] {
  const query = encodeURIComponent(`${setup.role} interview preparation ${setup.focus}`);
  const roleQuery = encodeURIComponent(`${setup.role} interview questions and answers`);
  const shelf: Resource[] = [
    { type: 'Watch', title: `Role-focused interview prep`, description: `A fresh YouTube search for ${setup.role} interview walkthroughs and mock answers.`, url: `https://www.youtube.com/results?search_query=${query}`, source: 'YouTube' },
    { type: 'Practice', title: 'Practice explaining your work', description: 'Use a simple STAR structure to make your examples specific and memorable.', url: 'https://www.indeed.com/career-advice/interviewing/star-interview-method', source: 'Indeed Career Guide' },
    { type: 'Read', title: `${setup.role} practice questions`, description: 'Use this as a research starting point, then adapt each response to your real experience.', url: `https://www.google.com/search?q=${roleQuery}`, source: 'Curated search' },
  ];
  if (setup.company === 'Amazon') shelf.unshift({ type: 'Official', title: 'Amazon interview loop', description: 'Amazon’s public guide covers the interview loop, behavioural questions, and preparation themes.', url: 'https://amazon.jobs/content/en/how-we-hire/interview-loop', source: 'Amazon Jobs' });
  if (setup.company === 'Microsoft') shelf.unshift({ type: 'Official', title: 'Microsoft early-career interview tips', description: 'Microsoft’s official student guide explains how it assesses role knowledge, critical thinking, and learning ability.', url: 'https://careers.microsoft.com/v2/global/en/hiring-tips/student-interviewing', source: 'Microsoft Careers' });
  return shelf.slice(0, 4);
}
