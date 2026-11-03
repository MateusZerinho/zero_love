// ===============================
// Imagens e vídeos: só para olhar
// ===============================
// - Não dá para arrastar imagem/vídeo (o "fantasminha" que segue o mouse)
// - Clique direito em imagem/vídeo não abre menu (salvar, picture-in-picture...)
// - Vídeos sem botão de picture-in-picture / popup / cast
(function () {
    const MIDIA = "img, video, .music-player__cover-canvas";

    const ehMidia = (alvo) => alvo && alvo.closest && alvo.closest(MIDIA);

    // capture = true: roda antes de qualquer outro script da página
    document.addEventListener("dragstart", (e) => {
        if (ehMidia(e.target)) e.preventDefault();
    }, true);

    document.addEventListener("contextmenu", (e) => {
        if (ehMidia(e.target)) e.preventDefault();
    }, true);

    document.querySelectorAll("img").forEach((img) => {
        img.draggable = false;
    });

    document.querySelectorAll("video").forEach((v) => {
        v.controls = false;
        v.disablePictureInPicture = true;
        v.disableRemotePlayback = true;
        v.setAttribute("disablepictureinpicture", "");
        v.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
    });
})();

// ===============================
// Pré-loader
// ===============================
(function () {
    const preloader = document.getElementById("preloader");
    if (!preloader) return;
 
    // Tempo total da animação de preenchimento:
    // delay (0.4s) + duração (2s) + uma pausa extra antes de sair (0.3s) = ~2.7s
    const FILL_DURATION = 2700;
 
    setTimeout(function () {
        preloader.classList.add("preloader--hidden");
 
        // Remove do DOM depois da transição de fade-out (0.8s)
        setTimeout(function () {
            preloader.remove();
        }, 800);
    }, FILL_DURATION);
})();

// ===============================
// Plugins externos
// ===============================
feather.replace();
AOS.init();

// Contagem regressiva (hero)
// ===============================
(function () {
    // 05/11/2026 às 00:00 (mês começa em 0 → 10 = novembro)
    const dataDoEvento = new Date(2026, 10, 5, 0, 0, 0).getTime();

    const els = {
        dias: document.getElementById("hcDias"),
        horas: document.getElementById("hcHoras"),
        minutos: document.getElementById("hcMinutos"),
        segundos: document.getElementById("hcSegundos")
    };
    const grid = document.getElementById("heroCounter");
    const texto = document.getElementById("heroText");

    if (!els.dias) return;

    const pad = (n) => String(n).padStart(2, "0");

    const diaEmMs = 1000 * 60 * 60 * 24;
    const horaEmMs = 1000 * 60 * 60;
    const minutoEmMs = 1000 * 60;

    let intervalo;

    function atualizar() {
        const distancia = dataDoEvento - Date.now();

        if (distancia < 0) {
            clearInterval(intervalo);
            if (grid) grid.hidden = true;
            if (texto) texto.innerHTML = "Hoje é o nosso dia 💕";
            return;
        }

        els.dias.textContent = pad(Math.floor(distancia / diaEmMs));
        els.horas.textContent = pad(Math.floor((distancia % diaEmMs) / horaEmMs));
        els.minutos.textContent = pad(Math.floor((distancia % horaEmMs) / minutoEmMs));
        els.segundos.textContent = pad(Math.floor((distancia % minutoEmMs) / 1000));
    }

    atualizar(); // já preenche na hora, sem esperar 1s
    intervalo = setInterval(atualizar, 1000);
})();

