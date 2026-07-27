type ForumEditedLabelProps = {
  editedAt: string | null;
  className?: string;
};

export function ForumEditedLabel({ editedAt, className = "" }: ForumEditedLabelProps) {
  if (!editedAt) return null;
  return (
    <span className={`text-xs font-medium text-zinc-500 ${className}`.trim()}>Edited</span>
  );
}
