import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const onboardingSchema = z.object({
  name: z.string().min(2, "Nome da organização obrigatório"),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens",
    ),
});

async function createOrgAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const raw = {
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
  };

  const result = onboardingSchema.safeParse(raw);
  if (!result.success) {
    redirect("/onboarding?error=validation");
  }

  const { name, slug } = result.data;

  const existingSlug = await prisma.organization.findUnique({
    where: { slug },
  });
  if (existingSlug) {
    redirect("/onboarding?error=slug_taken");
  }

  const org = await prisma.organization.create({
    data: { name, slug },
  });

  await prisma.orgMembership.create({
    data: {
      userId: session.user.id,
      orgId: org.id,
      role: "ADMIN_ORG",
    },
  });

  redirect("/dashboard");
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // If user already has an org, redirect to dashboard
  const membership = await prisma.orgMembership.findFirst({
    where: { userId: session.user.id },
  });
  if (membership) redirect("/dashboard");

  const params = await searchParams;
  const errorMsg =
    params.error === "slug_taken"
      ? "Este identificador já está em uso. Escolha outro."
      : params.error === "validation"
        ? "Dados inválidos. Verifique os campos."
        : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Criar organização
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure a sua organização para começar a usar o Duedilis.
          </p>
        </div>
        {errorMsg && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}
        <form action={createOrgAction} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Nome da organização
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              placeholder="Ex: Construtora ABC"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-gray-700"
            >
              Identificador único
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              minLength={2}
              maxLength={50}
              pattern="[a-z0-9-]+"
              placeholder="Ex: construtora-abc"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-mono"
            />
            <p className="mt-1 text-xs text-gray-500">
              Apenas letras minúsculas, números e hífens.
            </p>
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            Criar organização
          </button>
        </form>
      </div>
    </div>
  );
}
