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

function stripPunctuation(str) {
    return str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'\[\]{}<>|\\+]/g, "").replace(/\s{2,}/g, " ");
}

function wordsMatch(input, target) {
    const cleanInput = stripPunctuation(input.trim());
    const cleanTarget = stripPunctuation(target.trim());
    return turkishToLower(cleanInput) === turkishToLower(cleanTarget);
}

// Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * ShuffleBag implementation for non-repeating random selection.
 * Ensures all items are used once before repeating.
 */
class ShuffleBag {
    constructor() {
        this.items = [];
        this.cursor = -1;
    }

    setItems(items) {
        this.items = [...items];
        this.cursor = this.items.length - 1; // Force shuffle on first use
        this.shuffle();
    }

    shuffle() {
        if (this.items.length === 0) return;
        shuffleArray(this.items);
        this.cursor = 0;
    }

    next() {
        if (this.items.length === 0) return null;

        if (this.cursor >= this.items.length) {
            this.shuffle();
        }

        return this.items[this.cursor++];
    }
}

class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('ff_sound') !== 'off';
        this.keyclickEnabled = localStorage.getItem('ff_keyclick') !== 'off';

        // Frequencies for sounds
        this.sounds = {
            tick: [800, 0.05],     // High short beep
            error: [150, 0.15],    // Low thud
            achievement: [
                [523.25, 0.1], // C5
                [659.25, 0.1], // E5
                [783.99, 0.2]  // G5
            ],
            warning: [400, 0.1]    // Warning beep
        };
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, duration, type = 'sine', time = 0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + time);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + time + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + time);
        osc.stop(this.ctx.currentTime + time + duration);
    }

    playTick() {
        if (!this.enabled) return;
        this.init();
        this.playTone(...this.sounds.tick, 'sine');
    }

    playError() {
        if (!this.enabled) return;
        this.init();

        // Custom error sound: Low pitch slide down (like a "bonk")
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.15); // Slide down

        // Increased gain for louder volume
        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playAchievement() {
        if (!this.enabled) return;
        this.init();

        // Louder and more celebratory achievement melody
        const notes = [
            [523.25, 0.15], // C5
            [659.25, 0.15], // E5
            [783.99, 0.25], // G5 (longer)
            [1046.5, 0.3]   // C6 (higher octave, longest)
        ];

        let time = 0;
        notes.forEach(([freq, dur]) => {
            // Use higher gain for achievement
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + time);

            // Louder than normal sounds
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime + time);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + time + dur);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + time);
            osc.stop(this.ctx.currentTime + time + dur);

            time += dur * 0.8; // Slight overlap for richer sound
        });
    }

    playWarning() {
        if (!this.enabled) return;
        this.init();
        this.playTone(...this.sounds.warning, 'square');
    }

    playKeyclick() {
        if (!this.enabled || !this.keyclickEnabled) return;
        this.init();

        if (!this.ctx) return;

        // "Tick" sound: High pitch, very short, elegant
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Higher pitch for "tick" rather than "thock"
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.03);

        // Very fast decay for crispness, lower volume
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.03);
    }



    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('ff_sound', this.enabled ? 'on' : 'off');
        return this.enabled;
    }

    toggleKeyclick() {
        this.keyclickEnabled = !this.keyclickEnabled;
        localStorage.setItem('ff_keyclick', this.keyclickEnabled ? 'on' : 'off');
        return this.keyclickEnabled;
    }
}

// ═══════════════════════════════════════════
// ACHIEVEMENT SYSTEM
// ═══════════════════════════════════════════

