(() => {
  const KEY = "arjun-mini-bank-v1";
  const $ = (sel) => document.querySelector(sel);
  const state = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function uid() { return Math.random().toString(16).slice(2, 10); }
  function money(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }
  function toast(msg, bad = false) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("bad", bad);
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  }
  function ensureVault() {
    if (!state.accounts) state.accounts = {};
    if (!state.session) state.session = null;
  }
  function openAccount(name, pin, opening) {
    ensureVault();
    const number = `ARJ-${1000 + Object.keys(state.accounts).length + 1}`;
    const acc = { number, name, pin: String(pin), balance: 0, history: [] };
    state.accounts[number] = acc;
    if (opening > 0) deposit(number, opening, "Opening balance");
    state.session = number;
    save();
    return acc;
  }
  function get(num) {
    ensureVault();
    const a = state.accounts[num];
    if (!a) throw new Error("Account not found");
    return a;
  }
  function pushTxn(acc, kind, amount, note, counterparty = null) {
    const txn = {
      id: uid(), kind, amount, balance_after: acc.balance, note,
      at: new Date().toISOString(), counterparty,
    };
    acc.history.unshift(txn);
    return txn;
  }
  function deposit(num, amount, note = "Deposit") {
    const a = get(num);
    amount = Number(amount);
    if (!(amount > 0)) throw new Error("Amount must be positive");
    a.balance = Math.round((a.balance + amount) * 100) / 100;
    pushTxn(a, "deposit", amount, note);
    save();
  }
  function withdraw(num, amount, pin, note = "Withdraw") {
    const a = get(num);
    if (String(pin) !== a.pin) throw new Error("Invalid PIN");
    amount = Number(amount);
    if (!(amount > 0)) throw new Error("Amount must be positive");
    if (amount > a.balance) throw new Error("Insufficient funds");
    a.balance = Math.round((a.balance - amount) * 100) / 100;
    pushTxn(a, "withdraw", amount, note);
    save();
  }
  function transfer(src, dst, amount, pin) {
    const a = get(src);
    const b = get(dst);
    if (String(pin) !== a.pin) throw new Error("Invalid PIN");
    amount = Number(amount);
    if (!(amount > 0)) throw new Error("Amount must be positive");
    if (amount > a.balance) throw new Error("Insufficient funds");
    a.balance = Math.round((a.balance - amount) * 100) / 100;
    b.balance = Math.round((b.balance + amount) * 100) / 100;
    pushTxn(a, "transfer_out", amount, `To ${dst}`, dst);
    pushTxn(b, "transfer_in", amount, `From ${src}`, src);
    save();
  }
  function label(kind) {
    return ({
      deposit: "Deposit", withdraw: "Withdrawal",
      transfer_out: "Transfer out", transfer_in: "Transfer in",
    })[kind] || kind;
  }
  function render() {
    ensureVault();
    const session = state.session;
    if (!session || !state.accounts[session]) {
      $("#gate").classList.remove("hidden");
      $("#app").classList.add("hidden");
      $("#sessionLabel").textContent = "No account open";
      return;
    }
    const a = state.accounts[session];
    $("#gate").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#sessionLabel").textContent = `${a.name} · ${a.number}`;
    $("#balance").textContent = money(a.balance);
    $("#acctMeta").textContent = `${Object.keys(state.accounts).length} account(s) in this vault`;
    const list = $("#ledger");
    list.innerHTML = "";
    if (!a.history.length) {
      list.innerHTML = `<li><span class="kind">No movements yet</span><span class="when">—</span><span class="note">Make a deposit to begin.</span></li>`;
      return;
    }
    a.history.slice(0, 40).forEach((t) => {
      const li = document.createElement("li");
      const inbound = t.kind === "deposit" || t.kind === "transfer_in";
      li.innerHTML = `
        <span class="kind">${label(t.kind)}</span>
        <span class="amt ${inbound ? "in" : "out"}">${inbound ? "+" : "−"}${money(t.amount).slice(1)}</span>
        <span class="note">${t.note || ""} · bal ${money(t.balance_after)}</span>
        <span class="when">${new Date(t.at).toLocaleString()}</span>`;
      list.appendChild(li);
    });
  }

  $("#openForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      openAccount(String(fd.get("name") || "").trim(), String(fd.get("pin") || "").trim(), Number(fd.get("opening") || 0));
      toast("Account opened");
      render();
    } catch (err) { toast(err.message || String(err), true); }
  });
  $("#depositForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { deposit(state.session, fd.get("amount")); e.target.reset(); toast("Deposited"); render(); }
    catch (err) { toast(err.message || String(err), true); }
  });
  $("#withdrawForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { withdraw(state.session, fd.get("amount"), fd.get("pin")); e.target.reset(); toast("Withdrawn"); render(); }
    catch (err) { toast(err.message || String(err), true); }
  });
  $("#transferForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      transfer(state.session, String(fd.get("to") || "").trim(), fd.get("amount"), fd.get("pin"));
      e.target.reset(); toast("Transferred"); render();
    } catch (err) { toast(err.message || String(err), true); }
  });
  $("#refreshBtn").addEventListener("click", () => {
    Object.assign(state, load()); render(); toast("Ledger refreshed");
  });
  render();
})();
