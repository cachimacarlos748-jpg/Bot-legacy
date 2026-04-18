// ============================================================
//  LEGACY STORE - Bot de WhatsApp con IA Gemini
//  Desarrollado para: Legacy Store Venezuela
//  Tecnologías: whatsapp-web.js + Google Gemini AI
// ============================================================

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ──────────────────────────────────────────────
//  CONFIGURACIÓN
// ──────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDrFAlf2I_bIMgJHpUWzek0J61CDTNPnnw";
const BOT_NAME = "Legacy Bot";

// ──────────────────────────────────────────────
//  PROMPT DEL SISTEMA (Conocimiento del negocio)
// ──────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente virtual oficial de LEGACY STORE, una tienda premium de recargas para videojuegos en Venezuela. Tu nombre es "Legacy Bot".

## TU PERSONALIDAD
- Eres amigable, profesional y entusiasta del gaming.
- Usas un tono cercano pero respetuoso, como hablan los gamers venezolanos.
- Respondes siempre en español.
- Eres conciso pero completo en tus respuestas.
- Puedes usar emojis relacionados al gaming con moderación (🎮, ⚡, 🎯, etc.).

## INFORMACIÓN DEL NEGOCIO

**Nombre:** LEGACY STORE 🎮
**Tipo:** Premium Gaming Store - Recargas para videojuegos
**País:** Venezuela 🇻🇪
**Slogan:** "Recarga tus juegos favoritos de forma rápida, segura y al mejor precio de Venezuela"
**Página web:** https://legacy-game-store.base44.app
**WhatsApp de soporte humano:** +58 422 2896623

## JUEGOS Y PRECIOS DISPONIBLES

### 🎮 ROBLOX (DISPONIBLE - Entrega Instantánea ⚡)

| Paquete | Precio Bs | Precio USD |
|---------|-----------|------------|
| 80 Robux | Bs. 566,50 | $1.10 |
| 400 Robux | Bs. 2.626,50 | $5.10 |
| 800 Robux | Bs. 5.201,50 | $10.10 |
| 1.700 Robux | Bs. 10.815,00 | $21.00 |
| 4.500 Robux | Bs. 26.265,00 | $51.00 |
| 10.000 Robux | Bs. 51.551,50 | $100.10 |

*Nota: Los precios pueden variar según la tasa del día. La tasa de referencia es Bs 515 por dólar.*

## CÓMO COMPRAR (Proceso paso a paso)

**Opción 1 - Por la página web:**
1. Entra a https://legacy-game-store.base44.app
2. Selecciona Roblox y elige tu paquete de Robux
3. Ingresa tus datos: usuario, contraseña, teléfono y correo
4. Realiza el pago por Pago Móvil o Transferencia al BDV
5. Sube tu comprobante y confirma el pedido
6. ¡Recibes tu recarga al instante! ⚡

**Opción 2 - Por WhatsApp:**
Escríbenos directamente aquí y un agente te atenderá.

## DATOS DE PAGO

**Método:** Pago Móvil / Transferencia Bancaria 🇻🇪
**Banco:** BDV - Banco de Venezuela (Código 0102)
**Cédula:** 13166374
**Teléfono de Pago Móvil:** 04129251197

## POLÍTICAS IMPORTANTES

⚠️ **Política anti-fraude:** Si se envía un comprobante de pago falso, la cuenta del juego del cliente será bloqueada permanentemente.
✅ **Entrega:** Instantánea una vez verificado el pago.
🔒 **Seguridad:** Los datos de la cuenta se usan únicamente para realizar la recarga y no se almacenan.

## LO QUE PUEDES HACER

1. **Informar precios** de los paquetes disponibles
2. **Explicar el proceso de compra** paso a paso
3. **Dar los datos de pago** cuando el cliente quiera comprar
4. **Soporte técnico básico** para problemas comunes
5. **Resolver dudas** sobre el servicio
6. **Redirigir a soporte humano** cuando sea necesario

## CUÁNDO REDIRIGIR A SOPORTE HUMANO

Debes indicar que un agente humano se comunicará cuando:
- El cliente pagó pero no recibió su recarga
- Hay un problema técnico con su cuenta de juego
- El cliente quiere hacer una reclamación
- La consulta es muy específica y no puedes resolverla
- El cliente lo solicita explícitamente

En esos casos di: "Voy a conectarte con un agente de soporte humano de Legacy Store. Por favor escribe al +58 422 2896623 o espera que te contactemos. 🎮"

## LO QUE NO DEBES HACER

- No inventes precios ni información que no esté en este prompt
- No hagas promesas que no puedas cumplir
- No compartas información personal de otros clientes
- No respondas preguntas que no tengan relación con Legacy Store o gaming
- Si no sabes algo, dilo honestamente y ofrece conectar con soporte humano

## RESPUESTA DE BIENVENIDA

