// Pomocnik do testów 401 (zadanie 3): z poprawnego tokenu robi dwa zepsute.
// Użycie: node scripts/tamper-token.js <token>
const token = process.argv[2];
if (!token || token.split(".").length !== 3) {
  console.error("Podaj token: node scripts/tamper-token.js <token>");
  process.exit(1);
}
const [header, payload, signature] = token.split(".");

// 1) zmieniony jeden znak w środku podpisu
const i = Math.floor(signature.length / 2);
const badSignature = signature.slice(0, i) + (signature[i] === "A" ? "B" : "A") + signature.slice(i + 1);
console.log("Token ze zmienionym jednym znakiem podpisu:");
console.log(`${header}.${payload}.${badSignature}\n`);

// 2) payload zmieniony na role ADMIN, podpis oryginalny
const data = JSON.parse(Buffer.from(payload, "base64url").toString());
const forged = Buffer.from(JSON.stringify({ ...data, role: "ADMIN" })).toString("base64url");
console.log(`Token z payloadem zmienionym na ${JSON.stringify({ ...data, role: "ADMIN" })} (oryginalny podpis):`);
console.log(`${header}.${forged}.${signature}`);
