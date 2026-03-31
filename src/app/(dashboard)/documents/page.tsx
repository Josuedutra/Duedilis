import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Documentos</h1>
      <p className="text-gray-500">CDE — Common Data Environment — Sprint D3</p>
    </main>
  );
}
