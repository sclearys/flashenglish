interface Segmento {
  codigo: string;
  porcentaje: number; // 0-100
  esActivo: boolean;
  desbloqueado: boolean;
}

interface Props {
  segmentos: Segmento[]; // los 8 bloques en orden de catálogo
  mostrarLabels?: boolean;
}

// Agrupación fija por nivel
const GRUPOS: { label: string; codigos: string[]; flex: number }[] = [
  { label: "Basic",        codigos: ["BASIC1", "BASIC2"],              flex: 2 },
  { label: "Intermediate", codigos: ["INT1", "INT2", "INT3", "INT4"], flex: 4 },
  { label: "Advanced",     codigos: ["ADV1", "ADV2"],                 flex: 2 },
];

function nivelDelBloqueActivo(segmentos: Segmento[]): string {
  const activo = segmentos.find((s) => s.esActivo);
  if (!activo) return "";
  for (const grupo of GRUPOS) {
    if (grupo.codigos.includes(activo.codigo)) return grupo.label;
  }
  return "";
}

export default function BarraOchoSegmentos({ segmentos, mostrarLabels = true }: Props) {
  const nivelActivo = nivelDelBloqueActivo(segmentos);
  const porCodigo = new Map(segmentos.map((s) => [s.codigo, s]));

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Barra de segmentos */}
      <div className="flex gap-1.5 w-full">
        {GRUPOS.map((grupo) => (
          <div
            key={grupo.label}
            className="flex gap-[3px]"
            style={{ flex: grupo.flex }}
          >
            {grupo.codigos.map((codigo) => {
              const seg = porCodigo.get(codigo);
              const pct = seg?.porcentaje ?? 0;
              const activo = seg?.esActivo ?? false;
              const desbloqueado = seg?.desbloqueado ?? false;
              const completo = pct >= 100;

              // Fondo: brand-100 si desbloqueado (disponible), surface si bloqueado
              const bgFondo = desbloqueado ? "bg-brand-100" : "bg-surface";

              return (
                <div
                  key={codigo}
                  className={`flex-1 h-3 rounded-[4px] overflow-hidden ${bgFondo}`}
                >
                  {completo ? (
                    // Completado: naranja pleno
                    <div className="w-full h-full bg-brand-500 rounded-[4px]" />
                  ) : activo ? (
                    // Activo: relleno parcial; mínimo 8% para siempre ser visible
                    <div
                      className="h-full bg-brand-500 rounded-[4px] transition-all duration-[400ms] ease-out"
                      style={{ width: `${Math.max(pct, 8)}%` }}
                    />
                  ) : pct > 0 ? (
                    // Parcial: bloque inactivo con progreso (ej. saltado por test de nivel)
                    <div
                      className="h-full bg-brand-500 rounded-[4px]"
                      style={{ width: `${pct}%` }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Labels de nivel */}
      {mostrarLabels && (
        <div className="flex w-full">
          {GRUPOS.map((grupo) => (
            <div
              key={grupo.label}
              className="text-center"
              style={{ flex: grupo.flex }}
            >
              <span
                className={`text-eyebrow font-semibold ${
                  grupo.label === nivelActivo ? "text-ink" : "text-mute"
                }`}
              >
                {grupo.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
