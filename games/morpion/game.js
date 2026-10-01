// Morpion : le plus petit jeu à deux. Sert aussi d'exemple pour ajouter un jeu (voir docs/AJOUTER_UN_JEU.md).
export default {
  id: "morpion",
  name: "Morpion",
  start(ctx) {
    return new Morpion(ctx);
  },
};

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

class Morpion {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = ctx.root;
    this.root.innerHTML = `
      <div class="mo">
        <button class="mo-quit" aria-label="Quitter">✕</button>
        <h2 class="mo-status"></h2>
        <div class="mo-board" role="grid"></div>
        <button class="mo-again" hidden>Rejouer</button>
      </div>`;
    this.q = (s) => this.root.querySelector(s);
    this.board = this.q(".mo-board");
    for (let i = 0; i < 9; i++) {
      const b = document.createElement("button");
      b.className = "mo-cell";
      b.setAttribute("aria-label", `Case ${i + 1}`);
      b.onclick = () => this.click(i);
      this.board.append(b);
    }
    this.q(".mo-quit").onclick = () => ctx.quit();
    this.q(".mo-again").onclick = () => this.again();
    ctx.on("move", (m) => this.place(m.i, 1 - this.mySeat()));
    ctx.on("reset", () => this.reset());
    ctx.on("rematch", () => ctx.isHost && this.again());
    ctx.on("peer-left", () => (this.q(".mo-status").textContent = "L'autre joueur est parti."));
    this.reset();
  }

  mySeat() {
    return this.ctx.seat;
  }

  reset() {
    this.b = Array(9).fill("");
    this.turn = 0; // 0 = X (siège 0), 1 = O (siège 1)
    this.over = false;
    this.q(".mo-again").hidden = true;
    this.render();
    this.maybeBot();
  }

  again() {
    if (this.ctx.mode === "online" && !this.ctx.isHost) return this.ctx.send("rematch", {});
    if (this.ctx.mode === "online") this.ctx.send("reset", {});
    this.reset();
  }

  isMyTurn() {
    if (this.over) return false;
    if (this.ctx.mode === "local") return true;
    if (this.ctx.mode === "bot") return this.turn === 0;
    return this.turn === this.ctx.seat;
  }

  click(i) {
    if (!this.isMyTurn() || this.b[i]) return;
    if (this.ctx.mode === "online") this.ctx.send("move", { i });
    this.place(i, this.turn);
  }

  place(i, who) {
    if (this.over || this.b[i] || who !== this.turn) return;
    this.b[i] = who === 0 ? "X" : "O";
    const line = LINES.find((l) => l.every((k) => this.b[k] === this.b[i]));
    if (line) this.over = { line, winner: who };
    else if (this.b.every(Boolean)) this.over = { line: null, winner: -1 };
    else this.turn = 1 - this.turn;
    this.render();
    this.maybeBot();
  }

  maybeBot() {
    if (this.ctx.mode !== "bot" || this.over || this.turn !== 1) return;
    setTimeout(() => {
      if (this.over || this.turn !== 1) return;
      const free = this.b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      const win = (mark) => free.find((i) => LINES.some((l) => l.includes(i) && l.every((k) => k === i || this.b[k] === mark)));
      const pick =
        win("O") ??
        win("X") ??
        (free.includes(4) ? 4 : [0, 2, 6, 8].find((i) => free.includes(i)) ?? free[Math.floor(Math.random() * free.length)]);
      this.place(pick, 1);
    }, 450);
  }

  render() {
    const cells = this.board.children;
    for (let i = 0; i < 9; i++) {
      cells[i].textContent = this.b[i];
      cells[i].dataset.m = this.b[i];
      cells[i].classList.toggle("win", !!this.over?.line?.includes(i));
      cells[i].disabled = !!this.b[i] || !this.isMyTurn();
    }
    const name = (s) => this.ctx.players[s]?.name || (s === 0 ? "Joueur X" : "Joueur O");
    let t;
    if (this.over) t = this.over.winner === -1 ? "Égalité !" : `🏆 ${name(this.over.winner)} gagne !`;
    else t = this.isMyTurn() ? "À toi de jouer" : `Tour de ${name(this.turn)}`;
    this.q(".mo-status").textContent = t;
    this.q(".mo-again").hidden = !this.over;
  }

  destroy() {
    this.root.innerHTML = "";
  }
}
