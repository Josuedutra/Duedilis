"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setSentryContext } from "@/lib/sentry-context";

const ALLOWED_ROLES = ["ADMIN_ORG", "GESTOR_PROJETO"] as const;

async function requireOrgRole(orgId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });

  if (
    !membership ||
    !(ALLOWED_ROLES as readonly string[]).includes(membership.role)
  ) {
    throw new Error("Sem permissão para esta operação");
  }

  setSentryContext({ orgId, userId: session.user.id });

  return { userId: session.user.id, role: membership.role };
}

const ProjectSchema = z.object({
  orgId: z.string().min(1, "Organização obrigatória"),
  name: z.string().min(1, "Nome obrigatório").max(100),
  slug: z
    .string()
    .min(1, "Slug obrigatório")
    .max(60)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug só pode conter letras minúsculas, números e hífens",
    ),
  description: z.string().max(500).optional(),
  address: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ProjectFormState = {
  errors?: Partial<Record<keyof z.infer<typeof ProjectSchema>, string[]>>;
  message?: string;
};

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const raw = {
    orgId: formData.get("orgId") as string,
    name: formData.get("name") as string,
    slug: (formData.get("slug") as string)?.toLowerCase().trim(),
    description: (formData.get("description") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  };

  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { orgId, name, slug, description, address, startDate, endDate } =
    parsed.data;

  try {
    const { userId } = await requireOrgRole(orgId);

    // Check slug uniqueness within org
    const existing = await prisma.project.findUnique({
      where: { orgId_slug: { orgId, slug } },
    });
    if (existing) {
      return {
        errors: {
          slug: ["Já existe um projeto com este slug nesta organização"],
        },
      };
    }

    const project = await prisma.project.create({
      data: {
        orgId,
        name,
        slug,
        description,
        address,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        memberships: {
          create: { userId, orgId, role: "GESTOR_PROJETO" },
        },
      },
    });

    revalidatePath("/projects");
    redirect(`/projects/${project.id}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Sem permissão para esta operação"
    ) {
      return { message: error.message };
    }
    // redirect() throws — let it propagate
    throw error;
  }
}

export async function updateProject(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) return { message: "Projeto não encontrado" };

  const raw = {
    orgId: project.orgId,
    name: formData.get("name") as string,
    slug: (formData.get("slug") as string)?.toLowerCase().trim(),
    description: (formData.get("description") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  };

  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { orgId, name, slug, description, address, startDate, endDate } =
    parsed.data;

  try {
    await requireOrgRole(orgId);

    // Check slug uniqueness — allow same slug for same project
    const existing = await prisma.project.findFirst({
      where: { orgId, slug, NOT: { id: projectId } },
    });
    if (existing) {
      return {
        errors: {
          slug: ["Já existe um projeto com este slug nesta organização"],
        },
      };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        name,
        slug,
        description,
        address,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    redirect(`/projects/${projectId}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Sem permissão para esta operação"
    ) {
      return { message: error.message };
    }
    throw error;
  }
}

export async function archiveProject(projectId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new Error("Projeto não encontrado");

  await requireOrgRole(project.orgId);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "CANCELADO" },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect("/projects");
}
