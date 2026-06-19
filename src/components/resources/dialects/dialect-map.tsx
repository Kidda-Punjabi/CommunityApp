/**
 * Illustrative placeholder map of Punjab dialect regions — NOT accurate district
 * geography. Shapes are rough approximations for orientation only.
 *
 * For production accuracy, replace with real boundary data (e.g. Indian Punjab
 * district GeoJSON) rather than refining these hand-drawn paths.
 */
export function DialectMap() {
  return (
    <figure className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <svg
        viewBox="0 0 400 320"
        className="w-full"
        role="img"
        aria-label="Illustrative map of Punjab dialect regions"
      >
        <rect width="400" height="320" fill="#f4f4f5" />

        {/* Malwa — south, largest region */}
        <path
          d="M 40 140 L 360 130 L 380 280 L 30 290 Z"
          fill="#ddd6fe"
          stroke="#8b5cf6"
          strokeWidth="2"
          opacity="0.85"
        />
        <text x="200" y="220" textAnchor="middle" className="fill-violet-900 text-[13px] font-semibold">
          Malwa (Malwai)
        </text>

        {/* Doaba — northeast strip */}
        <path
          d="M 180 30 L 360 40 L 340 130 L 160 120 Z"
          fill="#bfdbfe"
          stroke="#3b82f6"
          strokeWidth="2"
          opacity="0.9"
        />
        <text x="260" y="85" textAnchor="middle" className="fill-blue-900 text-[13px] font-semibold">
          Doaba (Doabi)
        </text>

        {/* Majha — northwest, lower visual emphasis */}
        <path
          d="M 30 40 L 170 35 L 160 120 L 40 130 Z"
          fill="#e4e4e7"
          stroke="#a1a1aa"
          strokeWidth="1.5"
          opacity="0.75"
        />
        <text x="95" y="88" textAnchor="middle" className="fill-zinc-600 text-[12px] font-medium">
          Majha (Majhi)
        </text>
      </svg>

      <figcaption className="space-y-4 border-t border-zinc-100 px-4 py-4 text-sm text-zinc-600">
        <p className="text-xs text-zinc-500">
          For illustration only — not accurate district boundaries.
        </p>

        <div>
          <p className="font-medium text-zinc-800">Doabi districts</p>
          <p className="mt-0.5">
            Jalandhar, Hoshiarpur, Kapurthala, Nawanshahr (Shaheed Bhagat Singh Nagar)
          </p>
        </div>

        <div>
          <p className="font-medium text-zinc-800">Malwai districts</p>
          <p className="mt-0.5">
            Ludhiana, Bathinda, Patiala, Sangrur, Moga, Mansa, Barnala, Muktsar, Faridkot,
            Ferozepur, Fazilka
          </p>
        </div>

        <div>
          <p className="font-medium text-zinc-700">Majha districts</p>
          <p className="mt-0.5 text-zinc-600">Amritsar, Tarn Taran, Gurdaspur</p>
        </div>
      </figcaption>
    </figure>
  );
}
