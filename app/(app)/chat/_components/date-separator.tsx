import { formatDateSeparator } from "@/lib/format/date";

export function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="bg-wa-header text-wa-textSecondary text-[11px] font-medium px-3 py-1 rounded-md shadow-sm">
        {formatDateSeparator(date)}
      </span>
    </div>
  );
}
