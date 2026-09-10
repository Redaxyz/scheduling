import { prisma } from "@/lib/prisma";
import TemplateEditor from "@/components/TemplateEditor";

// No dynamic segment here, so without this Next.js would prerender it once
// at build time and freeze the provider/template list from that build.
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const providers = await prisma.provider.findMany({
    where: { active: true },
    include: { scheduleSlots: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Doctor weekly templates</h1>
        <p className="text-sm font-bold opacity-50">
          The recurring weekly schedule each doctor normally follows. Use the Schedule tab to mark one-off days off.
        </p>
      </div>
      <TemplateEditor
        providers={providers.map((p) => ({
          id: p.id,
          name: p.name,
          slots: p.scheduleSlots.map((s) => ({ weekday: s.weekday, half: s.half, office: s.office, surgery: s.surgery })),
        }))}
      />
    </div>
  );
}
