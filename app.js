/**
 * FASTFINGERS — Time-Based Typing Test Engine
 * Clean, focused, performant.
 */

const SKIP_PUNCTUATION = ['.', ',', '!', '?', ';', ':', '"', "'", '(', ')', '-', '—', '…', '·'];

const TURKISH_LOWER_MAP = {
    'İ': 'i', 'I': 'ı', 'Ğ': 'ğ', 'Ü': 'ü', 'Ş': 'ş', 'Ö': 'ö', 'Ç': 'ç'
};

function turkishToLower(str) {
    let result = '';
    for (const char of str) {
        result += TURKISH_LOWER_MAP[char] || char.toLowerCase();
    }
    return result;
}

function charsMatch(a, b) {
    return a === b || turkishToLower(a) === turkishToLower(b);
}

class FastFingers {
    constructor() {
        this.els = {
            startScreen: document.getElementById('startScreen'),
            typingArea: document.getElementById('typingArea'),
            resultsScreen: document.getElementById('resultsScreen'),
            sentenceDisplay: document.getElementById('sentenceDisplay'),
            typingInput: document.getElementById('typingInput'),
            countdown: document.getElementById('countdown'),
            countdownProgress: document.getElementById('countdownProgress'),
            timer: null, // Will be set in init
            themeToggle: document.getElementById('themeToggle'),
            startBtn: document.getElementById('startBtn'),
            retryBtn: document.getElementById('retryBtn'),
            homeBtn: document.getElementById('homeBtn'),
            modeBtns: document.querySelectorAll('.duration-btn'),
            // Live stats
            liveWpm: document.getElementById('liveWpm'),
            liveAccuracy: document.getElementById('liveAccuracy'),
            liveChars: document.getElementById('liveChars'),
            targetWpm: document.getElementById('targetWpm'),
            targetChars: document.getElementById('targetChars'),
            // Final stats
            finalWpm: document.getElementById('finalWpm'),
            finalAccuracy: document.getElementById('finalAccuracy'),
            finalChars: document.getElementById('finalChars'),
            finalWords: document.getElementById('finalWords'),
            newRecord: document.getElementById('newRecord'),
            // Personal best
            pbWpm: document.getElementById('pbWpm'),
            pbAccuracy: document.getElementById('pbAccuracy'),
            pbChars: document.getElementById('pbChars')
        };

        this.state = {
            // Settings
            duration: 30, // seconds

            // Sentences
            allSentences: [],
            displaySentence: '',
            typingSentence: '',
            typingToDisplayMap: [],

            // Progress
            currentSentenceIdx: 0,
            completedChars: 0,
            correctChars: 0,
            incorrectChars: 0,
            completedWords: 0,

            // Timer
            startTime: null,
            timeRemaining: 30,
            isRunning: false,
            timerInterval: null,

            // State
            hasErrors: false
        };

        this.init();
    }

    init() {
        this.loadTheme();
        this.loadPersonalBest();
        this.bindEvents();
        // Get timer container for urgency class
        this.els.timer = this.els.countdown.closest('.timer');
    }

    // Personal Best
    getStorageKey() {
        return `ff-pb-${this.state.duration}`;
    }

    loadPersonalBest() {
        const key = this.getStorageKey();
        const saved = localStorage.getItem(key);

        if (saved) {
            const pb = JSON.parse(saved);
            this.els.pbWpm.textContent = pb.wpm;
            this.els.pbAccuracy.textContent = pb.accuracy;
            this.els.pbChars.textContent = pb.chars;
        } else {
            this.els.pbWpm.textContent = '—';
            this.els.pbAccuracy.textContent = '—';
            this.els.pbChars.textContent = '—';
        }
    }

    savePersonalBest(stats) {
        const key = this.getStorageKey();
        const saved = localStorage.getItem(key);
        const current = saved ? JSON.parse(saved) : null;

        // Check if new record (WPM is primary metric)
        const isNewRecord = !current || stats.wpm > current.wpm;

        if (isNewRecord) {
            localStorage.setItem(key, JSON.stringify({
                wpm: stats.wpm,
                accuracy: stats.accuracy,
                chars: stats.totalChars
            }));
        }

        return isNewRecord;
    }

