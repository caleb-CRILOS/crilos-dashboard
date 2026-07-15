export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="flex gap-5 border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`label-mono relative cursor-pointer py-3 text-xs ${
            tab === active ? "text-paper" : "text-paper-faint hover:text-paper-dim"
          }`}
        >
          {tab}
          {tab === active && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-clay" />
          )}
        </button>
      ))}
    </div>
  );
}
