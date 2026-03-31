import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function IssuesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Issues</h1>
      <p className="text-gray-500">Módulo de Issues — Sprint D2</p>
    </main>
  );
}
