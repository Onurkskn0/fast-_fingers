/**
 * FastFingers - Sentence Library
 * Difficulty-based Turkish sentences for typing test
 */

const SENTENCES = {
    easy: [
        "Güneş bugün çok güzel doğdu.",
        "Kedim pencerede oturuyor.",
        "Bu kitabı çok sevdim.",
        "Yarın okula gideceğim.",
        "Annem çok güzel yemek yapıyor.",
        "Bahçede çiçekler açtı.",
        "Bugün hava çok sıcak.",
        "Arkadaşımla parka gittik.",
        "Köpeğim top oynamayı seviyor.",
        "Bu film çok eğlenceliydi.",
        "Sabah erken kalktım.",
        "Denizde yüzmeyi seviyorum.",
        "Dondurma yemeyi çok seviyorum.",
        "Babam bana bisiklet aldı.",
        "Okulda yeni arkadaşlar edindim."
    ],
    medium: [
        "Teknoloji hayatımızı kolaylaştırıyor ama bazen de zorlaştırıyor.",
        "İstanbul dünyanın en kalabalık şehirlerinden biridir.",
        "Kitap okumak hayal gücünü geliştiren en güzel aktivitelerden biridir.",
        "Yazılım geliştirme sürekli öğrenmeyi gerektiren bir meslektir.",
        "Doğa yürüyüşleri hem sağlık hem de ruh hali için faydalıdır.",
        "Müzik dinlemek stresi azaltmanın en etkili yollarından biridir.",
        "Her gün düzenli egzersiz yapmak sağlıklı yaşamın anahtarıdır.",
        "Programlama dillerini öğrenmek mantıksal düşünmeyi geliştirir.",
        "Türk mutfağı dünyada en zengin mutfaklardan biri olarak kabul edilir.",
        "Uzay araştırmaları insanlığın geleceği için büyük önem taşımaktadır.",
        "Sanat insanların duygularını ifade etmesinin en güzel yoludur.",
        "Çevre kirliliği günümüzün en önemli sorunlarından biridir.",
        "Yapay zeka teknolojisi hızla gelişmeye devam etmektedir.",
        "Sağlıklı beslenme alışkanlıkları küçük yaşta kazanılmalıdır.",
        "Tarihi eserlerimizi korumak gelecek nesillere karşı görevimizdir."
    ],
    hard: [
        "Kuantum bilgisayarlar geleneksel bilgisayarların çözemediği problemleri milisaniyeler içinde çözebilir.",
        "Nöroplastisite beynin yaşam boyu yeni sinaptik bağlantılar kurabilme yeteneğini ifade eder.",
        "Sürdürülebilir kalkınma ekonomik büyüme ile çevresel koruma arasında denge kurmayı hedefler.",
        "Kriptografi dijital çağda veri güvenliğinin sağlanmasında kritik bir rol oynamaktadır.",
        "Biyoteknoloji tarım sektöründe verimliliği artırarak küresel gıda krizine çözüm sunabilir.",
        "Karanlık madde evrendeki toplam kütlenin yaklaşık yüzde yirmi yedisini oluşturmaktadır.",
        "Epistemoloji bilginin doğası kaynağı ve sınırlarını araştıran felsefe dalıdır.",
        "Makine öğrenmesi algoritmaları büyük veri setlerinden anlamlı örüntüler çıkarabilmektedir.",
        "Genetik mühendisliği canlıların DNA dizilimlerini değiştirerek yeni özellikler kazandırır.",
        "Blockchain teknolojisi merkezi olmayan güvenli ve şeffaf işlem kayıtları sağlamaktadır.",
        "Astrofizikçiler kara deliklerin olay ufkunu ilk kez görüntülemeyi başardılar.",
        "Nörolinguistik programlama zihin ve dil arasındaki ilişkiyi inceleyen bir yaklaşımdır.",
        "İklim değişikliği küresel ekosistemler üzerinde geri dönüşü olmayan etkiler yaratmaktadır.",
        "Kuantum dolanıklık iki parçacığın mesafeden bağımsız olarak birbirini etkilemesidir.",
        "Fenomenoloji bilinç deneyimlerinin yapısını ve özünü araştıran felsefi bir akımdır."
    ]
};

/**
 * Get random sentences from a difficulty level
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @param {number} count - Number of sentences to return
 * @returns {string[]} Array of random sentences
 */
function getRandomSentences(difficulty = 'medium', count = 5) {
    const sentences = SENTENCES[difficulty] || SENTENCES.medium;
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get all sentences for a difficulty level
 * @param {string} difficulty 
 * @returns {string[]}
 */
function getAllSentences(difficulty) {
    return SENTENCES[difficulty] || SENTENCES.medium;
}
