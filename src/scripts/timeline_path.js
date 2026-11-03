// ./scripts/timeline_path.js
// ===============================================================
// Linha do tempo: um vetor que acompanha a rolagem
// ===============================================================
// Como funciona:
//  1. O JS mede onde está o centro de cada marcador (1, 2, 3, 4) e desenha um
//     caminho em SVG que passa por todos eles, em ondas suaves (curvas de Bézier).
//  2. Esse caminho existe em duas camadas: o "trilho" (pontinhos, o que ainda vai
//     ser percorrido) e o "rastro" (linha cheia, o que o coração já percorreu).
//  3. Um coração com número (o "viajante") começa no marcador 1. Ao rolar a página,
//     ele anda pelo caminho, o rastro vai sendo desenhado atrás dele e ele solta
//     corações pequenos. Quando chega no marcador 2, vira "2", e assim por diante.
//  4. Rolando para cima tudo volta: o rastro recua e o número diminui.
//  5. Usa o mesmo ScrollTrigger/ticker do GSAP que o resto da página (ScrollSmoother).
//     Se este arquivo falhar, a linha reta antiga continua aparecendo (veja o SCSS).
// ===============================================================

(function () {
    "use strict";

    const { gsap, ScrollTrigger } = window;
    const secao = document.querySelector(".timeline");
    const lista = document.querySelector(".timeline__list");
    const itens = Array.from(document.querySelectorAll(".timeline__item"));
    const marcadores = itens.map((item) => item.querySelector(".timeline__marker"));

    if (!secao || !lista || itens.length < 2 || marcadores.some((m) => !m) || !gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    // ---------------------------------------------------------------
    // Ajustes (mexa aqui para calibrar)
    // ---------------------------------------------------------------
    const CONFIG = {
        // Em que altura da tela o coração "está lendo": 0.6 = 60% da altura da janela.
        // Menor = o coração anda mais cedo; maior = mais tarde.
        linhaLeitura: 0.6,

        // Força das ondas do caminho. O desvio máximo para o lado é ~75% disso.
        // (Os cards ficam a 56px da linha central; passar de ~60 faz o caminho entrar neles.)
        amplitude: 44,
        amplitudeCelular: 18,

        // Suavização do coração (maior = cola mais no scroll, menor = mais "preguiçoso")
        suavizacao: 7,

        // Corações pequenos deixados no rastro
        espacoFaiscas: 34, // a cada quantos px percorridos solta um
        maxFaiscas: 26,    // limite na tela ao mesmo tempo
        coresFaiscas: ["#ff8fa8", "#ff9eb5", "#f77062", "#ffb3c6", "#c31432"],

        mediaQueryCelular: "(max-width: 640px)",
    };

    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
    const celular = window.matchMedia(CONFIG.mediaQueryCelular);
    const NS = "http://www.w3.org/2000/svg";

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    // ---------------------------------------------------------------
    // Elementos criados pelo JS (o HTML não precisa de nada novo)
    // ---------------------------------------------------------------
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "timeline__path");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `
        <defs>
            <linearGradient id="timelineGradiente" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
                <stop offset="0" class="timeline__stop--ini"></stop>
                <stop offset="1" class="timeline__stop--fim"></stop>
            </linearGradient>
        </defs>
        <path class="timeline__path-trilho"></path>
        <path class="timeline__path-rastro"></path>`;

    const gradiente = svg.querySelector("linearGradient");
    const trilho = svg.querySelector(".timeline__path-trilho");
    const rastro = svg.querySelector(".timeline__path-rastro");

    const viajante = document.createElement("div");
    viajante.className = "timeline__traveler";
    viajante.setAttribute("aria-hidden", "true");
    viajante.innerHTML = `<div class="timeline__traveler-body"><span class="timeline__traveler-num">1</span></div>`;
    const corpo = viajante.firstElementChild;
    const numero = corpo.firstElementChild;

    // ---------------------------------------------------------------
    // Estado
    // ---------------------------------------------------------------
    const geo = {
        altura: 0,   // altura da lista
        total: 0,    // comprimento total do caminho (px)
        marcos: [],  // { x, y, len } de cada marcador
        amL: [],     // amostras: comprimento ...
        amY: [],     // ... e y correspondente (y só cresce, então dá para buscar por y)
    };

    let gatilho = null;
    let progresso = 0;     // 0 a 1 do ScrollTrigger
    let atual = 0;         // comprimento percorrido (suavizado)
    let ultimoDesenho = -1;
    let ultimaFaisca = 0;
    let idxAtual = -1;     // último marcador alcançado
    let faiscasAtivas = 0;
    let ligado = false;

    // ---------------------------------------------------------------
    // Geometria
    // ---------------------------------------------------------------
    // Dado um y (coordenada da lista), devolve o comprimento do caminho naquele ponto
    function comprimentoNoY(y) {
        const Y = geo.amY;
        const L = geo.amL;
        if (!Y.length || y <= Y[0]) return 0;
        if (y >= Y[Y.length - 1]) return geo.total;

        let lo = 0;
        let hi = Y.length - 1;
        while (hi - lo > 1) {
            const meio = (lo + hi) >> 1;
            if (Y[meio] <= y) lo = meio;
            else hi = meio;
        }
        const t = (y - Y[lo]) / (Y[hi] - Y[lo] || 1);
        return L[lo] + (L[hi] - L[lo]) * t;
    }

    // Comprimento do caminho em que o coração deve estar agora
    function alvoAtual() {
        const vh = window.innerHeight;
        // ponto da lista que está na "linha de leitura" da tela (mesma conta do bouquet.js)
        const yLeitura = -(1 - CONFIG.linhaLeitura) * vh + progresso * (geo.altura + vh);
        return comprimentoNoY(yLeitura);
    }

    function medir() {
        const largura = lista.offsetWidth;
        const altura = lista.offsetHeight;
        if (!largura || !altura) return;

        geo.altura = altura;
        svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);

        // Centro de cada marcador em coordenadas da lista.
        // offsetTop/offsetLeft ignoram transform (AOS, ScrollSmoother), então são seguros.
        const pontos = itens.map((item, i) => {
            const m = marcadores[i];
            return {
                x: item.offsetLeft + m.offsetLeft + m.offsetWidth / 2,
                y: item.offsetTop + m.offsetTop + m.offsetHeight / 2,
            };
        });

        // Ondas: de um marcador ao próximo o caminho faz UMA curva (um "S" aberto)
        // e a direção da curva alterna. Os controles ficam a 30% e 70% da altura,
        // então a tangente nos marcadores é vertical e a linha é contínua e suave.
        const A = celular.matches ? CONFIG.amplitudeCelular : CONFIG.amplitude;
        const primeiraDirecao = celular.matches
            ? -1
            : itens[0].offsetLeft + itens[0].offsetWidth / 2 <= largura / 2 ? 1 : -1; // começa para o lado do 2º card

        let d = `M ${pontos[0].x} ${pontos[0].y}`;
        for (let i = 0; i < pontos.length - 1; i++) {
            const a = pontos[i];
            const b = pontos[i + 1];
            const dy = b.y - a.y;
            const s = primeiraDirecao * (i % 2 === 0 ? 1 : -1);
            d += ` C ${a.x + s * A} ${a.y + dy * 0.3}, ${b.x + s * A} ${a.y + dy * 0.7}, ${b.x} ${b.y}`;
        }
        trilho.setAttribute("d", d);
        rastro.setAttribute("d", d);

        geo.total = rastro.getTotalLength();
        rastro.style.strokeDasharray = String(geo.total);

        // Degradê vertical: do primeiro ao último marcador
        gradiente.setAttribute("y1", pontos[0].y);
        gradiente.setAttribute("y2", pontos[pontos.length - 1].y);

        // Tabela de amostras (comprimento × y) para buscar o ponto pelo scroll
        const passo = Math.max(2, geo.total / 800);
        geo.amL = [];
        geo.amY = [];
        for (let l = 0; l < geo.total; l += passo) {
            geo.amL.push(l);
            geo.amY.push(rastro.getPointAtLength(l).y);
        }
        geo.amL.push(geo.total);
        geo.amY.push(rastro.getPointAtLength(geo.total).y);

        geo.marcos = pontos.map((p) => ({ x: p.x, y: p.y, len: comprimentoNoY(p.y) }));

        progresso = gatilho ? gatilho.progress : 0;
        atual = alvoAtual();
        ultimaFaisca = atual;
        ultimoDesenho = -1;
        desenhar(atual, false);
        viajante.classList.add("timeline__traveler--pronto");
    }

    // ---------------------------------------------------------------
    // Faíscas: corações pequenos que o viajante vai deixando
    // ---------------------------------------------------------------
    function faisca(x, y, forte) {
        if (reduzir.matches || faiscasAtivas >= CONFIG.maxFaiscas) return;

        const el = document.createElement("span");
        el.className = "timeline__spark";
        el.textContent = "♥";
        el.style.fontSize = (forte ? 14 : 9) + Math.random() * (forte ? 14 : 9) + "px";
        el.style.color = CONFIG.coresFaiscas[Math.floor(Math.random() * CONFIG.coresFaiscas.length)];

        const angulo = Math.random() * Math.PI * 2;
        const distancia = forte ? 40 + Math.random() * 50 : 10 + Math.random() * 22;
        el.style.setProperty("--x", x + (Math.random() - 0.5) * 14 + "px");
        el.style.setProperty("--y", y + (Math.random() - 0.5) * 14 + "px");
        el.style.setProperty("--dx", Math.cos(angulo) * distancia + "px");
        el.style.setProperty("--dy", Math.sin(angulo) * distancia + "px");
        el.style.setProperty("--rot", Math.random() * 80 - 40 + "deg");

        faiscasAtivas++;
        el.addEventListener(
            "animationend",
            () => {
                el.remove();
                faiscasAtivas--;
            },
            { once: true }
        );
        lista.appendChild(el);
    }

    // ---------------------------------------------------------------
    // Desenho
    // ---------------------------------------------------------------
    function trocarMarco(novo, p, comEfeito) {
        const anterior = idxAtual;
        idxAtual = novo;

        marcadores.forEach((m, i) => m.classList.toggle("is-reached", i <= novo));
        numero.textContent = marcadores[novo].textContent.trim();

        // Chegou em um marcador novo (indo para frente): "pop" no número e uma explosão de corações
        if (comEfeito && novo > anterior && !reduzir.matches) {
            gsap.fromTo(numero, { scale: 1.8 }, { scale: 1, duration: 0.55, ease: "back.out(2.2)", overwrite: true });
            for (let k = 0; k < 8; k++) faisca(p.x, p.y, true);
        }
    }

    // len = quanto do caminho já foi percorrido (px)
    function desenhar(len, comEfeito) {
        ultimoDesenho = len;

        const p = rastro.getPointAtLength(len);
        viajante.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        rastro.style.strokeDashoffset = String(geo.total - len);

        // O coração se inclina de leve conforme a curva
        const a = rastro.getPointAtLength(Math.max(0, len - 3));
        const b = rastro.getPointAtLength(Math.min(geo.total, len + 3));
        const graus = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
        corpo.style.rotate = reduzir.matches ? "0deg" : clamp(-graus * 0.5, -14, 14) + "deg";

        // Qual marcador já foi alcançado?
        let idx = 0;
        for (let i = 0; i < geo.marcos.length; i++) {
            if (len >= geo.marcos[i].len - 0.5) idx = i;
        }
        if (idx !== idxAtual) trocarMarco(idx, p, comEfeito);

        // Rastro de corações
        if (comEfeito && Math.abs(len - ultimaFaisca) >= CONFIG.espacoFaiscas) {
            ultimaFaisca = len;
            faisca(p.x, p.y, false);
        }
    }

    // ---------------------------------------------------------------
    // Loop (ticker do GSAP, o mesmo do ScrollSmoother)
    // ---------------------------------------------------------------
    function quadro(tempo, deltaMs) {
        const dt = Math.min(deltaMs, 50) / 1000;
        const alvo = alvoAtual();

        if (reduzir.matches) atual = alvo;
        else atual += (alvo - atual) * (1 - Math.exp(-CONFIG.suavizacao * dt));
        if (Math.abs(alvo - atual) < 0.05) atual = alvo;

        if (atual === ultimoDesenho) return; // parado: não faz nada
        desenhar(atual, true);
    }

    function ligar() {
        if (ligado) return;
        ligado = true;
        atual = alvoAtual();
        ultimaFaisca = atual;
        gsap.ticker.add(quadro);
    }

    function desligar() {
        if (!ligado) return;
        ligado = false;
        gsap.ticker.remove(quadro);
        // fora da tela: deixa o desenho já no ponto certo (sem efeitos)
        atual = alvoAtual();
        desenhar(atual, false);
    }

    // ---------------------------------------------------------------
    // Início
    // ---------------------------------------------------------------
    function iniciar() {
        secao.classList.add("timeline--vetor");
        lista.prepend(svg);   // por baixo dos cards
        lista.appendChild(viajante);

        medir();

        gatilho = ScrollTrigger.create({
            trigger: lista,
            start: "top bottom", // lista começa a entrar na janela
            end: "bottom top",   // lista terminou de sair da janela
            onUpdate: (self) => {
                progresso = self.progress;
            },
            onToggle: (self) => (self.isActive ? ligar() : desligar()),
        });

        progresso = gatilho.progress;
        if (gatilho.isActive) ligar();

        // Recalcula quando o layout muda (resize, imagens, o bouquet.js mexendo no padding...)
        ScrollTrigger.addEventListener("refresh", medir);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    }

    // Espera a página carregar (imagens/fontes definem as alturas dos cards)
    if (document.readyState === "complete") {
        iniciar();
    } else {
        window.addEventListener("load", iniciar, { once: true });
    }
})();