class AchievementManager {
    constructor(app) {
        this.app = app;

        // Achievement definitions
        this.achievements = {
            // Tier 1 - Hoşgeldin
            first_step: {
                id: 'first_step',
                icon: '🚀',
                name: 'İlk Adım',
                description: 'İlk testini tamamla',
                tier: 1,
                hidden: false
            },
            fast_start: {
                id: 'fast_start',
                icon: '⚡',
                name: 'Hızlı Başlangıç',
                description: 'İlk 5 saniyede 5+ kelime yaz',
                tier: 1,
                hidden: false
            },
            // Tier 2 - Gelişim
            sharpshooter: {
                id: 'sharpshooter',
                icon: '🎯',
                name: 'Keskin Nişancı',
                description: '%100 doğrulukla bitir',
                tier: 2,
                hidden: false
            },
            hot_hands: {
                id: 'hot_hands',
                icon: '🔥',
                name: 'Ateşli Eller',
                description: '80+ WPM ulaş',
                tier: 2,
                hidden: false
            },
            rising: {
                id: 'rising',
                icon: '📈',
                name: 'Yükseliş',
                description: 'Kişisel rekoru 5 kez geç',
                tier: 2,
                hidden: false,
                maxProgress: 5
            },
            persistent: {
                id: 'persistent',
                icon: '🔁',
                name: 'Azimli',
                description: 'Tek oturumda 10 test tamamla',
                tier: 2,
                hidden: false,
                maxProgress: 10
            },
            // Tier 3 - Ustalık
            like_wind: {
                id: 'like_wind',
                icon: '💨',
                name: 'Rüzgar Gibi',
                description: '100+ WPM ulaş',
                tier: 3,
                hidden: false
            },
            perfectionist: {
                id: 'perfectionist',
                icon: '💯',
                name: 'Mükemmeliyetçi',
                description: 'Üst üste 3 test %95+ doğruluk',
                tier: 3,
                hidden: false,
                maxProgress: 3
            },
            champion: {
                id: 'champion',
                icon: '🏆',
                name: 'Şampiyon',
                description: '3 sürede de kişisel rekor kır',
                tier: 3,
                hidden: false,
                maxProgress: 3
            },
            marathon: {
                id: 'marathon',
                icon: '🏃',
                name: 'Maratoncu',
                description: '60s modda 150+ kelime yaz',
                tier: 3,
                hidden: false
            },
            // Tier 4 - Efsane (Gizli)
            diamond: {
                id: 'diamond',
                icon: '💎',
                name: 'Elmas Eller',
                description: '%100 doğruluk + 100 WPM aynı anda',
                tier: 4,
                hidden: false
            },
            night_owl: {
                id: 'night_owl',
                icon: '🌙',
                name: 'Gece Kuşu',
                description: '???',
                hint: 'Gecenin sessizliğinde...',
                tier: 4,
                hidden: true
            }
        };

        this.load();
        this.sessionTests = 0;
        this.notificationQueue = [];
        this.isShowingNotification = false;
    }

    load() {
        const saved = localStorage.getItem('ff_achievements');
        if (saved) {
            const data = JSON.parse(saved);
            this.unlocked = new Set(data.unlocked || []);
            this.progress = data.progress || {};
            this.stats = data.stats || { totalTests: 0, pbBeaten: 0 };
            this.streaks = data.streaks || { accuracy95: 0 };
            this.championModes = new Set(data.championModes || []);
        } else {
            this.unlocked = new Set();
            this.progress = {};
            this.stats = { totalTests: 0, pbBeaten: 0 };
            this.streaks = { accuracy95: 0 };
            this.championModes = new Set();
        }
    }

    save() {
        localStorage.setItem('ff_achievements', JSON.stringify({
            unlocked: [...this.unlocked],
            progress: this.progress,
            stats: this.stats,
            streaks: this.streaks,
            championModes: [...this.championModes]
        }));
    }

    unlock(id) {
        if (this.unlocked.has(id)) return false;

        this.unlocked.add(id);
        this.save();

        const achievement = this.achievements[id];
        if (achievement) {
            this.queueNotification(achievement);
        }

        return true;
    }

    queueNotification(achievement) {
        this.notificationQueue.push(achievement);
        if (!this.isShowingNotification) {
            this.showNextNotification();
        }
    }

    showNextNotification() {
        if (this.notificationQueue.length === 0) {
            this.isShowingNotification = false;
            return;
        }

        this.isShowingNotification = true;
        const achievement = this.notificationQueue.shift();
        this.showUnlockOverlay(achievement);
    }

