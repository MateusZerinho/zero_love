// ===============================
// Sempre começar do topo ao recarregar
// ===============================
(function () {
    // Impede o navegador de restaurar a posição de scroll anterior
    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }

    // Remove #hash da URL (senão o navegador pula para a âncora)
    if (location.hash) {
        history.replaceState(null, "", location.pathname + location.search);
    }

    window.scrollTo(0, 0);

    // Alguns navegadores (Safari/Firefox) restauram depois do load e do bfcache
    window.addEventListener("pageshow", function () {
        window.scrollTo(0, 0);
    });
})();

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
// Pré-loader (trava o scroll até ele acabar)
// ===============================
(function () {
    const preloader = document.getElementById("preloader");
    if (!preloader) return;

    const html = document.documentElement;
    const TECLAS_DE_SCROLL = new Set([
        " ", "Spacebar", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"
    ]);

    let travado = false;

    const bloquear = (e) => e.preventDefault();
    const bloquearTecla = (e) => {
        if (TECLAS_DE_SCROLL.has(e.key)) e.preventDefault();
    };
    // Rede de segurança: se algo ainda conseguir rolar, volta para o topo
    const voltarAoTopo = () => {
        if (travado && window.scrollY !== 0) window.scrollTo(0, 0);
    };

    function travar() {
        travado = true;
        html.classList.add("scroll-travado"); // overflow: hidden (veja preloader.scss)
        window.scrollTo(0, 0);

        // passive: false é obrigatório para o preventDefault funcionar em wheel/touchmove
        window.addEventListener("wheel", bloquear, { passive: false });
        window.addEventListener("touchmove", bloquear, { passive: false });
        window.addEventListener("keydown", bloquearTecla);
        window.addEventListener("scroll", voltarAoTopo);
    }

    function liberar() {
        travado = false;
        window.removeEventListener("wheel", bloquear);
        window.removeEventListener("touchmove", bloquear);
        window.removeEventListener("keydown", bloquearTecla);
        window.removeEventListener("scroll", voltarAoTopo);

        window.scrollTo(0, 0);
        html.classList.remove("scroll-travado");
        window.__smoother?.paused(false); // destrava o ScrollSmoother (desktop)
    }

    // O main.js usa isto logo depois de criar o ScrollSmoother
    window.preloaderScroll = { ativo: () => travado };

    travar();

    // Tempo total da animação de preenchimento:
    // delay (0.4s) + duração (2s) + uma pausa extra antes de sair (0.3s) = ~2.7s
    const FILL_DURATION = 2700;

    setTimeout(function () {
        preloader.classList.add("preloader--hidden");

        // Remove do DOM depois da transição de fade-out (0.8s) e só então libera o scroll
        setTimeout(function () {
            preloader.remove();
            liberar();
        }, 800);
    }, FILL_DURATION);
})();

// ===============================
// Plugins externos
// ===============================
feather.replace();
AOS.init();

