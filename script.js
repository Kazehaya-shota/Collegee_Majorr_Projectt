const topicInput = document.querySelector('#topic');
const form = document.querySelector('#course-form');
const preview = document.querySelector('#preview');
const modulesContainer = document.querySelector('#generated-modules');

const moduleTemplates = [
  ['01', 'Set the foundations', 'Why it matters, principles, and a shared vocabulary'],
  ['02', 'Build a shared language', 'Naming, patterns, and lightweight documentation'],
  ['03', 'Create components that scale', 'Anatomy, variants, and meaningful constraints'],
  ['04', 'Work with design tokens', 'Turn visual decisions into reusable rules'],
  ['05', 'Put governance into practice', 'Review rituals, ownership, and adoption'],
  ['06', 'Apply it to a real project', 'A focused final challenge and reflection']
];

function topicWords(topic) {
  const trimmed = topic.trim();
  return trimmed || 'your chosen topic';
}

function renderPath(topic) {
  const title = topicWords(topic);
  const templates = title.toLowerCase().includes('design system')
    ? moduleTemplates
    : [
      ['01', 'Map the essentials', `Build a clear mental model of ${title}`],
      ['02', 'Learn the core patterns', 'Recognize the methods and tools that matter'],
      ['03', 'Practice with examples', 'Use guided exercises to build confidence'],
      ['04', 'Solve realistic problems', 'Apply the ideas in context and get feedback'],
      ['05', 'Build your working system', 'Turn knowledge into a repeatable approach'],
      ['06', 'Put it into action', 'Complete a focused project and reflection']
    ];

  modulesContainer.innerHTML = templates.map(([number, title, description]) => `
    <div class="roadmap-module">
      <b>${number}</b>
      <div><strong>${title}</strong><small>${description}</small></div>
      <button aria-label="Edit ${title}">⋮</button>
    </div>`).join('');
}

function revealPath(event) {
  event?.preventDefault();
  renderPath(topicInput.value);
  preview.hidden = false;
  preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', revealPath);

document.querySelectorAll('[data-scroll-to]').forEach((button) => {
  button.addEventListener('click', () => document.getElementById(button.dataset.scrollTo).scrollIntoView({ behavior: 'smooth', block: 'center' }));
});

document.querySelectorAll('.chips button, .library-pills button').forEach((button) => {
  button.addEventListener('click', () => {
    topicInput.value = button.textContent.trim();
    document.getElementById('planner').scrollIntoView({ behavior: 'smooth', block: 'center' });
    topicInput.focus();
  });
});

document.querySelector('.add-source').addEventListener('click', () => {
  const button = document.querySelector('.add-source');
  button.textContent = 'Source added ✓';
  button.style.color = '#4b9d75';
});

document.querySelectorAll('.coach-suggestions button').forEach((button) => {
  button.addEventListener('click', () => {
    button.textContent = 'Applied ✓';
    button.style.color = '#4b9d75';
  });
});

document.querySelector('.start-path').addEventListener('click', () => {
  const button = document.querySelector('.start-path');
  button.innerHTML = 'Your first lesson is ready <span>→</span>';
});
