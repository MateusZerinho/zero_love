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

// ===============================
// Contador de tempo
// ===============================
const dataDoEvento = new Date("Nov 5, 2026 00:00:00");
const timeStampDoEvento = dataDoEvento.getTime();

const contaAsHoras = setInterval(function () {
    const agora = new Date().getTime();
    const distanciaAteOEvento = timeStampDoEvento - agora;

    const diaEmMs = 1000 * 60 * 60 * 24;
    const horaEmMs = 1000 * 60 * 60;
    const minutoEmMs = 1000 * 60;

    const dias = Math.floor(distanciaAteOEvento / diaEmMs);
    const horas = Math.floor((distanciaAteOEvento % diaEmMs) / horaEmMs);
    const minutos = Math.floor((distanciaAteOEvento % horaEmMs) / minutoEmMs);
    const segundos = Math.floor((distanciaAteOEvento % minutoEmMs) / 1000);

    const contador = document.getElementById("contador");

    if (contador) {
        contador.innerHTML = `${dias}d ${horas}h ${minutos}m ${segundos}s`;
    }

    if (distanciaAteOEvento < 0) {
        clearInterval(contaAsHoras);
        const texto = document.querySelector(".hero__text");
        if (texto) {
            texto.innerHTML = "O aniversário de namoro do melhor casal já acabou 💔";
        }
    }
}, 1000);

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
const smoother = ScrollSmoother.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: 2,
    effects: true,
    normalizeScroll: true,
    smoothTouch: 0.1
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