export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <div className="h-4 w-24 rounded-full bg-white/10" />
      <div className="h-10 w-64 rounded-xl bg-white/10" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 rounded-2xl bg-white/10" />
        ))}
      </div>
      <div className="sheet h-24" />
      <div className="sheet h-64" />
    </div>
  );
}
