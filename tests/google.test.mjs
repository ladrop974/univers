import test from "node:test";
import assert from "node:assert/strict";
import { senderName, mailItem, driveItem, isConfigured, isConnected, connect, mailSummary, driveSearch, DEMO_MAIL, DEMO_DRIVE } from "../js/google.js";

test("sans Client ID : non configuré, non connecté, connexion refusée proprement", async () => {
  assert.equal(isConfigured(), false);
  assert.equal(isConnected("mail"), false);
  await assert.rejects(() => connect("mail"), /pas encore activée/);
  await assert.rejects(() => mailSummary(), /Connecte-toi/);
  await assert.rejects(() => driveSearch("x"), /Connecte-toi/);
});

test("lecture des en-têtes Gmail (jamais le corps)", () => {
  assert.equal(senderName('"Camille D." <camille@ex.org>'), "Camille D.");
  const m = mailItem({ id: "1", labelIds: ["INBOX", "UNREAD"], snippet: "SECRET", payload: { headers: [{ name: "From", value: "Léa <l@x.fr>" }, { name: "Subject", value: "Salut" }, { name: "Date", value: "Mon, 05 Oct 2026 08:00:00 +0000" }] } });
  assert.equal(m.from, "Léa");
  assert.equal(m.subject, "Salut");
  assert.equal(m.unread, true);
  assert.ok(m.date.startsWith("2026-10-05"));
  assert.ok(!JSON.stringify(m).includes("SECRET"));
  assert.equal(mailItem({ id: "2", payload: { headers: [] } }).subject, "(sans objet)");
});

test("Drive : métadonnées seulement", () => {
  const f = driveItem({ id: "9", name: "a.pdf", mimeType: "application/pdf", modifiedTime: "2026-10-01T00:00:00Z", webViewLink: "https://drive.google.com/x", content: "SECRET" });
  assert.equal(f.type, "pdf");
  assert.ok(!JSON.stringify(f).includes("SECRET"));
});

test("les données Démo sont marquées Démo", () => {
  assert.equal(DEMO_MAIL.demo, true);
  assert.equal(DEMO_DRIVE.demo, true);
  assert.ok(DEMO_MAIL.items.every((i) => /exemple/i.test(i.from)));
});
