feather.replace();

AOS.init();

const dataDoEvento = new Date("Nov 5, 2026 00:00:00");
const timeStampDoEvento = dataDoEvento.getTime();

const contaAsHoras = setInterval(function() {
    const agora = new Date();
    const timeStampAtual = agora.getTime();

    const distanciaAteOEvento = timeStampDoEvento - timeStampAtual;

    const diaEmMs = 1000 * 60 * 60 * 24;
    const horaEmMs = 1000 * 60 * 60;
    const minutoEmMs = 1000 * 60;

    const diasAteOEvento = Math.floor(distanciaAteOEvento / diaEmMs);
    const horasAteOEvento = Math.floor((distanciaAteOEvento % diaEmMs) / horaEmMs);
    const minutosAteOEvento = Math.floor((distanciaAteOEvento % horaEmMs) / minutoEmMs);
    const segundosAteOEvento = Math.floor((distanciaAteOEvento % minutoEmMs) / 1000);

    document.getElementById('contador').innerHTML = `${diasAteOEvento}d ${horasAteOEvento}h ${minutosAteOEvento}m ${segundosAteOEvento}s`;

    if (distanciaAteOEvento < 0) {
        clearInterval(contaAsHoras);
        const paragrafo = document.querySelector('.hero__text');
        paragrafo.innerHTML = 'O aniversário de namoro do melhor casal já acabou 💔';
    }
}, 1000);

function createHeart() {
    const container = document.querySelector('.hearts-container');
    const heart = document.createElement('div');
    heart.classList.add('heart');

    heart.style.left = `${Math.random() * 100}%`;
    heart.style.animationDuration = 3 + Math.random() * 3 + 's';
    
    const angles = [35, 45, 55];
    const randomAngle = angles[Math.floor(Math.random() * angles.length)];
    heart.style.setProperty('--rotation', `${randomAngle}deg`);

    container.appendChild(heart);

    setTimeout(() => {
        heart.remove();
    }, 7000);
}

setInterval(createHeart, 300);

document.addEventListener('DOMContentLoaded', function () {
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const descriptions = document.querySelectorAll('.event__details__description');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
        const container = entry.target.closest('.container');
        const image = container?.querySelector('.event__image');
        if (!image) return;

        if (entry.isIntersecting) {
            image.classList.add('event__image--active');
        } else {
            image.classList.remove('event__image--active');
        }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -40% 0px',
        threshold: 0
    });

    descriptions.forEach(desc => {
        observer.observe(desc);

        // 🔹 Checagem inicial para já ativar se estiver visível ao carregar
        const rect = desc.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom >= 0) {
        const container = desc.closest('.container');
        const image = container?.querySelector('.event__image');
        if (image) image.classList.add('event__image--active');
        }
    });
    descriptions.forEach(desc => observer.observe(desc));
});

document.addEventListener('DOMContentLoaded', () => {
    const bar = document.getElementById('spotifyBar');
    const wrapper = bar.parentElement; // .spotify-wrapper

    // cria um spacer logo após o wrapper para preservar o espaço quando a barra fica fixed
    const spacer = document.createElement('div');
    spacer.className = 'spotify-spacer';
    wrapper.parentNode.insertBefore(spacer, wrapper.nextSibling);

    // calcula o ponto de gatilho (quando a barra encosta no topo)
    let triggerPoint = wrapper.getBoundingClientRect().top + window.scrollY;

    function updateTrigger() {
        // recalcula sempre que necessário (resize, conteúdo dinâmico)
        triggerPoint = wrapper.getBoundingClientRect().top + window.scrollY;
    }

    function onScroll() {
    // pequena folga (12px) para ficar exatamente igual ao top no CSS
    const offset = 12;
    if (window.scrollY >= triggerPoint - offset) {
        if (!bar.classList.contains('fixed')) {
            // aplica fixed e mantém espaço no fluxo com o spacer
            bar.classList.add('fixed');
            spacer.style.height = bar.offsetHeight + 'px';
            spacer.style.display = 'block';
        }
    } else {
        if (bar.classList.contains('fixed')) {
            // remove fixed e remove spacer
            bar.classList.remove('fixed');
            spacer.style.display = 'none';
            spacer.style.height = '0';
        }
        }
    }

    // eventos
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { updateTrigger(); onScroll(); });

    // se houver imagens ou conteúdo carregando que mudem layout, recalcule depois de um tempo
    window.setTimeout(updateTrigger, 500);
});

// Cards Animados
gsap.registerPlugin(ScrollTrigger)

const tl = gsap.timeline({
    scrollTrigger: {
        start: "50% 50%",
        end: "90% 50%",
        scrub: true,
        pin: ".sectionPai"
    }
})

// Primeiro movimento dos cards
tl.to(".card1", {
    x: "-60%",
    scale: ".8",
})

tl.to(".card2", {
    x: "0%",
    scale: "1",
    zIndex: 2
}, "-=.5")

tl.to(".card3", {
    x: "60%",
}, "-=.5")

// Segundo movimento dos cards
tl.to(".card2", {
    x: "-60%",
    scale: ".8",
})

tl.to(".card3", {
    x: "0%",
    scale: "1",
    zIndex: 2
}, "-=.5")

tl.to(".card1", {
    x: "60%",
    zIndex: 0
}, "-=.5")