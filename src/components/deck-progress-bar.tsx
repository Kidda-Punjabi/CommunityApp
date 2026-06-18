type DeckProgressBarProps = {
  confident: number;
  notConfident: number;
  total: number;
};

export function DeckProgressBar({ confident, notConfident, total }: DeckProgressBarProps) {
  if (total === 0) return null;

  const unrated = total - confident - notConfident;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
        {confident > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${(confident / total) * 100}%` }}
          />
        )}
        {notConfident > 0 && (
          <div
            className="bg-amber-400"
            style={{ width: `${(notConfident / total) * 100}%` }}
          />
        )}
        {unrated > 0 && (
          <div
            className="bg-zinc-200"
            style={{ width: `${(unrated / total) * 100}%` }}
          />
        )}
      </div>
      <p className="text-xs text-zinc-500">
        <span className="font-medium text-green-700">{confident} confident</span>
        {" · "}
        <span className="font-medium text-amber-700">{notConfident} not confident</span>
        {unrated > 0 && (
          <>
            {" · "}
            <span>{unrated} unrated</span>
          </>
        )}
      </p>
    </div>
  );
}