// ===============================
// Hero: números pulam em sequência a cada 10s
// ===============================
(function () {
    const grid = document.getElementById("heroCounter");
    if (!grid || !window.gsap) return;

    const INTERVALO_MS = 10000;   // de quanto em quanto tempo pula
    const ATRASO_ENTRE = 0.14;    // segundos entre uma caixa e a próxima (efeito "onda")
    const SUBIDA = 0.24;          // duração da subida
    const DESCIDA = 0.7;          // duração da descida (com quique)

    const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const celular = window.matchMedia("(max-width: 640px)");
    const caixas = gsap.utils.toArray(".hero-counter__box", grid);

    // valor inicial explícito para o GSAP conseguir interpolar a variável
    gsap.set(caixas, { "--pulo": "0px" });

    function pular() {
        if (grid.hidden || document.hidden || reduzirMovimento.matches) return;

        const altura = celular.matches ? -14 : -22; // px (negativo = sobe)
        const tl = gsap.timeline();

        // ordem do HTML: dias, horas, minutos, segundos
        caixas.forEach((caixa, i) => {
            const numero = caixa.querySelector(".hero-counter__number");
            const inicio = i * ATRASO_ENTRE;

            // sobe rápido
            tl.to(caixa, { "--pulo": altura + "px", duration: SUBIDA, ease: "power2.out" }, inicio)
              // desce quicando
              .to(caixa, { "--pulo": "0px", duration: DESCIDA, ease: "bounce.out" }, inicio + SUBIDA)
              // o número dá uma leve "inchada" junto com o pulo
              .to(numero, { scale: 1.15, duration: SUBIDA, ease: "power2.out" }, inicio)
              .to(numero, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" }, inicio + SUBIDA);
        });
    }

    // Dispara o pulo quando o número dos segundos (o que aparece na tela)
    // chega em um múltiplo de 10: ...20, 10, 00, 50...
    const elSegundos = document.getElementById("hcSegundos");
    let ultimoSegundo = null;

    gsap.ticker.add(() => {
        const atual = parseInt(elSegundos.textContent, 10);
        if (atual === ultimoSegundo) return;       // ainda é o mesmo segundo

        ultimoSegundo = atual;
        if (atual % (INTERVALO_MS / 1000) === 0) pular();
    });
})();

// ===============================
// Corações caindo
// ===============================
function createHeart() {
    const container = document.querySelector(".hearts-container");
    if (!container) return;

    const heart = document.createElement("div");
    heart.classList.add("heart");

    heart.style.left = `${Math.random() * 100}%`;
    heart.style.animationDuration = 3 + Math.random() * 3 + "s";

    const angles = [35, 45, 55];
    const randomAngle = angles[Math.floor(Math.random() * angles.length)];
    heart.style.setProperty("--rotation", `${randomAngle}deg`);

    container.appendChild(heart);

    setTimeout(() => heart.remove(), 7000);
}

setInterval(createHeart, 300);

// ===============================
// Intersection Observer (mobile)
// ===============================
document.addEventListener("DOMContentLoaded", function () {
    const isTouchDevice =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) return;

    const descriptions = document.querySelectorAll(
        ".event__details__description"
    );

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const container = entry.target.closest(".container");
                const image = container?.querySelector(".event__image");
                if (!image) return;

                if (entry.isIntersecting) {
                    image.classList.add("event__image--active");
                } else {
                    image.classList.remove("event__image--active");
                }
            });
        },
        {
            rootMargin: "0px 0px -40% 0px",
            threshold: 0
        }
    );

    descriptions.forEach((desc) => {
        observer.observe(desc);

        // ativação inicial
        const rect = desc.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom >= 0) {
            const container = desc.closest(".container");
            const image = container?.querySelector(".event__image");
            if (image) image.classList.add("event__image--active");
        }
    });
});

