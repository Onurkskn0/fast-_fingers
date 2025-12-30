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
        if (!this.keyclickEnabled) return;
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
            a11yToggle: document.getElementById('a11yToggle'),
            a11yPanel: document.getElementById('a11yPanel'),
            highContrastToggle: document.getElementById('highContrastToggle'),
            largeTextToggle: document.getElementById('largeTextToggle'),

            themeToggle: document.getElementById('themeToggle'),
            startBtn: document.getElementById('startBtn'),
            retryBtn: document.getElementById('retryBtn'),
            homeBtn: document.getElementById('homeBtn'),
            modeBtns: document.querySelectorAll('.duration-btn'),
            liveWpm: document.getElementById('liveWpm'),
            liveAccuracy: document.getElementById('liveAccuracy'),
            liveWords: document.getElementById('liveWords'),
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
            pbWords: document.getElementById('pbWords'),
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
            escHintItem: document.getElementById('escHintItem'),
            enterHint: document.getElementById('enterHint'),
            startHintItem: document.getElementById('startHintItem'),
            startHint: document.getElementById('startHint'),
            hintSeparator: document.getElementById('hintSeparator'),
            enterKbd: document.getElementById('enterKbd'),
            spaceHint: document.getElementById('spaceHint'),
            // spaceHintItem is now startHintItem
            spaceHintItem: document.getElementById('startHintItem'),
            // enterHintItem is now startHintItem
            enterHintItem: document.getElementById('startHintItem'),
            inputWrapper: document.querySelector('.input-wrapper'),


            // Share Modal Elements
            shareModal: document.getElementById('shareModal'),
            shareCloseBtn: document.getElementById('shareCloseBtn'),
            sharePreviewResult: document.getElementById('sharePreviewResult'),
            sharePreviewLoader: document.getElementById('sharePreviewLoader'),
            shareThemeDark: document.getElementById('shareThemeDark'),
            shareThemeLight: document.getElementById('shareThemeLight'),
            shareThemeHC: document.getElementById('shareThemeHC'),
            shareCustomText: document.getElementById('shareCustomText'),
            shareDownloadBtn: document.getElementById('shareDownloadBtn'),
            shareCopyBtn: document.getElementById('shareCopyBtn'),
            shareTweetBtn: document.getElementById('shareTweetBtn'),
            pbShareBtn: document.getElementById('pbShareBtn')
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
            duration: parseInt(localStorage.getItem('ff_duration')) || 30,

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
        this.loadAccessibility();
        this.loadPersonalBest();
        this.loadSoundState();

        // precise UI update for duration handled by inline script in index.html to prevent FOUC

        this.bindEvents();
        this.bindShareEvents();
        this.els.timer = this.els.countdown?.closest('.timer');
    }

    loadAccessibility() {
        // High Contrast
        const isHighContrast = localStorage.getItem('ff_high_contrast') === 'true';
        if (isHighContrast) {
            document.documentElement.classList.add('high-contrast');
            this.els.highContrastToggle.setAttribute('aria-pressed', 'true');
        }

        // Large Text
        const isLargeText = localStorage.getItem('ff_large_text') === 'true';
        if (isLargeText) {
            document.documentElement.classList.add('large-text');
            this.els.largeTextToggle.setAttribute('aria-pressed', 'true');
        }

        // Accessibility Panel Events
        this.els.a11yToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = this.els.a11yPanel.classList.contains('hidden');
            if (isHidden) {
                this.els.a11yPanel.classList.remove('hidden');
                this.els.a11yToggle.setAttribute('aria-expanded', 'true');
            } else {
                this.els.a11yPanel.classList.add('hidden');
                this.els.a11yToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.els.a11yWrapper?.contains(e.target) && !this.els.a11yPanel?.classList.contains('hidden')) {
                this.els.a11yPanel.classList.add('hidden');
                this.els.a11yToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Toggle High Contrast
        this.els.highContrastToggle.addEventListener('click', () => {
            const isPressed = this.els.highContrastToggle.getAttribute('aria-pressed') === 'true';
            this.els.highContrastToggle.setAttribute('aria-pressed', !isPressed);
            document.documentElement.classList.toggle('high-contrast');
            localStorage.setItem('ff_high_contrast', !isPressed);
        });

        // Toggle Large Text
        this.els.largeTextToggle.addEventListener('click', () => {
            const isPressed = this.els.largeTextToggle.getAttribute('aria-pressed') === 'true';
            this.els.largeTextToggle.setAttribute('aria-pressed', !isPressed);
            document.documentElement.classList.toggle('large-text');
            localStorage.setItem('ff_large_text', !isPressed);
        });

        // Add a11y wrapper to els for outside click detection
        this.els.a11yWrapper = document.querySelector('.a11y-wrapper');
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
        if (this.state.duration === -1) {
            return 'ff-last-infinite';
        }
        return `ff-pb-${this.state.duration}`;
    }

    loadPersonalBest() {
        const key = this.getStorageKey();
        const saved = localStorage.getItem(key);

        // Update Label
        const titleEl = document.getElementById('pbTitle');
        const timeItem = document.getElementById('pbTimeItem');
        const pbTimeEl = document.getElementById('pbTime');

        if (this.state.duration === -1) {
            if (titleEl) titleEl.textContent = "SON DENEME";
            if (timeItem) timeItem.classList.remove('hidden');
            document.body.classList.add('infinite-mode');
        } else {
            if (titleEl) titleEl.textContent = "EN İYİ SKOR";
            if (timeItem) timeItem.classList.add('hidden');
            document.body.classList.remove('infinite-mode');
        }

        if (saved) {
            const pb = JSON.parse(saved);
            this.els.pbWpm.textContent = pb.wpm;
            this.els.pbAccuracy.textContent = pb.accuracy + '%';
            if (this.els.pbWords) this.els.pbWords.textContent = pb.words || '—';
            this.els.pbChars.textContent = pb.chars;

            // Display time for infinite mode
            if (this.state.duration === -1 && pb.timeFormatted && pbTimeEl) {
                pbTimeEl.textContent = pb.timeFormatted;
            }
        } else {
            this.els.pbWpm.textContent = '—';
            this.els.pbAccuracy.textContent = '—';
            if (this.els.pbWords) this.els.pbWords.textContent = '—';
            this.els.pbChars.textContent = '—';
            if (pbTimeEl) pbTimeEl.textContent = '—';
        }
    }

    savePersonalBest(stats) {
        const key = this.getStorageKey();

        // specific logic for infinite mode
        if (this.state.duration === -1) {
            // Guard: Don't save if test never started
            if (!this.state.startTime) {
                return false;
            }

            // Calculate formatted time
            const endTime = this.state.pauseTime || Date.now();
            const elapsedMs = endTime - this.state.startTime;

            // Guard: Don't save if elapsed time is invalid
            if (elapsedMs < 0 || elapsedMs > 86400000) { // Max 24 hours
                return false;
            }

            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const mins = Math.floor(elapsedSeconds / 60);
            const secs = elapsedSeconds % 60;
            const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            localStorage.setItem(key, JSON.stringify({
                wpm: Math.max(0, stats.wpm), // Ensure non-negative
                accuracy: stats.accuracy,
                words: stats.correctWords,
                chars: stats.correctChars,
                timeFormatted: formattedTime
            }));
            return false; // Infinite mode never triggers "New Record" celebration
        }

        const saved = localStorage.getItem(key);
        const current = saved ? JSON.parse(saved) : null;

        const isNewRecord = !current || stats.wpm > current.wpm;

        if (isNewRecord) {
            this.soundManager.playAchievement();
            this.achievementManager.checkPBBeaten(this.state.duration);
            localStorage.setItem(key, JSON.stringify({
                wpm: stats.wpm,
                accuracy: stats.accuracy,
                words: stats.correctWords,
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
        // Sync global class for FOUC prevention styles
        if (isEnabled) {
            document.documentElement.classList.remove('sound-off');
        } else {
            document.documentElement.classList.add('sound-off');
        }
    }

    toggleKeyclick() {
        const isEnabled = this.soundManager.toggleKeyclick();
        this.updateKeyclickUI(isEnabled);
    }

    updateKeyclickUI(isEnabled) {
        if (!this.els.keyclickToggle) return;
        this.els.keyclickToggle.setAttribute('data-keyclick', isEnabled ? 'on' : 'off');
        // Sync global class for FOUC prevention styles
        if (isEnabled) {
            document.documentElement.classList.remove('keyclick-off');
        } else {
            document.documentElement.classList.add('keyclick-off');
        }
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
        const finishBtn = document.getElementById('finishRunBtn');
        finishBtn?.addEventListener('click', () => this.finish());

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
        localStorage.setItem('ff_duration', this.state.duration);
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

        if (this.state.duration === -1) {
            this.state.timeRemaining = 0; // Starts at 0 for infinite
            // UI setup for infinite
            this.els.countdown.textContent = "00:00";
        } else {
            this.state.timeRemaining = this.state.duration;
            this.els.countdown.textContent = this.state.duration;
        }

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
        this.els.timer?.classList.remove('timer--urgent');

        const pb = this.getPersonalBest();
        if (this.state.duration !== -1 && pb) {
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

        // Show/hide Finish button (only for infinite mode)
        const finishBtn = document.getElementById('finishRunBtn');
        if (finishBtn) {
            if (this.state.duration === -1) {
                finishBtn.classList.remove('hidden');
                finishBtn.style.opacity = '1';
                finishBtn.style.pointerEvents = 'auto';
            } else {
                finishBtn.classList.add('hidden');
                finishBtn.style.opacity = '0';
                finishBtn.style.pointerEvents = 'none';
            }
        }

        // Update footer hints for typing mode
        if (this.els.escHintItem) this.els.escHintItem.style.display = '';
        if (this.els.escHint) this.els.escHint.textContent = 'Duraklat';

        if (this.els.startHintItem) this.els.startHintItem.style.display = '';
        if (this.els.hintSeparator) this.els.hintSeparator.style.display = 'none';
        if (this.els.enterKbd) this.els.enterKbd.style.display = 'none';
        if (this.els.startHint) this.els.startHint.textContent = 'İlerle';
    }

    loadNewSentence() {
        // Get adaptive sentence based on current WPM
        this.state.currentSentence = this.getAdaptiveSentence();
        this.state.words = this.state.currentSentence.split(' ');
        this.state.currentWordIndex = 0;
        this.renderWords();
    }

    goHome() {
        // ULTRATHINK: Save stats for infinite mode if user quits manually
        if (this.state.duration === -1 && this.state.startTime) {
            const stats = this.calcFinalStats();
            this.savePersonalBest(stats);
        }

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

        // Hide finish button when going home
        const finishBtn = document.getElementById('finishRunBtn');
        if (finishBtn) {
            finishBtn.style.opacity = '0';
            finishBtn.style.pointerEvents = 'none';
        }

        this.els.pauseOverlay?.classList.add('hidden');
        this.els.typingArea.classList.add('hidden');
        this.els.resultsScreen.classList.add('hidden');
        this.els.startScreen.classList.remove('hidden');

        // Refresh stats UI to show the just-saved run
        this.loadPersonalBest();

        // Update footer hints for home screen - show ALL shortcuts
        if (this.els.escHintItem) this.els.escHintItem.style.display = '';
        if (this.els.escHint) this.els.escHint.textContent = 'Menü';

        if (this.els.startHintItem) this.els.startHintItem.style.display = '';
        if (this.els.hintSeparator) this.els.hintSeparator.style.display = '';
        if (this.els.enterKbd) this.els.enterKbd.style.display = '';
        if (this.els.startHint) this.els.startHint.textContent = 'Başla';
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

        // Keep "Finish" button visible in infinite mode during pause
        const finishBtn = document.getElementById('finishRunBtn');
        if (finishBtn) {
            if (this.state.duration === -1) {
                finishBtn.classList.remove('hidden');
                finishBtn.style.opacity = '1';
                finishBtn.style.pointerEvents = 'auto';
            } else {
                finishBtn.classList.add('hidden');
                finishBtn.style.opacity = '0';
                finishBtn.style.pointerEvents = 'none';
            }
        }

        // Prevent input while paused
        this.els.typingInput?.blur();
        if (this.els.typingInput) {
            this.els.typingInput.disabled = true;
        }

        // Update footer hints for pause
        if (this.els.escHint) this.els.escHint.textContent = 'Devam Et';
        if (this.els.startHintItem) this.els.startHintItem.style.display = 'none';
    }

    resume() {
        if (!this.state.isPaused) return;

        // Adjust start time to account for pause duration (only if timer was started)
        if (this.state.startTime) {
            const pauseDuration = Date.now() - this.state.pauseTime;
            this.state.startTime += pauseDuration;
        }

        this.state.isPaused = false;
        this.state.pauseTime = null;
        this.els.pauseOverlay?.classList.add('hidden');

        // Restore typing hints
        if (this.els.escHint) this.els.escHint.textContent = 'Duraklat';
        if (this.els.startHintItem) this.els.startHintItem.style.display = '';
        if (this.els.hintSeparator) this.els.hintSeparator.style.display = 'none';
        if (this.els.enterKbd) this.els.enterKbd.style.display = 'none';
        if (this.els.startHint) this.els.startHint.textContent = 'İlerle';

        // Keep "Finish" button visible in infinite mode when resuming
        const finishBtn = document.getElementById('finishRunBtn');
        if (finishBtn) {
            if (this.state.duration === -1) {
                finishBtn.classList.remove('hidden');
                finishBtn.style.opacity = '1';
                finishBtn.style.pointerEvents = 'auto';
            } else {
                finishBtn.classList.add('hidden');
                finishBtn.style.opacity = '0';
                finishBtn.style.pointerEvents = 'none';
            }
        }

        // Re-enable and focus input
        if (this.els.typingInput) {
            this.els.typingInput.disabled = false;
        }
        this.els.typingInput?.focus();

        // CRITICAL: Restart the timer loop after resume
        // Only if timer was already started (user had typed at least once)
        if (this.state.startTime) {
            this.loopTimer();
        }
    }

    // ═══════════════════════════════════════════
    // SHARE
    // ═══════════════════════════════════════════

    async renderShareImage(themeName, customText, providedStats = null) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1; // High res

        canvas.width = 800; // * dpr;
        canvas.height = 450; // * dpr;
        // ctx.scale(dpr, dpr);

        // Theme Definitions (matching styles.css)
        // Theme Definitions (matching styles.css)
        const themes = {
            dark: { bg: '#0D0D0D', fg: '#E8E4D9', muted: '#D4D4D4', accent: '#FFB347', border: '#2A2A2A', surface: '#1A1A1A' }, // Muted: Platinum
            light: { bg: '#FAF9F6', fg: '#1A1A1B', muted: '#222222', accent: '#EA9D34', border: '#E2E2E5', surface: '#FFFFFF' }, // Muted: Near Black
            'high-contrast': { bg: '#000000', fg: '#FFFFFF', muted: '#FFFF00', accent: '#00FFFF', border: '#FFFFFF', surface: '#000000' }
        };

        // Use selected theme explicitly. If user wants HC, they select it manually (or auto-selected on open).
        let colors = themes[themeName] || themes.dark;

        // Removed: Global High Contrast Override. 
        // We now treat HC as a distinct selectable theme.
        const isHighContrast = themeName === 'high-contrast';

        // Background
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Decorative Border (Glassmorphism hint)
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Logo
        ctx.fillStyle = colors.accent;
        ctx.font = 'bold 24px "Space Grotesk", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('▸ fastfingers', 50, 70);

        // Date / Timestamp (Fixed Font & Contrast)
        ctx.fillStyle = isHighContrast ? colors.fg : colors.muted; // Use FG if HC, otherwise muted
        ctx.font = 'bold 16px "Space Grotesk", sans-serif'; // Increased size & weight
        ctx.textAlign = 'right';
        const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        ctx.fillText(date, canvas.width - 50, 70);

        // Stats Container
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Use provided stats or fallback to DOM/state. Ensure we have real data.
        let statsToRender = providedStats;
        if (!statsToRender) {
            // Read from DOM first
            const domWpm = this.els.finalWpm?.textContent;
            const domAcc = this.els.finalAccuracy?.textContent;
            const domChars = this.els.finalChars?.textContent;
            const domWords = this.els.finalWords?.textContent;

            // If DOM values look empty/zero, recalculate from state
            if (!domWpm || domWpm === '0' || domWpm === '—') {
                const recalculated = this.calcFinalStats();
                statsToRender = {
                    wpm: recalculated.wpm,
                    accuracy: recalculated.accuracy + '%',
                    chars: recalculated.correctChars,
                    words: recalculated.correctWords,
                    time: document.getElementById('finalTime')?.textContent,
                    isInfinite: this.state.duration === -1
                };
            } else {
                statsToRender = {
                    wpm: domWpm,
                    accuracy: domAcc,
                    chars: domChars,
                    words: domWords,
                    time: document.getElementById('finalTime')?.textContent,
                    isInfinite: document.getElementById('finalTimeItem') && !document.getElementById('finalTimeItem').classList.contains('hidden')
                };
            }
        }

        // Main WPM
        ctx.fillStyle = colors.accent;
        ctx.font = 'bold 100px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = themeName === 'dark' ? 'rgba(255, 179, 71, 0.2)' : 'transparent';
        ctx.shadowBlur = themeName === 'dark' ? 20 : 0;
        ctx.fillText(statsToRender.wpm, centerX, centerY - 20);
        ctx.shadowBlur = 0; // Reset shadow

        ctx.fillStyle = colors.muted;
        ctx.font = 'bold 24px "Space Grotesk", sans-serif'; // Increased WPM label
        ctx.fillText('WPM', centerX, centerY + 15);

        // Secondary Stats Row - REDESIGNED
        const statsY = centerY + 80;
        const statsRows = [
            { label: 'DOĞRULUK', value: statsToRender.accuracy },
            { label: 'KARAKTER', value: statsToRender.chars },
            { label: 'KELİME', value: statsToRender.words }
        ];

        // Add SÜRE if infinite mode (detected from object)
        if (statsToRender.isInfinite && statsToRender.time) {
            statsRows.push({ label: 'SÜRE', value: statsToRender.time });
        }

        // Center-distributed layout
        const totalStats = statsRows.length;

        ctx.textAlign = 'center';

        statsRows.forEach((stat, i) => {
            // Distribute evenly across the width
            const x = (canvas.width / (totalStats + 1)) * (i + 1);

            // Value
            ctx.fillStyle = colors.fg;
            ctx.font = '700 36px "Space Grotesk", sans-serif';
            ctx.fillText(stat.value, x, statsY);

            // Label (Larger, Bolder)
            ctx.fillStyle = colors.muted;
            ctx.font = 'bold 14px "Space Grotesk", sans-serif';
            ctx.fillText(stat.label.split('').join(String.fromCharCode(8202)), x, statsY + 30);

            // Optional: Divider Line between items
            if (i < totalStats - 1) {
                const nextX = (canvas.width / (totalStats + 1)) * (i + 2);
                const midX = (x + nextX) / 2;

                ctx.strokeStyle = colors.border;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(midX, statsY - 20);
                ctx.lineTo(midX, statsY + 30);
                ctx.stroke();
            }
        });

        // Custom Text (Taunt/Note) - Enhanced Typography
        if (customText) {
            ctx.fillStyle = colors.accent; // Make it pop
            ctx.font = 'italic 500 18px "Space Grotesk", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`"${customText}"`, centerX, canvas.height - 40);
        } else {
            // Footer Mode Info - MORE PROMINENT
            ctx.fillStyle = colors.fg; // Was muted, now foreground for visibility
            ctx.font = '700 14px "Space Grotesk", sans-serif'; // Larger and bolder
            ctx.textAlign = 'center';
            const modeText = `${this.state.duration === -1 ? 'SONSUZ' : this.state.duration + ' SANİYE'} MOD`;
            ctx.fillText(modeText.split('').join(String.fromCharCode(8202)), centerX, canvas.height - 40);
        }

        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    shareResult(preserveStats = false) {
        this.els.shareModal.classList.remove('hidden');

        // Initialize state: Check global HC first
        const isGlobalHC = document.documentElement.classList.contains('high-contrast');
        const currentTheme = isGlobalHC ? 'high-contrast' : (document.documentElement.getAttribute('data-theme') || 'dark');

        this.activeShareTheme = currentTheme;
        this.updateShareThemeUI(currentTheme);

        // Clear input
        this.els.shareCustomText.value = '';

        // Clear stale stats ONLY if not preserving (i.e., for normal result sharing)
        if (!preserveStats) {
            this.currentShareStats = null;
        }

        // Initial Render
        this.refreshSharePreview();
    }

    shareBestResult() {
        const key = this.getStorageKey();
        const saved = localStorage.getItem(key);
        if (!saved) return;

        const pb = JSON.parse(saved);
        this.currentShareStats = {
            wpm: pb.wpm,
            accuracy: pb.accuracy + '%',
            chars: pb.chars,
            words: pb.words || '—',
            time: pb.timeFormatted,
            isInfinite: this.state.duration === -1
        };

        this.shareResult(true); // Pass true to preserve the stats we just set
    }

    closeShareModal() {
        this.els.shareModal.classList.add('hidden');
    }

    updateShareThemeUI(theme) {
        this.activeShareTheme = theme;
        // Reset all
        this.els.shareThemeDark.classList.remove('active');
        this.els.shareThemeLight.classList.remove('active');
        if (this.els.shareThemeHC) this.els.shareThemeHC.classList.remove('active');

        if (theme === 'dark') {
            this.els.shareThemeDark.classList.add('active');
        } else if (theme === 'light') {
            this.els.shareThemeLight.classList.add('active');
        } else if (theme === 'high-contrast' && this.els.shareThemeHC) {
            this.els.shareThemeHC.classList.add('active');
        }
    }

    async refreshSharePreview() {
        if (!this.els.sharePreviewResult) return;

        this.els.sharePreviewLoader.classList.remove('hidden');
        const customText = this.els.shareCustomText.value || '';

        // If we are sharing active stats (not PB), pass them explicitly or let it fallback
        // But to be consistent, we pass them.
        const stats = this.currentShareStats || null;

        const blob = await this.renderShareImage(this.activeShareTheme, customText, stats);
        const url = URL.createObjectURL(blob);

        // Revoke old url to prevent memory leaks if exists
        if (this.lastShareUrl) URL.revokeObjectURL(this.lastShareUrl);
        this.lastShareUrl = url;

        this.els.sharePreviewResult.src = url;

        // Wait for load to hide loader
        this.els.sharePreviewResult.onload = () => {
            this.els.sharePreviewLoader.classList.add('hidden');
        };

        this.currentShareBlob = blob;
    }

    async handleDownload() {
        if (!this.currentShareBlob) return;
        const url = URL.createObjectURL(this.currentShareBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fastfingers-result.png`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async handleCopy() {
        if (!this.currentShareBlob) return;
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': this.currentShareBlob })
            ]);
            this.showToast('Görsel panoya kopyalandı! 📋');
        } catch (err) {
            this.showToast('Kopyalama başarısız, lütfen indirmeyi deneyin.');
        }
    }

    async tweetResult() {
        // Try to copy image first for smoother UX
        if (this.currentShareBlob) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': this.currentShareBlob })
                ]);
                this.showToast('Görsel kopyalandı! Tweet\'e yapıştırın (Ctrl+V) 🐦', 4000);
            } catch (e) {
                this.showToast('Görseli indirin ve tweet\'e ekleyin ⬇️', 4000);
            }
        }

        const wpm = this.els.finalWpm.textContent;
        const acc = this.els.finalAccuracy.textContent;
        const text = `${wpm} WPM | ${acc} Doğruluk ile testi tamamladım! 🚀\n\nSen de hızını test et:`;
        const url = 'https://fastfingers.app';
        const hashtags = 'fastfingers,typingtest,yazıhızı';

        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;

        // Slight delay to let the toast appear before tab switch (optional but nice)
        setTimeout(() => {
            window.open(twitterUrl, '_blank');
        }, 500);
    }

    bindShareEvents() {
        // Modal Close
        if (this.els.shareCloseBtn) {
            this.els.shareCloseBtn.addEventListener('click', () => this.closeShareModal());
        }
        if (this.els.shareModal) {
            this.els.shareModal.addEventListener('click', (e) => {
                if (e.target === this.els.shareModal) this.closeShareModal();
            });
        }

        // Theme Toggles
        if (this.els.shareThemeDark) {
            this.els.shareThemeDark.addEventListener('click', () => {
                this.updateShareThemeUI('dark');
                this.refreshSharePreview();
            });
        }
        if (this.els.shareThemeLight) {
            this.els.shareThemeLight.addEventListener('click', () => {
                this.updateShareThemeUI('light');
                this.refreshSharePreview();
            });
        }
        if (this.els.shareThemeHC) {
            this.els.shareThemeHC.addEventListener('click', () => {
                this.updateShareThemeUI('high-contrast');
                this.refreshSharePreview();
            });
        }

        if (this.els.pbShareBtn) {
            this.els.pbShareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shareBestResult();
            });
        }

        // Custom Text Input (Debounced)
        if (this.els.shareCustomText) {
            let debounceTimer;
            this.els.shareCustomText.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.refreshSharePreview(), 300);
            });
        }

        // Action Buttons
        if (this.els.shareDownloadBtn) {
            this.els.shareDownloadBtn.addEventListener('click', () => this.handleDownload());
        }
        if (this.els.shareCopyBtn) {
            this.els.shareCopyBtn.addEventListener('click', () => this.handleCopy());
        }
        if (this.els.shareTweetBtn) {
            this.els.shareTweetBtn.addEventListener('click', () => this.tweetResult());
        }
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
        // Guard: Prevent double-finish or finishing when not running
        if (!this.state.isRunning) return;

        // Guard: Prevent finishing if test never started (no typing happened)
        if (!this.state.startTime) {
            // Just go home silently
            this.goHome();
            return;
        }

        // Guard: Prevent saving if no characters were typed (empty test)
        if (this.state.totalCharsTyped === 0) {
            this.goHome();
            return;
        }

        // SANITY CHECK: Ensure startTime is a valid recent timestamp (e.g. > Jan 1 2025)
        // This prevents the "56 years" bug (29450931:57) where startTime is near 0
        if (this.state.startTime < 1735689600000) {
            console.warn('Invalid startTime detected in finish():', this.state.startTime);
            this.goHome();
            return;
        }

        // IMPORTANT: Capture end time ONCE at the very start
        // If paused, use pauseTime to avoid counting pause duration
        const capturedEndTime = this.state.isPaused && this.state.pauseTime
            ? this.state.pauseTime
            : Date.now();

        this.state.isRunning = false;
        if (this.state.animationFrameId) {
            cancelAnimationFrame(this.state.animationFrameId);
            this.state.animationFrameId = null;
        }

        // Hide pause overlay if visible
        this.els.pauseOverlay?.classList.add('hidden');

        // Hide finish button
        const finishBtn = document.getElementById('finishRunBtn');
        if (finishBtn) {
            finishBtn.style.opacity = '0';
            finishBtn.style.pointerEvents = 'none';
        }

        // Calculate stats using the captured end time
        const stats = this.calcFinalStats(capturedEndTime);

        if (this.state.duration === -1) {
            // INFINITE MODE
            // Save to "Last Attempt" using savePersonalBest which handles infinite mode
            this.savePersonalBest(stats);
            this.loadPersonalBest();

            // No "New Record" for infinite
            this.els.newRecord.classList.add('hidden');

            // Show word count
            this.els.finalWords.textContent = stats.correctWords;

            // Show elapsed time in dedicated SÜRE field
            const finalTimeItem = document.getElementById('finalTimeItem');
            const finalTime = document.getElementById('finalTime');
            if (finalTimeItem) finalTimeItem.classList.remove('hidden');

            let elapsedSeconds = Math.floor((capturedEndTime - this.state.startTime) / 1000);

            // Safety cap: If duration > 24 hours, show 00:00 or handle gracefully
            if (elapsedSeconds > 86400 || elapsedSeconds < 0) {
                elapsedSeconds = 0;
            }

            const mins = Math.floor(elapsedSeconds / 60);
            const secs = elapsedSeconds % 60;
            if (finalTime) finalTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            // NORMAL MODE
            const isNewRecord = this.savePersonalBest(stats);
            this.loadPersonalBest();

            if (isNewRecord) {
                this.els.newRecord.classList.remove('hidden');
            } else {
                this.els.newRecord.classList.add('hidden');
            }

            // Hide time field for normal mode
            const finalTimeItem = document.getElementById('finalTimeItem');
            if (finalTimeItem) finalTimeItem.classList.add('hidden');

            // Show word count
            this.els.finalWords.textContent = stats.correctWords;
        }

        this.els.finalWpm.textContent = stats.wpm;
        this.els.finalAccuracy.textContent = `${stats.accuracy}%`;
        this.els.finalChars.textContent = stats.correctChars;

        this.els.typingArea.classList.add('hidden');
        this.els.resultsScreen.classList.remove('hidden');

        // Check achievements
        this.achievementManager.checkAll(stats);
        this.updateAchievementCount();

        // Update footer hints for results screen
        if (this.els.escHint) this.els.escHint.textContent = 'Menü';
        if (this.els.startHintItem) this.els.startHintItem.style.display = 'none';
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

            if (this.state.duration === -1) {
                // Infinite Mode: Count UP
                const seconds = Math.floor(elapsed);
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                this.els.countdown.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                // Keep progress full
                if (this.els.countdownProgress) {
                    this.els.countdownProgress.style.transform = 'scaleX(1)';
                }
            } else {
                // Normal Mode: Count DOWN
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
        const html = this.state.words.map((word, wordIndex) => {
            const wordClasses = ['word'];
            if (wordIndex === 0) wordClasses.push('word--current');

            // Wrap each char in a span
            const charsHtml = word.split('').map((char, charIndex) => {
                return `<span class="char" data-word="${wordIndex}" data-char="${charIndex}">${this.escapeHtml(char)}</span>`;
            }).join('');

            return `<span class="${wordClasses.join(' ')}" data-index="${wordIndex}">${charsHtml}</span>`;
        }).join('<span class="word-space"> </span>');

        this.els.sentenceDisplay.innerHTML = html;
        // Caret removed – no positioning needed
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

        // Word-level error check
        for (let i = 0; i < input.length; i++) {
            if (i >= targetLower.length || inputLower[i] !== targetLower[i]) {
                hasError = true;
                break;
            }
        }

        wordEl.classList.toggle('word--error', hasError);

        // Fluid input feedback
        if (this.els.inputWrapper) {
            this.els.inputWrapper.classList.toggle('input-wrapper--error', hasError);
        }
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
        if (this.els.liveWords) this.els.liveWords.textContent = stats.correctWords;
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
            return { wpm: 0, accuracy: 100, correctChars: 0, correctWords: 0 };
        }

        const elapsed = (Date.now() - this.state.startTime) / 60000;
        const wpm = elapsed > 0 ? Math.round((this.state.correctChars / 5) / elapsed) : 0;
        const acc = this.state.totalCharsTyped > 0
            ? Math.round((this.state.correctChars / this.state.totalCharsTyped) * 100)
            : 100;

        return { wpm, accuracy: acc, correctChars: this.state.correctChars, correctWords: this.state.correctWords };
    }

    calcFinalStats(endTime = null) {
        let mins;

        if (this.state.duration === -1) {
            // Infinite mode: use actual elapsed time
            if (!this.state.startTime) {
                return { wpm: 0, accuracy: 100, correctChars: 0, correctWords: 0 };
            }
            const finalEndTime = endTime || this.state.pauseTime || Date.now();
            const elapsedMs = finalEndTime - this.state.startTime;
            mins = elapsedMs / 60000;
            if (mins <= 0) mins = 0.01; // Prevent divide by zero
        } else {
            mins = this.state.duration / 60;
        }

        const wpm = Math.max(0, Math.round((this.state.correctChars / 5) / mins));
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

    // Helper for infinite mode to save stats with consistent timing
    saveInfiniteStats(stats, endTime) {
        const key = 'ff-last-infinite';

        if (!this.state.startTime) return;

        const elapsedMs = endTime - this.state.startTime;
        if (elapsedMs < 0 || elapsedMs > 86400000) return;

        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        localStorage.setItem(key, JSON.stringify({
            wpm: stats.wpm,  // Use the EXACT same WPM from calcFinalStats
            accuracy: stats.accuracy,
            chars: stats.correctChars,
            timeFormatted: formattedTime
        }));
    }
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    window.fastFingers = new FastFingers();
});
