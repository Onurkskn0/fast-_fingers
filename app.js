/**
 * FASTFINGERS — Adaptive Word-Based Typing Test
 * Non-repeating sentences with difficulty scaling based on WPM.
 */

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

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

function wordsMatch(input, target) {
    return turkishToLower(input.trim()) === turkishToLower(target.trim());
}

// ═══════════════════════════════════════════
// MAIN CLASS
// ═══════════════════════════════════════════

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
            timer: null,
            themeToggle: document.getElementById('themeToggle'),
            startBtn: document.getElementById('startBtn'),
            retryBtn: document.getElementById('retryBtn'),
            homeBtn: document.getElementById('homeBtn'),
            modeBtns: document.querySelectorAll('.duration-btn'),
            liveWpm: document.getElementById('liveWpm'),
            liveAccuracy: document.getElementById('liveAccuracy'),
            liveChars: document.getElementById('liveChars'),
            targetWpm: document.getElementById('targetWpm'),
            targetChars: document.getElementById('targetChars'),
            finalWpm: document.getElementById('finalWpm'),
            finalAccuracy: document.getElementById('finalAccuracy'),
            finalChars: document.getElementById('finalChars'),
            finalWords: document.getElementById('finalWords'),
            newRecord: document.getElementById('newRecord'),
            pbWpm: document.getElementById('pbWpm'),
            pbAccuracy: document.getElementById('pbAccuracy'),
            pbChars: document.getElementById('pbChars')
        };

        this.state = {
            // Sentence pools by difficulty
            sentencePools: {
                easy: [],
                medium: [],
                hard: [],
                expert: []
            },

            // Track used sentences to prevent repeats
            usedSentences: new Set(),

            // Current difficulty level
            currentDifficulty: 'easy',

            // Current sentence/word state
            currentSentence: '',
            words: [],
            currentWordIndex: 0,

            // Settings
            duration: 30,

            // Stats
            totalWordsTyped: 0,
            correctWords: 0,
            totalCharsTyped: 0,
            correctChars: 0,

            // Timer
            startTime: null,
            timeRemaining: 30,
            isRunning: false,
            timerInterval: null
        };

        // Difficulty thresholds based on WPM
        this.difficultyThresholds = {
            easy: 0,      // 0-29 WPM
            medium: 30,   // 30-49 WPM
            hard: 50,     // 50-69 WPM
            expert: 70    // 70+ WPM
        };

        this.init();
    }

    async init() {
        await this.loadSentences();
        this.loadTheme();
        this.loadPersonalBest();
        this.bindEvents();
        this.els.timer = this.els.countdown?.closest('.timer');
    }

    // ═══════════════════════════════════════════
    // SENTENCE LOADING & SELECTION
    // ═══════════════════════════════════════════

    async loadSentences() {
        try {
            const response = await fetch('sentences.json');
            const data = await response.json();
            this.state.sentencePools = {
                easy: data.easy || [],
                medium: data.medium || [],
                hard: data.hard || [],
                expert: data.expert || []
            };
        } catch (error) {
            console.error('Failed to load sentences:', error);
            this.state.sentencePools = {
                easy: ["Bugün hava çok güzel", "Kedim uyumayı seviyor"],
                medium: ["Teknoloji hayatımızı etkiliyor"],
                hard: ["Yapay zeka hızla gelişiyor"],
                expert: ["Kuantum bilgisayarlar gelecekte önemli olacak"]
            };
        }
    }

    getDifficultyForWpm(wpm) {
        if (wpm >= this.difficultyThresholds.expert) return 'expert';
        if (wpm >= this.difficultyThresholds.hard) return 'hard';
        if (wpm >= this.difficultyThresholds.medium) return 'medium';
        return 'easy';
    }

    getUnusedSentence(difficulty) {
        const pool = this.state.sentencePools[difficulty];
        const available = pool.filter(s => !this.state.usedSentences.has(s));

        // If all sentences in this difficulty are used, try adjacent difficulty
        if (available.length === 0) {
            // Try to get from a nearby difficulty
            const fallbackOrder = {
                easy: ['medium', 'hard', 'expert'],
                medium: ['easy', 'hard', 'expert'],
                hard: ['medium', 'expert', 'easy'],
                expert: ['hard', 'medium', 'easy']
            };

            for (const fallback of fallbackOrder[difficulty]) {
                const fallbackPool = this.state.sentencePools[fallback];
                const fallbackAvailable = fallbackPool.filter(s => !this.state.usedSentences.has(s));
                if (fallbackAvailable.length > 0) {
                    const sentence = fallbackAvailable[Math.floor(Math.random() * fallbackAvailable.length)];
                    this.state.usedSentences.add(sentence);
                    return sentence;
                }
            }

            // If everything is used, reset and pick random
            this.state.usedSentences.clear();
            return pool[Math.floor(Math.random() * pool.length)];
        }

        // Pick random from available
        const sentence = available[Math.floor(Math.random() * available.length)];
        this.state.usedSentences.add(sentence);
        return sentence;
    }

    getAdaptiveSentence() {
        // Calculate current WPM to determine difficulty
        let currentWpm = 0;
        if (this.state.startTime) {
            const elapsed = (Date.now() - this.state.startTime) / 60000;
            currentWpm = elapsed > 0 ? Math.round((this.state.correctChars / 5) / elapsed) : 0;
        }

        // Determine appropriate difficulty
        const newDifficulty = this.getDifficultyForWpm(currentWpm);

        // Gradual difficulty increase - don't jump more than one level
        const levels = ['easy', 'medium', 'hard', 'expert'];
        const currentIdx = levels.indexOf(this.state.currentDifficulty);
        const targetIdx = levels.indexOf(newDifficulty);

        if (targetIdx > currentIdx + 1) {
            // Only go up one level at a time
            this.state.currentDifficulty = levels[currentIdx + 1];
        } else if (targetIdx < currentIdx - 1) {
            // Only go down one level at a time
            this.state.currentDifficulty = levels[currentIdx - 1];
        } else {
            this.state.currentDifficulty = newDifficulty;
        }

        return this.getUnusedSentence(this.state.currentDifficulty);
    }

    // ═══════════════════════════════════════════
    // PERSONAL BEST
    // ═══════════════════════════════════════════

    getStorageKey() {
        return `ff-pb-${this.state.duration}`;
    }

    loadPersonalBest() {
        const key = this.getStorageKey();
        const saved = localStorage.getItem(key);

        if (saved) {
            const pb = JSON.parse(saved);
            this.els.pbWpm.textContent = pb.wpm;
            this.els.pbAccuracy.textContent = pb.accuracy + '%';
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

        const isNewRecord = !current || stats.wpm > current.wpm;

        if (isNewRecord) {
            localStorage.setItem(key, JSON.stringify({
                wpm: stats.wpm,
                accuracy: stats.accuracy,
                chars: stats.correctChars
            }));
        }

        return isNewRecord;
    }

    getPersonalBest() {
        const key = this.getStorageKey();
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    }

    // ═══════════════════════════════════════════
    // THEME
    // ═══════════════════════════════════════════

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

    // ═══════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════

    bindEvents() {
        this.els.themeToggle?.addEventListener('click', () => this.toggleTheme());
        this.els.startBtn?.addEventListener('click', () => this.start());
        this.els.retryBtn?.addEventListener('click', () => this.start());
        this.els.homeBtn?.addEventListener('click', () => this.goHome());

        this.els.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectMode(btn));
        });

        this.els.typingInput?.addEventListener('input', (e) => this.handleInput(e));

        this.els.typingInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.goHome();
                return;
            }

            if ((e.key === ' ' || e.key === 'Enter') && this.state.isRunning) {
                e.preventDefault();
                this.submitWord();
            }
        });

        this.els.typingInput?.addEventListener('paste', (e) => e.preventDefault());

        document.addEventListener('keydown', (e) => {
            // Start screen shortcuts
            if (!this.els.startScreen.classList.contains('hidden')) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.start();
                }
            }

            // Results screen shortcuts
            if (!this.els.resultsScreen.classList.contains('hidden')) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.start(); // Retry
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.goHome();
                }
            }
        });

        window.addEventListener('focus', () => {
            if (this.state.isRunning) this.els.typingInput?.focus();
        });
    }

    selectMode(btn) {
        this.els.modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.duration = parseInt(btn.dataset.duration);
        this.loadPersonalBest();
    }

    // ═══════════════════════════════════════════
    // GAME FLOW
    // ═══════════════════════════════════════════

    start() {
        // Reset all state
        this.state.usedSentences.clear();
        this.state.currentDifficulty = 'easy'; // Start easy
        this.state.totalWordsTyped = 0;
        this.state.correctWords = 0;
        this.state.totalCharsTyped = 0;
        this.state.correctChars = 0;
        this.state.currentWordIndex = 0;

        this.state.timeRemaining = this.state.duration;
        this.state.startTime = null;
        this.state.isRunning = true;

        this.els.startScreen.classList.add('hidden');
        this.els.resultsScreen.classList.add('hidden');
        this.els.typingArea.classList.remove('hidden');

        if (this.els.countdownProgress) {
            this.els.countdownProgress.style.transform = 'scaleX(1)';
        }
        this.els.countdown.textContent = this.state.duration;
        this.els.timer?.classList.remove('timer--urgent');

        const pb = this.getPersonalBest();
        if (pb) {
            this.els.targetWpm.textContent = pb.wpm;
            this.els.targetChars.textContent = pb.chars;
        } else {
            this.els.targetWpm.textContent = '';
            this.els.targetChars.textContent = '';
        }

        this.loadNewSentence();
        this.updateLiveStats();

        this.els.typingInput.value = '';
        this.els.typingInput.focus();
    }

    loadNewSentence() {
        // Get adaptive sentence based on current WPM
        this.state.currentSentence = this.getAdaptiveSentence();
        this.state.words = this.state.currentSentence.split(' ');
        this.state.currentWordIndex = 0;
        this.renderWords();
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
        const isNewRecord = this.savePersonalBest(stats);
        this.loadPersonalBest();

        if (isNewRecord) {
            this.els.newRecord.classList.remove('hidden');
        } else {
            this.els.newRecord.classList.add('hidden');
        }

        this.els.finalWpm.textContent = stats.wpm;
        this.els.finalAccuracy.textContent = `${stats.accuracy}%`;
        this.els.finalChars.textContent = stats.correctChars;
        this.els.finalWords.textContent = stats.correctWords;

        this.els.typingArea.classList.add('hidden');
        this.els.resultsScreen.classList.remove('hidden');
    }

    // ═══════════════════════════════════════════
    // TIMER
    // ═══════════════════════════════════════════

    startTimer() {
        this.state.startTime = Date.now();

        this.state.timerInterval = setInterval(() => {
            if (!this.state.isRunning) return;

            const elapsed = (Date.now() - this.state.startTime) / 1000;
            this.state.timeRemaining = Math.max(0, this.state.duration - elapsed);

            this.els.countdown.textContent = Math.ceil(this.state.timeRemaining);

            const progress = 1 - (elapsed / this.state.duration);
            if (this.els.countdownProgress) {
                this.els.countdownProgress.style.transform = `scaleX(${Math.max(0, progress)})`;
            }

            if (this.state.timeRemaining <= 5) {
                this.els.timer?.classList.add('timer--urgent');
            }

            if (this.state.timeRemaining <= 0) {
                this.finish();
            }

            this.updateLiveStats();
        }, 100);
    }

    // ═══════════════════════════════════════════
    // INPUT HANDLING
    // ═══════════════════════════════════════════

    handleInput(e) {
        if (!this.state.isRunning) return;

        if (!this.state.startTime) {
            this.startTimer();
        }

        const input = e.target.value;
        this.updateWordHighlight(input);
    }

    submitWord() {
        const input = this.els.typingInput.value.trim();
        const targetWord = this.state.words[this.state.currentWordIndex];

        if (!targetWord) return;

        this.state.totalWordsTyped++;
        this.state.totalCharsTyped += input.length;

        const isCorrect = wordsMatch(input, targetWord);
        if (isCorrect) {
            this.state.correctWords++;
            this.state.correctChars += targetWord.length;
        } else {
            let correctChars = 0;
            const inputLower = turkishToLower(input);
            const targetLower = turkishToLower(targetWord);
            for (let i = 0; i < Math.min(inputLower.length, targetLower.length); i++) {
                if (inputLower[i] === targetLower[i]) correctChars++;
            }
            this.state.correctChars += correctChars;
        }

        this.markWordCompleted(isCorrect);
        this.state.currentWordIndex++;
        this.els.typingInput.value = '';

        if (this.state.currentWordIndex >= this.state.words.length) {
            this.loadNewSentence();
        } else {
            this.updateCurrentWordHighlight();
        }

        this.updateLiveStats();
    }

    // ═══════════════════════════════════════════
    // RENDERING
    // ═══════════════════════════════════════════

    renderWords() {
        const html = this.state.words.map((word, index) => {
            const classes = ['word'];
            if (index === 0) classes.push('word--current');
            return `<span class="${classes.join(' ')}" data-index="${index}">${this.escapeHtml(word)}</span>`;
        }).join('<span class="word-space"> </span>');

        this.els.sentenceDisplay.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateWordHighlight(input) {
        const wordEl = this.els.sentenceDisplay.querySelector('.word--current');
        if (!wordEl) return;

        const target = this.state.words[this.state.currentWordIndex];
        const inputLower = turkishToLower(input);
        const targetLower = turkishToLower(target);

        let hasError = false;
        for (let i = 0; i < input.length; i++) {
            if (i >= targetLower.length || inputLower[i] !== targetLower[i]) {
                hasError = true;
                break;
            }
        }

        wordEl.classList.toggle('word--error', hasError);
    }

    markWordCompleted(isCorrect) {
        const wordEl = this.els.sentenceDisplay.querySelector('.word--current');
        if (!wordEl) return;

        wordEl.classList.remove('word--current', 'word--error');
        wordEl.classList.add(isCorrect ? 'word--correct' : 'word--incorrect');
    }

    updateCurrentWordHighlight() {
        const wordEls = this.els.sentenceDisplay.querySelectorAll('.word');
        wordEls.forEach((el, index) => {
            el.classList.remove('word--current');
            if (index === this.state.currentWordIndex) {
                el.classList.add('word--current');
            }
        });
    }

    // ═══════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════

    updateLiveStats() {
        const stats = this.calcLiveStats();
        this.els.liveWpm.textContent = stats.wpm;
        this.els.liveAccuracy.textContent = stats.accuracy;
        this.els.liveChars.textContent = stats.correctChars;

        const pb = this.getPersonalBest();
        if (pb) {
            const wpmStat = this.els.liveWpm?.parentElement;
            const charsStat = this.els.liveChars?.parentElement;

            if (stats.wpm > pb.wpm) {
                wpmStat?.classList.add('live-stat--beating');
            } else {
                wpmStat?.classList.remove('live-stat--beating');
            }

            if (stats.correctChars > pb.chars) {
                charsStat?.classList.add('live-stat--beating');
            } else {
                charsStat?.classList.remove('live-stat--beating');
            }
        }
    }

    calcLiveStats() {
        if (!this.state.startTime) {
            return { wpm: 0, accuracy: 100, correctChars: 0 };
        }

        const elapsed = (Date.now() - this.state.startTime) / 60000;
        const wpm = elapsed > 0 ? Math.round((this.state.correctChars / 5) / elapsed) : 0;
        const acc = this.state.totalCharsTyped > 0
            ? Math.round((this.state.correctChars / this.state.totalCharsTyped) * 100)
            : 100;

        return { wpm, accuracy: acc, correctChars: this.state.correctChars };
    }

    calcFinalStats() {
        const mins = this.state.duration / 60;
        const wpm = Math.round((this.state.correctChars / 5) / mins);
        const acc = this.state.totalCharsTyped > 0
            ? Math.round((this.state.correctChars / this.state.totalCharsTyped) * 100)
            : 100;

        return {
            wpm,
            accuracy: acc,
            correctChars: this.state.correctChars,
            correctWords: this.state.correctWords
        };
    }
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    window.fastFingers = new FastFingers();
});
