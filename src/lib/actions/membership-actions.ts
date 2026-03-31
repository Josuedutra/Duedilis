"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ProjectRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Org Invite ────────────────────────────────────────────────────────────

const InviteSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum([
    "ADMIN_ORG",
    "GESTOR_PROJETO",
    "FISCAL",
    "TECNICO",
    "AUDITOR",
    "OBSERVADOR",
  ]),
});

export type InviteFormState = {
  errors?: { email?: string[]; role?: string[] };
  message?: string;
  inviteLink?: string;
};

export async function inviteOrgMember(
  _prevState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const raw = {
    email: (formData.get("email") as string)?.toLowerCase().trim(),
    role: formData.get("role") as string,
  };

  const parsed = InviteSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { email, role } = parsed.data;

  // Require ADMIN_ORG
  const membership = await prisma.orgMembership.findFirst({
    where: { userId: session.user.id, role: "ADMIN_ORG" },
    select: { orgId: true },
  });

  if (!membership) {
    return { message: "Apenas ADMIN_ORG pode convidar membros." };
  }

  const { orgId } = membership;

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    const alreadyMember = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId } },
    });
    if (alreadyMember) {
      return { message: "Este utilizador já é membro da organização." };
    }
  }

  // Upsert invite (update if exists + not accepted)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const existingInvite = await prisma.orgInvite.findUnique({
    where: { orgId_email: { orgId, email } },
  });

  let token: string;

  if (existingInvite && !existingInvite.acceptedAt) {
    // Refresh token
    const updated = await prisma.orgInvite.update({
      where: { id: existingInvite.id },
      data: { role, expiresAt, invitedBy: session.user.id },
      select: { token: true },
    });
    token = updated.token;
  } else if (!existingInvite) {
    const created = await prisma.orgInvite.create({
      data: {
        orgId,
        email,
        role,
        invitedBy: session.user.id,
        expiresAt,
      },
      select: { token: true },
    });
    token = created.token;
  } else {
    return { message: "Convite já foi aceite por este utilizador." };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteLink = `${baseUrl}/invite/${token}`;

  revalidatePath("/members");

  return { inviteLink };
}

// ─── Accept Invite ──────────────────────────────────────────────────────────

export async function acceptInvite(
  token: string,
): Promise<{ error?: string; orgId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "not_authenticated" };

  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });

  if (!invite) return { error: "Convite não encontrado." };
  if (invite.acceptedAt) return { error: "Este convite já foi utilizado." };
  if (invite.expiresAt < new Date()) return { error: "Este convite expirou." };

  // Verify email matches (optional guard)
  if (session.user.email && invite.email !== session.user.email.toLowerCase()) {
    return {
      error: `Este convite é para ${invite.email}. Estás com sessão iniciada como ${session.user.email}.`,
    };
  }

  // Create membership
  await prisma.$transaction([
    prisma.orgMembership.upsert({
      where: {
        userId_orgId: { userId: session.user.id, orgId: invite.orgId },
      },
      create: {
        userId: session.user.id,
        orgId: invite.orgId,
        role: invite.role,
      },
      update: { role: invite.role },
    }),
    prisma.orgInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return { orgId: invite.orgId };
}

// ─── Add Project Member ─────────────────────────────────────────────────────

export async function addProjectMember({
  projectId,
  userId,
  role,
}: {
  projectId: string;
  userId: string;
  role: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado." };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });

  if (!project) return { error: "Projeto não encontrado." };

  // Require ADMIN_ORG or GESTOR_PROJETO
  const myMembership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: { userId: session.user.id, orgId: project.orgId },
    },
    select: { role: true },
  });

  if (
    !myMembership ||
    !["ADMIN_ORG", "GESTOR_PROJETO"].includes(myMembership.role)
  ) {
    return { error: "Sem permissão para adicionar membros." };
  }

  // Verify target user is org member
  const targetOrgMember = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId: project.orgId } },
  });

  if (!targetOrgMember) {
    return { error: "O utilizador não é membro desta organização." };
  }

  const validRoles: string[] = Object.values(ProjectRole);
  if (!validRoles.includes(role)) return { error: "Role inválido." };

  const projectRole = role as ProjectRole;

  await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId, orgId: project.orgId, role: projectRole },
    update: { role: projectRole },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
}

// ─── Remove Org Member ──────────────────────────────────────────────────────

export async function removeOrgMember(targetUserId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const myMembership = await prisma.orgMembership.findFirst({
    where: { userId: session.user.id, role: "ADMIN_ORG" },
    select: { orgId: true },
  });

  if (!myMembership) throw new Error("Sem permissão.");

  if (targetUserId === session.user.id) {
    throw new Error("Não pode remover-se a si próprio.");
  }

  await prisma.orgMembership.deleteMany({
    where: { userId: targetUserId, orgId: myMembership.orgId },
  });

  revalidatePath("/members");
}
