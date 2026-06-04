// Devuelve true solo en cliente y cuando el navegador soporta Web Speech API.
// Se evalúa una vez al importar el módulo (seguro para SSR: no accede a window en build time).
export function tieneWebSpeech(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

// Lee un texto en inglés con acento UK a velocidad ligeramente reducida.
// Cancela cualquier reproducción en curso antes de empezar (evita solapamientos
// y permite "reiniciar" si se llama mientras ya está sonando).
// onEnd: callback opcional que se llama cuando el audio termina de reproducirse.
export function leerFraseEnIngles(texto: string, onEnd?: () => void): void {
  if (!tieneWebSpeech()) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  // Chrome pausa el motor de síntesis tras periodos de inactividad o al cancelar.
  // resume() lo despierta; el setTimeout da tiempo al hilo de audio a estar listo.
  window.speechSynthesis.resume();
  setTimeout(() => {
    if (!tieneWebSpeech()) {
      onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "en-GB";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  }, 50);
}

// Detiene cualquier reproducción en curso. Útil al desmontar el componente
// de sesión o al avanzar de tarjeta, para no dejar audio huérfano.
export function detenerAudio(): void {
  if (!tieneWebSpeech()) return;
  window.speechSynthesis.cancel();
}
