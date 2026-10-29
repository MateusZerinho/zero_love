// ===============================
// Music Player (loop + UI)
// ===============================
(function () {
    const player = document.getElementById("musicPlayer");
    const audio = document.getElementById("mpAudio");
    if (!player || !audio) return;

    const btnPlay = document.getElementById("mpPlay");
    const btnPrev = document.getElementById("mpPrev");
    const btnNext = document.getElementById("mpNext");
    const btnMin = document.getElementById("mpMin");
    const btnMini = document.getElementById("mpMini");
    const range = document.getElementById("mpRange");
    const status = document.getElementById("mpStatus");
    const elCurrent = document.getElementById("mpCurrent");
    const elDuration = document.getElementById("mpDuration");

    const SALTO = 10; // segundos para os botões anterior/próximo
    audio.volume = 0.6;
    audio.loop = true;

    const formatar = (s) => {
        if (!isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const seg = Math.floor(s % 60);
        return `${m}:${String(seg).padStart(2, "0")}`;
    };

    const pintarBarra = () => {
        const max = Number(range.max) || 1;
        range.style.setProperty("--progress", (range.value / max) * 100 + "%");
    };

    // ---------- Estado visual ----------
    function atualizarEstado() {
        const tocando = !audio.paused;
        btnPlay.classList.toggle("is-playing", tocando);
        btnPlay.setAttribute("aria-label", tocando ? "Pausar" : "Tocar");
        player.classList.toggle("is-playing", tocando);
        status.classList.toggle("is-playing", tocando);
        status.textContent = tocando ? "Tocando" : "Pausado";
    }

    audio.addEventListener("play", atualizarEstado);
    audio.addEventListener("pause", atualizarEstado);

    // ---------- Progresso ----------
    audio.addEventListener("loadedmetadata", () => {
        range.max = audio.duration;
        elDuration.textContent = formatar(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
        if (!range.matches(":active")) {
            range.value = audio.currentTime;
            pintarBarra();
        }
        elCurrent.textContent = formatar(audio.currentTime);
    });

    range.addEventListener("input", () => {
        audio.currentTime = Number(range.value);
        elCurrent.textContent = formatar(audio.currentTime);
        pintarBarra();
    });

    // ---------- Botões ----------
    btnPlay.addEventListener("click", () => {
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
    });

    btnPrev.addEventListener("click", () => {
        audio.currentTime = Math.max(0, audio.currentTime - SALTO);
    });

    btnNext.addEventListener("click", () => {
        const alvo = audio.currentTime + SALTO;
        // se passar do fim, volta pro começo (como o loop faria)
        audio.currentTime = alvo >= audio.duration ? 0 : alvo;
    });

    btnMin.addEventListener("click", () => player.classList.add("is-collapsed"));
    btnMini.addEventListener("click", () => player.classList.remove("is-collapsed"));

    // No celular começa minimizado para não cobrir o conteúdo
    if (window.matchMedia("(max-width: 640px)").matches) {
        player.classList.add("is-collapsed");
    }

    // ---------- Autoplay ----------
    // Navegadores bloqueiam áudio automático. Tentamos tocar e, se for
    // bloqueado, começamos na primeira interação do usuário com a página.
    const eventos = ["pointerdown", "keydown", "touchend"];

    function iniciarNaInteracao(e) {
        // se o clique foi no botão de pausar do player, não força o play
        if (e.target.closest && e.target.closest("#musicPlayer")) {
            eventos.forEach((ev) => document.removeEventListener(ev, iniciarNaInteracao));
            return;
        }
        audio.play().then(() => {
            eventos.forEach((ev) => document.removeEventListener(ev, iniciarNaInteracao));
        }).catch(() => {});
    }

    audio.play().catch(() => {
        eventos.forEach((ev) => document.addEventListener(ev, iniciarNaInteracao));
    });

    atualizarEstado();
    pintarBarra();
})();