Cuando un cliente escriba por primera vez o salude, usa este mensaje de bienvenida:
"¡Bienvenido a *LEGACY STORE* 🎮! Soy Legacy Bot, tu asistente virtual. Estoy aquí para ayudarte con recargas de videojuegos, precios y soporte. ¿En qué puedo ayudarte hoy? 🚀"
`;

// ──────────────────────────────────────────────
//  INICIALIZAR GEMINI AI
// ──────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: SYSTEM_PROMPT,
});

// ──────────────────────────────────────────────
//  HISTORIAL DE CONVERSACIONES
//  Guardamos el historial por número de teléfono
// ──────────────────────────────────────────────
const conversationHistory = new Map();

// Tiempo de expiración de sesión: 30 minutos sin actividad
const SESSION_TIMEOUT = 30 * 60 * 1000;
const sessionTimers = new Map();

function getOrCreateSession(phoneNumber) {
  if (!conversationHistory.has(phoneNumber)) {
    conversationHistory.set(phoneNumber, []);
    console.log(`[Nueva sesión] Cliente: ${phoneNumber}`);
  }
  return conversationHistory.get(phoneNumber);
}

function resetSessionTimer(phoneNumber) {
  // Limpiar timer anterior si existe
  if (sessionTimers.has(phoneNumber)) {
    clearTimeout(sessionTimers.get(phoneNumber));
  }
  // Crear nuevo timer
  const timer = setTimeout(() => {
    conversationHistory.delete(phoneNumber);
    sessionTimers.delete(phoneNumber);
    console.log(`[Sesión expirada] Cliente: ${phoneNumber}`);
  }, SESSION_TIMEOUT);
  sessionTimers.set(phoneNumber, timer);
}

// ──────────────────────────────────────────────
//  FUNCIÓN PARA CONSULTAR GEMINI
// ──────────────────────────────────────────────
async function askGemini(phoneNumber, userMessage) {
  try {
    const history = getOrCreateSession(phoneNumber);

    // Iniciar chat con historial existente
    const chat = model.startChat({
      history: history,
    });

    // Enviar mensaje y obtener respuesta
    const result = await chat.sendMessage(userMessage);
    const response = result.response.text();

    // Guardar en historial (formato requerido por Gemini)
    history.push({
      role: "user",
      parts: [{ text: userMessage }],
    });
    history.push({
      role: "model",
      parts: [{ text: response }],
    });

    // Reiniciar timer de sesión
    resetSessionTimer(phoneNumber);

    return response;
  } catch (error) {
    console.error(`[Error Gemini] ${error.message}`);
    if (error.message.includes("API_KEY")) {
      return "⚠️ Error de configuración del bot. Por favor contacta al soporte: +58 422 2896623";
    }
    return "Lo siento, tuve un problema técnico momentáneo. Por favor intenta de nuevo o escríbenos al +58 422 2896623 🎮";
  }
}

// ──────────────────────────────────────────────
//  INICIALIZAR CLIENTE DE WHATSAPP
// ──────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "legacy-store-bot",
    dataPath: "./session",
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
});

// ──────────────────────────────────────────────
//  EVENTOS DEL CLIENTE
// ──────────────────────────────────────────────

// Mostrar QR para vincular la cuenta
client.on("qr", (qr) => {
  console.log("\n" + "=".repeat(50));
  console.log("  LEGACY STORE BOT - Escanea el código QR");
  console.log("=".repeat(50));
  console.log("Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo");
  console.log("Luego escanea este código QR:\n");
  qrcode.generate(qr, { small: true });
  console.log("\n" + "=".repeat(50) + "\n");
});

// Bot autenticado correctamente
client.on("authenticated", () => {
  console.log("✅ [Autenticado] Sesión de WhatsApp iniciada correctamente.");
});

// Error de autenticación
client.on("auth_failure", (msg) => {
  console.error("❌ [Error de autenticación]", msg);
  console.log("Elimina la carpeta 'session' y vuelve a escanear el QR.");
});

// Bot listo para recibir mensajes
client.on("ready", () => {
  console.log("\n" + "=".repeat(50));
  console.log("  🎮 LEGACY STORE BOT ACTIVO Y LISTO");
  console.log("=".repeat(50));
  console.log(`  Bot: ${BOT_NAME}`);
  console.log(`  Estado: En línea ✅`);
  console.log(`  Hora de inicio: ${new Date().toLocaleString("es-VE")}`);
  console.log("=".repeat(50) + "\n");
});

// ──────────────────────────────────────────────
//  MANEJO DE MENSAJES ENTRANTES
// ──────────────────────────────────────────────
client.on("message", async (message) => {
  // Ignorar mensajes de grupos (solo responder en chats privados)
  if (message.from.endsWith("@g.us")) return;

  // Ignorar mensajes del propio bot
  if (message.fromMe) return;

  // Ignorar mensajes de estado
  if (message.from === "status@broadcast") return;

  const phoneNumber = message.from;
  const userText = message.body?.trim();

  // Ignorar mensajes vacíos o solo multimedia sin texto
  if (!userText) return;

  console.log(`\n[Mensaje entrante] De: ${phoneNumber}`);
  console.log(`[Texto] ${userText}`);

  try {
    // Mostrar indicador de "escribiendo..."
    const chat = await message.getChat();
    await chat.sendStateTyping();

    // Obtener respuesta de Gemini
    const response = await askGemini(phoneNumber, userText);

    // Enviar respuesta
    await message.reply(response);
    console.log(`[Respuesta enviada] A: ${phoneNumber}`);
  } catch (error) {
    console.error(`[Error al responder] ${error.message}`);
    await message.reply(
      "Lo siento, ocurrió un error. Por favor intenta de nuevo o contáctanos al +58 422 2896623 🎮"
    );
  }
});

// ──────────────────────────────────────────────
//  MANEJO DE DESCONEXIÓN
// ──────────────────────────────────────────────
client.on("disconnected", (reason) => {
  console.log(`\n⚠️ [Desconectado] Razón: ${reason}`);
  console.log("Intentando reconectar...");
  setTimeout(() => {
    client.initialize();
  }, 5000);
});

// ──────────────────────────────────────────────
//  INICIAR EL BOT
// ──────────────────────────────────────────────
console.log("\n🚀 Iniciando Legacy Store Bot...");
console.log("Por favor espera mientras se carga WhatsApp Web...\n");
client.initialize();

// ──────────────────────────────────────────────
//  MANEJO DE ERRORES GLOBALES
// ──────────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Error no manejado]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Excepción no capturada]", error.message);
});
