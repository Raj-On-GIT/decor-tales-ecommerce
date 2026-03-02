export default function PageLoader({ text = "Loading..." }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5">
      <div className="relative w-15 h-15">
        <div className="absolute inset-0 rounded-full border-10 border-gray-200" />
        <div className="absolute inset-0 rounded-full border-10 border-transparent border-t-black animate-spin" />
      </div>

      <p className="text-sm font-medium tracking-widest text-gray-400 animate-pulse">
        {text}
      </p>
    </div>
  );
}