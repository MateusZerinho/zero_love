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