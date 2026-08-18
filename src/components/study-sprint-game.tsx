'use client';

import { useEffect, useRef, useState } from 'react';

type Question = { prompt: string; options: string[]; answer: number; explanation: string };
type Rival = 'rival-glider' | 'rival-tentacle' | 'rival-symbiote' | 'rival-wing' | 'rival-electric' | 'rival-armored' | 'rival-shadow' | 'rival-sand';
type ActiveRival = { id: number; kind: Rival; duration: number };

const rivals: Rival[] = ['rival-glider', 'rival-tentacle', 'rival-symbiote', 'rival-wing', 'rival-electric', 'rival-armored', 'rival-shadow', 'rival-sand'];
const questions: Question[] = [
  { prompt: 'What is 15% of 240?', options: ['24', '30', '36', '48'], answer: 2, explanation: '10% of 240 is 24 and 5% is 12, so 15% is 36.' },
  { prompt: 'A train travels 180 km in 3 hours. What is its average speed?', options: ['40 km/h', '50 km/h', '60 km/h', '90 km/h'], answer: 2, explanation: 'Average speed is distance divided by time: 180 ÷ 3 = 60 km/h.' },
  { prompt: 'Solve: 3(x + 4) = 27. What is x?', options: ['3', '5', '9', '13'], answer: 1, explanation: 'Divide by 3 to get x + 4 = 9, then subtract 4: x = 5.' },
  { prompt: 'A jacket costs ₹1,200 after a 20% discount. What was the original price?', options: ['₹1,350', '₹1,440', '₹1,500', '₹1,600'], answer: 2, explanation: '₹1,200 is 80% of the original price, so the original is 1,200 ÷ 0.8 = ₹1,500.' },
  { prompt: 'Which fraction is the largest?', options: ['3/8', '5/12', '7/16', '1/2'], answer: 3, explanation: 'One half equals 0.5, which is larger than the other fractions.' },
  { prompt: 'What is the next number in the pattern 2, 6, 12, 20, ...?', options: ['24', '28', '30', '32'], answer: 2, explanation: 'The gaps are +4, +6, +8, so the next gap is +10: 20 + 10 = 30.' },
  { prompt: 'Which organ pumps blood around the human body?', options: ['Lungs', 'Brain', 'Heart', 'Liver'], answer: 2, explanation: 'The heart contracts rhythmically to circulate blood through the body.' },
  { prompt: 'What is the chemical symbol for gold?', options: ['Ag', 'Au', 'Gd', 'Go'], answer: 1, explanation: 'Au comes from aurum, the Latin word for gold.' },
  { prompt: 'Which gas do plants primarily absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2, explanation: 'Plants use carbon dioxide, water, and light energy to make glucose.' },
  { prompt: 'Why do we see lightning before we hear thunder?', options: ['Lightning is closer', 'Light travels faster than sound', 'Thunder starts later', 'Clouds block sound'], answer: 1, explanation: 'Light reaches us far sooner than sound over the same distance.' },
  { prompt: 'What is the largest planet in our solar system?', options: ['Earth', 'Mars', 'Jupiter', 'Saturn'], answer: 2, explanation: 'Jupiter is the solar system’s largest planet by mass and diameter.' },
  { prompt: 'Which layer of Earth is liquid and helps create the magnetic field?', options: ['Crust', 'Mantle', 'Outer core', 'Inner core'], answer: 2, explanation: 'The moving liquid metal in the outer core drives Earth’s magnetic field.' },
  { prompt: 'What is the capital city of Canada?', options: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa'], answer: 3, explanation: 'Ottawa is Canada’s capital, even though Toronto is its largest city.' },
  { prompt: 'Which ocean is the largest on Earth?', options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'], answer: 2, explanation: 'The Pacific Ocean covers more area than all other oceans.' },
  { prompt: 'Binary code uses which two digits?', options: ['0 and 1', '1 and 2', '2 and 3', '8 and 9'], answer: 0, explanation: 'Binary is a base-two system, using only 0 and 1.' },
  { prompt: 'What does CPU stand for in a computer?', options: ['Central Program Utility', 'Central Processing Unit', 'Computer Processing User', 'Core Program Unit'], answer: 1, explanation: 'The CPU is the central processing unit that executes instructions.' },
  { prompt: 'Which study habit is most likely to help you retain a difficult concept?', options: ['Read it once quickly', 'Explain it in your own words', 'Skip to a new topic', 'Highlight every sentence'], answer: 1, explanation: 'Explaining an idea forces active recall and reveals what you still need to learn.' },
  { prompt: 'What makes a learning goal more actionable?', options: ['Making it very broad', 'Attaching a clear outcome and practice', 'Only watching videos', 'Avoiding a deadline'], answer: 1, explanation: 'A clear outcome and practice step turn interest into an achievable learning goal.' },
  { prompt: 'Why are short quizzes useful after a lesson?', options: ['They replace the lesson', 'They test recall and expose gaps', 'They make the lesson longer', 'They remove the need to practice'], answer: 1, explanation: 'Retrieval practice helps strengthen memory and shows which ideas need another pass.' },
  { prompt: 'What is a practical way to keep a learning streak sustainable?', options: ['Study for hours every day', 'Choose a small repeatable daily action', 'Only learn when inspired', 'Set several unrelated goals'], answer: 1, explanation: 'Small, repeatable actions make it easier to return tomorrow and maintain momentum.' },
];

function nextQuestion(previous: number) {
  const candidates = questions.map((_, index) => index).filter((index) => index !== previous);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function randomRival(except?: Rival) {
  const choices = rivals.filter((rival) => rival !== except);
  return choices[Math.floor(Math.random() * choices.length)];
}

function makeRival(previous?: Rival): ActiveRival {
  return { id: Date.now() + Math.floor(Math.random() * 1000), kind: randomRival(previous), duration: 2.25 + Math.random() * 1.15 };
}

export function StudySprintGame() {
  const [isRunning, setIsRunning] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [questionIndex, setQuestionIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  // Stable initial rival prevents an SSR/client render mismatch. New rivals are browser-only.
  const [activeRivals, setActiveRivals] = useState<ActiveRival[]>([{ id: 0, kind: 'rival-glider', duration: 3.15 }]);
  const elapsedRef = useRef(0);
  const nextQuestionAtRef = useRef(4);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isQuietAfterQuiz, setIsQuietAfterQuiz] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const rivalRefs = useRef(new Map<number, HTMLDivElement>());
  const isJumpingRef = useRef(false);
  const clearedRivalIdsRef = useRef(new Set<number>());
  const sprintRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = sprintRef.current;
    if (!element || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function jump() {
    if (!isRunning || isJumping || questionIndex !== null) return;
    setIsJumping(true);
    isJumpingRef.current = true;
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => {
      isJumpingRef.current = false;
      setIsJumping(false);
    }, 650);
  }

  function restart() {
    if (rivalTimerRef.current) clearTimeout(rivalTimerRef.current);
    elapsedRef.current = 0;
    nextQuestionAtRef.current = 4 + Math.floor(Math.random() * 3);
    setIsQuietAfterQuiz(false);
    rivalRefs.current.clear();
    clearedRivalIdsRef.current.clear();
    setScore(0);
    setFeedback('');
    setQuestionIndex(null);
    setIsJumping(false);
    isJumpingRef.current = false;
    setIsGameOver(false);
    setActiveRivals([makeRival()]);
    setIsRunning(true);
  }

  useEffect(() => {
    if (!isVisible || !isRunning || questionIndex !== null || isGameOver || activeRivals.length >= 2) return;
    const normalGap = 760 + Math.floor(Math.random() * 720);
    rivalTimerRef.current = setTimeout(() => {
      setActiveRivals((current) => current.length >= 2 ? current : [...current, makeRival(current.at(-1)?.kind)]);
    }, isQuietAfterQuiz ? Math.max(normalGap, 1900) : normalGap);
    return () => { if (rivalTimerRef.current) clearTimeout(rivalTimerRef.current); };
  }, [activeRivals.length, isGameOver, isQuietAfterQuiz, isRunning, isVisible, questionIndex]);

  function answer(optionIndex: number) {
    if (questionIndex === null) return;
    const question = questions[questionIndex];
    if (optionIndex !== question.answer) {
      setFeedback('Not quite — choose the strongest answer to continue your sprint.');
      return;
    }
    setScore((current) => current + 10);
    setFeedback('');
    setIsQuietAfterQuiz(true);
    setQuestionIndex(null);
    setIsRunning(true);
  }

  useEffect(() => {
    if (!isQuietAfterQuiz) return;
    const timer = setTimeout(() => setIsQuietAfterQuiz(false), 1900);
    return () => clearTimeout(timer);
  }, [isQuietAfterQuiz]);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setInterval(() => {
      if (!isRunning || questionIndex !== null) return;
      elapsedRef.current += 1;
      setScore((current) => current + 1);
      if (elapsedRef.current >= nextQuestionAtRef.current && !isJumping) {
        if (rivalTimerRef.current) clearTimeout(rivalTimerRef.current);
        rivalRefs.current.clear();
        clearedRivalIdsRef.current.clear();
        setActiveRivals([]);
        setQuestionIndex(nextQuestion(questionIndex ?? -1));
        setIsRunning(false);
        nextQuestionAtRef.current = elapsedRef.current + 4 + Math.floor(Math.random() * 3);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isJumping, isRunning, isVisible, questionIndex]);

  useEffect(() => () => {
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    if (rivalTimerRef.current) clearTimeout(rivalTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isVisible || !isRunning || questionIndex !== null || isGameOver) return;
    const collisionTimer = setInterval(() => {
      const hero = heroRef.current?.getBoundingClientRect();
      if (!hero) return;
      for (const [id, rival] of rivalRefs.current) {
        const bounds = rival.getBoundingClientRect();
        const horizontalOverlap = hero.right - 7 > bounds.left && hero.left + 7 < bounds.right;
        const collided = horizontalOverlap && hero.bottom - 8 > bounds.top && hero.top + 7 < bounds.bottom;
        if (horizontalOverlap && isJumpingRef.current) clearedRivalIdsRef.current.add(id);
        if (collided) {
          setIsRunning(false);
          setIsJumping(false);
          setIsGameOver(true);
          break;
        }
      }
    }, 45);
    return () => clearInterval(collisionTimer);
  }, [isGameOver, isRunning, isVisible, questionIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'Space') { event.preventDefault(); jump(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function passRival(id: number) {
    if (clearedRivalIdsRef.current.delete(id)) setScore((current) => current + 5);
    rivalRefs.current.delete(id);
    setActiveRivals((current) => current.filter((rival) => rival.id !== id));
  }

  const question = questionIndex === null ? null : questions[questionIndex];
  return <section ref={sprintRef} className="study-sprint"><header><div><p className="eyebrow"><span className="pulse" /> FOCUS BREAK</p><h2>Study Sprint</h2><p>Jump with <kbd>Space</kbd> or tap the game. A quick learning check arrives every 4–6 seconds and clears the track until you answer correctly.</p></div><div className="sprint-score"><span>RUN SCORE · +1 / SECOND · +5 / RIVAL</span><strong>{String(score).padStart(3, '0')}</strong><button type="button" onClick={restart}>Restart</button></div></header><div className={`sprint-game${isRunning && isVisible ? ' is-running' : ' is-paused'}`} onClick={jump} role="application" aria-label="Study Sprint runner game. Press Space or tap to jump."><div className="sprint-sky"><i /><i /><i /></div><div className="sprint-web web-a" /><div className="sprint-web web-b" /><div ref={heroRef} className={`sprint-hero${isJumping ? ' is-jumping' : ''}`} aria-hidden="true"><span className="hero-head" /><span className="hero-body" /><i /><i /><i /><i /></div>{activeRivals.map((rival) => <div ref={(node) => { if (node) rivalRefs.current.set(rival.id, node); else rivalRefs.current.delete(rival.id); }} key={rival.id} className={`sprint-obstacle ${rival.kind}`} style={{ '--rival-duration': `${rival.duration}s` } as React.CSSProperties} onAnimationEnd={() => passRival(rival.id)} aria-hidden="true"><i /><b /></div>)}<div className="sprint-ground"><i /></div>{question && <div className="sprint-question" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Learning checkpoint"><span>LEARNING CHECKPOINT</span><h3>{question.prompt}</h3><div>{question.options.map((option, index) => <button key={option} type="button" onClick={() => answer(index)}>{option}<b>{String.fromCharCode(65 + index)}</b></button>)}</div>{feedback && <p role="alert">{feedback}</p>}<small>Choose the correct answer to resume the run.</small></div>}{isGameOver && <div className="sprint-game-over" onClick={(event) => event.stopPropagation()} role="status"><span>RUN ENDED</span><h3>A rival caught you.</h3><p>Score: {score}</p><button type="button" onClick={restart}>Run again</button></div>}{!isRunning && !question && !isGameOver && <div className="sprint-paused-label">PAUSED</div>}</div></section>;
}