    showUnlockOverlay(achievement) {
        // Play achievement sound
        this.app.soundManager.playAchievement();

        // Create corner toast (non-intrusive)
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <div class="achievement-toast__icon">${achievement.icon}</div>
            <div class="achievement-toast__text">
                <div class="achievement-toast__label">BAŞARIM</div>
                <div class="achievement-toast__name">${achievement.name}</div>
            </div>
        `;

        document.body.appendChild(toast);

        // Auto close after 4 seconds
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => {
                toast.remove();
                this.showNextNotification();
            });
        }, 4000);

        // Click to close
        toast.addEventListener('click', () => {
            toast.classList.add('hiding');
        });
    }

    // Called at end of each test
    checkAll(stats) {
        this.stats.totalTests++;
        this.sessionTests++;

        // first_step - First test completed
        this.unlock('first_step');

        // sharpshooter - 100% accuracy
        if (stats.accuracy === 100) {
            this.unlock('sharpshooter');
        }

        // hot_hands - 80+ WPM
        if (stats.wpm >= 80) {
            this.unlock('hot_hands');
        }

        // like_wind - 100+ WPM
        if (stats.wpm >= 100) {
            this.unlock('like_wind');
        }

        // diamond - 100% accuracy AND 100+ WPM
        if (stats.accuracy === 100 && stats.wpm >= 100) {
            this.unlock('diamond');
        }

        // marathon - 150+ words in 60s mode
        if (this.app.state.duration === 60 && stats.correctWords >= 150) {
            this.unlock('marathon');
        }

        // persistent - 10 tests in one session
        if (this.sessionTests >= 10) {
            this.unlock('persistent');
        }
        this.progress.persistent = Math.min(this.sessionTests, 10);

        // perfectionist - 3 consecutive tests with 95%+ accuracy
        if (stats.accuracy >= 95) {
            this.streaks.accuracy95++;
            if (this.streaks.accuracy95 >= 3) {
                this.unlock('perfectionist');
            }
        } else {
            this.streaks.accuracy95 = 0;
        }
        this.progress.perfectionist = Math.min(this.streaks.accuracy95, 3);

        // night_owl - Test between 00:00 and 05:00
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 5) {
            this.unlock('night_owl');
        }

        this.save();
    }

    // Called when personal best is beaten
    checkPBBeaten(duration) {
        this.stats.pbBeaten++;
        this.progress.rising = Math.min(this.stats.pbBeaten, 5);

        // rising - Beat PB 5 times
        if (this.stats.pbBeaten >= 5) {
            this.unlock('rising');
        }

        // champion - Beat PB in all 3 durations
        this.championModes.add(duration);
        this.progress.champion = this.championModes.size;
        if (this.championModes.size >= 3) {
            this.unlock('champion');
        }

        this.save();
    }

    // Called during typing for fast_start
    checkFastStart(wordsTyped, elapsedSeconds) {
        if (elapsedSeconds <= 5 && wordsTyped >= 5) {
            this.unlock('fast_start');
        }
    }

    getProgress(id) {
        const achievement = this.achievements[id];
        if (!achievement || !achievement.maxProgress) return null;

        const current = this.progress[id] || 0;
        return { current, max: achievement.maxProgress };
    }

    isUnlocked(id) {
        return this.unlocked.has(id);
    }

    getAll() {
        return Object.values(this.achievements).map(a => ({
            ...a,
            unlocked: this.unlocked.has(a.id),
            progress: this.getProgress(a.id)
        }));
    }

    getUnlockedCount() {
        return this.unlocked.size;
    }

    getTotalCount() {
        return Object.keys(this.achievements).length;
    }
}

// ═══════════════════════════════════════════
// MAIN CLASS
// ═══════════════════════════════════════════

class FastFingers {
    constructor() {
        this.soundManager = new SoundManager();
        this.achievementManager = new AchievementManager(this);

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
            pbChars: document.getElementById('pbChars'),
            submitBtn: document.getElementById('submitBtn'),
            soundToggle: document.getElementById('soundToggle'),
            keyclickToggle: document.getElementById('keyclickToggle'),
            shareBtn: document.getElementById('shareBtn'),
            pauseOverlay: document.getElementById('pauseOverlay'),
            resumeBtn: document.getElementById('resumeBtn'),
            quitBtn: document.getElementById('quitBtn'),
            restartBtn: document.getElementById('restartBtn'),
            achievementBtn: document.getElementById('achievementBtn'),
            achievementCount: document.getElementById('achievementCount'),
            achievementModal: document.getElementById('achievementModal'),
            achievementGrid: document.getElementById('achievementGrid'),
            achievementClose: document.getElementById('achievementClose'),
            escHint: document.getElementById('escHint'),
            enterHintItem: document.getElementById('enterHintItem'),
            spaceHintItem: document.getElementById('spaceHintItem')
        };

        this.state = {
            // Sentence pools by difficulty
            sentencePools: {
                easy: [],
                medium: [],
                hard: [],
                expert: []
            },

            // Shuffle bags for each difficulty
            bags: {
                easy: new ShuffleBag(),
                medium: new ShuffleBag(),
                hard: new ShuffleBag(),
                expert: new ShuffleBag()
            },

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
            isPaused: false,
            pauseTime: null,
            animationFrameId: null, // Replaces timerInterval
            lastWarnSecond: 5
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
        this.loadSoundState();
        this.bindEvents();
        this.els.timer = this.els.countdown?.closest('.timer');
    }

    // ═══════════════════════════════════════════
    // SENTENCE LOADING & SELECTION
    // ═══════════════════════════════════════════

    async loadSentences() {
        let pools = {};

        try {
            const response = await fetch('sentences.json');
            if (!response.ok) throw new Error('HTTP error');
            const data = await response.json();
            pools = {
                easy: data.easy || [],
                medium: data.medium || [],
                hard: data.hard || [],
                expert: data.expert || []
            };
            console.log('Sentences loaded from sentences.json');
        } catch (error) {
            console.log('fetch failed, trying fallback...');
            if (typeof SENTENCES_DATA !== 'undefined') {
                pools = {
                    easy: SENTENCES_DATA.easy || [],
                    medium: SENTENCES_DATA.medium || [],
                    hard: SENTENCES_DATA.hard || [],
                    expert: SENTENCES_DATA.expert || []
                };
                console.log('Sentences loaded from sentences.js (fallback)');
            } else {
                console.error('No sentence source available!');
                pools = {
                    easy: ["Cümle yüklenemedi - sayfayı yenileyin"],
                    medium: ["Cümle yüklenemedi - sayfayı yenileyin"],
                    hard: ["Cümle yüklenemedi - sayfayı yenileyin"],
                    expert: ["Cümle yüklenemedi - sayfayı yenileyin"]
                };
            }
        }

        this.state.sentencePools = pools;

        // Initialize shuffle bags
        Object.keys(pools).forEach(diff => {
            this.state.bags[diff].setItems(pools[diff]);
        });
    }

    getDifficultyForWpm(wpm) {
        if (wpm >= this.difficultyThresholds.expert) return 'expert';
        if (wpm >= this.difficultyThresholds.hard) return 'hard';
        if (wpm >= this.difficultyThresholds.medium) return 'medium';
        return 'easy';
    }

    getUnusedSentence(difficulty) {
        // Use ShuffleBag to get unique sentences without repetition until drained
        let sentence = this.state.bags[difficulty].next();

        // If somehow failed (empty pool), try adjacent difficulty
        if (!sentence) {
            const fallbackOrder = {
                easy: ['medium', 'hard', 'expert'],
                medium: ['easy', 'hard', 'expert'],
                hard: ['medium', 'expert', 'easy'],
                expert: ['hard', 'medium', 'easy']
            };

            for (const fallback of fallbackOrder[difficulty]) {
                sentence = this.state.bags[fallback].next();
                if (sentence) return sentence;
            }
            // Absolute fallback
            return "Hata: Cümle bulunamadı.";
        }

        return sentence;
    }

    getAdaptiveSentence() {
        // Calculate current WPM to determine difficulty
        let currentWpm = 0;
        if (this.state.startTime && !this.state.isPaused) {
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
            this.soundManager.playAchievement();
            this.achievementManager.checkPBBeaten(this.state.duration);
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
    // SOUND
    // ═══════════════════════════════════════════

    loadSoundState() {
        // Main sound
        const soundEnabled = localStorage.getItem('ff_sound') !== 'off';
        this.updateSoundUI(soundEnabled);

        // Keyclick sound
        const keyclickEnabled = localStorage.getItem('ff_keyclick') !== 'off';
        this.updateKeyclickUI(keyclickEnabled);
    }

    toggleSound() {
        const isEnabled = this.soundManager.toggle();
        this.updateSoundUI(isEnabled);
    }

    updateSoundUI(isEnabled) {
        if (!this.els.soundToggle) return;
        this.els.soundToggle.setAttribute('data-sound', isEnabled ? 'on' : 'off');
        this.els.soundToggle.style.opacity = isEnabled ? '1' : '0.5';
    }

    toggleKeyclick() {
        const isEnabled = this.soundManager.toggleKeyclick();
        this.updateKeyclickUI(isEnabled);
    }

    updateKeyclickUI(isEnabled) {
        if (!this.els.keyclickToggle) return;
        this.els.keyclickToggle.setAttribute('data-keyclick', isEnabled ? 'on' : 'off');
        this.els.keyclickToggle.style.opacity = isEnabled ? '1' : '0.5';
    }

    // ═══════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════

    bindEvents() {
        this.els.themeToggle?.addEventListener('click', () => this.toggleTheme());
        this.els.startBtn?.addEventListener('click', () => this.start());
        this.els.retryBtn?.addEventListener('click', () => this.start());
        this.els.homeBtn?.addEventListener('click', () => this.goHome());

        // Sound toggles
        this.els.soundToggle?.addEventListener('click', () => this.toggleSound());
        this.els.keyclickToggle?.addEventListener('click', () => this.toggleKeyclick());

        // Share and pause buttons
        this.els.shareBtn?.addEventListener('click', () => this.shareResult());
        this.els.resumeBtn?.addEventListener('click', () => this.resume());
        this.els.quitBtn?.addEventListener('click', () => this.goHome());
        this.els.restartBtn?.addEventListener('click', () => this.start());

        this.els.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectMode(btn));
        });

        this.els.typingInput?.addEventListener('input', (e) => this.handleInput(e));

        // Word submission (Space only)
        this.els.typingInput?.addEventListener('keydown', (e) => {
            if (e.key === ' ' && this.state.isRunning && !this.state.isPaused) {
                e.preventDefault();
                this.submitWord();
            }
        });

        this.els.typingInput?.addEventListener('paste', (e) => e.preventDefault());

        // Mobile submit button
        this.els.submitBtn?.addEventListener('click', () => {
            if (this.state.isRunning && !this.state.isPaused) {
                this.submitWord();
                this.els.typingInput?.focus();
            }
        });

        // Global ESC key handler (capture phase to work when input is focused)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();

                // Typing screen - pause or resume
                if (this.state.isRunning) {
                    if (this.state.isPaused) {
                        // ESC on pause screen = resume
                        this.resume();
                    } else {
                        // ESC while typing = pause
                        this.pause();
                    }
                    return;
                }

                // Start screen shortcuts
                if (!this.els.startScreen.classList.contains('hidden')) {
                    // ESC does nothing on start screen
                    return;
                }

                // Results screen - go home
                if (!this.els.resultsScreen.classList.contains('hidden')) {
                    this.goHome();
                    return;
                }
            }

            // Backspace key to go home from pause screen
            if (e.key === 'Backspace' && this.state.isRunning && this.state.isPaused) {
                e.preventDefault();
                this.goHome();
                return;
            }

            // Enter key to restart test from pause screen
            if (e.key === 'Enter' && this.state.isRunning && this.state.isPaused) {
                e.preventDefault();
                this.start(); // Restart the test
                return;
            }

            // Start screen shortcuts (Enter/Space)
            if (!this.els.startScreen.classList.contains('hidden')) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.start();
                }
            }

            // Results screen shortcuts (Enter for retry)
            if (!this.els.resultsScreen.classList.contains('hidden')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.start();
                }
            }
        }, true); // Capture phase

        window.addEventListener('focus', () => {
            if (this.state.isRunning && !this.state.isPaused) this.els.typingInput?.focus();
        });

        // Handle visibility change for timer accuracy/pausing
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Auto-pause if user leaves tab
                if (this.state.isRunning && !this.state.isPaused) {
                    this.pause();
                }
            }
        });

        // Achievement modal
        this.els.achievementBtn?.addEventListener('click', () => this.openAchievementModal());
        this.els.achievementClose?.addEventListener('click', () => this.closeAchievementModal());
        this.els.achievementModal?.querySelector('.achievement-modal__backdrop')?.addEventListener('click', () => this.closeAchievementModal());

        // Update achievement count on load
        this.updateAchievementCount();
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
        // Cancel any existing animation frame
        if (this.state.animationFrameId) {
            cancelAnimationFrame(this.state.animationFrameId);
            this.state.animationFrameId = null;
        }

        // Reset all state
        // this.state.usedSentences.clear(); // Removed, replaced by shuffle bags
        this.state.currentDifficulty = 'easy'; // Start easy
        this.state.totalWordsTyped = 0;
        this.state.correctWords = 0;
        this.state.totalCharsTyped = 0;
        this.state.correctChars = 0;
        this.state.currentWordIndex = 0;

        this.state.timeRemaining = this.state.duration;
        this.state.startTime = null;
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.state.pauseTime = null;
        this.state.lastWarnSecond = 5;

        this.els.startScreen.classList.add('hidden');
        this.els.resultsScreen.classList.add('hidden');
        this.els.pauseOverlay?.classList.add('hidden'); // Close pause overlay
        this.els.typingArea.classList.remove('hidden');

        // Re-enable input if it was disabled during pause
        if (this.els.typingInput) {
            this.els.typingInput.disabled = false;
        }

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

        // Update footer hints
        if (this.els.escHint) this.els.escHint.textContent = 'Duraklat';
        if (this.els.enterHintItem) this.els.enterHintItem.style.display = 'none';
        if (this.els.spaceHintItem) this.els.spaceHintItem.style.display = '';
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
        this.state.isPaused = false;
        if (this.state.animationFrameId) {
            cancelAnimationFrame(this.state.animationFrameId);
            this.state.animationFrameId = null;
        }

        // Re-enable input in case it was disabled during pause
        if (this.els.typingInput) {
            this.els.typingInput.disabled = false;
            this.els.typingInput.value = '';
        }

        this.els.pauseOverlay?.classList.add('hidden');
        this.els.typingArea.classList.add('hidden');
        this.els.resultsScreen.classList.add('hidden');
        this.els.startScreen.classList.remove('hidden');
    }

    // ═══════════════════════════════════════════
    // ACHIEVEMENT MODAL
    // ═══════════════════════════════════════════

    openAchievementModal() {
        this.renderAchievements();
        this.els.achievementModal?.classList.remove('hidden');
    }

    closeAchievementModal() {
        this.els.achievementModal?.classList.add('hidden');
    }

    renderAchievements() {
        if (!this.els.achievementGrid) return;

        const achievements = this.achievementManager.getAll();

        // Sort by tier, then by unlocked status
        achievements.sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            if (a.unlocked !== b.unlocked) return b.unlocked ? 1 : -1;
            return 0;
        });

        this.els.achievementGrid.innerHTML = achievements.map(a => {
            const statusClass = a.unlocked ? 'unlocked' : 'locked';
            const displayName = a.hidden && !a.unlocked ? '???' : a.name;
            const displayDesc = a.hidden && !a.unlocked ? (a.hint || '???') : a.description;
            const displayIcon = a.hidden && !a.unlocked ? '❓' : a.icon;

            let progressHtml = '';
            if (a.progress && !a.unlocked) {
                const percent = (a.progress.current / a.progress.max) * 100;
                progressHtml = `
                    <div class="achievement-card__progress">
                        <div class="achievement-card__progress-bar" style="width: ${percent}%"></div>
                    </div>
                `;
            }

            return `
                <div class="achievement-card ${statusClass}">
                    <div class="achievement-card__icon">${displayIcon}</div>
                    <div class="achievement-card__name">${displayName}</div>
                    <div class="achievement-card__desc">${displayDesc}</div>
                    ${progressHtml}
                </div>
            `;
        }).join('');
    }

    updateAchievementCount() {
        if (!this.els.achievementCount) return;
        const unlocked = this.achievementManager.getUnlockedCount();
        const total = this.achievementManager.getTotalCount();
        this.els.achievementCount.textContent = `${unlocked}/${total}`;
    }

    // ═══════════════════════════════════════════
    // PAUSE / RESUME
    // ═══════════════════════════════════════════

    pause() {
        if (!this.state.isRunning || this.state.isPaused) return;

        this.state.isPaused = true;
        this.state.pauseTime = Date.now();
        this.els.pauseOverlay?.classList.remove('hidden');

        // Prevent input while paused
        this.els.typingInput?.blur();
        if (this.els.typingInput) {
            this.els.typingInput.disabled = true;
        }
    }

    resume() {
        if (!this.state.isPaused) return;

        // Adjust start time to account for pause duration
        const pauseDuration = Date.now() - this.state.pauseTime;
        this.state.startTime += pauseDuration;

        this.state.isPaused = false;
        this.state.pauseTime = null;
        this.els.pauseOverlay?.classList.add('hidden');

        // Re-enable and focus input
        if (this.els.typingInput) {
            this.els.typingInput.disabled = false;
        }
        this.els.typingInput?.focus();
    }

    // ═══════════════════════════════════════════
    // SHARE
    // ═══════════════════════════════════════════

    async shareResult() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 800;
        canvas.height = 420;

        // Background
        ctx.fillStyle = '#0D0D0D';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Border
        ctx.strokeStyle = '#FFB347';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Logo
        ctx.fillStyle = '#FFB347';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▸ fastfingers', canvas.width / 2, 70);

        // WPM (main stat)
        ctx.fillStyle = '#FFB347';
        ctx.font = 'bold 120px sans-serif';
        ctx.fillText(this.els.finalWpm.textContent, canvas.width / 2, 200);

        ctx.fillStyle = '#7A7A6C';
        ctx.font = '20px monospace';
        ctx.fillText('WPM', canvas.width / 2, 230);

        // Stats row
        const stats = [
            { label: 'DOĞRULUK', value: this.els.finalAccuracy.textContent },
            { label: 'KARAKTER', value: this.els.finalChars.textContent },
            { label: 'KELİME', value: this.els.finalWords.textContent }
        ];

        const startX = 160;
        const gap = 240;

        stats.forEach((stat, i) => {
            const x = startX + i * gap;
            ctx.fillStyle = '#E8E4D9';
            ctx.font = 'bold 32px sans-serif';
            ctx.fillText(stat.value, x, 310);

            ctx.fillStyle = '#7A7A6C';
            ctx.font = '14px monospace';
            ctx.fillText(stat.label, x, 340);
        });

        // Footer
        ctx.fillStyle = '#7A7A6C';
        ctx.font = '14px monospace';
        ctx.fillText(`${this.state.duration}s mod`, canvas.width / 2, 390);

        // Create blob and copy/download
        canvas.toBlob(async (blob) => {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                this.showToast('Sonuç panoya kopyalandı! 📋');
            } catch (err) {
                // Fallback: download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fastfingers-${this.els.finalWpm.textContent}wpm.png`;
                a.click();
                URL.revokeObjectURL(url);
            }
        }, 'image/png');
    }

    showToast(message, duration = 3000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <span>✨</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove after duration
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => {
                toast.remove();
                if (container.children.length === 0) {
                    container.remove();
                }
            });
        }, duration);
    }

    finish() {
        this.state.isRunning = false;
        if (this.state.animationFrameId) {
            cancelAnimationFrame(this.state.animationFrameId);
            this.state.animationFrameId = null;
        }

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

        // Check achievements
        this.achievementManager.checkAll(stats);
        this.updateAchievementCount();

        // Update footer hints for results screen
        if (this.els.escHint) this.els.escHint.textContent = 'Menü';
        if (this.els.enterHintItem) this.els.enterHintItem.style.display = '';
        if (this.els.spaceHintItem) this.els.spaceHintItem.style.display = 'none';
    }

    // ═══════════════════════════════════════════
    // TIMER (Refactored to requestAnimationFrame)
    // ═══════════════════════════════════════════

    startTimer() {
        this.state.startTime = Date.now();
        this.loopTimer();
    }

    loopTimer() {
        if (!this.state.isRunning) return;

        if (!this.state.isPaused) {
            const now = Date.now();
            const elapsed = (now - this.state.startTime) / 1000;
            this.state.timeRemaining = Math.max(0, this.state.duration - elapsed);

            this.els.countdown.textContent = Math.ceil(this.state.timeRemaining);

            const progress = 1 - (elapsed / this.state.duration);
            if (this.els.countdownProgress) {
                this.els.countdownProgress.style.transform = `scaleX(${Math.max(0, progress)})`;
            }

            if (this.state.timeRemaining <= 5) {
                this.els.timer?.classList.add('timer--urgent');
            }

            // Audio warning check
            if (this.state.timeRemaining <= 5 && this.state.timeRemaining > 0) {
                const currentSec = Math.ceil(this.state.timeRemaining);
                if (currentSec <= this.state.lastWarnSecond) {
                    this.soundManager.playWarning();
                    this.state.lastWarnSecond = currentSec - 1;
                }
            }

            if (this.state.timeRemaining <= 0) {
                this.finish();
                return; // Stop the loop
            }

            this.updateLiveStats();
        }

        // Keep looping
        this.state.animationFrameId = requestAnimationFrame(() => this.loopTimer());
    }

    // ═══════════════════════════════════════════
    // INPUT HANDLING
    // ═══════════════════════════════════════════

    handleInput(e) {
        if (!this.state.isRunning || this.state.isPaused) return;

        if (!this.state.startTime) {
            this.soundManager.init(); // Init audio context on first interaction
            this.startTimer();
        }

        this.soundManager.playKeyclick();

        const input = e.target.value;

        // Check for space at end - submit word (mobile support)
        if (input.endsWith(' ')) {
            e.target.value = input.trimEnd(); // Remove the space
            this.submitWord();
            return;
        }

        this.updateWordHighlight(input);
    }

    submitWord() {
        const input = this.els.typingInput.value.trim();
        const targetWord = this.state.words[this.state.currentWordIndex];

        // Don't allow skipping without typing
        if (!input || !targetWord) return;

        this.state.totalWordsTyped++;
        // Count target word length as expected chars (so incomplete words hurt accuracy)
        this.state.totalCharsTyped += targetWord.length;

        const isCorrect = wordsMatch(input, targetWord);

        if (isCorrect) {
            this.soundManager.playTick();
            this.state.correctWords++;
            this.state.correctChars += targetWord.length;
        } else {
            this.soundManager.playError();
        }
        // If not correct, correctChars stays 0 for this word

        this.markWordCompleted(isCorrect);
        this.state.currentWordIndex++;
        this.els.typingInput.value = '';

        if (this.state.currentWordIndex >= this.state.words.length) {
            this.loadNewSentence();
        } else {
            this.updateCurrentWordHighlight();
        }

        this.updateLiveStats();

        // Check fast_start achievement (5+ words in first 5 seconds)
        if (this.state.startTime) {
            const elapsed = (Date.now() - this.state.startTime) / 1000;
            this.achievementManager.checkFastStart(this.state.correctWords, elapsed);
        }
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
        this.els.liveAccuracy.textContent = `${stats.accuracy}%`;
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
