export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      <p className="text-white text-sm font-medium tracking-wide">CertainID Family</p>
    </div>
  );
}