// ===============================
// Contagem regressiva (hero) + animação da virada
// ===============================
// Ciclo anual:
//   até 05/11 00:00           → contagem regressiva até o dia 5
//   05/11 00:00 → 06/11 00:00 → parabéns (contador escondido)
//   a partir de 06/11 00:00   → contagem recomeça, até 05/11 do ano seguinte
//
// Tudo fica dentro de um try/catch: se algo aqui der errado, o resto do main.js
// (ScrollSmoother, pins, etc.) continua rodando e a página rola normalmente.
(function () {
    try {
        iniciarContagemHero();
    } catch (erro) {
        console.warn("[contagem hero] não foi possível iniciar:", erro);
    }

    function iniciarContagemHero() {
        const MES = 10; // mês começa em 0 → 10 = novembro
        const DIA = 5;

        const TEXTO_CONTAGEM = "O aniversário de namoro do melhor casal começa daqui";
        const TEXTO_FESTA = "O aniversário de namoro do melhor casal já começou! <br> Parabéns, meu amor! ❤️";

        const els = {
            dias: document.getElementById("hcDias"),
            horas: document.getElementById("hcHoras"),
            minutos: document.getElementById("hcMinutos"),
            segundos: document.getElementById("hcSegundos")
        };
        const grid = document.getElementById("heroCounter");
        const texto = document.getElementById("heroText");
        const hero = document.querySelector(".hero");

        if (!els.dias || !grid) return;

        const caixas = Array.from(grid.querySelectorAll(".hero-counter__box"));
        const numeros = Array.from(grid.querySelectorAll(".hero-counter__number"));
        const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

        const CORES = ["#ffb3c6", "#ffc2d1", "#ff9eb5", "#ff8fa8", "#f77062", "#ffffff"];
        const rand = (a, b) => a + Math.random() * (b - a);
        const pad = (n) => String(n).padStart(2, "0");

        const diaEmMs = 1000 * 60 * 60 * 24;
        const horaEmMs = 1000 * 60 * 60;
        const minutoEmMs = 1000 * 60;

        // Quantos ms ANTES da virada a página sobe sozinha até o topo
        // (para quem estiver rolando lá embaixo ver a animação). A subida dura de 2,2s a 5s,
        // então termina antes da virada.
        const ANTECEDENCIA_MS = 10000;

        let iniciado = false;   // vira true depois da 1ª atualização (página já aberta)
        let modoAtual = null;
        let tlVirada = null;
        let tlRolagem = null;           // a subida automática em andamento
        let ultimaViradaAvisada = null; // a virada para a qual já subimos (não sobe duas vezes)

        // Só para TESTAR: no console, heroDesvio(ms) adianta/atrasa o relógio do contador.
        // Ex.: 10s antes da virada do dia 6:
        //   heroDesvio(new Date(2026, 10, 5, 23, 59, 50) - Date.now())
        // heroDesvio(0) volta ao normal.
        let desvioMs = 0;
        const agora = () => new Date(Date.now() + desvioMs);
        window.heroDesvio = (ms) => { desvioMs = ms; ultimaViradaAvisada = null; };

        // ---------------------------------------------------------------
        // Em que fase do ciclo estamos?
        // ---------------------------------------------------------------
        function situacao(data) {
            const ano = data.getFullYear();
            const inicioFesta = new Date(ano, MES, DIA, 0, 0, 0);   // 00:00 do dia 5
            const fimFesta = new Date(ano, MES, DIA + 1, 0, 0, 0);  // 00:00 do dia 6

            if (data < inicioFesta) return { modo: "contagem", alvo: inicioFesta.getTime() };
            if (data < fimFesta) return { modo: "festa", alvo: fimFesta.getTime() };
            return { modo: "contagem", alvo: new Date(ano + 1, MES, DIA, 0, 0, 0).getTime() };
        }

        // Troca o texto da hero (o hero_intro.js refaz o letra por letra)
        function definirTexto(html) {
            if (!texto) return;

            if (typeof window.heroTrocarTexto === "function") {
                window.heroTrocarTexto(html);
                return;
            }

            // Reserva: sem o hero_intro.js, troca com um fade simples
            texto.innerHTML = html;
            if (iniciado && window.gsap && !reduzirMovimento.matches) {
                gsap.fromTo(texto,
                    { autoAlpha: 0, y: 24 },
                    { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out" });
            }
        }

        // A altura da página muda quando o contador some/volta: avisa o ScrollTrigger
        // (com um respiro, para o layout já ter assentado)
        function reajustar() {
            if (!window.ScrollTrigger) return;
            if (window.gsap) gsap.delayedCall(0.1, () => ScrollTrigger.refresh());
            else ScrollTrigger.refresh();
        }

        // ---------------------------------------------------------------
        // Subida suave até o topo (para ver a animação da virada)
        // ---------------------------------------------------------------
        const posicaoAtual = () => window.scrollY || window.pageYOffset || 0;

        function irPara(y) {
            if (window.__smoother) window.__smoother.scrollTop(y); // desktop (ScrollSmoother)
            else window.scrollTo(0, y);                            // celular (rolagem nativa)
        }

        // Se a pessoa mexer na rolagem durante a subida, a gente larga: ela manda.
        const EVENTOS_DO_USUARIO = ["wheel", "touchstart", "mousedown", "keydown"];

        function pararRolagem() {
            if (tlRolagem) tlRolagem.kill();
            tlRolagem = null;
            EVENTOS_DO_USUARIO.forEach((ev) => window.removeEventListener(ev, pararRolagem));
        }

        function rolarParaOTopo() {
            const y0 = posicaoAtual();
            if (y0 < 40 || tlRolagem) return; // já está no topo, ou já está subindo

            if (!window.gsap || reduzirMovimento.matches) {
                irPara(0);
                return;
            }

            // Quanto mais longe, mais demora (mas nunca menos de 2,2s nem mais de 5s)
            const duracao = Math.min(5, Math.max(2.2, 1 + y0 / 1500));
            const proxy = { y: y0 };

            tlRolagem = gsap.to(proxy, {
                y: 0,
                duration: duracao,
                ease: "power2.inOut", // começa e termina devagar
                onUpdate: () => irPara(proxy.y),
                onComplete: pararRolagem
            });

            EVENTOS_DO_USUARIO.forEach((ev) => window.addEventListener(ev, pararRolagem, { passive: true }));
        }

        // ---------------------------------------------------------------
        // Explosão de corações (origem = centro de um elemento)
        // ---------------------------------------------------------------
        function explosaoDeCoracoes(origem, quantidade) {
            if (!hero || !origem || !window.gsap) return;

            const camada = document.createElement("div");
            camada.className = "hero__burst";
            camada.setAttribute("aria-hidden", "true");
            hero.appendChild(camada);

            const rh = hero.getBoundingClientRect();
            const ro = origem.getBoundingClientRect();
            const cx = ro.left - rh.left + ro.width / 2;
            const cy = ro.top - rh.top + ro.height / 2;

            // anel de luz que se expande
            const anel = document.createElement("span");
            anel.className = "hero__burst-anel";
            anel.style.left = cx + "px";
            anel.style.top = cy + "px";
            camada.appendChild(anel);
            gsap.fromTo(anel,
                { xPercent: -50, yPercent: -50, scale: 0, opacity: 1 },
                { scale: 10, opacity: 0, duration: 1.1, ease: "power2.out" });

            // corações: voam para fora, depois caem e somem
            for (let i = 0; i < quantidade; i++) {
                const c = document.createElement("span");
                c.className = "hero__burst-heart";
                c.textContent = "♥";
                c.style.left = cx + "px";
                c.style.top = cy + "px";
                c.style.fontSize = rand(14, 40) + "px";
                c.style.color = CORES[Math.floor(Math.random() * CORES.length)];
                camada.appendChild(c);

                const ang = rand(0, Math.PI * 2);
                const forca = rand(110, 320);
                const dx = Math.cos(ang) * forca;
                const dy = Math.sin(ang) * forca * 0.65 - 70; // tende a subir

                gsap.set(c, { xPercent: -50, yPercent: -50 });
                gsap.timeline()
                    .fromTo(c,
                        { x: 0, y: 0, scale: 0, rotation: 0, opacity: 1 },
                        { x: dx, y: dy, scale: 1, rotation: rand(-70, 70), duration: rand(0.8, 1.3), ease: "power3.out" })
                    .to(c,
                        { y: dy + rand(120, 260), opacity: 0, duration: rand(1, 1.6), ease: "power1.in" },
                        ">-0.2");
            }

            gsap.delayedCall(3.5, () => camada.remove());
        }

        // ---------------------------------------------------------------
        // Animações da virada
        // ---------------------------------------------------------------
        function limparEstado() {
            gsap.set(grid, { clearProps: "height,overflow" });
            gsap.set(caixas, { clearProps: "opacity" });
            gsap.set(caixas, { "--pulo": "0px" });
            gsap.set(numeros, { clearProps: "transform" });
        }

        // Dia 4 → dia 5: zera, explode em corações e recolhe o contador
        function animarParaFesta() {
            if (tlVirada) tlVirada.kill();
            gsap.killTweensOf(caixas.concat(numeros));
            window.heroTransicaoAtiva = true; // o "pulo" a cada 10s fica quieto

            const altura = grid.offsetHeight;
            [els.dias, els.horas, els.minutos, els.segundos].forEach((el) => (el.textContent = "00"));

            tlVirada = gsap.timeline({
                onComplete() {
                    grid.hidden = true;
                    limparEstado();
                    window.heroTransicaoAtiva = false;
                    reajustar();
                }
            });

            tlVirada
                // 1) os zeros dão um "pop" em sequência
                .to(numeros, {
                    keyframes: [
                        { scale: 1.35, duration: 0.18, ease: "power2.out" },
                        { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" }
                    ],
                    stagger: 0.06
                })
                // 2) explosão + texto de parabéns + caixas sobem e somem
                .add(() => {
                    explosaoDeCoracoes(grid, 38);
                    definirTexto(TEXTO_FESTA);
                }, 0.55)
                .to(caixas, { opacity: 0, "--pulo": "-28px", duration: 0.45, ease: "power2.in", stagger: 0.07 }, 0.55)
                // 3) o espaço do contador recolhe suavemente
                .fromTo(grid,
                    { height: altura },
                    {
                        height: 0,
                        duration: 0.55,
                        ease: "power2.inOut",
                        immediateRender: false,
                        onStart: () => (grid.style.overflow = "hidden")
                    },
                    ">-0.05");
        }

        // Dia 5 → dia 6: o contador reabre e as caixas quicam para dentro
        function animarParaContagem() {
            if (tlVirada) tlVirada.kill();
            gsap.killTweensOf(caixas.concat(numeros));
            window.heroTransicaoAtiva = true;

            definirTexto(TEXTO_CONTAGEM);
            grid.hidden = false;
            gsap.set(grid, { height: 0, overflow: "hidden" });
            gsap.set(caixas, { opacity: 0 });
            gsap.set(caixas, { "--pulo": "34px" });
            // (os números são preenchidos logo depois, pelo atualizar())

            tlVirada = gsap.timeline({
                onComplete() {
                    limparEstado();
                    window.heroTransicaoAtiva = false;
                    reajustar();
                }
            });

            tlVirada
                .to(grid, { height: "auto", duration: 0.6, ease: "power2.out" })
                .to(caixas, { opacity: 1, "--pulo": "0px", duration: 0.9, ease: "back.out(1.8)", stagger: 0.12 }, 0.25)
                .fromTo(numeros, { scale: 1.4 }, { scale: 1, duration: 0.8, ease: "elastic.out(1, 0.4)", stagger: 0.12 }, 0.4)
                .add(() => explosaoDeCoracoes(texto, 16), 0.3);
        }

        // ---------------------------------------------------------------
        // Troca de modo
        // ---------------------------------------------------------------
        function mudarModo(modo) {
            const primeira = modoAtual === null;
            modoAtual = modo;

            // Na 1ª vez (página acabou de abrir) não anima: só mostra o estado certo.
            const animar = !primeira && window.gsap && !reduzirMovimento.matches;
            if (!primeira) rolarParaOTopo(); // reserva: se ainda estiver embaixo, sobe agora

            if (modo === "festa") {
                if (animar) {
                    animarParaFesta();
                } else {
                    grid.hidden = true;
                    definirTexto(TEXTO_FESTA);
                    if (!primeira) reajustar();
                }
            } else if (!primeira) {
                if (animar) {
                    animarParaContagem();
                } else {
                    grid.hidden = false;
                    definirTexto(TEXTO_CONTAGEM);
                    reajustar();
                }
            }
        }

        function atualizar() {
            try {
                const s = situacao(agora());
                if (s.modo !== modoAtual) mudarModo(s.modo);

                const distancia = s.alvo - agora().getTime();

                // Faltam 10s (ou menos) para a próxima virada: sobe suavemente até o topo
                if (distancia > 0 && distancia <= ANTECEDENCIA_MS && ultimaViradaAvisada !== s.alvo) {
                    ultimaViradaAvisada = s.alvo;
                    rolarParaOTopo();
                }

                if (s.modo === "festa") return;

                els.dias.textContent = pad(Math.floor(distancia / diaEmMs));
                els.horas.textContent = pad(Math.floor((distancia % diaEmMs) / horaEmMs));
                els.minutos.textContent = pad(Math.floor((distancia % horaEmMs) / minutoEmMs));
                els.segundos.textContent = pad(Math.floor((distancia % minutoEmMs) / 1000));
            } catch (erro) {
                console.warn("[contagem hero] erro ao atualizar:", erro);
            }
        }

        atualizar();      // já preenche na hora, sem esperar 1s
        iniciado = true;
        setInterval(atualizar, 1000); // não para mais: é ele que faz a virada
    }
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
        if (grid.hidden || document.hidden || reduzirMovimento.matches || window.heroTransicaoAtiva) return;

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

// O ScrollTrigger também tenta restaurar o scroll no refresh
ScrollTrigger.clearScrollMemory("manual");

// Tela de toque (celular/tablet): rolagem 100% NATIVA do navegador.
// O ScrollSmoother nem é criado: ele prende o conteúdo com position: fixed e fixa
// a altura do <body>, e no celular essa medida erra (barras do navegador/sistema
// mudam a altura da tela), deixando espaço em branco no fim da página.
const ehToque = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// O CSS usa esta classe para liberar a rolagem nativa (veja main.scss)
document.documentElement.classList.toggle("scroll-nativo", ehToque);

// Não recalcula tudo toda vez que a barra do navegador aparece/some
ScrollTrigger.config({ ignoreMobileResize: true });

// No desktop continua exatamente como antes
const smoother = ehToque
    ? null
    : ScrollSmoother.create({
          wrapper: "#smooth-wrapper",
          content: "#smooth-content",
          smooth: 2,
          effects: true,
          normalizeScroll: true,
          smoothTouch: 0.1
      });

// Guarda para o pré-loader poder destravar, e já nasce pausado se ele ainda estiver na tela
window.__smoother = smoother;
if (window.preloaderScroll?.ativo()) smoother?.paused(true);

// ===============================
// Fotos das sections .event: "selecionada" ao rolar
// ===============================
// Uma foto de cada vez fica no estado de hover (levantada e um pouco maior).
// Ela é selecionada quando o centro dela chega na "linha" da tela. Ela é solta
// um pouco ANTES de a próxima ser selecionada, então há um intervalo em que
// nenhuma foto está selecionada.
(function () {
    const fotos = gsap.utils.toArray(".event__image");
    if (!fotos.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const celular = window.matchMedia("(max-width: 640px)");

    const CONFIG = {
        linha: 70,         // % da altura da tela em que a foto é selecionada. Maior = seleciona mais cedo
        linhaCelular: 65,
        folga: 12,         // intervalo entre uma sair e a próxima entrar (em % da altura da tela).
                           // Maior = a foto sai mais cedo e o intervalo sem seleção é maior. 0 = troca direta
        repouso: { y: 20, scale: 1 },      // mesmo estado do CSS
        selecionada: { y: 0, scale: 1.03 },// mesmo estado do :hover
        duracao: 0.6,
        ease: "power2.out",
    };

    const linhaAtual = () => (celular.matches ? CONFIG.linhaCelular : CONFIG.linha);
    const inicio = () => `center ${linhaAtual()}%`;
    // A próxima foto chega aqui ANTES de chegar na linha de seleção dela
    const fim = () => `center ${linhaAtual() + CONFIG.folga}%`;

    function selecionar(img) {
        gsap.to(img, { ...CONFIG.selecionada, duration: CONFIG.duracao, ease: CONFIG.ease, overwrite: true });
    }

    function soltar(img) {
        gsap.to(img, { ...CONFIG.repouso, duration: CONFIG.duracao, ease: CONFIG.ease, overwrite: true });
    }

    fotos.forEach((img, i) => {
        // O GSAP passa a controlar o transform: tira a transition do CSS
        // (senão ela brigaria com cada quadro) e define o estado inicial.
        img.style.transition = "opacity 0.6s ease";
        gsap.set(img, { ...CONFIG.repouso, willChange: "transform" });

        const proxima = fotos[i + 1];

        ScrollTrigger.create({
            trigger: img,
            start: inicio,
            endTrigger: proxima || img,
            end: proxima ? fim : "bottom top",
            invalidateOnRefresh: true,
            onToggle: (self) => (self.isActive ? selecionar(img) : soltar(img)),
        });
    });
})();

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