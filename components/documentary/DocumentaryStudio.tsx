"use client";

import { useMemo, useState } from "react";
import { Film, Sparkles, Upload, Play, Wand2, Clock3, ShieldCheck } from "lucide-react";

const chapters = [
  ["01", "Az út", "Gyermekkor, család, az élet első kérdései"],
  ["02", "Ahonnan jövök", "Család, iskola és az értékek, amelyek formáltak"],
  ["03", "A raktár", "Magyar Baptista Szeretetszolgálat, raktár és szolgálat"],
  ["04", "A kilométerek", "Logisztika, autók, hosszú utak és csendes gondolatok"],
  ["05", "A védelem", "Személy- és vagyonőri pálya, felelősség és figyelem"],
  ["06", "A következő lépés", "Biztonságszervezői és magánnyomozói jövőbeli képzések"],
  ["07", "A hit", "Keresztény hit, kérdések, remény és kitartás"],
  ["08", "Az otthon", "Diósd és az önálló élet első stabil alapja"],
  ["09", "A fiatal gazda", "Támogatás, Somogy és a mezőgazdasági jövő"],
  ["10", "A méhek", "Méhészet, természet és egy felépítendő vállalkozás"],
  ["11", "Gál Remény Tanyája", "A hosszú távú családi gazdaság víziója"],
  ["12", "A jövő", "Technológia, LifeOS, család és örökség"],
];

const masterPrompt = `Készíts hosszú, prémium minőségű, mozifilmszerű magyar YouTube dokumentumfilmet Gál Bence Dávid életéről. Te legyél a rendező, forgatókönyvíró, vágó, narrátor és zenei rendező. Használd elsőként a feltöltött valódi fotókat és videókat; csak a hiányzó részekhez készíts realisztikus AI B-rollt. Ne találj ki megtörtént eseményeket. A jövőbeli terveket jövőként kezeld. 16:9, YouTube, lehetőleg kb. 30 perc vagy a szolgáltatás által támogatott leghosszabb jó minőségű változat. Természetes magyar férfi narráció, fotorealisztikus dokumentumfilmes képi világ, visszafogott cinematic zene és valódi környezeti hangok. Fontos témák: gyermekkor és család, amerikai/internacionális iskolai évek, Magyar Baptista Szeretetszolgálat, raktári munka, logisztika, autók és hosszú vezetés, személy- és vagyonőri pálya, biztonságszervezői és magánnyomozói jövőbeli képzés, keresztény hit, Diósd és az otthon, fiatal gazda támogatás, Somogy, méhészet, Gál Remény Tanyája, LifeOS, jövőbeli család és örökség. A visszatérő motívum az országút: „Még nem értem oda. De már úton vagyok.” Ne legyen slideshow, reklám, TikTok-videó vagy giccses motivációs film. Legyen őszinte, családbarát és valódi dokumentumfilm-érzetű.`;

export function DocumentaryStudio() {
  const [prompt, setPrompt] = useState(masterPrompt);
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Készen áll a rendezői brief");

  const totalMinutes = useMemo(() => Math.max(24, Math.min(36, chapters.length * 2.5)), []);

  function startDirector() {
    setRunning(true);
    setStatus("AI rendezői terv készítése…");
    window.setTimeout(() => {
      setRunning(false);
      setStatus("Storyboard kész. A következő lépés az AI média- és renderelő provider csatlakoztatása.");
    }, 900);
  }

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45"><Film className="h-4 w-4" /> LifeOS Documentary Studio</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Ami még előttem áll</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">AI-rendező a személyes, mozifilmszerű magyar élettörténetedhez. Te adod az anyagokat és az irányt; a rendszer a storyboardtól a végső renderig automatizálható.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/65"><Clock3 className="mr-2 inline h-4 w-4" /> cél: ~{totalMinutes} perc</div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 sm:p-7">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-medium">Rendezői brief</h2><p className="mt-1 text-xs text-white/40">Ezt fogja használni az AI a film alapjához.</p></div><Sparkles className="h-5 w-5 text-white/45" /></div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[420px] w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white/80 outline-none transition focus:border-white/25" />
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={startDirector} disabled={running} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"><Wand2 className="mr-2 inline h-4 w-4" />{running ? "Rendezés…" : "AI rendező indítása"}</button>
              <label className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium hover:bg-white/[0.07]"><Upload className="mr-2 inline h-4 w-4" /> Saját fotók / videók<input type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></label>
            </div>
            <p className="mt-3 text-xs text-white/35">{files.length ? `${files.length} fájl kiválasztva` : "Még nincs feltöltött média"} · {status}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-white/10 p-2"><Play className="h-4 w-4" /></div><div><h2 className="font-medium">Filmes ív</h2><p className="text-xs text-white/40">12 fejezet, folyamatos történet</p></div></div>
            <div className="space-y-2">
              {chapters.map(([n, title, desc]) => <div key={n} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3"><span className="w-7 shrink-0 pt-0.5 text-[10px] font-semibold tracking-widest text-white/25">{n}</span><div><div className="text-sm text-white/85">{title}</div><div className="mt-0.5 text-xs text-white/35">{desc}</div></div></div>)}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            [ShieldCheck, "Privacy first", "Rendszámok, dokumentumok és érzékeny adatok maszkolhatók."],
            [Sparkles, "AI B-roll", "A hiányzó jövőbeli jelenetek külön AI-videóként generálhatók."],
            [Film, "Render pipeline", "Storyboard → hang → jelenetek → timeline → YouTube export."],
          ].map(([Icon, title, desc]) => { const I = Icon as typeof ShieldCheck; return <div key={title as string} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><I className="mb-3 h-5 w-5 text-white/45" /><div className="text-sm font-medium">{title as string}</div><p className="mt-1 text-xs leading-5 text-white/35">{desc as string}</p></div>; })}
        </section>
      </div>
    </main>
  );
}
