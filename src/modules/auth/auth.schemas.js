const { z } = require("zod");

// email normalizowany: bez spacji na brzegach i małymi literami
const email = z.string().trim().toLowerCase().pipe(z.email());

// .strict() - pole "role" (ani żadne inne nieznane pole) nie przejdzie -> 400
const registerBody = z.object({
  email,
  password: z.string().min(10).max(72) // bcrypt bierze pod uwagę maks. 72 bajty
}).strict();

const loginBody = z.object({
  email,
  password: z.string().min(1).max(72)
}).strict();

module.exports = { registerBody, loginBody };
