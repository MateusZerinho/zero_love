feather.replace();

AOS.init();

const dataDoEvento = new Date("Nov 5, 2025 15:00:00");
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