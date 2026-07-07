export function DialectMap() {
  return (
    <figure className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="relative">
        <img
          src="/punjab-districts-map.svg"
          alt="Map of Punjab with district boundaries"
          className="h-auto w-full"
        />
        <div className="pointer-events-none absolute left-[26%] top-[30%] rounded-full bg-violet-600/95 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
          Majha: this is what you&apos;re learning
        </div>
      </div>

      <figcaption className="space-y-4 border-t border-zinc-100 px-4 py-4 text-sm text-zinc-600">
        <div>
          <p className="font-medium text-violet-700">Majha (focus dialect)</p>
          <p className="mt-0.5">Amritsar, Tarn Taran, Gurdaspur</p>
        </div>

        <div>
          <p className="font-medium text-blue-700">Doaba</p>
          <p className="mt-0.5">
            Jalandhar, Hoshiarpur, Kapurthala, Nawanshahr (Shaheed Bhagat Singh Nagar)
          </p>
        </div>

        <div>
          <p className="font-medium text-emerald-700">Malwa</p>
          <p className="mt-0.5">
            Ludhiana, Bathinda, Patiala, Sangrur, Moga, Mansa, Barnala, Muktsar, Faridkot,
            Ferozepur, Fazilka
          </p>
        </div>

        <div>
          <p className="font-medium text-zinc-800">Puadhi and Pothohari</p>
          <p className="mt-0.5">
            Puadhi sits between Majha and Malwa in eastern Punjab. Pothohari is centered in
            Pakistan-administered Punjab (Rawalpindi belt), so it is noted here as an external
            regional reference.
          </p>
        </div>

        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          Map source: Wikimedia Commons,{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:India_Punjab_locator_map.svg"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-600 hover:text-violet-500"
          >
            India Punjab locator map.svg
          </a>{" "}
          (CC BY-SA 3.0, Arun Ganesh / Planemad).
        </div>
      </figcaption>
    </figure>
  );
}