    getPersonalBest() {
        const key = this.getStorageKey();
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    }

    // Theme
    loadTheme() {
        const saved = localStorage.getItem('ff-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ff-theme', next);
    }

    // Events
    bindEvents() {
        this.els.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.els.startBtn.addEventListener('click', () => this.start());
        this.els.retryBtn.addEventListener('click', () => this.start());
        this.els.homeBtn.addEventListener('click', () => this.goHome());

        this.els.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectMode(btn));
        });

        this.els.typingInput.addEventListener('input', (e) => this.handleInput(e));
        this.els.typingInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.goHome();
            }
            // ENTER works like SPACE during typing
            if (e.key === 'Enter' && this.state.isRunning) {
                e.preventDefault();
                // Insert a space character
                const input = this.els.typingInput;
                const pos = input.selectionStart;
                input.value = input.value.slice(0, pos) + ' ' + input.value.slice(pos);
                input.selectionStart = input.selectionEnd = pos + 1;
                // Trigger input event
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        this.els.typingInput.addEventListener('paste', (e) => e.preventDefault());

        document.addEventListener('keydown', (e) => {
            if (!this.els.startScreen.classList.contains('hidden')) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.start();
                }
            }
        });

        window.addEventListener('focus', () => {
            if (this.state.isRunning) this.els.typingInput.focus();
        });
    }

    selectMode(btn) {
        this.els.modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.duration = parseInt(btn.dataset.duration);
        // Update personal best display for new duration
        this.loadPersonalBest();
    }

    // Filter punctuation
    filterPunctuation(sentence) {
        const filtered = [];
        const map = [];
        for (let i = 0; i < sentence.length; i++) {
            if (!SKIP_PUNCTUATION.includes(sentence[i])) {
                map.push(i);
                filtered.push(sentence[i]);
            }
        }
        return { filtered: filtered.join(''), map };
    }

    // Get all sentences shuffled
    getAllSentences() {
        const all = [
            ...getAllSentences('easy'),
            ...getAllSentences('medium'),
            ...getAllSentences('hard')
        ];
        return all.sort(() => Math.random() - 0.5);
    }

    // Game flow
    start() {
        // Get shuffled sentences
        this.state.allSentences = this.getAllSentences();
        this.state.currentSentenceIdx = 0;

        // Reset stats
        this.state.completedChars = 0;
        this.state.correctChars = 0;
        this.state.incorrectChars = 0;
        this.state.completedWords = 0;
        this.state.hasErrors = false;

        // Timer
        this.state.timeRemaining = this.state.duration;
        this.state.startTime = null;
        this.state.isRunning = true;

        // UI
        this.els.startScreen.classList.add('hidden');
        this.els.resultsScreen.classList.add('hidden');
        this.els.typingArea.classList.remove('hidden');

        // Reset timer
        this.els.countdownProgress.style.transform = 'scaleX(1)';
        this.els.countdown.textContent = this.state.duration;
        if (this.els.timer) {
            this.els.timer.classList.remove('timer--urgent');
        }

        // Show target from personal best
        const pb = this.getPersonalBest();
        if (pb) {
            this.els.targetWpm.textContent = pb.wpm;
            this.els.targetChars.textContent = pb.chars;
        } else {
            this.els.targetWpm.textContent = '';
            this.els.targetChars.textContent = '';
        }

        // Load first sentence
        this.loadNextSentence();
        this.updateLiveStats();

        this.els.typingInput.value = '';
        this.els.typingInput.focus();
    }

    loadNextSentence() {
        // Loop back if we run out
        if (this.state.currentSentenceIdx >= this.state.allSentences.length) {
            this.state.allSentences = this.getAllSentences();
            this.state.currentSentenceIdx = 0;
        }

        const sentence = this.state.allSentences[this.state.currentSentenceIdx];
        const { filtered, map } = this.filterPunctuation(sentence);

        this.state.displaySentence = sentence;
        this.state.typingSentence = filtered;
        this.state.typingToDisplayMap = map;

        this.renderSentence();
    }

    goHome() {
        this.state.isRunning = false;
        if (this.state.timerInterval) clearInterval(this.state.timerInterval);

        this.els.typingArea.classList.add('hidden');
        this.els.resultsScreen.classList.add('hidden');
        this.els.startScreen.classList.remove('hidden');
    }

    finish() {
        this.state.isRunning = false;
        if (this.state.timerInterval) clearInterval(this.state.timerInterval);

        const stats = this.calcFinalStats();

        // Check for new record
        const isNewRecord = this.savePersonalBest(stats);

        // Update personal best display
        this.loadPersonalBest();

        // Show/hide new record badge
        if (isNewRecord) {
            this.els.newRecord.classList.remove('hidden');
        } else {
            this.els.newRecord.classList.add('hidden');
        }

        this.els.finalWpm.textContent = stats.wpm;
        this.els.finalAccuracy.textContent = `${stats.accuracy}%`;
        this.els.finalChars.textContent = stats.totalChars;
        this.els.finalWords.textContent = stats.words;

        this.els.typingArea.classList.add('hidden');
        this.els.resultsScreen.classList.remove('hidden');
    }

    // Timer
    startTimer() {
        this.state.startTime = Date.now();

        this.state.timerInterval = setInterval(() => {
            if (!this.state.isRunning) return;

            const elapsed = (Date.now() - this.state.startTime) / 1000;
            this.state.timeRemaining = Math.max(0, this.state.duration - elapsed);

            // Update countdown display
            this.els.countdown.textContent = Math.ceil(this.state.timeRemaining);

            // Update progress bar (shrinks from right)
            const progress = 1 - (elapsed / this.state.duration);
            this.els.countdownProgress.style.transform = `scaleX(${Math.max(0, progress)})`;

            // Urgency state (last 5 seconds)
            if (this.state.timeRemaining <= 5) {
                this.els.timer.classList.add('timer--urgent');
            }

            // Time's up
            if (this.state.timeRemaining <= 0) {
                this.finish();
            }

            this.updateLiveStats();
        }, 100);
    }

    // Input handling
    handleInput(e) {
        if (!this.state.isRunning) return;

        // Start timer on first input
        if (!this.state.startTime) {
            this.startTimer();
        }

        const input = e.target.value;
        const target = this.state.typingSentence;

        this.processInput(input, target);
    }

    processInput(input, target) {
        const inputChars = input.split('');
        const targetChars = target.split('');

        let correct = 0, incorrect = 0;

        for (let i = 0; i < inputChars.length; i++) {
            if (i < targetChars.length) {
                if (charsMatch(inputChars[i], targetChars[i])) {
                    correct++;
                } else {
                    incorrect++;
                }
            }
        }

        this.state.hasErrors = incorrect > 0;
        this.updateCharDisplay(inputChars, targetChars);

        // Check sentence completion - must match length exactly and have no errors
        const isComplete = inputChars.length === targetChars.length && correct === targetChars.length;

        if (isComplete) {
            this.completeSentence(targetChars.length);
        }
    }

    completeSentence(charCount) {
        // Add completed chars
        this.state.completedChars += charCount;
        this.state.correctChars += charCount;

        // Count words (spaces + 1)
        const words = this.state.typingSentence.split(' ').length;
        this.state.completedWords += words;

        // Next sentence
        this.state.currentSentenceIdx++;
        this.els.typingInput.value = '';
        this.loadNextSentence();
    }

    updateCharDisplay(inputChars, targetChars) {
        const typableEls = this.els.sentenceDisplay.querySelectorAll('.char:not(.char--punctuation)');
        const allEls = this.els.sentenceDisplay.querySelectorAll('.char');

        allEls.forEach(el => el.classList.remove('char--current', 'char--correct', 'char--incorrect'));

        typableEls.forEach((el, i) => {
            if (i < inputChars.length) {
                el.classList.add(charsMatch(inputChars[i], targetChars[i]) ? 'char--correct' : 'char--incorrect');
            } else if (i === inputChars.length) {
                el.classList.add('char--current');
            }
        });

        // Mark punctuation
        const map = this.state.typingToDisplayMap;
        const display = this.state.displaySentence;

        for (let i = 0; i < display.length; i++) {
            if (SKIP_PUNCTUATION.includes(display[i])) {
                const el = allEls[i];
                const prevIdx = map.findIndex(m => m > i) - 1;
                if (prevIdx >= 0 && prevIdx < inputChars.length) {
                    if (charsMatch(inputChars[prevIdx], targetChars[prevIdx])) {
                        el.classList.add('char--correct');
                    }
                }
            }
        }
    }

    // Rendering
    renderSentence() {
        const display = this.state.displaySentence;
        const map = this.state.typingToDisplayMap;
        const typable = new Set(map);

        let first = true;
        const html = display.split('').map((char, i) => {
            const classes = ['char'];
            if (!typable.has(i)) classes.push('char--punctuation');
            if (char === ' ') classes.push('char--space');
            if (typable.has(i) && first) {
                classes.push('char--current');
                first = false;
            }
            return `<span class="${classes.join(' ')}">${char === ' ' ? '&nbsp;' : char}</span>`;
        }).join('');

        this.els.sentenceDisplay.innerHTML = html;
    }

    // Stats
    updateLiveStats() {
        const stats = this.calcLiveStats();
        this.els.liveWpm.textContent = stats.wpm;
        this.els.liveAccuracy.textContent = stats.accuracy;
        this.els.liveChars.textContent = stats.chars;

        // Check if beating personal best
        const pb = this.getPersonalBest();
        if (pb) {
            const wpmStat = this.els.liveWpm.parentElement;
            const charsStat = this.els.liveChars.parentElement;

            if (stats.wpm > pb.wpm) {
                wpmStat.classList.add('live-stat--beating');
            } else {
                wpmStat.classList.remove('live-stat--beating');
            }

            if (stats.chars > pb.chars) {
                charsStat.classList.add('live-stat--beating');
            } else {
                charsStat.classList.remove('live-stat--beating');
            }
        }
    }

    calcLiveStats() {
        if (!this.state.startTime) {
            return { wpm: 0, accuracy: 100, chars: 0 };
        }

        const elapsed = (Date.now() - this.state.startTime) / 60000; // minutes
        const input = this.els.typingInput.value;
        const target = this.state.typingSentence;

        // Current sentence progress
        let currentCorrect = 0;
        let currentIncorrect = 0;
        for (let i = 0; i < input.length && i < target.length; i++) {
            if (charsMatch(input[i], target[i])) {
                currentCorrect++;
            } else {
                currentIncorrect++;
            }
        }

        const totalCorrect = this.state.correctChars + currentCorrect;
        const totalChars = this.state.completedChars + input.length;

        const wpm = elapsed > 0 ? Math.round((totalCorrect / 5) / elapsed) : 0;
        const acc = totalChars > 0 ? Math.round((totalCorrect / totalChars) * 100) : 100;

        return { wpm, accuracy: acc, chars: totalChars };
    }

    calcFinalStats() {
        // Get current input for partial sentence
        const input = this.els.typingInput.value;
        const target = this.state.typingSentence;

        // Count correct chars in current (unfinished) sentence
        let currentCorrect = 0;
        for (let i = 0; i < input.length && i < target.length; i++) {
            if (charsMatch(input[i], target[i])) {
                currentCorrect++;
            }
        }

        // Total correct = completed sentences + current sentence progress
        const totalCorrect = this.state.correctChars + currentCorrect;
        const totalChars = this.state.completedChars + input.length;

        const mins = this.state.duration / 60;
        const wpm = mins > 0 ? Math.round((totalCorrect / 5) / mins) : 0;
        const acc = totalChars > 0 ? Math.round((totalCorrect / totalChars) * 100) : 100;

        return {
            wpm,
            accuracy: acc,
            totalChars: totalCorrect,
            words: this.state.completedWords
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.fastFingers = new FastFingers();
});
