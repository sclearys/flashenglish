import { Perfil, ResultadoEval, SesionEnCurso } from "./types";

const PENDIENTES_CASI = 2;
const PENDIENTES_INCORRECTO = 3;

/**
 * Aplica el resultado de evaluar una frase y devuelve el perfil actualizado.
 *
 * Reglas (según doc-03):
 *
 * Frase NUEVA (nunca había fallado antes):
 *   - perfecto  → aprendida, no entra en progreso_frases
 *   - casi      → entra en progreso_frases con estado "casi", 2 pendientes
 *   - incorrecto→ entra en progreso_frases con estado "incorrecto", 3 pendientes
 *
 * Frase EN REPASO (ya en progreso_frases):
 *   - perfecto  → descuenta 1 pendiente; si llega a 0, sale de progreso_frases (aprendida)
 *   - casi o incorrecto:
 *       · Si baja de nivel (casi → incorrecto): nuevo estado "incorrecto", 3 pendientes
 *       · Si no baja de nivel: reinicia contador al valor base del estado actual
 */
export function evaluarFrase(
  perfil: Perfil,
  fraseId: string,
  resultado: ResultadoEval,
  sesion: SesionEnCurso
): Perfil {
  // ids_repaso puede no existir en sesiones guardadas antes de este campo
  const esRepaso = (sesion.ids_repaso ?? []).includes(fraseId);
  const progresoActual = perfil.progreso_frases[fraseId];

  // Copia del mapa de progreso para no mutar el original
  const nuevoProgreso = { ...perfil.progreso_frases };

  if (!esRepaso) {
    // ── Frase nueva ───────────────────────────────────────────────────────
    if (resultado === "perfecto") {
      // Aprendida a la primera: no entra en progreso
    } else if (resultado === "casi") {
      nuevoProgreso[fraseId] = {
        estado: "casi",
        pendientes: PENDIENTES_CASI,
        ultima_vez: new Date().toISOString(),
      };
    } else {
      nuevoProgreso[fraseId] = {
        estado: "incorrecto",
        pendientes: PENDIENTES_INCORRECTO,
        ultima_vez: new Date().toISOString(),
      };
    }
  } else {
    // ── Frase en repaso ───────────────────────────────────────────────────
    if (resultado === "perfecto") {
      const pendientesRestantes = (progresoActual?.pendientes ?? 1) - 1;
      if (pendientesRestantes <= 0) {
        // Aprendida: sale de progreso_frases
        delete nuevoProgreso[fraseId];
      } else {
        nuevoProgreso[fraseId] = {
          ...progresoActual,
          pendientes: pendientesRestantes,
          ultima_vez: new Date().toISOString(),
        };
      }
    } else {
      // Fallo en una frase de repaso
      const estadoActual = progresoActual?.estado ?? "casi";

      if (estadoActual === "casi" && resultado === "incorrecto") {
        // Baja de nivel: casi → incorrecto
        nuevoProgreso[fraseId] = {
          estado: "incorrecto",
          pendientes: PENDIENTES_INCORRECTO,
          ultima_vez: new Date().toISOString(),
        };
      } else {
        // No baja de nivel: reinicia el contador del estado actual
        nuevoProgreso[fraseId] = {
          estado: estadoActual,
          pendientes: estadoActual === "casi" ? PENDIENTES_CASI : PENDIENTES_INCORRECTO,
          ultima_vez: new Date().toISOString(),
        };
      }
    }
  }

  // Actualiza aciertos totales si fue perfecto
  const aciertosNuevos =
    resultado === "perfecto" ? perfil.aciertos_totales + 1 : perfil.aciertos_totales;

  return {
    ...perfil,
    progreso_frases: nuevoProgreso,
    aciertos_totales: aciertosNuevos,
  };
}

/**
 * Avanza el puntero de frases nuevas tras terminar la sesión.
 * Solo cuenta las frases que eran nuevas (no estaban en ids_repaso).
 */
export function avanzarPunterosAlTerminar(
  perfil: Perfil,
  sesion: SesionEnCurso
): Perfil["puntero_frase_nueva"] {
  const idsRepaso = sesion.ids_repaso ?? [];
  const idsNuevasUsadas = sesion.frases_ids.filter(
    (id) => !idsRepaso.includes(id)
  );

  const punteros = { ...perfil.puntero_frase_nueva };

  for (const id of idsNuevasUsadas) {
    // El ID tiene forma "BASIC1-L01-01-V1", el bloque es la primera parte
    const bloque = id.split("-")[0];
    if (bloque in punteros) {
      punteros[bloque] = (punteros[bloque] ?? 0) + 1;
    }
  }

  return punteros;
}

/**
 * Actualiza la racha de días del perfil al terminar una sesión.
 *
 * Reglas:
 *   - ultima_sesion_fecha = hoy       → ya hizo sesión hoy, racha sin cambio
 *   - ultima_sesion_fecha = ayer      → racha + 1
 *   - ultima_sesion_fecha = null o más antigua → racha = 1
 */
export function actualizarRacha(perfil: Perfil): Pick<Perfil, "racha_dias" | "ultima_sesion_fecha"> {
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().slice(0, 10); // "YYYY-MM-DD"

  if (perfil.ultima_sesion_fecha === null) {
    // Primera sesión de siempre
    return { racha_dias: 1, ultima_sesion_fecha: fechaHoy };
  }

  const ultimaFecha = perfil.ultima_sesion_fecha.slice(0, 10);

  if (ultimaFecha === fechaHoy) {
    // Ya hizo sesión hoy, no cambia nada
    return { racha_dias: perfil.racha_dias, ultima_sesion_fecha: perfil.ultima_sesion_fecha };
  }

  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const fechaAyer = ayer.toISOString().slice(0, 10);

  if (ultimaFecha === fechaAyer) {
    // Sesión ayer → racha continúa
    return { racha_dias: perfil.racha_dias + 1, ultima_sesion_fecha: fechaHoy };
  }

  // Más de un día sin sesión → racha se rompe
  return { racha_dias: 1, ultima_sesion_fecha: fechaHoy };
}
