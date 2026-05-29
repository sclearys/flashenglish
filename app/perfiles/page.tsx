"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  cargarEstado,
  cambiarPerfilActivo,
  crearPerfil,
  renombrarPerfil,
  cambiarColorPerfil,
  eliminarPerfil,
  COLORES_PERFIL,
} from "@/lib/storage";
import { AppState } from "@/lib/types";
import { crearClienteSupabase } from "@/lib/supabase";
import { descargarEstado, subirEstado } from "@/lib/nube";
import { guardarEstadoLocal } from "@/lib/storage";

type Modo = "selector" | "crear" | "editar";

export default function Perfiles() {
  const router = useRouter();
  const [estado, setEstado] = useState<AppState | null>(null);
  const [modo, setModo] = useState<Modo>("selector");
  const [perfilEditandoId, setPerfilEditandoId] = useState<string | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [mostrarMigracion, setMostrarMigracion] = useState(false);
  const [nombreInput, setNombreInput] = useState("");
  const [colorSeleccionado, setColorSeleccionado] = useState<string>(COLORES_PERFIL[0]);
  const [emailCuenta, setEmailCuenta] = useState<string | null>(null);
  const [esModoInvitado, setEsModoInvitado] = useState(false);

  useEffect(() => {
    const estadoCargado = cargarEstado();
    setEstado(estadoCargado);

    // Detectar si el usuario entró sin cuenta (cookie modo_invitado)
    setEsModoInvitado(document.cookie.includes("modo_invitado=1"));

    // Mostrar modal de migración si hay 1 perfil llamado "Yo" con progreso guardado
    const perfiles = Object.values(estadoCargado.perfiles);
    if (perfiles.length === 1) {
      const p = perfiles[0];
      const tieneProgreso =
        Object.keys(p.progreso_frases).length > 0 ||
        Object.values(p.puntero_frase_nueva).some((v) => v > 0);
      if (p.nombre === "Yo" && tieneProgreso) {
        setMostrarMigracion(true);
      }
    }

    // Obtener el email de la cuenta autenticada para mostrarlo en el selector
    async function cargarEmail() {
      const supabase = crearClienteSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmailCuenta(user.email);
    }
    cargarEmail();

    // Sincronizar desde Supabase en segundo plano.
    // Si la nube tiene datos, los usamos como fuente de verdad.
    // Si la nube está vacía pero hay progreso local (primer login),
    // subimos el estado local inmediatamente sin esperar ninguna acción del usuario.
    descargarEstado().then((estadoNube) => {
      if (estadoNube) {
        guardarEstadoLocal(estadoNube);
        setEstado(estadoNube);
      } else {
        // Nube vacía: migración de primer login.
        // subirEstado() es no-op si no hay sesión activa (modo invitado).
        const tieneProgreso = Object.values(estadoCargado.perfiles).some(
          (p) =>
            Object.keys(p.progreso_frases).length > 0 ||
            Object.values(p.puntero_frase_nueva).some((v) => v > 0)
        );
        if (tieneProgreso) subirEstado(estadoCargado);
      }
    });
  }, []);

  if (!estado) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    );
  }

  const perfilesArray = Object.entries(estado.perfiles);
  const puedeAnadirMas = perfilesArray.length < 3;
  const coloresUsados = perfilesArray.map(([, p]) => p.color_acento);

  // ── Acciones ───────────────────────────────────────────────────────────────

  async function cerrarSesion() {
    const supabase = crearClienteSupabase();
    await supabase.auth.signOut();
    // Limpiar cookie de modo invitado por si acaso
    document.cookie = "modo_invitado=0; path=/; max-age=0";
    sessionStorage.removeItem("perfilSeleccionado");
    router.push("/entrar");
  }

  function irALogin() {
    // Salir del modo invitado: borrar cookie y volver al login
    document.cookie = "modo_invitado=0; path=/; max-age=0";
    sessionStorage.removeItem("perfilSeleccionado");
    router.push("/entrar");
  }

  function seleccionarPerfil(perfilId: string) {
    const nuevoEstado = cambiarPerfilActivo(estado!, perfilId);
    setEstado(nuevoEstado);
    sessionStorage.setItem("perfilSeleccionado", "1");
    router.push("/");
  }

  function iniciarCrear() {
    const colorDisponible =
      COLORES_PERFIL.find((c) => !coloresUsados.includes(c)) ?? COLORES_PERFIL[0];
    setNombreInput("");
    setColorSeleccionado(colorDisponible);
    setModo("crear");
  }

  function iniciarEditar(perfilId: string) {
    const perfil = estado!.perfiles[perfilId];
    setNombreInput(perfil.nombre);
    setColorSeleccionado(perfil.color_acento);
    setPerfilEditandoId(perfilId);
    setConfirmarBorrar(null);
    setModo("editar");
  }

  function guardarNuevoPerfil() {
    if (!nombreInput.trim()) return;
    const nuevoEstado = crearPerfil(estado!, nombreInput.trim(), colorSeleccionado);
    setEstado(nuevoEstado);
    setModo("selector");
  }

  function guardarEdicion() {
    if (!nombreInput.trim() || !perfilEditandoId) return;
    let nuevoEstado = renombrarPerfil(estado!, perfilEditandoId, nombreInput.trim());
    if (nuevoEstado.perfiles[perfilEditandoId].color_acento !== colorSeleccionado) {
      nuevoEstado = cambiarColorPerfil(nuevoEstado, perfilEditandoId, colorSeleccionado);
    }
    setEstado(nuevoEstado);
    setPerfilEditandoId(null);
    setModo("selector");
  }

  function borrarPerfilConfirmado(perfilId: string) {
    const nuevoEstado = eliminarPerfil(estado!, perfilId);
    setEstado(nuevoEstado);
    setConfirmarBorrar(null);
    setModo("selector");
  }

  function guardarMigracion(nombre: string) {
    const perfilId = Object.keys(estado!.perfiles)[0];
    const nuevoEstado = renombrarPerfil(estado!, perfilId, nombre);
    setEstado(nuevoEstado);
    setMostrarMigracion(false);
  }

  // ── Pantalla crear / editar ────────────────────────────────────────────────

  if (modo === "crear" || modo === "editar") {
    const esEditar = modo === "editar";
    const perfilEditando =
      esEditar && perfilEditandoId ? estado.perfiles[perfilEditandoId] : null;
    // En editar, el color del propio perfil no está "bloqueado" para sí mismo
    const coloresBloqueados = esEditar
      ? coloresUsados.filter((c) => c !== perfilEditando?.color_acento)
      : coloresUsados;

    return (
      <main className="min-h-screen bg-white flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-sm flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setModo("selector"); setPerfilEditandoId(null); }}
              className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors"
            >
              ← Volver
            </button>
            <h1 className="text-[18px] font-semibold text-ink">
              {esEditar ? "Editar perfil" : "Nuevo perfil"}
            </h1>
          </div>

          {/* Preview avatar */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
              style={{ background: colorSeleccionado }}
            >
              {nombreInput.trim() ? nombreInput.trim()[0].toUpperCase() : "?"}
            </div>
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-eyebrow font-semibold uppercase text-mute">NOMBRE</label>
            <input
              type="text"
              value={nombreInput}
              onChange={(e) => setNombreInput(e.target.value)}
              placeholder="Tu nombre"
              maxLength={20}
              className="w-full h-12 rounded-md border border-brand-100 px-4 text-sm text-ink font-medium focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Color */}
          <div className="flex flex-col gap-3">
            <label className="text-eyebrow font-semibold uppercase text-mute">COLOR</label>
            <div className="flex gap-4">
              {COLORES_PERFIL.map((color) => {
                const bloqueado = coloresBloqueados.includes(color);
                const seleccionado = colorSeleccionado === color;
                return (
                  <button
                    key={color}
                    onClick={() => !bloqueado && setColorSeleccionado(color)}
                    disabled={bloqueado}
                    title={bloqueado ? "Ya está en uso" : undefined}
                    className={`w-11 h-11 rounded-full transition-all ${
                      seleccionado ? "ring-2 ring-offset-2 ring-ink scale-110" : ""
                    } ${bloqueado ? "opacity-30 cursor-not-allowed" : "hover:scale-105"}`}
                    style={{ background: color }}
                  />
                );
              })}
            </div>
          </div>

          {/* Botón guardar */}
          <button
            onClick={esEditar ? guardarEdicion : guardarNuevoPerfil}
            disabled={!nombreInput.trim()}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {esEditar ? "Guardar cambios" : "Crear perfil"}
          </button>

          {/* Borrar perfil: solo en editar y si hay más de 1 perfil */}
          {esEditar && perfilesArray.length > 1 && (
            confirmarBorrar === perfilEditandoId ? (
              <div className="flex flex-col gap-3 p-4 border border-danger rounded-md">
                <p className="text-sm text-body text-center">
                  ¿Borrar el perfil de{" "}
                  <span className="font-semibold">{perfilEditando?.nombre}</span>?
                  Se perderá todo su progreso.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmarBorrar(null)}
                    className="flex-1 h-10 rounded-md border border-brand-100 text-sm font-semibold text-body hover:border-brand-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => borrarPerfilConfirmado(perfilEditandoId!)}
                    className="flex-1 h-10 rounded-md bg-danger text-white text-sm font-semibold hover:brightness-95 transition-all"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmarBorrar(perfilEditandoId)}
                className="text-sm font-medium text-danger hover:text-red-700 transition-colors text-center py-1"
              >
                Borrar perfil
              </button>
            )
          )}
        </div>
      </main>
    );
  }

  // ── Pantalla selector ──────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">

      {/* Modal de migración */}
      {mostrarMigracion && (
        <MigracionModal onGuardar={guardarMigracion} />
      )}

      <div className="w-full max-w-sm flex flex-col items-center gap-10">

        {/* Cuenta activa y cierre de sesión */}
        {emailCuenta ? (
          <div className="w-full flex items-center justify-between">
            <span className="text-xs text-mute truncate max-w-[200px]">{emailCuenta}</span>
            <div className="flex items-center gap-3">
              <Link
                href="/preferencias"
                className="text-2xl text-mute hover:text-body transition-colors leading-none"
                title="Preferencias"
              >
                ⚙
              </Link>
              <button
                onClick={cerrarSesion}
                className="text-xs font-medium text-body hover:text-ink transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : esModoInvitado ? (
          <div className="w-full flex items-center justify-between">
            <span className="text-xs text-mute">Modo sin cuenta</span>
            <button
              onClick={irALogin}
              className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
            >
              Iniciar sesión →
            </button>
          </div>
        ) : null}

        <h1 className="text-[22px] font-semibold text-ink">¿Quién eres?</h1>

        <div className="flex flex-wrap gap-8 justify-center">
          {perfilesArray.map(([id, perfil]) => (
            <div key={id} className="flex flex-col items-center gap-2 relative">
              <button
                onClick={() => seleccionarPerfil(id)}
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-semibold hover:scale-105 active:scale-95 transition-transform"
                style={{ background: perfil.color_acento }}
              >
                {perfil.nombre[0].toUpperCase()}
              </button>
              <span className="text-sm font-semibold text-ink text-center max-w-[80px] truncate">
                {perfil.nombre}
              </span>
              {/* Botón editar */}
              <button
                onClick={() => iniciarEditar(id)}
                className="absolute -top-1 -right-2 w-6 h-6 rounded-full bg-surface flex items-center justify-center text-mute text-xs hover:bg-brand-100 transition-colors"
                title="Editar perfil"
              >
                ✎
              </button>
            </div>
          ))}

          {/* Añadir perfil */}
          {puedeAnadirMas && (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={iniciarCrear}
                className="w-20 h-20 rounded-full bg-surface flex items-center justify-center text-mute text-3xl hover:bg-brand-50 transition-colors"
              >
                +
              </button>
              <span className="text-sm font-medium text-mute">Añadir</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Modal de migración ─────────────────────────────────────────────────────────

function MigracionModal({ onGuardar }: { onGuardar: (nombre: string) => void }) {
  const [nombre, setNombre] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-[18px] font-semibold text-ink">Hay progreso guardado</h2>
        <p className="text-sm text-body">¿Cómo te llamas? Así sabremos de quién es.</p>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          maxLength={20}
          autoFocus
          className="w-full h-12 rounded-md border border-brand-100 px-4 text-sm text-ink font-medium focus:outline-none focus:border-brand-500 transition-colors"
        />
        <button
          onClick={() => nombre.trim() && onGuardar(nombre.trim())}
          disabled={!nombre.trim()}
          className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
