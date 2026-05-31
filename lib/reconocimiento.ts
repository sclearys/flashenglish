// Wrapper de la Web Speech API — reconocimiento de voz (STT).
// Solo funciona en Chrome y Edge; Firefox no lo soporta.
// Este módulo solo se usa en el cliente; nunca se importa en el servidor.

// Usamos un tipo mínimo para SpeechRecognition en lugar del tipo global,
// porque la versión de TypeScript en uso no lo expone siempre como nombre global.
type ReconocedorVoz = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionEvent = {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
};

type WindowConSTT = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => ReconocedorVoz;
    webkitSpeechRecognition?: new () => ReconocedorVoz;
  };

// Instancia activa del reconocedor (para poder detenerla externamente).
let reconocedorActivo: ReconocedorVoz | null = null;

/** Devuelve true si el navegador soporta reconocimiento de voz. */
export function tieneReconocimientoVoz(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as WindowConSTT;
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

interface OpcionesReconocimiento {
  /** Idioma del discurso a reconocer. Usar "en-US" para inglés americano. */
  lang: string;
  /** Se llama cuando el reconocedor transcribe algo con suficiente confianza. */
  onResult: (texto: string) => void;
  /** Se llama si no se detecta voz o hay un error de reconocimiento. */
  onError: () => void;
  /** Se llama cuando el reconocedor termina (haya resultado o no). */
  onEnd: () => void;
}

/**
 * Inicia el reconocimiento de voz.
 * Llama a onResult con el texto transcrito si el reconocedor detecta habla.
 * Llama a onError si ocurre un error o no hay habla detectada.
 */
export function iniciarReconocimiento(opciones: OpcionesReconocimiento): void {
  if (!tieneReconocimientoVoz()) {
    opciones.onError();
    return;
  }

  // Detener cualquier reconocedor previo que pudiera estar activo.
  detenerReconocimiento();

  const win = window as WindowConSTT;
  const Constructor = (win.SpeechRecognition ?? win.webkitSpeechRecognition)!;
  const rec = new Constructor();
  reconocedorActivo = rec;

  rec.lang = opciones.lang;
  rec.interimResults = false; // Solo resultados finales
  rec.maxAlternatives = 1;
  rec.continuous = false;     // Para en cuanto detecta silencio

  let resultadoRecibido = false;

  rec.onresult = (event: SpeechRecognitionEvent) => {
    const texto = event.results[0][0].transcript.trim();
    if (texto) {
      resultadoRecibido = true;
      opciones.onResult(texto);
    }
  };

  rec.onerror = () => {
    reconocedorActivo = null;
    opciones.onError();
  };

  rec.onend = () => {
    reconocedorActivo = null;
    // Si terminó sin resultado (silencio prolongado, etc.), avisar.
    if (!resultadoRecibido) {
      opciones.onError();
    }
    opciones.onEnd();
  };

  rec.start();
}

/** Detiene el reconocedor activo si lo hay. */
export function detenerReconocimiento(): void {
  if (reconocedorActivo) {
    try {
      reconocedorActivo.stop();
      // No limpiamos reconocedorActivo aquí: en iOS .stop() es asíncrono
      // y onresult puede llegar después. Es onend quien lo pone a null.
    } catch {
      // Si .stop() lanza, el reconocedor no disparará onend → limpiamos aquí.
      reconocedorActivo = null;
    }
  }
}