// ===============================
// Contador desde o pedido de namoro
// ===============================
(function () {
    // 05/11/2022 às 00:00 (mês começa em 0 → 10 = novembro)
    const inicioDoNamoro = new Date(2022, 10, 5, 0, 0, 0);

    const els = {
        anos: document.getElementById("lcAnos"),
        meses: document.getElementById("lcMeses"),
        dias: document.getElementById("lcDias"),
        horas: document.getElementById("lcHoras"),
        minutos: document.getElementById("lcMinutos"),
        segundos: document.getElementById("lcSegundos")
    };

    if (!els.anos) return;

    const pad = (n) => String(n).padStart(2, "0");

    // Diferença de calendário (anos, meses, dias, h, min, s)
    function calcularTempo(inicio, agora) {
        let anos = agora.getFullYear() - inicio.getFullYear();
        let meses = agora.getMonth() - inicio.getMonth();
        let dias = agora.getDate() - inicio.getDate();
        let horas = agora.getHours() - inicio.getHours();
        let minutos = agora.getMinutes() - inicio.getMinutes();
        let segundos = agora.getSeconds() - inicio.getSeconds();

        if (segundos < 0) { segundos += 60; minutos--; }
        if (minutos < 0)  { minutos += 60;  horas--; }
        if (horas < 0)    { horas += 24;    dias--; }
        if (dias < 0) {
            // dias do mês anterior ao atual
            dias += new Date(agora.getFullYear(), agora.getMonth(), 0).getDate();
            meses--;
        }
        if (meses < 0)    { meses += 12;    anos--; }

        return { anos, meses, dias, horas, minutos, segundos };
    }

    function atualizar() {
        const t = calcularTempo(inicioDoNamoro, new Date());

        els.anos.textContent = pad(t.anos);
        els.meses.textContent = pad(t.meses);
        els.dias.textContent = pad(t.dias);
        els.horas.textContent = pad(t.horas);
        els.minutos.textContent = pad(t.minutos);
        els.segundos.textContent = pad(t.segundos);
    }

    atualizar();
    setInterval(atualizar, 1000);

    // ---------- Corações suaves de fundo ----------
    const secao = document.getElementById("loveCounter");
    const heartsBox = document.getElementById("loveCounterHearts");
    if (!secao || !heartsBox) return;

    const cores = ["#ffb3c6", "#ffc2d1", "#ff9eb5", "#ffd0da", "#ff8fa8"];
    let secaoVisivel = false;

    // só cria corações enquanto a section está na tela
    new IntersectionObserver((entries) => {
        secaoVisivel = entries[0].isIntersecting;
    }).observe(secao);

    setInterval(() => {
        if (!secaoVisivel) return;

        const heart = document.createElement("span");
        heart.className = "love-counter__heart";
        heart.textContent = "♥";
        heart.style.left = Math.random() * 100 + "%";
        heart.style.fontSize = 12 + Math.random() * 22 + "px";
        heart.style.color = cores[Math.floor(Math.random() * cores.length)];
        heart.style.animationDuration = 5 + Math.random() * 4 + "s";
        heart.style.setProperty("--fall-distance", secao.offsetHeight + 40 + "px");

        heartsBox.appendChild(heart);
        setTimeout(() => heart.remove(), 9500);
    }, 500);
})();

// ===============================
// GSAP + ScrollSmoother
// ===============================
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// ScrollSmoother (IDs CORRETOS)
// Celular/tablet (só toque, sem mouse): usa a rolagem NATIVA do aparelho.
// O normalizeScroll e o smoothTouch faziam o dedo "controlar" a rolagem via JS,
// o que deixava tudo mais rápido. No desktop (mouse) continua igual.
const dispositivoToque = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const smoother = ScrollSmoother.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: 2,
    effects: true,
    normalizeScroll: !dispositivoToque,
    smoothTouch: false
});

// ===============================
// Barra do Spotify fixa (GSAP pin)
// ===============================
ScrollTrigger.create({
    trigger: ".spotify-wrapper",
    start: "top top+=12",
    end: () => "+=" + document.body.scrollHeight,
    pin: "#spotifyBar",
    pinSpacing: false,
    invalidateOnRefresh: true
});

// ===============================
// Cards animados
// ===============================
const tl = gsap.timeline({
    scrollTrigger: {
        trigger: ".sectionPai",
        start: "top top",
        end: "+=150%",
        scrub: true,
        pin: true,
        anticipatePin: 1
    }
});

// Primeiro movimento
tl.to(".card1", {
    x: "-60%",
    scale: 0.8
});

tl.to(
    ".card2",
    {
        x: "0%",
        scale: 1,
        zIndex: 2
    },
    "-=0.5"
);

tl.to(
    ".card3",
    {
        x: "60%"
    },
    "-=0.5"
);

// Segundo movimento
tl.to(".card2", {
    x: "-60%",
    scale: 0.8
});

tl.to(
    ".card3",
    {
        x: "0%",
        scale: 1,
        zIndex: 2
    },
    "-=0.5"
);

tl.to(
    ".card1",
    {
        x: "60%",
        zIndex: 0
    },
    "-=0.5"
);